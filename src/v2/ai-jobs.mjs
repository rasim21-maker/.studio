import {isDeepStrictEqual} from 'node:util';
import {validateAiJob,validateAiResult} from '../../shared/v2/ai-contracts.mjs';
import {newAiJobState,transitionAiJob} from '../../shared/v2/ai-job-state.mjs';
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
const sql=s=>({sqlite:s,postgres:s.replace(/\?/g,(()=>{let n=0;return()=>'$'+ ++n;})())});
const decode=row=>row?{job:JSON.parse(row.job),state:JSON.parse(row.state),result:row.result?JSON.parse(row.result):null}:null;
/** Internal repository, not a worker-auth API. authorize must resolve trusted current scope. */
export class AiJobs {
 constructor({storage,authorize,audit,clock=Date.now}){if(!storage||typeof authorize!=='function'||typeof audit?.append!=='function')throw Error('Storage, authorization and atomic audit required');Object.assign(this,{storage,authorize,audit,clock});}
 async initialize(){await this.storage.transaction(async tx=>{
  await tx.query('CREATE TABLE IF NOT EXISTS studio_ai_job_scopes(tenant TEXT PRIMARY KEY, revision INTEGER NOT NULL)');
  await tx.query('CREATE TABLE IF NOT EXISTS studio_ai_jobs_v1(tenant TEXT NOT NULL, site TEXT NOT NULL, id TEXT NOT NULL, idem TEXT NOT NULL, revision INTEGER NOT NULL, status TEXT NOT NULL, job TEXT NOT NULL, state TEXT NOT NULL, result TEXT, PRIMARY KEY(tenant,site,id), UNIQUE(tenant,site,idem))');
 });return this;}
 async scope(actor,site,action){const s=await this.authorize(actor,site,action);if(!s||s.siteId!==site||typeof s.tenantId!=='string'||!s.tenantId||!Number.isSafeInteger(s.maxActive)||s.maxActive<1||s.maxActive>1000)fail(403,'AI scope denied');return s;}
 async lock(tx,tenant){await tx.query(sql('INSERT INTO studio_ai_job_scopes VALUES (?,0) ON CONFLICT(tenant) DO NOTHING'),[tenant]);await tx.query(sql('UPDATE studio_ai_job_scopes SET revision=revision+1 WHERE tenant=?'),[tenant]);}
 async row(tx,s,id){return decode(await tx.get(sql('SELECT * FROM studio_ai_jobs_v1 WHERE tenant=? AND site=? AND id=?'),[s.tenantId,s.siteId,id]));}
 async recheck(actor,site,action,s){const current=await this.scope(actor,site,action);if(!isDeepStrictEqual(s,current))fail(403,'AI authority changed');}
 async submit(actor,input){const job=structuredClone(input);validateAiJob(job);const s=await this.scope(actor,job.siteId,'submit');
  if(job.tenantId!==s.tenantId||job.actorId!==actor.user_id)fail(403,'AI scope mismatch');
  return this.storage.transaction(async tx=>{
   await this.lock(tx,s.tenantId);await this.recheck(actor,job.siteId,'submit',s);
   const existing=decode(await tx.get(sql('SELECT * FROM studio_ai_jobs_v1 WHERE tenant=? AND site=? AND idem=?'),[s.tenantId,s.siteId,job.idempotencyKey]));
   if(existing){if(!isDeepStrictEqual(existing.job,job))fail(409,'Idempotency input changed');await this.recheck(actor,job.siteId,'submit',s);return existing;}
   const count=await tx.get(sql("SELECT COUNT(*) AS n FROM studio_ai_jobs_v1 WHERE tenant=? AND status IN ('queued','leased','running','review')"),[s.tenantId]);
   if(Number(count.n)>=s.maxActive)fail(429,'AI outstanding-job quota reached');
   const state=newAiJobState();await tx.query(sql('INSERT INTO studio_ai_jobs_v1 VALUES (?,?,?,?,?,?,?,?,NULL)'),[s.tenantId,job.siteId,job.id,job.idempotencyKey,0,state.status,JSON.stringify(job),JSON.stringify(state)]);
   await this.audit.append(tx,{actor,orgId:s.tenantId,siteId:job.siteId,resource:'ai-job:'+job.id,action:'ai.job.created',jobId:job.id,after:state});
   await this.recheck(actor,job.siteId,'submit',s);return{job,state,result:null};
  });
 }
 async get(actor,site,id){const s=await this.scope(actor,site,'read');return this.storage.transaction(async tx=>{const row=await this.row(tx,s,id);await this.recheck(actor,site,'read',s);if(!row)fail(404,'AI job not found');return row;});}
 async list(actor,site,{limit=50,offset=0}={}){if(!Number.isSafeInteger(limit)||limit<1||limit>100||!Number.isSafeInteger(offset)||offset<0||offset>100000)fail(422,'Invalid AI page');const s=await this.scope(actor,site,'read');return this.storage.transaction(async tx=>{const rows=await tx.all(sql('SELECT * FROM studio_ai_jobs_v1 WHERE tenant=? AND site=? ORDER BY id LIMIT ? OFFSET ?'),[s.tenantId,site,limit,offset]);await this.recheck(actor,site,'read',s);return rows.map(decode);});}
 /** Trusted scheduler only; never expose this cross-tenant scan over HTTP. */
 async pending(after={tenantId:'',siteId:'',id:''},limit=50){if(!after||!['tenantId','siteId','id'].every(k=>typeof after[k]==='string'&&after[k].length<=128)||!Number.isInteger(limit)||limit<1||limit>100)fail(422,'Invalid AI batch');return this.storage.transaction(async tx=>(await tx.all(sql("SELECT * FROM studio_ai_jobs_v1 WHERE (tenant>? OR (tenant=? AND site>?) OR (tenant=? AND site=? AND id>?)) AND status IN ('queued','leased','running') ORDER BY tenant,site,id LIMIT ?"),[after.tenantId,after.tenantId,after.siteId,after.tenantId,after.siteId,after.id,limit])).map(decode));}
 async transition(actor,site,id,input,result){const command=structuredClone(input),output=result===undefined?undefined:structuredClone(result);const s=await this.scope(actor,site,command.type);
  const worker=['claim','start','complete','fail'].includes(command.type);
  if(worker&&(!s.workerId||command.owner!==s.workerId))fail(403,'Worker identity mismatch');
  return this.storage.transaction(async tx=>{
   await this.lock(tx,s.tenantId);const before=await this.row(tx,s,id);if(!before)fail(404,'AI job not found');
   let state;try{state=transitionAiJob(before.state,command,this.clock());}catch{fail(409,'Stale AI job transition');}
   if(command.type==='complete'){validateAiResult(before.job,output);if(output.attempt!==before.state.attempt)fail(409,'Stale AI result attempt');}
   else if(output!==undefined)fail(422,'Result only allowed on completion');
   const saved=command.type==='complete'?output:before.result;
   const updated=await tx.query(sql('UPDATE studio_ai_jobs_v1 SET revision=?,status=?,state=?,result=? WHERE tenant=? AND site=? AND id=? AND revision=?'),[state.revision,state.status,JSON.stringify(state),saved?JSON.stringify(saved):null,s.tenantId,site,id,before.state.revision]);
   if(updated.rowCount!==1)fail(409,'AI revision conflict');
   await this.audit.append(tx,{actor,orgId:s.tenantId,siteId:site,resource:'ai-job:'+id,action:'ai.job.'+command.type,jobId:id,before:before.state,after:state});
   await this.recheck(actor,site,command.type,s);return{job:before.job,state,result:saved};
  });
 }
}
