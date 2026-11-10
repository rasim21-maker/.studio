import {randomUUID} from 'node:crypto';
import {defineIntegration, fail, parseFields} from '@loft-studio/sdk';
const synchronous = value => {if (value?.then) fail(500, 'Entegrasyon işlemleri senkron olmalı.');return value;};
const decode = row => row && ({id:row.id, revision:row.revision, data:JSON.parse(row.data)});
const validId = id => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(id);

/** Durable local delivery; trusted packages, scoped storage, no network in a transaction. */
export class IntegrationRuntime {
  /** @param {any} host @param {any[]} definitions */
  constructor(host, definitions = []) {
    this.host = host; this.store = host.store; this.registry = new Map();
    for (const candidate of definitions) {
      const d = defineIntegration(candidate);
      if (this.registry.has(d.id)) fail(422, 'Tekrarlanan entegrasyon.');
      for (const [id,major] of Object.entries(d.requires)) {
        const module = host.registry.get(id);
        // Missing optional packages keep this integration dormant.
        if (module && Number(module.manifest.version.split('.')[0]) !== major) fail(422, 'Entegrasyon modül sürümü uyumsuz: '+id);
      }
      for (const s of d.subscriptions) {
        const module = host.registry.get(s.module);
        if (module && module.events?.[s.type]?.version !== s.version) fail(422, 'Entegrasyon olay sürümü uyumsuz.');
      }
      this.registry.set(d.id,d);
    }
    this.store.db.exec([
      "CREATE TABLE IF NOT EXISTS studio_event_cursors(module_id TEXT PRIMARY KEY, sequence INTEGER NOT NULL);",
      "CREATE TABLE IF NOT EXISTS studio_event_outbox(sequence INTEGER PRIMARY KEY AUTOINCREMENT,id TEXT NOT NULL UNIQUE,site_id TEXT NOT NULL REFERENCES studio_sites(id),module_id TEXT NOT NULL,type TEXT NOT NULL,version INTEGER NOT NULL,actor TEXT NOT NULL,data TEXT NOT NULL,created TEXT NOT NULL);",
      "CREATE TABLE IF NOT EXISTS studio_event_deliveries(event_id TEXT NOT NULL REFERENCES studio_event_outbox(id),integration_id TEXT NOT NULL,state TEXT NOT NULL CHECK(state IN ('pending','delivered','failed')),attempts INTEGER NOT NULL DEFAULT 0,next_attempt INTEGER NOT NULL DEFAULT 0,error TEXT,PRIMARY KEY(event_id,integration_id));",
      "CREATE TABLE IF NOT EXISTS studio_integration_records(site_id TEXT NOT NULL REFERENCES studio_sites(id),integration_id TEXT NOT NULL,collection TEXT NOT NULL,id TEXT NOT NULL,revision INTEGER NOT NULL,data TEXT NOT NULL,PRIMARY KEY(site_id,integration_id,collection,id));",
      "CREATE TABLE IF NOT EXISTS studio_integration_record_versions(site_id TEXT NOT NULL,integration_id TEXT NOT NULL,collection TEXT NOT NULL,id TEXT NOT NULL,revision INTEGER NOT NULL,PRIMARY KEY(site_id,integration_id,collection,id));",
      "CREATE TABLE IF NOT EXISTS studio_integration_references(site_id TEXT NOT NULL,integration_id TEXT NOT NULL,collection TEXT NOT NULL,record_id TEXT NOT NULL,field TEXT NOT NULL,target_module TEXT NOT NULL,target_collection TEXT NOT NULL,target_id TEXT NOT NULL,PRIMARY KEY(site_id,integration_id,collection,record_id,field));",
      "CREATE INDEX IF NOT EXISTS studio_integration_reference_target ON studio_integration_references(site_id,target_module,target_collection,target_id);",
      "CREATE INDEX IF NOT EXISTS studio_delivery_due ON studio_event_deliveries(integration_id,state,next_attempt);",
      "CREATE INDEX IF NOT EXISTS studio_outbox_site ON studio_event_outbox(site_id,sequence);"
    ].join('\n'));
    for(const d of this.registry.values())for(const s of d.subscriptions)this.store.run("INSERT OR IGNORE INTO studio_event_deliveries(event_id,integration_id,state) SELECT id,?,'pending' FROM studio_event_outbox WHERE module_id=? AND type=? AND version=?",d.id,s.module,s.type,s.version);
  }
  active(siteId,d) {
    return Object.entries(d.requires).every(([id,major]) => {
      const module = this.host.registry.get(id), row = this.host.installation(siteId,id);
      return module && Number(module.manifest.version.split('.')[0]) === major && row?.state === 'enabled' && row.version === module.manifest.version && row.schema_version === module.manifest.schemaVersion;
    });
  }
  access(actor,siteId,id,requireActive=true) {
    const d = this.registry.get(id); if (!d) fail(404,'Entegrasyon bulunamadı.');
    this.host.authorize(actor,siteId);
    for (const permission of d.permissions) this.host.authorize(actor,siteId,permission);
    for (const module of Object.keys(d.requires)) {
      if (!this.host.registry.has(module)) fail(409,'Gerekli modül kullanılamıyor.');
      for (const permission of this.host.definition(module).manifest.permissions) this.host.authorize(actor,siteId,permission);
    }
    if (requireActive&&!this.active(siteId,d)) fail(409,'Entegrasyon için ilgili modülleri etkinleştirin ve güncelleyin.');
    return d;
  }
  views(actor,siteId,moduleId) {
    const views=[];
    for (const d of this.registry.values()) {
      if (!this.active(siteId,d)) continue;
      try {this.access(actor,siteId,d.id);} catch (e) {if ([403,404,409].includes(e.status)) continue;throw e;}
      for (const view of d.views || []) if (view.module === moduleId) views.push({...view,integrationId:d.id});
    }
    return views;
  }
  publish(siteId,moduleId,type,data,actor='system',occurredAt=new Date().toISOString()) {
    const contract = this.host.definition(moduleId).events?.[type];
    if (!contract) fail(422,'Tanımsız olay sözleşmesi.');
    const validated=parseFields(contract.fields,data), encoded=JSON.stringify(validated);
    if (Buffer.byteLength(encoded)>16000 || typeof actor!=='string' || actor.length>200 || !Number.isFinite(Date.parse(occurredAt))) fail(422,'Olay boyutu veya kaynağı geçersiz.');
    const id=randomUUID();
    this.store.run('INSERT INTO studio_event_outbox(id,site_id,module_id,type,version,actor,data,created) VALUES (?,?,?,?,?,?,?,?)',id,siteId,moduleId,type,contract.version,actor,encoded,occurredAt);
    for (const d of this.registry.values()) if (d.subscriptions.some(s=>s.module===moduleId&&s.type===type&&s.version===contract.version)) {
      this.store.run("INSERT INTO studio_event_deliveries(event_id,integration_id,state) VALUES (?,?,'pending')",id,d.id);
    }
    return id;
  }
  ingest(limit=100) {
    if(!Number.isSafeInteger(limit)||limit<1||limit>500)fail(422,'Olay kaynağı sınırı geçersiz.');
    const failedSources=[];
    for (const [moduleId,module] of this.host.registry) {
      if (!module.eventSource) continue;
      try{this.store.transaction(()=>{
        let cursor=this.store.get('SELECT sequence FROM studio_event_cursors WHERE module_id=?',moduleId)?.sequence || 0;
        const rows=synchronous(module.eventSource.read(cursor,limit));
        if (!Array.isArray(rows) || rows.length>limit) fail(422,'Olay kaynağı sınırı geçersiz.');
        for (const row of rows) {
          if (!Number.isSafeInteger(row.sequence) || row.sequence<=cursor) fail(422,'Olay kaynağı sırası geçersiz.');
          if (this.store.get('SELECT id FROM studio_sites WHERE id=?',row.siteId)) this.publish(row.siteId,moduleId,row.type,row.data,row.actor,row.occurredAt);
          cursor=row.sequence;
        }
        this.store.run('INSERT INTO studio_event_cursors VALUES (?,?) ON CONFLICT(module_id) DO UPDATE SET sequence=excluded.sequence',moduleId,cursor);
      });}catch{failedSources.push(moduleId);}
    }
    return {failedSources};
  }
  context(d,siteId,actor=null,writable=true) {
    const store=this.store;
    const schema = name => {const c=d.collections?.[name];if(!c)fail(404,'Entegrasyon koleksiyonu bulunamadı.');return c;};
    const get=(name,id)=>{schema(name);if(!validId(id))fail(422,'Kayıt kimliği geçersiz.');return decode(store.get('SELECT * FROM studio_integration_records WHERE site_id=? AND integration_id=? AND collection=? AND id=?',siteId,d.id,name,id));};
    const list=(name,{where={},limit=100,offset=0,search='',orderBy}={})=>{
      const c=schema(name);
      if (!Number.isSafeInteger(limit)||limit<1||limit>500||!Number.isSafeInteger(offset)||offset<0||typeof search!=='string'||search.length>200)fail(422,'Liste sınırı geçersiz.');
      const clauses=['site_id=?','integration_id=?','collection=?'],params=[siteId,d.id,name];
      for (const [key,value] of Object.entries(where)) {
        if (!Object.hasOwn(c.fields,key))fail(422,'Filtre alanı geçersiz.');
        const values=Array.isArray(value)?value:[value];
        if (!values.length || values.length>100 || values.some(v=>!['string','number','boolean'].includes(typeof v)))fail(422,'Filtre değeri geçersiz.');
        clauses.push('json_extract(data,?) IN ('+values.map(()=>'?').join(',')+')');params.push('$.'+key,...values.map(v=>typeof v==='boolean'?Number(v):v));
      }
      if (search) {clauses.push("data LIKE ? ESCAPE '\\'");params.push('%'+search.replace(/[\\%_]/g,'\\$&')+'%');}
      const sql=clauses.join(' AND ');
      if(orderBy&&!Object.hasOwn(c.fields,orderBy))fail(422,'Sıralama alanı geçersiz.');
      return {total:store.get('SELECT COUNT(*) n FROM studio_integration_records WHERE '+sql,...params).n,
        items:store.all('SELECT * FROM studio_integration_records WHERE '+sql+' ORDER BY '+(orderBy?'json_extract(data,?) DESC,':'')+'rowid DESC LIMIT ? OFFSET ?',...params,...(orderBy?['$.'+orderBy]:[]),limit,offset).map(decode)};
    };
    const records={get,list,put:(name,input)=>{
      if(!writable)fail(403,'Salt okunur entegrasyon işlemi.');
      const c=schema(name),id=input.id||randomUUID(),previous=get(name,id);
      if(previous?input.revision!==previous.revision:input.revision!==undefined&&input.revision!==-1)fail(409,'Bağlantı başka bir oturumda değişti.');
      const data=parseFields(c.fields,input.data);
      for(const [key,f]of Object.entries(c.fields)) if(f.type==='reference'&&data[key]){
        if(!actor||!Object.hasOwn(d.requires,f.module))fail(403,'İlişki doğrulaması için yetkili kullanıcı gerekli.');
        this.host.collection(actor,siteId,f.module,f.collection,'GET',{id:data[key]});
      }
      const last=store.get('SELECT revision FROM studio_integration_record_versions WHERE site_id=? AND integration_id=? AND collection=? AND id=?',siteId,d.id,name,id);
      const revision=Math.max(previous?.revision??-1,last?.revision??-1)+1;
      store.run('INSERT INTO studio_integration_records VALUES (?,?,?,?,?,?) ON CONFLICT(site_id,integration_id,collection,id) DO UPDATE SET revision=excluded.revision,data=excluded.data',siteId,d.id,name,id,revision,JSON.stringify(data));
      store.run('INSERT INTO studio_integration_record_versions VALUES (?,?,?,?,?) ON CONFLICT(site_id,integration_id,collection,id) DO UPDATE SET revision=excluded.revision',siteId,d.id,name,id,revision);
      store.run('DELETE FROM studio_integration_references WHERE site_id=? AND integration_id=? AND collection=? AND record_id=?',siteId,d.id,name,id);
      for(const [key,f]of Object.entries(c.fields))if(f.type==='reference'&&data[key])store.run('INSERT INTO studio_integration_references VALUES (?,?,?,?,?,?,?,?)',siteId,d.id,name,id,key,f.module,f.collection,data[key]);
      return {id,revision,data};
    },remove:(name,id,revision)=>{
      if(!writable)fail(403,'Salt okunur entegrasyon işlemi.');
      const old=get(name,id);if(!old||old.revision!==revision)fail(409,'Bağlantı başka bir oturumda değişti.');
      store.run('DELETE FROM studio_integration_records WHERE site_id=? AND integration_id=? AND collection=? AND id=?',siteId,d.id,name,id);
      store.run('DELETE FROM studio_integration_references WHERE site_id=? AND integration_id=? AND collection=? AND record_id=?',siteId,d.id,name,id);
    }};
    return {siteId,actor,records,
      modules:{get:(module,collection,id)=>{
        if(!actor||!Object.hasOwn(d.requires,module))fail(403,'Bildirilmemiş modül erişimi.');
        return this.host.collection(actor,siteId,module,collection,'GET',{id});
      }},
      audit:(action,data)=>{
        if(!writable)fail(403,'Salt okunur entegrasyon işlemi.');
        store.run('INSERT INTO studio_module_events VALUES (?,?,?,?,?,?,?)',randomUUID(),siteId,d.id,actor?.user_id||'integration:'+d.id,action,JSON.stringify(data),new Date().toISOString());
      }};
  }
  drain({limit=100,now=Date.now()}={}) {
    if(!Number.isSafeInteger(limit)||limit<1||limit>500||!Number.isSafeInteger(now))fail(422,'İşleyici sınırı geçersiz.');
    let delivered=0,failed=0;
    for (const d of this.registry.values()) {
      // Disabled sites never occupy the front of the queue or consume retry attempts.
      const clauses=[],params=[d.id,now];
      for (const id of Object.keys(d.requires)) {
        const m=this.host.registry.get(id);if(!m){clauses.push('0');continue;}
        clauses.push("EXISTS (SELECT 1 FROM studio_module_installations i WHERE i.site_id=e.site_id AND i.module_id=? AND i.state='enabled' AND i.version=? AND i.schema_version=?)");
        params.push(id,m.manifest.version,m.manifest.schemaVersion);
      }
      const rows=this.store.all("SELECT e.*,q.attempts FROM studio_event_deliveries q JOIN studio_event_outbox e ON e.id=q.event_id WHERE q.integration_id=? AND q.state='pending' AND q.next_attempt<=? AND "+clauses.join(' AND ')+' ORDER BY e.sequence LIMIT ?',...params,limit);
      for (const event of rows) {
        try {
          this.store.transaction(()=>{
            if(!this.active(event.site_id,d))return;
            if(this.store.get('SELECT state FROM studio_event_deliveries WHERE event_id=? AND integration_id=?',event.id,d.id)?.state!=='pending')return;
            const subscription=d.subscriptions.find(s=>s.module===event.module_id&&s.type===event.type&&s.version===event.version);
            if(!subscription)fail(409,'Olay sürümü desteklenmiyor.');
            const contract=this.host.definition(event.module_id).events?.[event.type];
            if(contract?.version!==event.version)fail(409,'Olay sözleşmesi değişti.');
            const data=parseFields(contract.fields,JSON.parse(event.data));
            synchronous(subscription.run(this.context(d,event.site_id),{id:event.id,type:event.type,version:event.version,data,actor:event.actor,occurredAt:event.created}));
            this.store.run("UPDATE studio_event_deliveries SET state='delivered',attempts=attempts+1,error=NULL WHERE event_id=? AND integration_id=?",event.id,d.id);
            delivered++;
          });
        } catch {
          const attempts=event.attempts+1,state=attempts>=5?'failed':'pending';
          // Do not persist arbitrary plugin errors, payloads, or secrets in diagnostics.
          this.store.run('UPDATE studio_event_deliveries SET state=?,attempts=?,next_attempt=?,error=? WHERE event_id=? AND integration_id=?',state,attempts,now+Math.min(60000,1000*2**attempts),'HANDLER_FAILED',event.id,d.id);
          failed++;
        }
      }
    }
    return {delivered,failed};
  }
  execute(actor,siteId,id,commandId,input) {
    const d=this.access(actor,siteId,id),command=d.commands?.[commandId];
    if(!command)fail(404,'Entegrasyon işlemi bulunamadı.');
    const value=parseFields(command.fields||{},input);
    const execute=()=>synchronous(command.run(this.context(d,siteId,actor,command.write!==false),value));
    return command.write===false?execute():this.store.transaction(execute);
  }
  status(actor,siteId,id) {
    this.access(actor,siteId,id);
    return this.store.all('SELECT q.state,COUNT(*) count FROM studio_event_deliveries q JOIN studio_event_outbox e ON e.id=q.event_id WHERE e.site_id=? AND q.integration_id=? GROUP BY q.state',siteId,id);
  }
  retry(actor,siteId,id) {
    this.access(actor,siteId,id);this.host.authorize(actor,siteId,'members');
    return this.store.transaction(()=>{
      const result=this.store.run("UPDATE studio_event_deliveries SET state='pending',attempts=0,next_attempt=0,error=NULL WHERE integration_id=? AND state='failed' AND event_id IN (SELECT id FROM studio_event_outbox WHERE site_id=?)",id,siteId);
      this.context(this.registry.get(id),siteId,actor).audit('integration.retry',{count:Number(result.changes)});
      return {retried:Number(result.changes)};
    });
  }
  assertUnreferenced(siteId,moduleId,collection,id) {
    if(this.store.get('SELECT record_id FROM studio_integration_references WHERE site_id=? AND target_module=? AND target_collection=? AND target_id=? LIMIT 1',siteId,moduleId,collection,id))fail(409,'Kayıt bir entegrasyonda kullanılıyor; silmek yerine arşivleyin.');
  }
  exportForModule(actor,siteId,moduleId) {
    const exports=[];
    for(const d of this.registry.values())if(Object.hasOwn(d.requires,moduleId)){
      try{this.access(actor,siteId,d.id,false);}catch(e){if([403,404,409].includes(e.status))continue;throw e;}
      exports.push({id:d.id,version:d.version,records:this.store.all('SELECT * FROM studio_integration_records WHERE site_id=? AND integration_id=? ORDER BY collection,id',siteId,d.id).map(r=>({collection:r.collection,...decode(r)}))});
    }
    return exports;
  }
}
