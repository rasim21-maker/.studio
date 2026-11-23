/** Trusted orchestration only. The injected connector must isolate model execution.
 * No shell, model loading, provider credentials or publication authority lives here. */
export function createAiWorker({jobs,identity,resolve,connector,clock=Date.now}){
 let stopped=false,inflight=null,controller=null,activeId=null,cursor,lastError=false;
 const available=typeof connector?.execute==='function';
 async function step(){
  if(stopped||!available)return;
  const rows=await jobs.pending(cursor);cursor=rows.length?rows.at(-1).job:undefined;
  for(const row of rows){
   if(stopped)return;
   if(row.state.status!=='queued'&&row.state.expires>clock())continue;
   const {job}=row;let actor,lease,timer;
   try{
    actor=await identity(job);
    if(row.state.attempt>=10){await jobs.transition(actor,job.siteId,job.id,{type:'cancel',revision:row.state.revision});continue;}
    lease=await jobs.transition(actor,job.siteId,job.id,{type:'claim',revision:row.state.revision,owner:actor.workerId,ttl:Math.min(300000,job.budget.timeoutMs+5000)});
    // Source conflicts become visible failed jobs rather than retrying forever.
    const artifact=await resolve(actor,job);
    lease=await jobs.transition(actor,job.siteId,job.id,{type:'start',revision:lease.state.revision,owner:actor.workerId,attempt:lease.state.attempt});
    if(stopped)return;
    controller=new AbortController();activeId=job.id;const signal=controller.signal;
    const interrupted=new Promise((_,reject)=>{signal.addEventListener('abort',()=>reject(Error('AI execution interrupted')),{once:true});});
    timer=setTimeout(()=>controller?.abort(),job.budget.timeoutMs);
    const result=await Promise.race([Promise.resolve().then(()=>connector.execute({job:structuredClone(job),attempt:lease.state.attempt,artifact,signal})),interrupted]);
    // Revocation/source changes during inference must prevent result admission.
    await resolve(actor,job);
    await jobs.transition(actor,job.siteId,job.id,{type:'complete',revision:lease.state.revision,owner:actor.workerId,attempt:lease.state.attempt},result);
    lastError=false;
   }catch{
    lastError=true;
    // On shutdown leave the lease for restart recovery; no early ownership transfer.
    if(lease&&!stopped)try{await jobs.transition(actor,job.siteId,job.id,{type:'fail',revision:lease.state.revision,owner:actor.workerId,attempt:lease.state.attempt});}catch{/* Cancellation, revocation or a new lease won. Never overwrite it. */}
   }finally{clearTimeout(timer);controller=null;activeId=null;}
  }
 }
 return{
  status:()=>({available,running:!!inflight,lastError}),
  cancel(id){if(id===activeId)controller?.abort();},
  tick(){if(inflight)return inflight;inflight=step().finally(()=>{inflight=null;});return inflight;},
  async close(){stopped=true;controller?.abort();await inflight;}
 };
}
