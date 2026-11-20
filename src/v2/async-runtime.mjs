import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {ModuleHost} from '@loft-studio/module-core';
import {AsyncModuleHost} from '@loft-studio/module-core/async';
import {SQLiteStorage,StorageError} from '@loft-studio/module-core/storage';
import {AsyncAudit} from '@loft-studio/audit/async';
import {parseFields} from '@loft-studio/sdk';
import {difference} from '@loft-studio/audit';

/** Startup runs before the HTTP listener and before delivery workers. */
export async function createAsyncRuntime({store,dataDir,modules,integrations,authorize,save,trustPolicy,features}){
 // Schema-only compatibility initialization for retained history and audit triggers.
 new ModuleHost({store,modules:[],integrations:[],authorize});
 const filename=path.join(dataDir,'modules.sqlite'),storage=new SQLiteStorage(filename);
 let reader;
 try{
  const audit=await new AsyncAudit({storage,context:()=>store.audit?.current()||{}}).initialize();
  const ports={'site.document.save':async({actor,siteId},input)=>save(actor,siteId,{...input,actorType:'human'})},sources={};
  for(const m of modules){for(const [key,fn]of Object.entries(m.bindings?.ports||{})){if(ports[key])throw Error('Duplicate module port');ports[key]=(ctx,input)=>features?.authorized?features.authorized(()=>{for(const p of m.manifest.permissions)authorize(ctx.actor,ctx.siteId,p);},()=>fn(ctx,input)):fn(ctx,input);}if(m.bindings?.source)sources[m.manifest.id]=m.bindings.source;}
  const host=await new AsyncModuleHost({storage,modules,integrations,sources,ports,audit,authorize,trustPolicy}).initialize();
  await migrate(store,storage,modules,integrations);
  reader=new DatabaseSync(filename,{readOnly:true});
  if(features)features.booking.stateReader=site=>reader.prepare("SELECT state FROM studio_async_installations WHERE site_id=? AND module_id='studio.booking'").get(site)?.state;
  let flushing;
  const flushAudit=()=>{
   if(flushing)return flushing;
   if(!store.audit)return Promise.resolve();
   flushing=(async()=>{for(const source of [audit,features?.asyncAudit].filter(Boolean))for(;;){const rows=await source.pending();if(!rows.length)break;
    store.transaction(()=>{for(const r of rows){const p=JSON.parse(r.payload),c=p.context;
     store.run('INSERT OR IGNORE INTO studio_log_entries(id,occurred_at,kind,action,scope,actor_id,actor_type,actor_label,request_id,method,path,ip,peer_ip,ip_source,device,resource,values_json,detail) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',r.id,r.created,'change',p.action,'site:'+r.site_id,c.actorId,c.actorType,c.actorLabel||null,c.requestId||null,c.method||null,c.path||null,c.ip||null,c.peerIp||null,c.ipSource||null,JSON.stringify(c.device||{}),p.resource||p.moduleId,JSON.stringify(difference(p.before,p.after)),JSON.stringify({moduleId:p.moduleId,authority:'async-runtime'}));
    }});await source.acknowledge(rows.map(r=>r.id));
   }})().finally(()=>{flushing=undefined;});return flushing;
  };
  return {host,storage,audit,flushAudit,
   async lifecycle(actor,site,id,action,revision){
    const result=await host.lifecycle(actor,site,id,action,revision);
    const m=modules.find(m=>m.manifest.id===id);
    if(['install','enable','upgrade'].includes(action)&&m?.bindings?.provision)await m.bindings.provision(await authorize(actor,site));
    return result;
   },
   async export(actor,site,id){const result=await host.export(actor,site,id),m=modules.find(m=>m.manifest.id===id);if(m?.bindings?.exportData)result.operational=await m.bindings.exportData({actor,site:await authorize(actor,site)});return result;},
   async close(){await flushAudit();if(features)delete features.booking.stateReader;reader.close();await storage.close();}
  };
 }catch(e){reader?.close();await storage.close();throw e;}
}

