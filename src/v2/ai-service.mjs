import {createHash,randomUUID} from 'node:crypto';
import {AiJobs} from './ai-jobs.mjs';
import {createAiWorker} from './ai-worker.mjs';
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const exact=(input,keys)=>input&&typeof input==='object'&&!Array.isArray(input)&&Object.keys(input).every(k=>keys.includes(k));
/** Server-owned composition. Connector injection is trusted configuration, never browser input. */
export async function createAiService({storage,audit,access,store,connector,clock=Date.now,intervalMs=1000}){
 const workers=new WeakMap(),workerId='worker_'+randomUUID().replaceAll('-','');
 function authorize(actor,site,action){
  const delegated=workers.get(actor),human=delegated?{user_id:delegated.actorId}:actor;
  if(delegated&&delegated.siteId!==site)fail(403,'AI worker scope denied');
  if(!store.get('SELECT id FROM users WHERE id=?',human.user_id))fail(403,'AI actor unavailable');
  const current=access(human,site,'content');
  if(!delegated&&!['read','submit','cancel','reject'].includes(action))fail(403,'AI worker authority required');
  if(delegated&&!['read','claim','start','complete','fail','cancel'].includes(action))fail(403,'AI worker action denied');
  return{tenantId:current.org_id,siteId:site,maxActive:10,...(delegated?{workerId}:{} )};
 }
 const jobs=await new AiJobs({storage,audit,authorize,clock}).initialize();
 const worker=createAiWorker({jobs,connector,clock,
  identity(job){const actor={user_id:'system:ai-worker',workerId};workers.set(actor,job);return actor;},
  resolve(actor,job){const scope=authorize(actor,job.siteId,'read');if(scope.tenantId!==job.tenantId)fail(403,'AI tenant changed');const site=access({user_id:job.actorId},job.siteId,'content');if(site.revision!==job.baseRevision||digest(site.document)!==job.artifactDigest)fail(409,'AI source changed');return structuredClone(site.document);}
 });
 const timer=setInterval(()=>{void worker.tick().catch(()=>{});},intervalMs);timer.unref();
 return{jobs,worker,
  async route({req,method,user,siteId,action,url,body,send}){
   if(action!=='ai-jobs'&&!action.startsWith('ai-jobs/'))return false;
   access(user,siteId,'content');
   if(action==='ai-jobs'&&method==='GET')return send({jobs:await jobs.list(user,siteId,{limit:Number(url.searchParams.get('limit')||50),offset:Number(url.searchParams.get('offset')||0)}),runner:{...worker.status(),reason:worker.status().available?'Sunucuda yapılandırılmış çalıştırıcı. Sonuçlar otomatik uygulanmaz.':'Yerel Qwen çalıştırıcısı bağlı değil; iş başlatılamaz.'}});
   if(action==='ai-jobs'&&method==='POST'){
    const input=await body(req);const site=access(user,siteId,'content');
    if(!exact(input,['revision','idempotencyKey'])||!Number.isSafeInteger(input.revision)||input.revision!==site.revision)fail(409,'Güncel site sürümünü kullanın.');
    if(typeof input.idempotencyKey!=='string'||!/^[A-Za-z0-9_-]{16,80}$/.test(input.idempotencyKey))fail(422,'Geçerli istek anahtarı gerekli.');
    if(!worker.status().available)fail(503,'Yerel Qwen çalıştırıcısı bağlı değil.');
    // First exposed job kind is a read-only publication review. No deployment/pentest execution.
    const job={version:1,id:digest([site.org_id,siteId,user.user_id,input.idempotencyKey]),tenantId:site.org_id,siteId,environment:site.environment,actorId:user.user_id,kind:'publication-review',baseRevision:site.revision,artifactDigest:digest(site.document),targetIds:[],evidenceIds:[],region:'local',retentionDays:0,idempotencyKey:input.idempotencyKey,budget:{inputTokens:8192,outputTokens:2048,timeoutMs:60000}};
    return send(await jobs.submit(user,job));
   }
   const match=action.match(/^ai-jobs\/([a-f0-9]{64})(?:\/(cancel|reject))?$/);
   if(match&&method==='GET'&&!match[2])return send(await jobs.get(user,siteId,match[1]));
   if(match&&method==='POST'&&match[2]){const input=await body(req);if(!exact(input,['revision'])||!Number.isSafeInteger(input.revision))fail(422,'İş sürümü gerekli.');const saved=await jobs.transition(user,siteId,match[1],{type:match[2],revision:input.revision});worker.cancel(match[1]);return send(saved);}
   fail(405,'AI iş yöntemi desteklenmiyor.');
  },
  async close(){clearInterval(timer);await worker.close();}
 };
}
