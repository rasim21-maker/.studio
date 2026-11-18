import {randomUUID} from 'node:crypto';
import {defineAsyncModule,parseFields,fail} from '@loft-studio/sdk';
import {assertPackageTrust} from './trust.mjs';

const now=()=>new Date().toISOString();
const valid=v=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(v);
const decode=r=>r&&({id:r.id,revision:Number(r.revision),data:JSON.parse(r.data),created:r.created,updated:r.updated});
/** Versioned async host. SQL and connections are never exposed to module code. */
export class AsyncModuleHost {
 #storage; #authorize; #registry=new Map();
 constructor({storage,modules,authorize,trustPolicy={mode:'trusted-local'}}) {
  this.#storage=storage;this.#authorize=authorize;
  for(const d of modules){
   if(d.manifest?.apiVersion!==2)fail(422,'Async host requires module API 2.');
   defineAsyncModule(d);
   assertPackageTrust(d.manifest.id,d.manifest.version,trustPolicy);
   if(this.#registry.has(d.manifest.id))fail(422,'Duplicate module.');
   this.#registry.set(d.manifest.id,d);
  }
  const visit=(id,path=[])=>{
   if(path.includes(id))fail(422,'Cyclic dependency.');
   const d=this.#registry.get(id);if(!d)fail(422,'Missing dependency.');
   for(const [other,major]of Object.entries(d.manifest.dependencies||{})){
    if(Number(this.#registry.get(other)?.manifest.version.split('.')[0])!==major)fail(422,'Dependency version mismatch.');
    visit(other,[...path,id]);
   }
  };for(const id of this.#registry.keys())visit(id);
 }
 #sql(tx){return async(parts,...values)=>{
  const sql=parts.reduce((s,p,i)=>s+(i?(this.#storage.dialect==='postgres'?'$'+i:'?'):'')+p,'');
  return tx.query(sql,values);
 };}
 async initialize(){
  await this.#storage.transaction(async tx=>{
   for(const sql of [
    'CREATE TABLE IF NOT EXISTS studio_async_scopes(org_id TEXT NOT NULL,site_id TEXT NOT NULL,revision INTEGER NOT NULL,PRIMARY KEY(org_id,site_id))',
    'CREATE TABLE IF NOT EXISTS studio_async_installations(org_id TEXT NOT NULL,site_id TEXT NOT NULL,module_id TEXT NOT NULL,version TEXT NOT NULL,schema_version INTEGER NOT NULL,state TEXT NOT NULL,revision INTEGER NOT NULL,PRIMARY KEY(org_id,site_id,module_id),FOREIGN KEY(org_id,site_id) REFERENCES studio_async_scopes(org_id,site_id))',
    'CREATE TABLE IF NOT EXISTS studio_async_records(org_id TEXT NOT NULL,site_id TEXT NOT NULL,module_id TEXT NOT NULL,collection TEXT NOT NULL,id TEXT NOT NULL,revision INTEGER NOT NULL,deleted INTEGER NOT NULL,data TEXT NOT NULL,created TEXT NOT NULL,updated TEXT NOT NULL,PRIMARY KEY(org_id,site_id,module_id,collection,id),FOREIGN KEY(org_id,site_id,module_id) REFERENCES studio_async_installations(org_id,site_id,module_id))',
    'CREATE TABLE IF NOT EXISTS studio_async_outbox(id TEXT PRIMARY KEY,org_id TEXT NOT NULL,site_id TEXT NOT NULL,module_id TEXT NOT NULL,type TEXT NOT NULL,data TEXT NOT NULL,actor TEXT NOT NULL,created TEXT NOT NULL,FOREIGN KEY(org_id,site_id,module_id) REFERENCES studio_async_installations(org_id,site_id,module_id))'
   ])await tx.query(sql);
  });return this;
 }
 #definition(id){const d=this.#registry.get(id);if(!d)fail(404,'Module not found.');return d;}
 async #work(actor,siteId,moduleId,work){
  const first=await this.#authorize(actor,siteId);
  if(first.id!==siteId||!valid(first.org_id)||!valid(siteId)||!actor?.user_id)fail(403,'Invalid authorized scope.');
  return this.#storage.transaction(async tx=>{
   const q=this.#sql(tx),org=first.org_id,permissions=new Set(),pending=new Set();let active=true,poison;
   const authorize=async permission=>{
    if(!active)fail(409,'Module context has expired.');
    if(poison)throw poison;
    const current=await this.#authorize(actor,siteId,permission);
    if(current.id!==siteId||current.org_id!==org)fail(403,'Site authority changed.');
    if(permission)permissions.add(permission);return current;
   };
   await authorize();
   await q`INSERT INTO studio_async_scopes VALUES (${org},${siteId},0) ON CONFLICT(org_id,site_id) DO NOTHING`;
   // Serialize decisions within a site. PostgreSQL conflicts require caller retry.
   await q`UPDATE studio_async_scopes SET revision=revision+1 WHERE org_id=${org} AND site_id=${siteId}`;
   const installation=async id=>(await q`SELECT * FROM studio_async_installations WHERE org_id=${org} AND site_id=${siteId} AND module_id=${id}`).rows[0];
   const requireInstalled=async(id,write)=>{
    const row=await installation(id),d=this.#definition(id);
    if(!row)fail(409,'Module is not installed.');
    if(write&&(row.state!=='enabled'||row.version!==d.manifest.version||row.schema_version!==d.manifest.schemaVersion))fail(409,'Module is not writable.');
    return row;
   };
   const guard=fn=>(...args)=>{
    const operation=Promise.resolve().then(()=>{if(!active)fail(409,'Module context has expired.');return fn(...args);});
    pending.add(operation);operation.then(()=>pending.delete(operation),e=>{poison=e;pending.delete(operation);});return operation;
   };
   const context=(id,writable,migrating=false)=>{
    const d=this.#definition(id);
    const collection=async name=>{
     await authorize();const c=Object.hasOwn(d.collections||{},name)&&d.collections[name];if(!c)fail(404,'Collection not found.');
     await authorize(c.permission);return c;
    };
    const raw=async(name,key)=>(await q`SELECT * FROM studio_async_records WHERE org_id=${org} AND site_id=${siteId} AND module_id=${id} AND collection=${name} AND id=${key}`).rows[0];
    const rows=async name=>(await q`SELECT * FROM studio_async_records WHERE org_id=${org} AND site_id=${siteId} AND module_id=${id} AND collection=${name} AND deleted=0 ORDER BY updated DESC,id`).rows;
    const get=guard(async(name,key)=>{await collection(name);if(!valid(key))fail(422,'Invalid record ID.');const row=await raw(name,key);if(!row||row.deleted)fail(404,'Record not found.');return decode(row);});
    const emit=guard(async(type,data)=>{
     await authorize();if(!writable)fail(403,'Read-only context.');
     if(!/^[a-z][a-zA-Z0-9_.-]{0,99}$/.test(type))fail(422,'Invalid event.');
     if(d.events?.[type])data=parseFields(d.events[type].fields,data);
     const encoded=JSON.stringify(data);if(Buffer.byteLength(encoded)>16000)fail(422,'Event too large.');
     await q`INSERT INTO studio_async_outbox VALUES (${randomUUID()},${org},${siteId},${id},${type},${encoded},${actor.user_id},${now()})`;
    });
    const references=async(fields,data)=>{for(const [key,f]of Object.entries(fields)){
     if(f.type==='reference'&&data[key])await get(f.collection,data[key]);
     if(f.type==='items')for(const value of data[key]||[])await references(f.fields,value);
    }};
    const ctx={site:structuredClone(first),actor:structuredClone(actor),records:{get},emit,
     transaction:guard(async fn=>{await authorize();return await fn(ctx);})};
    ctx.records.list=guard(async(name,{offset=0,limit=100,search=''}={})=>{
     await collection(name);if(!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(limit)||limit<1||limit>500||typeof search!=='string'||search.length>200)fail(422,'Invalid pagination.');
     const values=(await rows(name)).filter(r=>r.data.toLowerCase().includes(search.toLowerCase()));
     return {total:values.length,items:values.slice(offset,offset+limit).map(decode)};
    });
    ctx.records.find=guard(async(name,key,value)=>{
     const c=await collection(name);if(!c.fields[key]?.unique)fail(422,'Unique field required.');
     return (await rows(name)).map(decode).find(r=>r.data[key]===value);
    });
    ctx.records.put=guard(async(name,input)=>{
     if(!writable)fail(403,'Read-only context.');if(!migrating)await requireInstalled(id,true);
     const c=await collection(name),key=c.singleton?'settings':input.id||randomUUID();
     if(!valid(key)||(c.singleton&&input.id&&input.id!==key))fail(422,'Invalid ID.');
     const old=await raw(name,key),exists=old&&!old.deleted;
     if(exists?input.revision!==old.revision:input.revision!==undefined&&input.revision!==-1)fail(409,'Revision conflict.');
     let data=parseFields(c.fields,input.data);await references(c.fields,data);
     if(c.beforeSave)await c.beforeSave(ctx,data,exists?decode(old):undefined);
     data=parseFields(c.fields,data);await references(c.fields,data);
     for(const [field,f]of Object.entries(c.fields))if(f.unique&&data[field]!==undefined){
      if((await rows(name)).some(r=>r.id!==key&&JSON.parse(r.data)[field]===data[field]))fail(409,'Unique value exists.');
     }
     await authorize(c.permission);if(!migrating)await requireInstalled(id,true);
     const revision=old?old.revision+1:0,created=exists?old.created:now(),updated=now();
     await q`INSERT INTO studio_async_records VALUES (${org},${siteId},${id},${name},${key},${revision},0,${JSON.stringify(data)},${created},${updated}) ON CONFLICT(org_id,site_id,module_id,collection,id) DO UPDATE SET revision=excluded.revision,deleted=0,data=excluded.data,created=excluded.created,updated=excluded.updated`;
     await emit('record.saved',{collection:name,id:key,revision});return {id:key,revision,data,created,updated};
    });
    ctx.records.remove=guard(async(name,key,revision)=>{
     if(!writable)fail(403,'Read-only context.');await requireInstalled(id,true);
     const c=await collection(name),old=await get(name,key);if(old.revision!==revision)fail(409,'Revision conflict.');
     if(c.beforeDelete)await c.beforeDelete(ctx,old);
     const points=(fields,data)=>Object.entries(fields).some(([key,f])=>f.type==='reference'&&f.collection===name&&data[key]===old.id||f.type==='items'&&(data[key]||[]).some(v=>points(f.fields,v)));
     for(const [other,schema]of Object.entries(d.collections||{}))if((await rows(other)).some(r=>points(schema.fields,JSON.parse(r.data))))fail(409,'Record is referenced.');
     await authorize(c.permission);
     await q`UPDATE studio_async_records SET deleted=1,revision=revision+1 WHERE org_id=${org} AND site_id=${siteId} AND module_id=${id} AND collection=${name} AND id=${key}`;
     await emit('record.deleted',{collection:name,id:key});
    });
    return ctx;
   };
   try{
    const value=await work({q,org,authorize,installation,requireInstalled,context});
    while(pending.size)await Promise.allSettled([...pending]);
    if(poison)throw poison;for(const permission of permissions)await authorize(permission);
    return value;
   }finally{active=false;while(pending.size)await Promise.allSettled([...pending]);}
  });
 }
 async lifecycle(actor,siteId,id,action,expected){
  const d=this.#definition(id);
  if(!['install','enable','disable','uninstall','upgrade'].includes(action))fail(405,'Invalid lifecycle action.');
  return this.#work(actor,siteId,id,async({q,org,authorize,installation,requireInstalled,context})=>{
   await authorize('members');for(const p of d.manifest.permissions)await authorize(p);
   const previous=await installation(id);if((previous?previous.revision:-1)!==expected)fail(409,'Installation revision conflict.');
   if(!previous&&action!=='install'||previous&&action==='install'&&previous.state!=='uninstalled')fail(409,'Invalid installation state.');
   const disabling=action==='disable'||action==='uninstall';
   if(disabling){for(const other of this.#registry.values())if(Object.hasOwn(other.manifest.dependencies||{},id)&&(await installation(other.manifest.id))?.state==='enabled')fail(409,'Active dependent module.');}
   else{
    for(const dependency of Object.keys(d.manifest.dependencies||{}))await requireInstalled(dependency,true);
    if(previous&&(previous.schema_version>d.manifest.schemaVersion||previous.version.localeCompare(d.manifest.version,'en',{numeric:true})>0))fail(409,'Downgrade refused.');
   }
   const state=action==='uninstall'?'uninstalled':disabling?'disabled':'enabled';
   const version=disabling?previous.version:d.manifest.version,schema=disabling?previous.schema_version:d.manifest.schemaVersion,revision=(previous?.revision??-1)+1;
   await q`INSERT INTO studio_async_installations VALUES (${org},${siteId},${id},${version},${schema},${state},${revision}) ON CONFLICT(org_id,site_id,module_id) DO UPDATE SET version=excluded.version,schema_version=excluded.schema_version,state=excluded.state,revision=excluded.revision`;
   const ctx=context(id,true,true);
   if(!disabling){for(const m of d.migrations)if(m.version>(previous?.schema_version||0))await m.up(ctx);if(!previous&&d.onInstall)await d.onInstall(ctx);}
   await ctx.emit('module.'+action,{version,schemaVersion:schema,state});return installation(id);
  });
 }
 async collection(actor,siteId,id,name,method,input={}){
  const d=this.#definition(id),c=Object.hasOwn(d.collections||{},name)&&d.collections[name];if(!c)fail(404,'Collection not found.');
  return this.#work(actor,siteId,id,async({requireInstalled,context})=>{
   await requireInstalled(id,method!=='GET');const ctx=context(id,method!=='GET');
   if(method==='GET')return input.id?ctx.records.get(name,input.id):ctx.records.list(name,input);
   if(c.readOnly)fail(403,'Read-only collection.');
   if(method==='PUT')return ctx.records.put(name,input);
   if(method==='DELETE'){await ctx.records.remove(name,input.id,input.revision);return {ok:true};}
   fail(405,'Invalid method.');
  });
 }
 async execute(actor,siteId,id,name,input){
  const d=this.#definition(id),command=d.commands?.[name];if(!command)fail(404,'Command not found.');
  return this.#work(actor,siteId,id,async({authorize,requireInstalled,context})=>{
   await authorize(command.permission);await requireInstalled(id,command.write!==false);
   return command.run(context(id,command.write!==false),parseFields(command.fields||{},input));
  });
 }
 async importLegacy(actor,siteId,id,snapshot){
  const d=this.#definition(id);
  if(snapshot?.format!=='studio-module-data'||snapshot.version!==1||snapshot.siteId!==siteId||snapshot.module?.id!==id||
     snapshot.module.version!==d.manifest.version||snapshot.module.schemaVersion!==d.manifest.schemaVersion||
     !Array.isArray(snapshot.records)||snapshot.records.length>10000)fail(422,'Incompatible legacy snapshot.');
  // Never silently drop operational or cross-module records during a migration.
  if(snapshot.operational||snapshot.integrations?.some(i=>i.records?.length))fail(409,'Operational/integration records require their own migration.');
  const old=snapshot.installation;
  if(!old||!['enabled','disabled','uninstalled'].includes(old.state)||!Number.isSafeInteger(old.revision)||old.revision<0||
     old.version!==d.manifest.version||old.schema_version!==d.manifest.schemaVersion)fail(422,'Incompatible installation.');
  return this.#work(actor,siteId,id,async({q,org,authorize,installation,context})=>{
   await authorize('members');for(const permission of d.manifest.permissions)await authorize(permission);
   if(await installation(id))fail(409,'Migration target already exists.');
   const keys=new Set(),records=[];
   for(const input of snapshot.records){
    const c=Object.hasOwn(d.collections||{},input.collection)&&d.collections[input.collection],key=input.collection+':'+input.id;
    if(!c||!valid(input.id)||keys.has(key)||c.singleton&&input.id!=='settings'||!Number.isSafeInteger(input.revision)||input.revision<0||
       !Number.isFinite(Date.parse(input.created))||!Number.isFinite(Date.parse(input.updated)))fail(422,'Invalid migration record.');
    const data=parseFields(c.fields,input.data);
    // Migration is lossless; normalization requires an explicitly reviewed source correction.
    if(JSON.stringify(data)!==JSON.stringify(input.data))fail(422,'Migration would normalize record data.');
    keys.add(key);records.push({...input,data});
   }
   for(const record of records){
    const c=d.collections[record.collection];
    const validateRefs=(fields,data)=>{for(const [key,f]of Object.entries(fields)){
     if(f.type==='reference'&&data[key]&&!keys.has(f.collection+':'+data[key]))fail(422,'Dangling migration reference.');
     if(f.type==='items')for(const item of data[key]||[])validateRefs(f.fields,item);
    }};
    validateRefs(c.fields,record.data);
    for(const [key,f]of Object.entries(c.fields))if(f.unique&&record.data[key]!==undefined&&records.some(r=>r!==record&&r.collection===record.collection&&r.data[key]===record.data[key]))fail(409,'Duplicate migration value.');
   }
   await q`INSERT INTO studio_async_installations VALUES (${org},${siteId},${id},${old.version},${old.schema_version},${old.state},${old.revision})`;
   for(const row of records)await q`INSERT INTO studio_async_records VALUES (${org},${siteId},${id},${row.collection},${row.id},${row.revision},0,${JSON.stringify(row.data)},${row.created},${row.updated})`;
   const readonly=context(id,false);
   for(const row of records){const hook=d.collections[row.collection].beforeSave;if(hook){const value=structuredClone(row.data);await hook(readonly,value,undefined);if(JSON.stringify(value)!==JSON.stringify(row.data))fail(422,'Migration hook would change record data.');}}
   await context(id,true,true).emit('module.migrated',{records:records.length,source:'module-api-v1'});
   return {records:records.length,installation:await installation(id)};
  });
 }
 async export(actor,siteId,id){
  const d=this.#definition(id);
  return this.#work(actor,siteId,id,async({q,org,authorize,requireInstalled})=>{
   for(const p of d.manifest.permissions)await authorize(p);const installation=await requireInstalled(id,false);
   const rows=(await q`SELECT * FROM studio_async_records WHERE org_id=${org} AND site_id=${siteId} AND module_id=${id} AND deleted=0 ORDER BY collection,id`).rows;
   return {format:'studio-async-module-data',version:1,module:d.manifest,siteId,installation,records:rows.map(r=>({collection:r.collection,...decode(r)}))};
  });
 }
}
