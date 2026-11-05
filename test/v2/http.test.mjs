import {describe,test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import {randomUUID} from 'node:crypto';
import {createApp} from '../../src/server.mjs';
import {passwordHash} from '../../src/auth.mjs';
import {readZip} from '../../src/v2/import.ts';
const root=path.resolve(import.meta.dirname,'../..'),password='V2-test-password-2026!';
async function freePort(){const s=net.createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const p=s.address().port;await new Promise(r=>s.close(r));return p;}
function client(origin){let cookie='',csrf='';return async(route,method='GET',input,headers={})=>{const res=await fetch(origin+route,{method,headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json','X-CSRF-Token':csrf,...headers},...(input===undefined?{}:{body:JSON.stringify(input)})});if(res.headers.get('set-cookie'))cookie=res.headers.get('set-cookie').split(';')[0];const bytes=Buffer.from(await res.arrayBuffer());let data;try{data=JSON.parse(bytes);}catch{data=bytes;}if(data.csrf)csrf=data.csrf;return{status:res.status,data,bytes,headers:res.headers};};}
describe('V2 HTTP and persistence contract',()=>{
 let app,admin,editor,outsider,org,site,origin,remoteBehavior=async()=>{throw Error('Unexpected remote request');};
 before(async()=>{origin='http://127.0.0.1:'+await freePort();app=await createApp({projectRoot:root,dataDir:path.join(root,'test-results','v2-'+Date.now()),origin,security:{studioTransport:(...args)=>remoteBehavior(...args)}});await new Promise(r=>app.server.listen(Number(new URL(origin).port),'127.0.0.1',r));admin=client(origin);editor=client(origin);outsider=client(origin);const setup=await admin('/api/setup','POST',{token:app.setupToken,email:'admin@v2.test',password});assert.equal(setup.status,201,JSON.stringify(setup.data));for(const [id,email]of [['editor','editor@v2.test'],['outside','outside@v2.test']])app.store.run('INSERT INTO users VALUES (?,?,?,?)',id,email,await passwordHash(password),new Date().toISOString());await editor('/api/login','POST',{email:'editor@v2.test',password});await outsider('/api/login','POST',{email:'outside@v2.test',password});});
 after(async()=>{await app?.close();});
 test('existing legacy site remains accessible and V2 auth is mandatory',async()=>{
  const anon=client(origin);assert.equal((await anon('/api/v2/workspace')).status,401);
  const workspace=await admin('/api/v2/workspace');assert.equal(workspace.status,200);org=workspace.data.organizations[0].id;assert.equal(workspace.data.legacy.id,'loft');
  assert.equal((await admin('/api/sites/loft/documents/tr')).status,200);
 });
 test('import quarantine reports, idempotency and commit produce one scoped site',async()=>{
  const input={kind:'example',example:'static',requestId:randomUUID(),orgId:org};
  const first=await admin('/api/v2/imports','POST',input);assert.equal(first.status,202,JSON.stringify(first.data));
  const again=await admin('/api/v2/imports','POST',input);assert.equal(again.data.id,first.data.id);
  assert.equal((await admin('/api/v2/imports','POST',{...input,name:'Changed'})).status,409);
  let review;for(let i=0;i<100;i++){review=await admin('/api/v2/imports/'+first.data.id);if(!['queued','analyzing'].includes(review.data.status))break;await new Promise(r=>setTimeout(r,10));}
  assert.equal(review.data.status,'review',JSON.stringify(review.data));assert.ok(review.data.report.accepted.length);
  assert.equal((await outsider('/api/v2/imports/'+first.data.id)).status,404);
  const commit=await admin('/api/v2/imports/'+first.data.id+'/commit','POST',{});assert.equal(commit.status,201,JSON.stringify(commit.data));site=commit.data.siteId;
  assert.equal((await admin('/api/v2/imports/'+first.data.id+'/commit','POST',{})).data.siteId,site);
  assert.equal((await admin('/api/v2/workspace')).data.sites.length,1);
 });
 test('cross-tenant document, preview, history, release and media reads are denied',async()=>{
  for(const suffix of ['','/preview','/history','/source?path=index.html','/members','/audit'])assert.equal((await outsider('/api/v2/sites/'+site+suffix)).status,404,suffix);
  assert.equal((await outsider('/api/v2/imports','POST',{kind:'example',example:'static',requestId:randomUUID(),orgId:org})).status,404);
 });
 test('content-only member cannot change layout, publish, import or grant membership',async()=>{
  assert.equal((await admin('/api/v2/sites/'+site+'/members','PUT',{email:'editor@v2.test',permissions:['content']})).status,200);
  const loaded=(await editor('/api/v2/sites/'+site)).data,doc=structuredClone(loaded.document);doc.pages[0].sections.reverse();
  assert.equal((await editor('/api/v2/sites/'+site+'/document','PUT',{revision:loaded.revision,document:doc})).status,403);
  for(const suffix of ['releases','publish','members'])assert.equal((await editor('/api/v2/sites/'+site+'/'+suffix,suffix==='members'?'PUT':'POST',{revision:loaded.revision,email:'outside@v2.test',permissions:['publish']})).status,403);
 });
 test('concurrent saves reject stale revision and record AI provenance',async()=>{
  const loaded=(await admin('/api/v2/sites/'+site)).data,one=structuredClone(loaded.document),two=structuredClone(loaded.document);one.pages[0].sections[0].fields[0].value='First write';two.pages[0].sections[0].fields[0].value='Second write';
  const results=await Promise.all([admin('/api/v2/sites/'+site+'/document','PUT',{revision:loaded.revision,document:one,actorType:'ai'}),admin('/api/v2/sites/'+site+'/document','PUT',{revision:loaded.revision,document:two})]);
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  const doc=(await admin('/api/v2/sites/'+site)).data;assert.equal(doc.revision,1);assert.equal(doc.document.pages[0].sections[0].fields[0].value,'First write');
  assert.equal((await admin('/api/v2/sites/'+site+'/history')).data.versions[0].actor_type,'ai');
  const source=(await admin('/api/v2/sites/'+site+'/source?path=index.html')).data;assert.match(source.text,/First write/);assert.match(source.text,/window.examplePreserved/);
 });
 test('same field validation rejects manual and AI XSS; requests require CSRF',async()=>{
  const loaded=(await admin('/api/v2/sites/'+site)).data,doc=structuredClone(loaded.document);doc.pages[0].sections[0].fields[0].value='<img src=x onerror="alert(1)">';
  for(const actorType of ['human','ai'])assert.equal((await admin('/api/v2/sites/'+site+'/document','PUT',{revision:loaded.revision,document:doc,actorType})).status,422);
  assert.equal((await admin('/api/v2/sites/'+site+'/document','PUT',{revision:loaded.revision,document:loaded.document},{'X-CSRF-Token':'wrong'})).status,403);
 });
 test('release remains immutable and content restore does not touch booking tables',async()=>{
  const loaded=(await admin('/api/v2/sites/'+site)).data,bookingBefore=app.store.all('SELECT name FROM sqlite_master WHERE type=\'table\' AND name LIKE \'booking%\'').map(t=>[t.name,app.store.all('SELECT * FROM '+t.name)]);
  const release=await admin('/api/v2/sites/'+site+'/releases','POST',{revision:loaded.revision});assert.equal(release.status,201);
  const zip=await admin(release.data.url);assert.equal(zip.status,200);assert.match(readZip(zip.bytes)['index.html'].toString(),/First write/);
  assert.equal((await outsider(release.data.url)).status,404);
  assert.equal((await admin('/api/v2/sites/'+site+'/restore','POST',{revision:loaded.revision,target:0})).status,200);
  assert.match(readZip((await admin(release.data.url)).bytes)['index.html'].toString(),/First write/);
  const after=app.store.all('SELECT name FROM sqlite_master WHERE type=\'table\' AND name LIKE \'booking%\'').map(t=>[t.name,app.store.all('SELECT * FROM '+t.name)]);assert.deepEqual(after,bookingBefore);
 });
 test('member removal takes effect immediately',async()=>{assert.equal((await admin('/api/v2/sites/'+site+'/members','DELETE',{userId:'editor'})).status,200);assert.equal((await editor('/api/v2/sites/'+site)).status,404);});
 test('generic booking modules share atomic capacity logic without pet requirements or cross-site access',async()=>{
  const prefix='/api/v2/sites/'+site+'/modules';
  assert.equal((await admin(prefix+'/enable','POST',{})).status,200);
  assert.equal((await outsider(prefix+'/booking-settings')).status,404);
  const config=(await admin(prefix+'/booking-settings')).data;assert.equal(config.values.participantMode,'generic');
  config.values.services[1].enabled=true;config.values.services[1].weekdays=[0,1,2,3,4,5,6];config.values.services[1].minNoticeHours=0;config.values.publicEnabled=true;
  assert.equal((await admin(prefix+'/booking-settings','PUT',config)).status,200);
  const day=new Date(Date.now()+7*86400000).toISOString().slice(0,10);
  const input={requestId:randomUUID(),serviceId:'appointment',quantity:1,start:day+'T10:00',customer:{name:'Example attendee',email:'attendee@example.test',phone:'0000000000'},participants:[{name:'Example attendee',notes:''}],notes:'',consent:true,status:'confirmed'};
  const results=await Promise.all([admin(prefix+'/bookings','POST',input),admin(prefix+'/bookings','POST',{...input,requestId:randomUUID()})]);
  assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);const booking=results.find(r=>r.status===201).data;
  assert.equal(booking.participants[0].name,'Example attendee');assert.deepEqual(booking.participants[0].extensions,{});assert.deepEqual(booking.pets,[]);
  const publicClient=client(origin);assert.equal((await publicClient('/public/'+site+'/catalog')).data.participantMode,'generic');
  assert.equal((await outsider(prefix+'/bookings')).status,404);
  const events=await admin(prefix+'/calendar','POST',{title:'Kapalı zaman',start:day+'T14:00',end:day+'T15:00',resource:'appointments',blocks:true,notes:'',repeat:'weekly',count:2});assert.equal(events.status,201);
  assert.equal((await admin(prefix+'/bookings','POST',{...input,requestId:randomUUID(),start:day+'T14:00'})).status,409);
  const latest=(await admin('/api/v2/sites/'+site)).data;assert.equal((await admin('/api/v2/sites/'+site+'/restore','POST',{revision:latest.revision,target:0})).status,200);
  assert.equal((await admin(prefix+'/bookings')).data.bookings[0].id,booking.id);
  assert.ok((await admin(prefix+'/integrations')).data.providers.filter(p=>p.kind==='payment').every(p=>!p.ready));
  assert.equal((await admin(prefix+'/calendar.ics')).status,200);
 });
 async function reviewImport(input){const started=await admin('/api/v2/imports','POST',{requestId:randomUUID(),orgId:org,...input});assert.equal(started.status,202,JSON.stringify(started.data));let review;for(let i=0;i<100;i++){review=await admin('/api/v2/imports/'+started.data.id);if(!['queued','analyzing'].includes(review.data.status))break;await new Promise(r=>setTimeout(r,10));}return review.data;}
 test('WordPress bridge contract checks source revision, rejects external conflicts and never exports credentials',async()=>{
  const secret='fixture-app-password-ONLY',remote={html:'<!doctype html><html><head><title>WP fixture</title></head><body><main><section><h1>CMS page</h1><p>Original</p></section></main></body></html>',revision:'revision-one'};
  remoteBehavior=async(url,options)=>{assert.equal(url,'https://wordpress.example.test/wp-json/loft-studio/v1/pages/7');assert.equal(options.headers.Authorization,'Basic '+Buffer.from('fixture:'+secret).toString('base64'));if(options.method==='PUT'){if(options.headers['If-Match']!==remote.revision)return{status:412,headers:{},body:Buffer.from('{}')};remote.html=JSON.parse(options.body).html;remote.revision='revision-three';}return{status:200,headers:{},body:Buffer.from(JSON.stringify(remote))};};
  const review=await reviewImport({kind:'wordpress',url:'https://wordpress.example.test',username:'fixture',password:secret,pageId:7});assert.equal(review.status,'review',JSON.stringify(review));assert.ok(!JSON.stringify(review).includes(secret));
  const imported=await admin('/api/v2/imports/'+review.id+'/commit','POST',{}),prefix='/api/v2/sites/'+imported.data.siteId;
  assert.equal((await admin(prefix+'/connection/check')).data.status,'current');
  const loaded=(await admin(prefix)).data,doc=structuredClone(loaded.document);doc.pages[0].sections[0].fields[0].value='Edited CMS';assert.equal((await admin(prefix+'/document','PUT',{revision:loaded.revision,document:doc})).status,200);
  remote.revision='revision-two';assert.equal((await admin(prefix+'/connection/check')).data.status,'changed');assert.equal((await admin(prefix+'/publish','POST',{revision:1})).status,409);assert.doesNotMatch(remote.html,/Edited CMS/);
  remote.revision='revision-one';assert.equal((await admin(prefix+'/publish','POST',{revision:1})).status,200);assert.match(remote.html,/Edited CMS/);
  const release=await admin(prefix+'/releases','POST',{revision:1}),files=readZip((await admin(release.data.url)).bytes);assert.ok(!JSON.stringify(Object.fromEntries(Object.entries(files).map(([k,v])=>[k,v.toString()]))).includes(secret));
  const row=app.store.get('SELECT * FROM studio_connections WHERE site_id=?',imported.data.siteId);assert.ok(!JSON.stringify(row).includes(secret));assert.equal((await outsider(prefix+'/connection/check')).status,404);
 });
 test('cancelling a remote import aborts its request and leaves no committed site',async()=>{
  let aborted=false;remoteBehavior=async(_url,options)=>new Promise((_resolve,reject)=>{options.signal.addEventListener('abort',()=>{aborted=true;reject(Error('Cancelled'));},{once:true});});
  const started=await admin('/api/v2/imports','POST',{kind:'wordpress',url:'https://wordpress.example.test',username:'fixture',password:'test',pageId:7,requestId:randomUUID(),orgId:org});assert.equal(started.status,202);
  for(let i=0;i<100;i++){const job=(await admin('/api/v2/imports/'+started.data.id)).data;if(job.status==='analyzing')break;await new Promise(r=>setTimeout(r,10));}
  assert.equal((await admin('/api/v2/imports/'+started.data.id+'/cancel','POST',{})).status,200);
  assert.equal((await admin('/api/v2/imports/'+started.data.id)).data.status,'cancelled');assert.ok(aborted);assert.equal((await admin('/api/v2/imports/'+started.data.id+'/commit','POST',{})).status,409);
 });
});
