import {test,before,after,describe} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {setImmediate as turn} from 'node:timers/promises';
import net from 'node:net';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {AuditLog,requestMetadata,difference,csvCell,sanitize} from '@loft-studio/audit';
import {createApp} from '../../src/server.mjs';
import {passwordHash} from '../../src/auth.mjs';

function fixture(){const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE items(id TEXT PRIMARY KEY,site_id TEXT,content TEXT,password TEXT);');
  const log=new AuditLog({db});log.track({table:'items',scope:a=>"'site:'||"+a+'.site_id'});return{db,log};}
test('L01: standalone changes contain before/after; rollback and log failure prevent phantom commits',()=>{
  const {db,log}=fixture();try{
    log.withContext({actorId:'alice',actorType:'human',requestId:'request-1',ip:'192.0.2.1'},()=>{
      db.prepare('INSERT INTO items VALUES (?,?,?,?)').run('one','a','{"name":"old","apiKey":"never-save-key"}','never-save-password');
      db.prepare('UPDATE items SET content=?,password=? WHERE id=?').run('{"name":"new","apiKey":"new-secret-key"}','second-password','one');
    });
    const rows=log.query('site:a').entries;assert.equal(rows.length,2);
    assert.deepEqual(rows[0].values.changes.find(v=>v.path==='/content/name'),{path:'/content/name',before:'old',after:'new'});
    assert.equal(rows[0].actorId,'alice');assert.equal(rows[0].requestId,'request-1');assert.equal(rows[0].ip,'192.0.2.1');
    assert.ok(rows[0].values.changes.some(v=>v.path==='/password'&&v.before==='[MASKED]'&&v.after==='[MASKED]'));
    assert.doesNotMatch(JSON.stringify(rows),/never-save-key|never-save-password|new-secret-key|second-password/);
    db.exec('BEGIN');db.exec("UPDATE items SET content='rollback' WHERE id='one'");db.exec('ROLLBACK');
    assert.equal(log.query('site:a').entries.length,2);
    db.exec("CREATE TEMP TRIGGER blocked_audit BEFORE INSERT ON studio_log_entries BEGIN SELECT RAISE(ABORT,'disk unavailable'); END;");
    assert.throws(()=>db.exec("UPDATE items SET content='must-not-commit' WHERE id='one'"),/disk unavailable/);
    assert.match(db.prepare('SELECT content FROM items').get().content,/new/);
    db.exec('DROP TRIGGER blocked_audit');
    assert.throws(()=>db.exec('DELETE FROM studio_log_entries'),/append-only/);
    assert.throws(()=>db.exec("UPDATE studio_log_entries SET actor_id='forged'"),/append-only/);
  }finally{db.close();}
});
test('L02: concurrent asynchronous operations keep separate authenticated identities',async()=>{
  const {db,log}=fixture();try{
    await Promise.all(['alice','bob'].map(id=>log.withContext({actorId:id,actorType:'human',requestId:id,scope:'site:'+id},async()=>{
      await turn();db.prepare('INSERT INTO items VALUES (?,?,?,?)').run(id,id,'{}','masked');await turn();log.record({action:'completed'});
    })));
    for(const id of ['alice','bob'])for(const entry of log.query('site:'+id).entries){assert.equal(entry.actorId,id);assert.equal(entry.requestId,id);}
  }finally{db.close();}
});
test('L03: source IP requires explicit trusted proxies; metadata excludes query credentials',()=>{
  const req={method:'GET',url:'/api/status?token=never-query',socket:{remoteAddress:'::ffff:127.0.0.1'},headers:{'x-forwarded-for':'6.6.6.6, 198.51.100.8, 10.0.0.2','user-agent':'Mozilla Windows Chrome/125\r\nforged','accept-language':'tr-TR'}};
  assert.equal(requestMetadata(req).ip,'127.0.0.1');
  const meta=requestMetadata(req,['127.0.0.1','10.0.0.2']);assert.equal(meta.ip,'198.51.100.8');assert.equal(meta.peerIp,'127.0.0.1');assert.equal(meta.ipSource,'trusted-proxy');
  assert.equal(meta.device.os,'Windows');assert.equal(meta.device.browser,'Chrome');assert.doesNotMatch(JSON.stringify(meta),/never-query|\\r|\\n/);
  req.headers['x-forwarded-for']='invalid';assert.equal(requestMetadata(req,['127.0.0.1']).ip,'127.0.0.1');
});
test('L04: bounded values label omissions; CSV protects formula cells; filters and snapshot pagination are strict',()=>{
  const changes=difference({password:'a',source:'old-code',name:'old'},{password:'b',source:'private-code',name:'x'.repeat(5000)});
  assert.equal(changes.changes.find(c=>c.path==='/password').after,'[MASKED]');
  assert.equal(changes.changes.find(c=>c.path==='/name').after.omitted,true);assert.doesNotMatch(JSON.stringify(changes),/private-code/);
  for(const text of ['=SUM(1,1)',' +SUM(1,1)','@cmd','\tbad'])assert.ok(csvCell(text).startsWith('"\''));
  const {db,log}=fixture();try{
    for(let n=0;n<5;n++)log.record({scope:'site:a',action:'entry-'+n});
    const first=log.query('site:a',{},2);log.record({scope:'site:a',action:'newer'});
    const second=log.query('site:a',{before:first.nextCursor,asOf:first.asOf},2);
    assert.deepEqual([...first.entries,...second.entries].map(e=>e.action),['entry-4','entry-3','entry-2','entry-1']);
    for(const filters of [{ip:'invalid'},{status:'999'},{kind:'anything'},{before:'1 OR 1=1'},{from:'yesterday'},{from:'2026-02-01T00:00:00Z',to:'2026-01-01T00:00:00Z'},{extra:'x'}])assert.throws(()=>log.query('site:a',filters),e=>e.status===422);
  }finally{db.close();}
});
test('L09: history survives restart; every writer reconnects connection-local capture explicitly',async()=>{
  const directory=await fs.mkdtemp(path.resolve('test-results','audit-restart-')),file=path.join(directory,'audit.sqlite');
  let db=new DatabaseSync(file);db.exec('CREATE TABLE items(id TEXT PRIMARY KEY,site_id TEXT,content TEXT,password TEXT)');
  let log=new AuditLog({db});log.track({table:'items',scope:a=>"'site:'||"+a+'.site_id'});db.exec("INSERT INTO items VALUES ('one','a','old','sensitive')");db.close();
  db=new DatabaseSync(file);try{log=new AuditLog({db});assert.equal(log.query('site:a').entries.length,1);log.track({table:'items',scope:a=>"'site:'||"+a+'.site_id'});db.exec("UPDATE items SET content='new' WHERE id='one'");assert.equal(log.query('site:a').entries.length,2);assert.equal(db.prepare('SELECT COUNT(*) n FROM studio_log_migrations').get().n,1);db.exec("INSERT INTO studio_log_migrations VALUES (2,'future')");assert.throws(()=>new AuditLog({db}),/schema is newer/);}finally{db.close();}
});
test('L14: large objects explicitly report omissions and invalid calendar dates are rejected',()=>{
  const value=Object.fromEntries(Array.from({length:301},(_,i)=>['field'+i,i]));
  const safe=sanitize(value);assert.equal(safe.omitted,true);assert.equal(safe.total,301);assert.equal(Object.keys(safe.value).length,300);
  const {db,log}=fixture();try{
    for(const from of ['2026-02-30T12:00:00Z','2026-04-31T12:00:00+03:00','2026-11-11T99:00:00Z','2026-11-11T12:00:00'])assert.throws(()=>log.query('site:a',{from}),e=>e.status===422);
    assert.deepEqual(log.query('site:a',{from:'2026-11-11T12:00:00+03:00'}).entries,[]);
  }finally{db.close();}
});

