import {randomUUID} from 'node:crypto';
import {defineIntegration,parseFields,fail} from '@loft-studio/sdk';
import {assertPackageTrust} from './trust.mjs';
const valid=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(id);
const decode=r=>r&&({id:r.id,revision:Number(r.revision),data:JSON.parse(r.data)});

/** Private host facade supplies the same transaction to records and delivery status. */
export class AsyncIntegrations {
 constructor(host,definitions,trustPolicy){
  this.host=host;this.registry=new Map();
  for(const d of definitions){
   if(d.apiVersion!==2)fail(422,'Async integration API 2 required.');defineIntegration(d);assertPackageTrust(d.id,d.version,trustPolicy);
   if(this.registry.has(d.id))fail(422,'Duplicate integration.');
   for(const s of d.subscriptions){const m=host.modules.get(s.module);if(m&&m.events?.[s.type]?.version!==s.version)fail(422,'Event version mismatch.');}
   this.registry.set(d.id,d);
  }
 }
 async initialize(){await this.host.storage.transaction(async tx=>{
  for(const sql of [
   'CREATE TABLE IF NOT EXISTS studio_async_links(org_id TEXT NOT NULL,site_id TEXT NOT NULL,integration_id TEXT NOT NULL,collection TEXT NOT NULL,id TEXT NOT NULL,revision INTEGER NOT NULL,deleted INTEGER NOT NULL,data TEXT NOT NULL,updated TEXT NOT NULL,PRIMARY KEY(org_id,site_id,integration_id,collection,id))',
   'CREATE TABLE IF NOT EXISTS studio_async_deliveries(event_id TEXT NOT NULL,integration_id TEXT NOT NULL,state TEXT NOT NULL,attempts INTEGER NOT NULL,next_attempt BIGINT NOT NULL,error TEXT,PRIMARY KEY(event_id,integration_id))',
   'CREATE TABLE IF NOT EXISTS studio_async_cursors(org_id TEXT NOT NULL,site_id TEXT NOT NULL,module_id TEXT NOT NULL,sequence BIGINT NOT NULL,PRIMARY KEY(org_id,site_id,module_id))'
  ])await tx.query(sql);
 });}
 async active(w,d){
  for(const [id,major]of Object.entries(d.requires)){
   const m=this.host.modules.get(id),row=await w.installation(id);
   if(!m||Number(m.manifest.version.split('.')[0])!==major||row?.state!=='enabled'||row.version!==m.manifest.version||row.schema_version!==m.manifest.schemaVersion)return false;
  }return true;
 }
 async access(w,d,required=true){
  if(!d)fail(404,'Integration not found.');await w.authorize();
  for(const p of d.permissions)await w.authorize(p);
  for(const id of Object.keys(d.requires)){
   const m=this.host.modules.get(id);if(!m)fail(409,'Required module unavailable.');
   for(const p of m.manifest.permissions)await w.authorize(p);
  }
  if(required&&!await this.active(w,d))fail(409,'Enable and update required modules.');
 }
 context(w,d,actor,siteId,writable){
  const {q,org}=w;let open=true;const pending=new Set();let poison;
  const guard=fn=>(...args)=>{const p=Promise.resolve().then(()=>{if(!open)fail(409,'Integration context expired.');if(poison)throw poison;return fn(...args);});pending.add(p);p.then(()=>pending.delete(p),e=>{poison=e;pending.delete(p);});return p;};
  const schema=name=>{if(!Object.hasOwn(d.collections,name))fail(404,'Collection not found.');return d.collections[name];};
  const raw=async(name,id)=>{schema(name);if(!valid(id))fail(422,'Invalid record ID.');return(await q`SELECT * FROM studio_async_links WHERE org_id=${org} AND site_id=${siteId} AND integration_id=${d.id} AND collection=${name} AND id=${id}`).rows[0];};
  const moduleGet=guard(async(id,name,key)=>{if(!actor||!Object.hasOwn(d.requires,id))fail(403,'Undeclared module access.');await w.requireInstalled(id,false);return w.context(id,false).records.get(name,key);});
  const records={get:guard(async(name,id)=>{const r=await raw(name,id);return r&&!r.deleted?decode(r):undefined;}),
   list:guard(async(name,{where={},limit=100,offset=0,search='',orderBy}={})=>{
    const c=schema(name);if(!Number.isSafeInteger(limit)||limit<1||limit>500||!Number.isSafeInteger(offset)||offset<0||typeof search!=='string'||search.length>200)fail(422,'Invalid pagination.');
    if(orderBy&&!Object.hasOwn(c.fields,orderBy))fail(422,'Invalid sort.');
    for(const [key,value]of Object.entries(where)){const values=Array.isArray(value)?value:[value];if(!Object.hasOwn(c.fields,key)||!values.length||values.length>100||values.some(v=>!['string','number','boolean'].includes(typeof v)))fail(422,'Invalid filter.');}
    let rows=(await q`SELECT * FROM studio_async_links WHERE org_id=${org} AND site_id=${siteId} AND integration_id=${d.id} AND collection=${name} AND deleted=0 ORDER BY updated DESC,id`).rows.map(decode);
    rows=rows.filter(r=>Object.entries(where).every(([k,v])=>(Array.isArray(v)?v:[v]).includes(r.data[k]))&&JSON.stringify(r.data).toLowerCase().includes(search.toLowerCase()));
    if(orderBy)rows.sort((a,b)=>String(b.data[orderBy]).localeCompare(String(a.data[orderBy]))||a.id.localeCompare(b.id));
    return {items:rows.slice(offset,offset+limit),total:rows.length};
   }),
   put:guard(async(name,input)=>{
    if(!writable)fail(403,'Read-only integration.');const c=schema(name),id=input.id||randomUUID(),old=await raw(name,id),exists=old&&!old.deleted;
    if(exists?input.revision!==old.revision:input.revision!==undefined&&input.revision!==-1)fail(409,'Revision conflict.');
    const data=parseFields(c.fields,input.data);for(const [key,f]of Object.entries(c.fields))if(f.type==='reference'&&data[key])await moduleGet(f.module,f.collection,data[key]);
    const revision=(old?.revision??-1)+1;
    await q`INSERT INTO studio_async_links VALUES (${org},${siteId},${d.id},${name},${id},${revision},0,${JSON.stringify(data)},${new Date().toISOString()}) ON CONFLICT(org_id,site_id,integration_id,collection,id) DO UPDATE SET revision=excluded.revision,deleted=0,data=excluded.data,updated=excluded.updated`;
    await q`DELETE FROM studio_async_references WHERE org_id=${org} AND site_id=${siteId} AND module_id=${d.id} AND collection=${name} AND record_id=${id}`;
    for(const [key,f]of Object.entries(c.fields))if(f.type==='reference'&&data[key])await q`INSERT INTO studio_async_references VALUES (${org},${siteId},${d.id},${name},${id},${key},${f.module},${f.collection},${data[key]})`;
    const result={id,revision,data};await this.host.audit(w.tx,{orgId:org,siteId,moduleId:d.id,actor:actor||{user_id:'integration:'+d.id},action:'integration.record.saved',resource:name+'/'+id,before:exists?decode(old):null,after:result});return result;
   }),
   remove:guard(async(name,id,revision)=>{
    if(!writable)fail(403,'Read-only integration.');const old=await raw(name,id);if(!old||old.deleted||old.revision!==revision)fail(409,'Revision conflict.');
    await q`UPDATE studio_async_links SET deleted=1,revision=revision+1 WHERE org_id=${org} AND site_id=${siteId} AND integration_id=${d.id} AND collection=${name} AND id=${id}`;
    await q`DELETE FROM studio_async_references WHERE org_id=${org} AND site_id=${siteId} AND module_id=${d.id} AND collection=${name} AND record_id=${id}`;
    await this.host.audit(w.tx,{orgId:org,siteId,moduleId:d.id,actor:actor||{user_id:'integration:'+d.id},action:'integration.record.deleted',resource:name+'/'+id,before:decode(old),after:null});
   })};
  return {ctx:{siteId,actor,records,modules:{get:moduleGet},audit:guard(async(action,data)=>{if(!writable)fail(403,'Read-only integration.');await this.host.audit(w.tx,{orgId:org,siteId,moduleId:d.id,actor:actor||{user_id:'integration:'+d.id},action,before:null,after:data});})},
   async finish(){while(pending.size)await Promise.allSettled([...pending]);if(poison)throw poison;},
   async close(){open=false;while(pending.size)await Promise.allSettled([...pending]);}};
 }
 async execute(actor,siteId,id,name,input){return this.host.work(actor,siteId,async w=>{
  const d=this.registry.get(id);await this.access(w,d);const c=d.commands[name];if(!c)fail(404,'Command not found.');
  const scoped=this.context(w,d,actor,siteId,c.write!==false);
  try{const result=await c.run(scoped.ctx,parseFields(c.fields||{},input));await scoped.finish();return result;}finally{await scoped.close();}
 });}
 async views(w,moduleId){const views=[];for(const d of this.registry.values()){
  if(!await this.active(w,d))continue;try{await this.access(w,d);}catch(e){if([403,404,409].includes(e.status))continue;throw e;}
  for(const v of d.views||[])if(v.module===moduleId)views.push({...v,integrationId:d.id});
 }return views;}
 async export(w,moduleId,siteId){const result=[];for(const d of this.registry.values())if(Object.hasOwn(d.requires,moduleId)){
  try{await this.access(w,d,false);}catch(e){if([403,404,409].includes(e.status))continue;throw e;}
  const rows=(await w.q`SELECT * FROM studio_async_links WHERE org_id=${w.org} AND site_id=${siteId} AND integration_id=${d.id} AND deleted=0 ORDER BY collection,id`).rows;
  result.push({id:d.id,version:d.version,records:rows.map(r=>({collection:r.collection,...decode(r)}))});
 }return result;}
 async status(actor,siteId,id){return this.host.work(actor,siteId,async w=>{
  await this.access(w,this.registry.get(id));return(await w.q`SELECT d.state,COUNT(*) count FROM studio_async_deliveries d JOIN studio_async_outbox e ON e.id=d.event_id WHERE e.org_id=${w.org} AND e.site_id=${siteId} AND d.integration_id=${id} GROUP BY d.state`).rows.map(r=>({...r,count:Number(r.count)}));
 });}
 async retry(actor,siteId,id){return this.host.work(actor,siteId,async w=>{
  await this.access(w,this.registry.get(id));await w.authorize('members');
  const r=await w.q`UPDATE studio_async_deliveries SET state='pending',attempts=0,next_attempt=0,error=NULL WHERE integration_id=${id} AND state='failed' AND event_id IN (SELECT id FROM studio_async_outbox WHERE org_id=${w.org} AND site_id=${siteId})`;
  await this.host.audit(w.tx,{orgId:w.org,siteId,moduleId:id,actor,action:'integration.retry',before:null,after:{count:r.rowCount}});return {retried:r.rowCount};
 });}
 async ingest(limit=100){
  if(!Number.isSafeInteger(limit)||limit<1||limit>500)fail(422,'Invalid source batch.');const failedSources=[];
  for(const [id,source]of Object.entries(this.host.sources))try{
   const scopes=await this.host.storage.transaction(tx=>tx.all('SELECT org_id,site_id FROM studio_async_installations WHERE module_id='+ (this.host.storage.dialect==='postgres'?'$1':'?'),[id]));
   for(const s of scopes)await this.host.system(s,async w=>{
    let cursor=Number((await w.q`SELECT sequence FROM studio_async_cursors WHERE org_id=${s.org_id} AND site_id=${s.site_id} AND module_id=${id}`).rows[0]?.sequence||0);
    const rows=await source.read(cursor,limit);if(!Array.isArray(rows)||rows.length>limit)fail(422,'Invalid source batch.');
    for(const r of rows){if(!Number.isSafeInteger(r.sequence)||r.sequence<=cursor)fail(422,'Invalid source sequence.');
     if(r.siteId===s.site_id){const contract=this.host.modules.get(id)?.events?.[r.type];if(!contract)fail(422,'Unknown source event.');const data=parseFields(contract.fields,r.data);
      if(!Number.isFinite(Date.parse(r.occurredAt))||typeof r.actor!=='string'||r.actor.length>200||Buffer.byteLength(JSON.stringify(data))>16000)fail(422,'Invalid source event.');
      const eventId=randomUUID();await w.q`INSERT INTO studio_async_outbox VALUES (${eventId},${s.org_id},${s.site_id},${id},${r.type},${JSON.stringify(data)},${r.actor},${r.occurredAt})`;
      await w.q`INSERT INTO studio_async_event_versions VALUES (${eventId},${contract.version})`;
     }cursor=r.sequence;
    }
    await w.q`INSERT INTO studio_async_cursors VALUES (${s.org_id},${s.site_id},${id},${cursor}) ON CONFLICT(org_id,site_id,module_id) DO UPDATE SET sequence=excluded.sequence`;
   });
  }catch{failedSources.push(id);}return {failedSources};
 }
 async drain({limit=100,now=Date.now()}={}){
  if(!Number.isSafeInteger(limit)||limit<1||limit>500||!Number.isSafeInteger(now))fail(422,'Invalid delivery batch.');let delivered=0,failed=0;
  const scopes=await this.host.storage.transaction(tx=>tx.all('SELECT org_id,site_id FROM studio_async_scopes'));
  for(const s of scopes)for(const d of this.registry.values()){
   const events=await this.host.system(s,async w=>{
    if(!await this.active(w,d))return [];
    for(const sub of d.subscriptions)await w.q`INSERT INTO studio_async_deliveries(event_id,integration_id,state,attempts,next_attempt) SELECT id,${d.id},'pending',0,0 FROM studio_async_outbox WHERE org_id=${s.org_id} AND site_id=${s.site_id} AND module_id=${sub.module} AND type=${sub.type} ON CONFLICT(event_id,integration_id) DO NOTHING`;
    return(await w.q`SELECT e.*,d.attempts FROM studio_async_outbox e JOIN studio_async_deliveries d ON d.event_id=e.id WHERE e.org_id=${s.org_id} AND e.site_id=${s.site_id} AND d.integration_id=${d.id} AND d.state='pending' AND d.next_attempt<=${now} ORDER BY e.created,e.id LIMIT ${limit}`).rows;
   });
   for(const event of events)try{
    const done=await this.host.system(s,async w=>{
     if(!await this.active(w,d))return false;
     const row=(await w.q`SELECT * FROM studio_async_deliveries WHERE event_id=${event.id} AND integration_id=${d.id}`).rows[0];if(row?.state!=='pending'||Number(row.next_attempt)>now)return false;
     const sub=d.subscriptions.find(v=>v.module===event.module_id&&v.type===event.type),contract=this.host.modules.get(event.module_id)?.events?.[event.type];
     const version=(await w.q`SELECT version FROM studio_async_event_versions WHERE event_id=${event.id}`).rows[0]?.version||1;
     if(!sub||contract?.version!==sub.version||version!==sub.version)fail(409,'Unsupported event version.');
     const scoped=this.context(w,d,null,s.site_id,true);
     try{await sub.run(scoped.ctx,{id:event.id,type:event.type,version:sub.version,data:parseFields(contract.fields,JSON.parse(event.data)),actor:event.actor,occurredAt:event.created});await scoped.finish();}finally{await scoped.close();}
     await w.q`UPDATE studio_async_deliveries SET state='delivered',attempts=attempts+1,error=NULL WHERE event_id=${event.id} AND integration_id=${d.id}`;return true;
    });if(done)delivered++;
   }catch(e){
    if(e.code==='RETRY_TRANSACTION')continue;
    await this.host.system(s,async w=>{const row=(await w.q`SELECT * FROM studio_async_deliveries WHERE event_id=${event.id} AND integration_id=${d.id}`).rows[0];if(row?.state!=='pending'||Number(row.next_attempt)>now)return;
     const attempts=row.attempts+1;await w.q`UPDATE studio_async_deliveries SET state=${attempts>=5?'failed':'pending'},attempts=${attempts},next_attempt=${now+Math.min(60000,1000*2**attempts)},error='HANDLER_FAILED' WHERE event_id=${event.id} AND integration_id=${d.id}`;
    });failed++;
   }
  }return {delivered,failed};
 }
}
