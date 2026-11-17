import {AsyncLocalStorage} from 'node:async_hooks';
import {randomUUID, createHash} from 'node:crypto';
import {isIP} from 'node:net';

export const manifest = Object.freeze({id:'loft.audit', version:'0.1.0', apiVersion:1, schemaVersion:1,
  name:'İstek ve değişiklik kayıtları', kind:'infrastructure', permissions:['audit','auditExport']});
const sensitive = /password|passwd|secret|token|apikey|accesskey|credential|authorization|cookie|csrf|nonce|verifier|sealed|privatekey|signingkey|cardnumber|creditcard|cvv|cvc|iban|bankaccount|bindinghash|statehash|sessionhash/i;
const jsonColumns = new Set(['content','document','metadata','data','settings','options','customer','pets','extensions','permissions','config','detail','changes']);
const hiddenColumns = new Set(['source','snapshot','base64','bytes','body','raw','files','assets']);
const clean = (value, max=500) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,max);
const quote = name => {if(!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name))throw Error('Invalid audit SQL identifier');return '"'+name+'"';};
const sqlString = value => "'"+String(value).replaceAll("'","''")+"'";
const digest = value => createHash('sha256').update(String(value)).digest('hex');
const error = (status,message) => {throw Object.assign(Error(message),{status});};