const root=path.resolve(import.meta.dirname,'../..'),password='Audit-fixture-password-2026!';
async function freePort(){const server=net.createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;await new Promise(r=>server.close(r));return port;}
function client(origin){let cookie='',csrf='';return async(route,method='GET',input,headers={})=>{
  const res=await fetch(origin+route,{method,headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json','X-CSRF-Token':csrf,...headers},...(input===undefined?{}:{body:JSON.stringify(input)})});
  if(res.headers.get('set-cookie'))cookie=res.headers.get('set-cookie').split(';')[0];const raw=await res.text();let data;try{data=JSON.parse(raw);}catch{data=raw;}
  if(data.csrf)csrf=data.csrf;return{status:res.status,data,raw,headers:res.headers};
};}
describe('Audit HTTP integration',()=>{
  let app,admin,reader,outsider,origin,site,owner;
  before(async()=>{
    origin='http://127.0.0.1:'+await freePort();app=await createApp({projectRoot:root,dataDir:path.join(root,'test-results','audit-'+randomUUID()),origin});
    await new Promise(r=>app.server.listen(Number(new URL(origin).port),'127.0.0.1',r));admin=client(origin);reader=client(origin);outsider=client(origin);
    const setup=await admin('/api/setup','POST',{token:app.setupToken,email:'operator@audit.test',password});assert.equal(setup.status,201,setup.raw);owner=setup.data.user.id;
    for(const id of ['reader','outsider']){app.store.run('INSERT INTO users VALUES (?,?,?,?)',id,id+'@audit.test',await passwordHash(password),new Date().toISOString());}
    await reader('/api/login','POST',{email:'reader@audit.test',password});await outsider('/api/login','POST',{email:'outsider@audit.test',password});
    const org=randomUUID(),workspace=randomUUID(),project=randomUUID();site=randomUUID();
    app.store.run('INSERT INTO studio_orgs VALUES (?,?,?)',org,'Audit fixture',owner);
    app.store.run('INSERT INTO studio_workspaces VALUES (?,?,?)',workspace,org,'Workspace');
    app.store.run('INSERT INTO studio_projects VALUES (?,?,?)',project,workspace,'Project');
    app.store.run('INSERT INTO studio_sites VALUES (?,?,?,?,?,?,?,?,?,?,?)',site,org,workspace,project,'development','static-html','Audit fixture',0,'{"pages":[]}','{}',new Date().toISOString());
    app.store.run('INSERT INTO studio_members VALUES (?,?,?)',site,'reader','["audit"]');
  });
  after(async()=>{await app?.close();});
  test('L05: real HTTP writes log old/new, time, verified user, IP and request identity',async()=>{
    const before=await admin('/api/sites/loft/structure');const values=structuredClone(before.data.values);values.menu.mode=values.menu.mode==='mega'?'standard':'mega';
    const saved=await admin('/api/sites/loft/structure','PUT',{revision:before.data.revision,values,note:'Audit fixture change',actorType:'ai'},{'X-Forwarded-For':'203.0.113.88','User-Agent':'Mozilla Windows Chrome/125'});
    assert.equal(saved.status,200,saved.raw);const requestId=saved.headers.get('x-request-id');assert.match(requestId,/^[a-f0-9-]{36}$/);
    const result=await admin('/api/audit/events?scope=site:loft&requestId='+requestId);assert.equal(result.status,200,result.raw);
    const entry=result.data.entries.find(e=>e.action==='structures.update');assert.ok(entry);assert.equal(entry.actorId,owner);assert.equal(entry.actorType,'human');assert.equal(entry.ip,'127.0.0.1');assert.equal(entry.device.os,'Windows');
    assert.ok(entry.values.changes.some(c=>c.path==='/content/menu/mode'&&c.before!==c.after));
    assert.ok(result.data.entries.some(e=>e.action==='request.completed'&&e.status===200));
    const rejected=await admin('/api/sites/loft/structure','PUT',{revision:before.data.revision,values,note:'Stale revision'});assert.equal(rejected.status,409);
    const rejectedLogs=(await admin('/api/audit/events?scope=site:loft&requestId='+rejected.headers.get('x-request-id'))).data.entries;
    assert.ok(rejectedLogs.some(e=>e.status===409));assert.ok(!rejectedLogs.some(e=>e.action==='structures.update'));
  });
  test('L06: failed auth, reads, static resources and not-found requests are recorded without credentials',async()=>{
    const anon=client(origin),failed=await anon('/api/login','POST',{email:'operator@audit.test',password:'never-persist-this-password'});assert.equal(failed.status,401);
    const requestId=failed.headers.get('x-request-id');
    const log=(await admin('/api/audit/events?scope=*&requestId='+requestId)).data;
    assert.ok(log.entries.some(e=>e.status===401&&e.actorType==='anonymous'));assert.doesNotMatch(JSON.stringify(log),/never-persist-this-password/);
    for(const url of ['/v2/','/not-found?token=never-query-secret']){
      const r=await anon(url);const records=(await admin('/api/audit/events?scope=*&requestId='+r.headers.get('x-request-id'))).data.entries;
      assert.ok(records.some(e=>e.action==='request.completed'&&e.status===r.status));assert.doesNotMatch(JSON.stringify(records),/never-query-secret/);
    }
    assert.equal((await anon('/api/audit/scopes')).status,401);
  });
  test('L07: site boundaries and separate export permission are enforced server-side',async()=>{
    assert.equal((await reader('/api/audit/events?scope=site:'+site)).status,200);
    assert.equal((await reader('/api/audit/export?scope=site:'+site)).status,403);
    assert.equal((await reader('/api/audit/events?scope=*')).status,403);
    assert.equal((await outsider('/api/audit/events?scope=site:'+site)).status,404);
    assert.equal((await outsider('/api/audit/events?scope=account:'+owner)).status,403);
    app.store.run('UPDATE studio_members SET permissions=? WHERE site_id=? AND user_id=?','[]',site,'reader');
    assert.equal((await reader('/api/audit/events?scope=site:'+site)).status,403);
    app.store.run('UPDATE studio_members SET permissions=? WHERE site_id=? AND user_id=?','["audit","auditExport"]',site,'reader');
    assert.equal((await reader('/api/audit/export?scope=site:'+site)).status,200);
  });
  test('L08: full filtered JSON/CSV export spans pages, has no secrets and logs access/export',async()=>{
    app.audit.log.withContext({actorId:'fixture',actorType:'system',actorLabel:'=HYPERLINK("bad")'},()=>{
      for(let n=0;n<245;n++)app.audit.log.record({scope:'site:'+site,action:'fixture.export',detail:{n,password:'secret-in-detail'}});
    });
    const base='/api/audit/export?scope=site:'+site+'&action=fixture.export';
    const json=await admin(base+'&format=json');assert.equal(json.status,200);assert.equal(json.data.complete,true);assert.equal(json.data.count,245);assert.equal(new Set(json.data.entries.map(e=>e.id)).size,245);assert.doesNotMatch(json.raw,/secret-in-detail/);
    const csv=await admin(base+'&format=csv');assert.equal(csv.status,200);assert.match(csv.headers.get('content-disposition'),/studio-audit.csv/);assert.equal(csv.raw.trim().split('\r\n').length,246);assert.ok(csv.raw.includes('"\'=HYPERLINK'));
    const history=await admin('/api/audit/events?scope=site:'+site+'&action=audit.export.completed');assert.ok(history.data.entries.some(e=>e.detail.count===245));
    assert.equal((await admin('/api/audit/events?scope=*&status=999')).status,422);
    assert.equal((await admin('/api/audit/events?scope=*','DELETE')).status,405);
  });
  test('L10: disconnected in-flight requests produce an aborted record',async()=>{
    const received=new Promise(resolve=>app.server.once('request',(req,res)=>resolve({req,res})));
    const outgoing=http.request(origin+'/api/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','Content-Length':'1000'}});
    outgoing.on('error',()=>{});outgoing.write('{');const {res}=await received;
    const closed=new Promise(resolve=>res.once('close',resolve));const id=res.getHeader('X-Request-ID');outgoing.destroy();await closed;
    const entries=app.audit.log.query('*',{requestId:id}).entries;
    assert.equal(entries.filter(e=>e.action==='request.aborted'&&e.status===499).length,1);
  });
  test('L11: permission revocation during a multi-page export terminates the file and is audited',async()=>{
    const original=app.audit.log.query.bind(app.audit.log);let pages=0;
    app.audit.log.query=(scope,filters,limit)=>{if(filters?.action==='fixture.export'&&++pages===2)app.store.run('UPDATE studio_members SET permissions=? WHERE site_id=? AND user_id=?','["audit"]',site,'reader');return original(scope,filters,limit);};
    try{await assert.rejects(reader('/api/audit/export?scope=site:'+site+'&action=fixture.export&format=json'),/terminated|fetch|aborted/i);}
    finally{app.audit.log.query=original;app.store.run('UPDATE studio_members SET permissions=? WHERE site_id=? AND user_id=?','["audit","auditExport"]',site,'reader');}
    assert.ok(original('site:'+site,{action:'audit.export.failed'}).entries.length>0);
  });
  test('L12: payment/provider secrets never enter the log; financial changes keep their resource ID',async()=>{
    const id=randomUUID(),payment=randomUUID(),now=new Date().toISOString();
    const row={id,site_id:'loft',revision:0,reference:'AUDIT-FIXTURE',service_id:'fixture',resource:'fixture',start:1,end:2,busy_start:1,busy_end:2,quantity:1,status:'pending',hold_until:null,price_minor:100,currency:'TRY',customer:'{"name":"Fixture"}',pets:'[]',notes:'',token_hash:'never-booking-token-hash',created:now,updated:now};
    await app.features.repository.scope('loft',async()=>{
     await app.features.repository.run('INSERT INTO reservations ('+Object.keys(row).join(',')+') VALUES ('+Object.keys(row).map(()=>'?').join(',')+')',...Object.values(row));
     await app.features.repository.run('INSERT INTO payment_transactions VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',payment,'loft',id,'iyzico','never-checkout-token','https://pay.example/?token=never-checkout-token',100,'TRY','created',now,now,'{"providerToken":"never-provider-token"}');
     await app.features.repository.run("UPDATE payment_transactions SET status='paid' WHERE id=?",payment);
    });await app.platform.flushAudit();
    const entries=app.audit.log.query('site:loft',{action:'payment_transactions.update'}).entries;
    assert.ok(entries[0].resource.includes(payment));assert.ok(entries[0].values.changes.some(c=>c.path==='/status'&&c.before==='created'&&c.after==='paid'));
    assert.doesNotMatch(JSON.stringify(app.audit.log.query('site:loft').entries),/never-booking-token-hash|never-checkout-token|never-provider-token/);
  });
  test('L13: AI identity comes from a verified credential; bearer material is excluded',async()=>{
    const token='studio_agent_'+randomBytes(32).toString('base64url'),id=randomUUID(),hash=createHash('sha256').update(token).digest('hex');
    app.store.run('INSERT INTO studio_agent_tokens VALUES (?,?,?,?,?,?,?,?)',id,site,owner,hash,'Audit fixture',new Date().toISOString(),Date.now()+60000,0);
    const request=await client(origin)('/api/v2/agent/sites/'+site+'/document','GET',undefined,{Authorization:'Bearer '+token});assert.equal(request.status,200,request.raw);
    const result=app.audit.log.query('site:'+site,{requestId:request.headers.get('x-request-id')}).entries;
    assert.ok(result.some(e=>e.action==='request.completed'&&e.actorType==='ai'&&e.actorId===owner));assert.doesNotMatch(JSON.stringify(result),new RegExp(token+'|'+hash));
  });
});
