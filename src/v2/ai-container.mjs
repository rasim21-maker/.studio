import {spawn} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import {validateAiJob,validateAiResult} from '../../shared/v2/ai-contracts.mjs';
const fail=code=>Object.assign(Error('Local AI runtime unavailable: '+code),{code});
const id=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const localHost=process.platform==='win32'?'npipe:////./pipe/dockerDesktopLinuxEngine':'unix:///var/run/docker.sock';
/** No shell; only deployment-controlled Docker arguments. Never forward CMS env. */
export function dockerCommand(args,{input='',signal,timeoutMs=10000,maxBytes=262144}={}){
 return new Promise((resolve,reject)=>{
  if(signal?.aborted)return reject(fail('ABORTED'));
  const env=Object.fromEntries(['PATH','SystemRoot','WINDIR','TEMP','TMP'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
  let child;try{child=spawn('docker',['--host',localHost,...args],{env,windowsHide:true,shell:false,stdio:['pipe','pipe','pipe']});}catch{return reject(fail('SPAWN'));}
  let output=[],size=0,problem;const stop=code=>{problem??=fail(code);child.kill('SIGKILL');};
  const aborted=()=>stop('ABORTED'),timer=setTimeout(()=>stop('TIMEOUT'),timeoutMs);signal?.addEventListener('abort',aborted,{once:true});
  if(signal?.aborted)aborted();
  child.stdout.on('data',chunk=>{size+=chunk.length;if(size>maxBytes)stop('OUTPUT_LIMIT');else output.push(chunk);});
  child.stderr.on('data',chunk=>{size+=chunk.length;if(size>maxBytes)stop('OUTPUT_LIMIT');});
  child.on('error',()=>{problem??=fail('SPAWN');});
  child.stdin.on('error',()=>{problem??=fail('INPUT');});
  child.on('close',code=>{clearTimeout(timer);signal?.removeEventListener('abort',aborted);if(problem||code!==0)reject(problem||fail('EXIT'));else resolve(Buffer.concat(output).toString('utf8'));});
  child.stdin.end(input);
 });
}
export function validateContainerConfig(config){
 if(!config||Object.keys(config).some(k=>!['image','model','modelRevision','runtimeRevision','memoryMiB','cpus'].includes(k))||!/^sha256:[a-f0-9]{64}$/.test(config.image)||!['model','modelRevision','runtimeRevision'].every(k=>typeof config[k]==='string'&&id.test(config[k]))||!/^qwen/i.test(config.model)||!Number.isInteger(config.memoryMiB)||config.memoryMiB<256||config.memoryMiB>65536||!Number.isInteger(config.cpus)||config.cpus<1||config.cpus>16)throw fail('CONFIG');
 return Object.freeze({...config});
}
/** Reviewed local image only. Docker/host administrator remains a trusted boundary. */
export async function createAiContainer(config,{command=dockerCommand}={}){
 const c=validateContainerConfig(config);let ready=false,busy=false,closed=false,active;const shutdown=new AbortController();
 const engine=JSON.parse(await command(['info','--format','{{json .}}']));
 if(engine.OSType!=='linux'||!engine.MemoryLimit||!engine.SwapLimit||!engine.PidsLimit||!engine.CpuCfsQuota)throw fail('ENGINE_LIMITS');
 const image=JSON.parse(await command(['image','inspect',c.image]));
 if(image.length!==1||image[0].Id!==c.image||image[0].Os!=='linux'||Object.keys(image[0].Config?.Volumes||{}).length)throw fail('IMAGE');
 ready=true;
 const adapter={
  status:()=>({ready:ready&&!closed,busy}),
  async execute({job,attempt,artifact,signal}){
   signal=signal?AbortSignal.any([signal,shutdown.signal]):shutdown.signal;
   if(!ready||closed||busy)throw fail('NOT_READY');
   validateAiJob(job);if(job.kind!=='publication-review'||!Number.isInteger(attempt)||attempt<1||attempt>10)throw fail('SCOPE');
   const text=JSON.stringify(artifact);if(createHash('sha256').update(text).digest('hex')!==job.artifactDigest)throw fail('DIGEST');
   const input=JSON.stringify({version:1,job,attempt,artifact})+'\n';if(Buffer.byteLength(input)>1048576)throw fail('INPUT_LIMIT');
   if(signal?.aborted)throw fail('ABORTED');
   busy=true;const name='loft-ai-'+randomUUID(),deadline=Math.ceil(job.budget.timeoutMs/1000),started=performance.now();let created=false;
   try{
    // Create separately: cancellation cannot race a delayed `docker run` creating a survivor.
    await command(['create','--pull=never','--name',name,'--label','studio.ai.worker=1','--network=none','--read-only','--user=65534:65534','--cap-drop=ALL','--security-opt=no-new-privileges:true','--pids-limit=64','--memory='+c.memoryMiB+'m','--memory-swap='+c.memoryMiB+'m','--cpus='+c.cpus,'--ulimit','nofile=64:64','--log-driver=none','--init','--interactive','--tmpfs','/tmp:rw,noexec,nosuid,nodev,size=16777216,mode=1777','--entrypoint','/bin/busybox',c.image,'timeout','-s','KILL',String(deadline),'/studio/worker'],{timeoutMs:Math.min(10000,job.budget.timeoutMs)});created=true;
    if(signal?.aborted)throw fail('ABORTED');
    const remaining=job.budget.timeoutMs-(performance.now()-started);if(remaining<=0)throw fail('TIMEOUT');
    const raw=await command(['start','--attach','--interactive',name],{input,signal,timeoutMs:remaining,maxBytes:262144});
    if(signal?.aborted)throw fail('ABORTED');
    let result;try{result=JSON.parse(raw);validateAiResult(job,result);}catch{throw fail('RESULT');}
    if(result.attempt!==attempt||result.model!==c.model||result.modelRevision!==c.modelRevision||result.runtimeRevision!==c.runtimeRevision)throw fail('PROVENANCE');
    return result;
   }finally{
    // Also try cleanup after create failure (daemon may have accepted before disconnection).
    try{await command(['rm','--force','--volumes',name]);}catch{ready=false;if(created)throw fail('CLEANUP');}finally{busy=false;}
   }
  },
 };
 return{status:adapter.status,execute(input){if(active)return Promise.reject(fail('NOT_READY'));const task=adapter.execute(input);active=task;return task.finally(()=>{if(active===task)active=null;});},async close(){closed=true;shutdown.abort();await active?.catch(()=>{});}};
}
