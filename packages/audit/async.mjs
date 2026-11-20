import {randomUUID} from 'node:crypto';
import {sanitize} from './index.mjs';

/** Append in the caller's unit of work; a failed audit write aborts its mutation. */
export class AsyncAudit {
 constructor({storage,context=()=>({})}){this.storage=storage;this.context=context;}
 async initialize(){await this.storage.transaction(async tx=>{
  await tx.query('CREATE TABLE IF NOT EXISTS studio_async_audit(id TEXT PRIMARY KEY,org_id TEXT NOT NULL,site_id TEXT NOT NULL,created TEXT NOT NULL,payload TEXT NOT NULL)');
  await tx.query('CREATE TABLE IF NOT EXISTS studio_async_audit_receipts(id TEXT PRIMARY KEY)');
 });return this;}
 async append(tx,entry){
  const id=randomUUID(),created=new Date().toISOString();
  const current=this.context();
  const context=Object.fromEntries(['actorId','actorType','actorLabel','requestId','method','path','ip','peerIp','ipSource','device'].filter(k=>current[k]!==undefined).map(k=>[k,current[k]]));
  const system=/^(system:|integration:)/.test(entry.actor.user_id);
  const payload=sanitize({...entry,actor:{user_id:entry.actor.user_id},context:{...context,actorId:entry.actor.user_id,actorType:system?'system':context.actorType||'human'}});
  await tx.query({sqlite:'INSERT INTO studio_async_audit VALUES (?,?,?,?,?)',postgres:'INSERT INTO studio_async_audit VALUES ($1,$2,$3,$4,$5)'},[id,entry.orgId,entry.siteId,created,JSON.stringify(payload)]);
 }
 /** Trusted composition bridge only. Authorization belongs to the audit query API. */
 async pending(limit=200){
  if(!Number.isSafeInteger(limit)||limit<1||limit>500)throw Error('Invalid audit batch limit');
  return this.storage.transaction(tx=>tx.all({sqlite:'SELECT a.* FROM studio_async_audit a LEFT JOIN studio_async_audit_receipts r ON r.id=a.id WHERE r.id IS NULL ORDER BY a.created,a.id LIMIT ?',postgres:'SELECT a.* FROM studio_async_audit a LEFT JOIN studio_async_audit_receipts r ON r.id=a.id WHERE r.id IS NULL ORDER BY a.created,a.id LIMIT $1'},[limit]));
 }
 async acknowledge(ids){await this.storage.transaction(async tx=>{for(const id of ids)await tx.query({sqlite:'INSERT INTO studio_async_audit_receipts VALUES (?) ON CONFLICT(id) DO NOTHING',postgres:'INSERT INTO studio_async_audit_receipts VALUES ($1) ON CONFLICT(id) DO NOTHING'},[id]);});}
}