async function migrate(source,storage,modules,integrations){
 const legacyTables=['studio_module_installations','studio_module_records','studio_integration_records','studio_integration_record_versions','studio_integration_references','studio_event_cursors','studio_event_outbox','studio_event_deliveries'];
 const definitions=new Map(modules.map(m=>[m.manifest.id,m]));
 source.db.exec('CREATE TABLE IF NOT EXISTS studio_async_origin(id TEXT PRIMARY KEY,state TEXT NOT NULL)');
 let origin=source.get('SELECT * FROM studio_async_origin');
 if(!origin){origin={id:randomUUID(),state:'copying'};source.run('INSERT INTO studio_async_origin VALUES (?,?)',origin.id,origin.state);}
 // Freeze before reading any source rows: concurrent old writers cannot race the copy.
 source.transaction(()=>{for(const table of legacyTables)for(const op of ['INSERT','UPDATE','DELETE'])source.db.exec(`CREATE TRIGGER IF NOT EXISTS async_freeze_${table}_${op} BEFORE ${op} ON ${table} BEGIN SELECT RAISE(ABORT,'Module storage moved to async runtime'); END;`);});
 await storage.transaction(async tx=>{
  await tx.query('CREATE TABLE IF NOT EXISTS studio_async_origin(id TEXT PRIMARY KEY)');
  const target=await tx.get('SELECT id FROM studio_async_origin');
  if(target&&target.id!==origin.id)throw new StorageError('MIGRATION_REQUIRED','Module database belongs to another application database.');
  if(!target&&origin.state==='live')throw new StorageError('MIGRATION_REQUIRED','Authoritative module database is missing; restore the paired backup.');
  if(!target)await tx.query('INSERT INTO studio_async_origin VALUES (?)',[origin.id]);
  await tx.query('CREATE TABLE IF NOT EXISTS studio_async_migrations(version INTEGER PRIMARY KEY,created TEXT NOT NULL)');
  if(await tx.get('SELECT version FROM studio_async_migrations WHERE version=1'))return;
  if(Number((await tx.get('SELECT COUNT(*) n FROM studio_async_installations')).n))throw Error('Async target is not empty; explicit migration required.');
  const sites=source.all('SELECT id,org_id FROM studio_sites'),org=new Map(sites.map(s=>[s.id,s.org_id]));
  for(const s of sites)await tx.query('INSERT INTO studio_async_scopes VALUES (?,?,0)',[s.org_id,s.id]);
  for(const r of source.all('SELECT * FROM studio_module_installations')){
   const m=definitions.get(r.module_id);if(m&&(r.version!==m.manifest.version||r.schema_version!==m.manifest.schemaVersion))throw Error('Upgrade legacy module before async migration: '+r.module_id);
   await tx.query('INSERT INTO studio_async_installations VALUES (?,?,?,?,?,?,?)',[org.get(r.site_id),r.site_id,r.module_id,r.version,r.schema_version,r.state,r.revision]);
  }
  for(const r of source.all('SELECT * FROM studio_module_records')){
   const c=definitions.get(r.module_id)?.collections?.[r.collection];if(c&&JSON.stringify(parseFields(c.fields,JSON.parse(r.data)))!==r.data)throw Error('Migration would normalize module data.');
   await tx.query('INSERT INTO studio_async_records VALUES (?,?,?,?,?,?,0,?,?,?)',[org.get(r.site_id),r.site_id,r.module_id,r.collection,r.id,r.revision,r.data,r.created,r.updated]);
  }
  for(const r of source.all('SELECT * FROM studio_integration_records')){
   const c=integrations.find(i=>i.id===r.integration_id)?.collections?.[r.collection];if(c&&JSON.stringify(parseFields(c.fields,JSON.parse(r.data)))!==r.data)throw Error('Migration would normalize integration data.');
   await tx.query('INSERT INTO studio_async_links VALUES (?,?,?,?,?,?,0,?,?)',[org.get(r.site_id),r.site_id,r.integration_id,r.collection,r.id,r.revision,r.data,new Date().toISOString()]);
  }
  for(const r of source.all('SELECT * FROM studio_integration_record_versions'))await tx.query('INSERT INTO studio_async_links VALUES (?,?,?,?,?,?,1,?,?) ON CONFLICT(org_id,site_id,integration_id,collection,id) DO NOTHING',[org.get(r.site_id),r.site_id,r.integration_id,r.collection,r.id,r.revision,'{}',new Date().toISOString()]);
  for(const r of source.all('SELECT * FROM studio_integration_references'))await tx.query('INSERT INTO studio_async_references VALUES (?,?,?,?,?,?,?,?,?)',[org.get(r.site_id),r.site_id,r.integration_id,r.collection,r.record_id,r.field,r.target_module,r.target_collection,r.target_id]);
  for(const r of source.all('SELECT * FROM studio_event_outbox')){
   // Old sources could enqueue before installation; retain their events too.
   const installed=await tx.get('SELECT module_id FROM studio_async_installations WHERE org_id=? AND site_id=? AND module_id=?',[org.get(r.site_id),r.site_id,r.module_id]);
   if(!installed){const m=definitions.get(r.module_id);if(!m)throw Error('Missing historical event module: '+r.module_id);await tx.query("INSERT INTO studio_async_installations VALUES (?,?,?,?,?,'uninstalled',0)",[org.get(r.site_id),r.site_id,r.module_id,m.manifest.version,m.manifest.schemaVersion]);}
   await tx.query('INSERT INTO studio_async_outbox VALUES (?,?,?,?,?,?,?,?)',[r.id,org.get(r.site_id),r.site_id,r.module_id,r.type,r.data,r.actor,r.created]);
   await tx.query('INSERT INTO studio_async_event_versions VALUES (?,?)',[r.id,r.version]);
  }
  for(const r of source.all('SELECT * FROM studio_event_deliveries'))await tx.query('INSERT INTO studio_async_deliveries VALUES (?,?,?,?,?,?)',[r.event_id,r.integration_id,r.state,r.attempts,r.next_attempt,r.error]);
  for(const r of source.all('SELECT * FROM studio_event_cursors'))for(const s of sites)await tx.query('INSERT INTO studio_async_cursors VALUES (?,?,?,?)',[s.org_id,s.id,r.module_id,r.sequence]);
  await tx.query('INSERT INTO studio_async_migrations VALUES (1,?)',[new Date().toISOString()]);
 });
 source.run("UPDATE studio_async_origin SET state='live' WHERE id=?",origin.id);
}
