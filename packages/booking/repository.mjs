import {AsyncLocalStorage} from 'node:async_hooks';
import {fail} from '@loft-studio/sdk';

export const operationTables=['booking_settings','reservations','calendar_events','booking_requests','reservation_participants','integrations','payment_transactions','payment_events','booking_changes'];
const numeric=new Set(['start','end','busy_start','busy_end','hold_until','sequence','price_minor','amount']);
const normalize=row=>row&&Object.fromEntries(Object.entries(row).map(([k,v])=>[k,v!==null&&numeric.has(k)?Number(v):v]));
const keys={booking_settings:['site_id'],reservations:['id'],calendar_events:['id'],booking_requests:['site_id','request_id'],reservation_participants:['booking_id','position'],integrations:['site_id','provider'],payment_transactions:['id'],payment_events:['id']};
const identity=(table,row)=>keys[table].map(k=>row[k]).join('/');
const auditRow=(table,row)=>!row?null:table==='payment_transactions'?Object.fromEntries(['id','site_id','booking_id','provider','amount','currency','status','created','updated'].map(k=>[k,row[k]])):row;

/** Trusted domain repository. Modules receive domain methods, never this SQL port. */
export class OperationsRepository {
 #context=new AsyncLocalStorage();
 constructor({storage,resolveSite,audit,authorize=()=>{},actor=()=> 'system:operations'}){this.storage=storage;this.resolveSite=resolveSite;this.audit=audit;this.authorize=authorize;this.actor=actor;}
 sql(sql){
  sql=sql.replace(/\b(booking_settings|reservations|calendar_events|booking_requests|reservation_participants|integrations|payment_transactions|payment_events|booking_changes)\b/g,'studio_ops_$1');
  if(sql.startsWith('INSERT OR IGNORE'))sql=sql.replace('INSERT OR IGNORE','INSERT')+' ON CONFLICT DO NOTHING';
  if(this.storage.dialect==='postgres'){let n=0;sql=sql.replace(/\bend\b/g,'"end"').replace(/\?/g,()=>'$'+(++n));}return sql;
 }
 async initialize(){await this.storage.transaction(async tx=>{
  const big='BIGINT',sequence=this.storage.dialect==='postgres'?'BIGSERIAL PRIMARY KEY':'INTEGER PRIMARY KEY AUTOINCREMENT';
  for(const sql of [
   'CREATE TABLE IF NOT EXISTS studio_ops_scopes(site_id TEXT PRIMARY KEY,org_id TEXT NOT NULL,revision INTEGER NOT NULL)',
   'CREATE TABLE IF NOT EXISTS booking_settings(site_id TEXT PRIMARY KEY,revision INTEGER NOT NULL,content TEXT NOT NULL)',
   `CREATE TABLE IF NOT EXISTS reservations(id TEXT PRIMARY KEY,site_id TEXT NOT NULL,revision INTEGER NOT NULL,reference TEXT UNIQUE NOT NULL,service_id TEXT NOT NULL,resource TEXT NOT NULL,start ${big} NOT NULL,end ${big} NOT NULL,busy_start ${big} NOT NULL,busy_end ${big} NOT NULL,quantity INTEGER NOT NULL,status TEXT NOT NULL,hold_until ${big},price_minor INTEGER NOT NULL,currency TEXT NOT NULL,customer TEXT NOT NULL,pets TEXT NOT NULL,notes TEXT NOT NULL,token_hash TEXT NOT NULL,created TEXT NOT NULL,updated TEXT NOT NULL)`,
   'CREATE INDEX IF NOT EXISTS studio_ops_booking_capacity ON reservations(site_id,resource,busy_start,busy_end,status)',
   `CREATE TABLE IF NOT EXISTS calendar_events(id TEXT PRIMARY KEY,site_id TEXT NOT NULL,revision INTEGER NOT NULL,title TEXT NOT NULL,start ${big} NOT NULL,end ${big} NOT NULL,resource TEXT NOT NULL,blocks INTEGER NOT NULL,notes TEXT NOT NULL)`,
   'CREATE TABLE IF NOT EXISTS booking_requests(site_id TEXT NOT NULL,request_id TEXT NOT NULL,booking_id TEXT NOT NULL,fingerprint TEXT,PRIMARY KEY(site_id,request_id))',
   'CREATE TABLE IF NOT EXISTS reservation_participants(booking_id TEXT NOT NULL REFERENCES reservations(id),position INTEGER NOT NULL,name TEXT NOT NULL,notes TEXT NOT NULL,extensions TEXT NOT NULL,PRIMARY KEY(booking_id,position))',
   'CREATE TABLE IF NOT EXISTS integrations(site_id TEXT NOT NULL,provider TEXT NOT NULL,revision INTEGER NOT NULL,enabled INTEGER NOT NULL,mode TEXT NOT NULL,options TEXT NOT NULL,secrets TEXT NOT NULL,PRIMARY KEY(site_id,provider))',
   'CREATE TABLE IF NOT EXISTS payment_transactions(id TEXT PRIMARY KEY,site_id TEXT NOT NULL,booking_id TEXT NOT NULL REFERENCES reservations(id),provider TEXT NOT NULL,reference TEXT,url TEXT,amount INTEGER NOT NULL,currency TEXT NOT NULL,status TEXT NOT NULL,created TEXT NOT NULL,updated TEXT NOT NULL,detail TEXT NOT NULL)',
   'CREATE INDEX IF NOT EXISTS studio_ops_payment_booking ON payment_transactions(booking_id)',
   'CREATE TABLE IF NOT EXISTS payment_events(id TEXT PRIMARY KEY,created TEXT NOT NULL)',
   `CREATE TABLE IF NOT EXISTS booking_changes(sequence ${sequence},site_id TEXT NOT NULL,booking_id TEXT NOT NULL,revision INTEGER NOT NULL,data TEXT NOT NULL,created TEXT NOT NULL,UNIQUE(booking_id,revision))`
  ])await tx.query(this.sql(sql));
  if(this.storage.dialect==='postgres'){
   await tx.query('ALTER TABLE studio_ops_reservations ALTER COLUMN price_minor TYPE BIGINT');
   await tx.query('ALTER TABLE studio_ops_payment_transactions ALTER COLUMN amount TYPE BIGINT');
  }
 });return this;}
 async bind(site,work){const current=this.#context.getStore();if(current){if(current.site!==site)fail(403,'Cross-site transaction refused.');return work();}return this.#context.run({site},work);}
 async scope(site,work){return this.bind(site,()=>this.transaction(work));}
 async transaction(work){
  const context=this.#context.getStore();if(!context)throw Error('Operational site scope required.');
  if(context.tx){if(context.closed)fail(409,'Operational transaction expired.');return work();}
  const authorized=await this.resolveSite(context.site);if(!authorized||authorized.id!==context.site||!authorized.org_id)fail(403,'Unknown operational scope.');
  return this.storage.transaction(async tx=>{
   const scoped={...context,tx,org:authorized.org_id,actor:context.actor||this.actor(),closed:false};
   try{return await this.#context.run(scoped,async()=>{
    await this.authorize(context.site);
    await tx.query(this.sql('INSERT INTO studio_ops_scopes VALUES (?,?,0) ON CONFLICT(site_id) DO NOTHING'),[context.site,authorized.org_id]);
    const row=await tx.get(this.sql('SELECT org_id FROM studio_ops_scopes WHERE site_id=?'),[context.site]);if(row.org_id!==authorized.org_id)fail(403,'Operational site authority changed.');
    await tx.query(this.sql('UPDATE studio_ops_scopes SET revision=revision+1 WHERE site_id=?'),[context.site]);
    const result=await work();await this.authorize(context.site);
    const fresh=await this.resolveSite(context.site);if(fresh?.org_id!==authorized.org_id)fail(403,'Operational site authority changed.');return result;
   });}finally{scoped.closed=true;}
  });
 }
 async all(sql,...params){return this.transaction(async()=>{const rows=await this.#context.getStore().tx.all(this.sql(sql),params);return rows.map(normalize);});}
 async get(sql,...params){return (await this.all(sql,...params))[0];}
 async run(sql,...params){return this.transaction(async()=>{
  const ctx=this.#context.getStore(),match=sql.match(/^(INSERT(?: OR IGNORE)? INTO|UPDATE|DELETE FROM) (\w+)/i);if(!match||!keys[match[2]])throw Error('Unsupported operational mutation');
  const table=match[2],kind=match[1].split(' ')[0];let before=[];
  if(kind!=='INSERT'){
   const where=sql.match(/\bWHERE\b[\s\S]*$/i);if(!where)throw Error('Unbounded operational mutation refused.');
   const preceding=sql.slice(0,where.index).split('?').length-1;
   before=await this.all('SELECT * FROM '+table+' '+where[0],...params.slice(preceding));
  }else if(table==='booking_settings')before=await this.all('SELECT * FROM booking_settings WHERE site_id=?',params[0]);
  else if(table==='integrations')before=await this.all('SELECT * FROM integrations WHERE site_id=? AND provider=?',params[0],params[1]);
  const result=await ctx.tx.query(this.sql(sql)+' RETURNING *',params),after=result.rows.map(normalize),prior=new Map(before.map(r=>[identity(table,r),r]));
  for(const r of kind==='DELETE'?before:after){
   if(r.site_id&&r.site_id!==ctx.site)fail(403,'Cross-site mutation refused.');
   if(r.booking_id){const booking=await this.get('SELECT site_id FROM reservations WHERE id=?',r.booking_id);if(booking?.site_id!==ctx.site)fail(403,'Cross-site reservation refused.');}
   const old=kind==='DELETE'?r:prior.get(identity(table,r))||null,next=kind==='DELETE'?null:r;
   if(this.audit)await this.audit.append(ctx.tx,{orgId:ctx.org,siteId:ctx.site,moduleId:table.startsWith('payment')?'studio.payments':'studio.booking',actor:{user_id:ctx.actor||'system:operations'},action:table+'.'+kind.toLowerCase(),resource:identity(table,r),before:auditRow(table,old),after:auditRow(table,next)});
   if(table==='reservations'&&next&&old?.revision!==next.revision){
    const data={bookingId:r.id,bookingRevision:r.revision,reference:r.reference,customerName:JSON.parse(r.customer).name,serviceId:r.service_id,status:r.status,start:r.start,end:r.end,kind:old?'updated':'created'};
    await ctx.tx.query(this.sql('INSERT INTO booking_changes(site_id,booking_id,revision,data,created) VALUES (?,?,?,?,?)'),[ctx.site,r.id,r.revision,JSON.stringify(data),r.updated]);
   }
  }
  return {changes:result.rowCount,rows:after};
 });}
 async event(site,actor,action,detail){if(site!==this.#context.getStore()?.site)fail(403,'Event scope mismatch.');return this.transaction(async()=>{const c=this.#context.getStore();if(this.audit)await this.audit.append(c.tx,{orgId:c.org,siteId:site,moduleId:'studio.booking',actor:{user_id:actor||'system:operations'},action,before:null,after:detail});});}
 async asActor(actor,work){const c=this.#context.getStore();return this.#context.run({...c,actor},work);}
 async changes(after,limit){if(!Number.isSafeInteger(after)||after<0||!Number.isSafeInteger(limit)||limit<1||limit>500)fail(422,'Invalid event cursor.');return this.storage.transaction(async tx=>(await tx.all(this.sql('SELECT * FROM booking_changes WHERE sequence>? ORDER BY sequence LIMIT ?'),[after,limit])).map(normalize).map(r=>({sequence:r.sequence,siteId:r.site_id,type:'booking.changed',data:JSON.parse(r.data),actor:'system:booking-storage',occurredAt:r.created})));}
}