export function safeText(value, max=4000) {
  return clean(value,max+512)
    .replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*/g,'[MASKED PRIVATE KEY]')
    .replace(/\b(?:gh[pousr]_[\w]{16,}|github_pat_[\w]{16,}|sk-[\w-]{16,}|sk_(?:live|test)_[\w]{12,})/gi,'[MASKED TOKEN]')
    .replace(/\bBearer\s+[^\s"'<>]+/gi,'Bearer [MASKED]')
    .replace(/((?:password|secret|api[_-]?key|access[_-]?token)\s*[:=]\s*)[^\s,;"'<>]+/gi,'$1[MASKED]')
    .replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/gi,'$1[MASKED]@')
    .replace(/([?&](?:token|key|secret|password|code|signature|session)[\w-]*=)[^&#\s]*/gi,'$1[MASKED]').slice(0,max);
}
export function sanitize(value, key='', depth=0) {
  if(sensitive.test(key.replace(/[^a-z]/gi,'')))return '[MASKED]';
  if(hiddenColumns.has(key))return {omitted:true,reason:'source-or-binary',sha256:digest(JSON.stringify(value))};
  if(depth>12)return {omitted:true,reason:'depth-limit'};
  if(typeof value==='string') {
    if(jsonColumns.has(key)) {try {return sanitize(JSON.parse(value),'',depth+1);}catch{/* plain text */}}
    const text=safeText(value);
    return value.length>4000?{excerpt:text,omitted:true,originalLength:value.length,sha256:digest(value)}:text;
  }
  if(Array.isArray(value))return value.slice(0,200).map(v=>sanitize(v,'',depth+1)).concat(value.length>200?[{omitted:true,reason:'array-limit',total:value.length}]:[]);
  if(value&&typeof value==='object'){
    const entries=Object.entries(value),safe=Object.fromEntries(entries.slice(0,300).map(([k,v])=>[clean(k,160),sanitize(v,k,depth+1)]));
    return entries.length>300?{value:safe,omitted:true,reason:'object-limit',total:entries.length}:safe;
  }
  return value ?? null;
}
const decodeRow = row => {
  if(!row)return null;
  const value=JSON.parse(row);
  for(const key of Object.keys(value))if(jsonColumns.has(key)&&typeof value[key]==='string')try{value[key]=JSON.parse(value[key]);}catch{}
  return value;
};
export function difference(before, after) {
  const changes=[]; let omitted=0, budget=120_000;
  const walk=(a,b,path,key='',depth=0)=>{
    if(JSON.stringify(a)===JSON.stringify(b))return;
    if(changes.length>=400||budget<=0){omitted++;return;}
    if(!sensitive.test(key.replace(/[^a-z]/gi,''))&&!hiddenColumns.has(key)&&depth<12&&a&&b&&typeof a==='object'&&typeof b==='object'&&!Array.isArray(a)&&!Array.isArray(b)) {
      for(const k of new Set([...Object.keys(a),...Object.keys(b)]))walk(a[k],b[k],path+'/'+k.replaceAll('~','~0').replaceAll('/','~1'),k,depth+1);
    } else {
      const entry={path:clean(path,600),before:sanitize(a,key),after:sanitize(b,key)};
      const size=JSON.stringify(entry).length;
      if(size>budget){omitted++;return;}budget-=size;changes.push(entry);
    }
  };
  // Walk individual columns on INSERT/DELETE as well, preserving sensitive names.
  if(before===null||after===null)for(const key of Object.keys(after||before||{}))walk(before?.[key],after?.[key],'/'+key,key);
  else walk(before,after,'');
  return {changes,omitted,truncated:omitted>0};
}
export function normalizeIP(value) {
  const text=String(value||'').trim().replace(/^::ffff:(?=\d+\.)/i,'');
  return isIP(text)?text.toLowerCase():null;
}
export function requestMetadata(req, trustedProxies=[]) {
  const peer=normalizeIP(req.socket?.remoteAddress),trusted=new Set(trustedProxies.map(normalizeIP).filter(Boolean));
  let ip=peer,source='socket';
  // Never trust arbitrary forwarding headers or a leftmost client-supplied address.
  if(peer&&trusted.has(peer)&&typeof req.headers['x-forwarded-for']==='string') {
    const chain=req.headers['x-forwarded-for'].split(',').map(normalizeIP);
    if(chain.length<=20&&chain.every(Boolean))for(let i=chain.length-1;i>=0&&trusted.has(ip);i--){ip=chain[i];source='trusted-proxy';}
  }
  const ua=safeText(req.headers['user-agent']||'',600);
  const browser=/Edg\//.test(ua)?'Edge':/Firefox\//.test(ua)?'Firefox':/Chrome\//.test(ua)?'Chrome':/Safari\//.test(ua)?'Safari':'Unknown';
  const os=/Windows/.test(ua)?'Windows':/Android/.test(ua)?'Android':/iPhone|iPad/.test(ua)?'iOS':/Macintosh/.test(ua)?'macOS':/Linux/.test(ua)?'Linux':'Unknown';
  let path='/[invalid-url]';
  try {path=new URL(req.url,'http://audit.invalid').pathname;}catch{}
  return {method:clean(req.method,12),path:safeText(path,1000),ip,peerIp:peer,ipSource:source,
    device:{userAgent:ua,browser,os,type:/Mobile|Android|iPhone/.test(ua)?'mobile':'unknown-or-desktop',
      platform:safeText(req.headers['sec-ch-ua-platform']||'',80),clientHints:safeText(req.headers['sec-ch-ua']||'',300),
      mobileHint:safeText(req.headers['sec-ch-ua-mobile']||'',8),language:safeText(req.headers['accept-language']||'',160),
      provenance:'client-reported; not a verified hardware identity'}};
}
export function csvCell(value) {
  let text=typeof value==='string'?value:JSON.stringify(value??null);
  if(/^[\s]*[=+\-@]/.test(text)||/^[\t\r\n]/.test(text))text="'"+text;
  return '"'+text.replaceAll('"','""')+'"';
}
export const csvColumns=['sequence','occurredAt','kind','action','scope','actorId','actorType','actorLabel','requestId','method','path','ip','peerIp','ipSource','device','status','durationMs','resource','values','detail'];
export const csvRow=entry=>csvColumns.map(k=>csvCell(entry[k])).join(',')+'\r\n';

/** Independent trusted server package: no imports from the Loft application. */
export class AuditLog {
  constructor({db,trustedProxies=[],resolveScope=()=> 'system',onFailure=()=>{}}) {
    this.db=db;this.context=new AsyncLocalStorage();this.trustedProxies=trustedProxies;this.resolveScope=resolveScope;this.onFailure=onFailure;
    if(trustedProxies.some(ip=>!normalizeIP(ip)))throw Error('Audit trusted proxies must be explicit IP addresses.');
    db.exec('CREATE TABLE IF NOT EXISTS studio_log_migrations(version INTEGER PRIMARY KEY,applied TEXT NOT NULL)');
    if(db.prepare('SELECT COALESCE(MAX(version),0) version FROM studio_log_migrations').get().version>manifest.schemaVersion)throw Error('Audit schema is newer than this package.');
    db.exec(`CREATE TABLE IF NOT EXISTS studio_log_entries(
      sequence INTEGER PRIMARY KEY AUTOINCREMENT,id TEXT NOT NULL UNIQUE,occurred_at TEXT NOT NULL,
      kind TEXT NOT NULL,action TEXT NOT NULL,scope TEXT NOT NULL,actor_id TEXT,actor_type TEXT NOT NULL,actor_label TEXT,
      request_id TEXT,method TEXT,path TEXT,ip TEXT,peer_ip TEXT,ip_source TEXT,device TEXT NOT NULL,
      status INTEGER,duration_ms INTEGER,resource TEXT,values_json TEXT NOT NULL,detail TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS studio_log_scope_seq ON studio_log_entries(scope,sequence);
      CREATE INDEX IF NOT EXISTS studio_log_request ON studio_log_entries(request_id,sequence);
      CREATE INDEX IF NOT EXISTS studio_log_time ON studio_log_entries(occurred_at,sequence);
      CREATE TRIGGER IF NOT EXISTS studio_log_immutable_update BEFORE UPDATE ON studio_log_entries BEGIN SELECT RAISE(ABORT,'Audit entries are append-only'); END;
      CREATE TRIGGER IF NOT EXISTS studio_log_immutable_delete BEFORE DELETE ON studio_log_entries BEGIN SELECT RAISE(ABORT,'Audit entries are append-only'); END;`);
    db.prepare('INSERT OR IGNORE INTO studio_log_migrations VALUES (?,?)').run(manifest.schemaVersion,new Date().toISOString());
    db.function('loft_log_context', key=>{
      const ctx=this.current();
      if(key==='device')return JSON.stringify(ctx.device||{});
      return ctx[key]??null;
    });
    db.function('loft_log_uuid',()=>randomUUID());
    db.function('loft_log_time',()=>new Date().toISOString());
    db.function('loft_log_diff',(before,after)=>JSON.stringify(difference(decodeRow(before),decodeRow(after))));
    this.insert=db.prepare('INSERT INTO studio_log_entries(id,occurred_at,kind,action,scope,actor_id,actor_type,actor_label,request_id,method,path,ip,peer_ip,ip_source,device,status,duration_ms,resource,values_json,detail) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
  }
  current(){return this.context.getStore()||{actorId:'system',actorType:'system',actorLabel:'System'};}
  identify(user,type='human') {
    const context=this.context.getStore();if(!context)return;
    context.actorId=clean(user.user_id||user.id,100);context.actorLabel=safeText(user.email||user.label||context.actorId,200);context.actorType=type;
    if(context.scope==='system')context.scope='account:'+context.actorId;
  }
  setScope(scope){const context=this.context.getStore();if(context)context.scope=scope;}
  withContext(context,fn){return this.context.run({...context},fn);}
  record({kind='event',action,scope,resource=null,values={},detail={},status=null,durationMs=null}) {
    const ctx=this.current();
    this.insert.run(randomUUID(),new Date().toISOString(),kind,clean(action,160),scope||ctx.scope||'system',
      ctx.actorId||null,ctx.actorType||'anonymous',ctx.actorLabel||null,ctx.requestId||null,ctx.method||null,ctx.path||null,
      ctx.ip||null,ctx.peerIp||null,ctx.ipSource||null,JSON.stringify(ctx.device||{}),status,durationMs,
      resource?safeText(resource,300):null,JSON.stringify(sanitize(values)),JSON.stringify(sanitize(detail)));
  }
  /** Install connection-local triggers so offline readers/backups need no custom functions. */
  track({table,scope,resource,columns,kind='change',action}) {
    quote(table);
    const info=this.db.prepare('SELECT name,pk FROM pragma_table_info(?)').all(table);
    if(!info.length)throw Error('Audit source table is missing: '+table);
    const names=columns||info.map(r=>r.name);for(const name of names)if(!info.some(r=>r.name===name))throw Error('Audit source column is missing: '+name);
    const primary=info.filter(r=>r.pk&&names.includes(r.name)&&!sensitive.test(r.name.replace(/[^a-z]/gi,''))).sort((a,b)=>a.pk-b.pk);
    const row=alias=>'json_object('+names.flatMap(name=>[sqlString(name),`CASE WHEN typeof(${alias}.${quote(name)})='blob' THEN '[BINARY OMITTED]' ELSE ${alias}.${quote(name)} END`]).join(',')+')';
    for(const operation of ['INSERT','UPDATE','DELETE']) {
      const alias=operation==='DELETE'?'OLD':'NEW',name='loft_log_'+table+'_'+operation.toLowerCase();
      const scopeSQL=scope(alias),resourceSQL=resource?resource(alias):primary.length
        ?sqlString(table+':')+'||json_object('+primary.flatMap(r=>[sqlString(r.name),alias+'.'+quote(r.name)]).join(',')+')':sqlString(table);
      this.db.exec(`DROP TRIGGER IF EXISTS temp.${quote(name)};
        CREATE TEMP TRIGGER ${quote(name)} AFTER ${operation} ON main.${quote(table)} BEGIN
        INSERT INTO studio_log_entries(id,occurred_at,kind,action,scope,actor_id,actor_type,actor_label,request_id,method,path,ip,peer_ip,ip_source,device,resource,values_json,detail)
        VALUES(loft_log_uuid(),loft_log_time(),${sqlString(kind)},${action?action(alias):sqlString(table+'.'+operation.toLowerCase())},COALESCE(${scopeSQL},loft_log_context('scope'),'system'),
        loft_log_context('actorId'),COALESCE(loft_log_context('actorType'),'anonymous'),loft_log_context('actorLabel'),loft_log_context('requestId'),loft_log_context('method'),loft_log_context('path'),loft_log_context('ip'),loft_log_context('peerIp'),loft_log_context('ipSource'),loft_log_context('device'),${resourceSQL},
        loft_log_diff(${operation==='INSERT'?'NULL':row('OLD')},${operation==='DELETE'?'NULL':row('NEW')}),'{}'); END;`);
    }
  }
  handle(req,res,handler,identity=null) {
    const metadata=requestMetadata(req,this.trustedProxies),started=performance.now();
    const context={...metadata,requestId:randomUUID(),actorId:null,actorType:'anonymous',actorLabel:null};
    if(identity){context.actorId=identity.user_id||identity.id;context.actorLabel=safeText(identity.email||context.actorId,200);context.actorType='human';}
    context.scope=this.resolveScope(metadata.path,identity)||'system';
    res.setHeader('X-Request-ID',context.requestId);
    return this.context.run(context,async()=>{
      try{this.record({kind:'request',action:'request.started'});}catch{this.onFailure();res.writeHead(503,{'Content-Type':'application/json'});res.end('{"error":"İstek kaydı oluşturulamadı."}');return;}
      let finished=false;
      const finish=aborted=>{
        if(finished)return;finished=true;
        this.withContext(context,()=>{try{this.record({kind:'request',action:aborted?'request.aborted':'request.completed',
          status:aborted?499:res.statusCode,durationMs:Math.round(performance.now()-started)});}catch{this.onFailure();}});
      };
      res.once('finish',()=>finish(false));res.once('close',()=>finish(!res.writableFinished));
      return handler();
    });
  }
  query(scope,filters={},limit=50) {
    if(typeof scope!=='string'||scope.length>150)error(422,'Kayıt kapsamı geçersiz.');
    const allowed=new Set(['before','asOf','from','to','kind','action','actor','ip','requestId','status','method']);
    if(Object.keys(filters).some(k=>!allowed.has(k)))error(422,'Tanımsız log filtresi.');
    if(!Number.isInteger(limit)||limit<1||limit>200)error(422,'Sayfa boyutu 1–200 olmalı.');
    const where=[],args=[];
    if(scope!=='*'){where.push('scope=?');args.push(scope);}
    const integer=(value,name)=>{if(!/^\d{1,15}$/.test(String(value)))error(422,name+' geçersiz.');return Number(value);};
    const maximum=Number(this.db.prepare('SELECT COALESCE(MAX(sequence),0) n FROM studio_log_entries').get().n);
    const asOf=filters.asOf===undefined?maximum:integer(filters.asOf,'Üst sınır');
    where.push('sequence<=?');args.push(asOf);
    if(filters.before!==undefined){where.push('sequence<?');args.push(integer(filters.before,'Sayfa imleci'));}
    for(const [key,operator]of [['from','>='],['to','<=']])if(filters[key]){
      const value=filters[key];
      if(typeof value!=='string'||value.length>40||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)||!Number.isFinite(Date.parse(value))||!Number.isFinite(Date.parse(value.slice(0,10)))||new Date(value.slice(0,10)).toISOString().slice(0,10)!==value.slice(0,10))error(422,'Saat dilimi içeren geçerli tarih/saat gerekli.');
      where.push('occurred_at'+operator+'?');args.push(new Date(filters[key]).toISOString());
    }
    if(filters.from&&filters.to&&Date.parse(filters.from)>Date.parse(filters.to))error(422,'Başlangıç bitişten sonra olamaz.');
    if(filters.kind&&!['request','change','event'].includes(filters.kind))error(422,'Kayıt türü geçersiz.');
    for(const [key,column]of [['kind','kind'],['action','action'],['requestId','request_id'],['method','method']])if(filters[key]){
      if(typeof filters[key]!=='string'||filters[key].length>160||/[\u0000-\u001f]/.test(filters[key]))error(422,'Filtre değeri geçersiz.');
      where.push(column+'=?');args.push(filters[key]);
    }
    if(filters.actor){if(typeof filters.actor!=='string'||filters.actor.length>200)error(422,'Kullanıcı filtresi geçersiz.');where.push('(actor_id=? OR actor_label=?)');args.push(filters.actor,filters.actor);}
    if(filters.ip){const ip=normalizeIP(filters.ip);if(!ip)error(422,'IP adresi geçersiz.');where.push('ip=?');args.push(ip);}
    if(filters.status){const status=integer(filters.status,'HTTP durumu');if(status<100||status>599)error(422,'HTTP durumu 100–599 olmalı.');where.push('status=?');args.push(status);}
    const rows=this.db.prepare('SELECT * FROM studio_log_entries WHERE '+where.join(' AND ')+' ORDER BY sequence DESC LIMIT ?').all(...args,limit+1);
    const more=rows.length>limit;rows.length=Math.min(rows.length,limit);
    const entries=rows.map(r=>({sequence:r.sequence,id:r.id,occurredAt:r.occurred_at,kind:r.kind,action:r.action,scope:r.scope,
      actorId:r.actor_id,actorType:r.actor_type,actorLabel:r.actor_label,requestId:r.request_id,method:r.method,path:r.path,ip:r.ip,
      peerIp:r.peer_ip,ipSource:r.ip_source,device:JSON.parse(r.device),status:r.status,durationMs:r.duration_ms,resource:r.resource,
      values:JSON.parse(r.values_json),detail:JSON.parse(r.detail)}));
    return {entries,asOf,nextCursor:more?entries.at(-1).sequence:null};
  }
}
