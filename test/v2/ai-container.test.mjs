import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {loadLocalAi} from '../../src/v2/ai-local-config.mjs';
import {createAiContainer,validateContainerConfig,dockerCommand} from '../../src/v2/ai-container.mjs';
const config={image:'sha256:'+'a'.repeat(64),model:'qwen-fixture-not-model',modelRevision:'fixture',runtimeRevision:'fixture',memoryMiB:256,cpus:1};
const artifact={text:'Untrusted fixture document'},hash=createHash('sha256').update(JSON.stringify(artifact)).digest('hex');
const job={version:1,id:'pass',tenantId:'tenant',siteId:'site',environment:'test',actorId:'owner',kind:'publication-review',baseRevision:1,artifactDigest:hash,targetIds:[],evidenceIds:[],region:'local',retentionDays:0,idempotencyKey:'test',budget:{inputTokens:8192,outputTokens:2048,timeoutMs:5000}};
const result={version:1,jobId:'pass',attempt:1,baseRevision:1,artifactDigest:hash,model:config.model,modelRevision:'fixture',runtimeRevision:'fixture',usage:{inputTokens:1,outputTokens:1,elapsedMs:1},output:{kind:'report',summary:'Fixture',evidenceIds:[]}};
function mock({cleanupFail=false,raw=JSON.stringify(result)}={}){const calls=[];return{calls,command:async(args,options)=>{calls.push({args,options});if(args[0]==='info')return JSON.stringify({OSType:'linux',MemoryLimit:true,SwapLimit:true,PidsLimit:true,CpuCfsQuota:true});if(args[0]==='image')return JSON.stringify([{Id:config.image,Os:'linux',Config:{}}]);if(args[0]==='start')return raw;if(args[0]==='rm'&&cleanupFail)throw Error('PRIVATE RAW ERROR');return'';}};}
test('container policy denies mutable images, remote options and unsupported resources',()=>{
 for(const change of [{image:'qwen:latest'},{host:'tcp://remote'},{memoryMiB:1},{cpus:0},{model:'other'},{mount:'/private'}])assert.throws(()=>validateContainerConfig({...config,...change}));
 assert.deepEqual(validateContainerConfig(config),config);
});
test('missing or invalid local configuration leaves AI disabled without logging secrets',async()=>{
 assert.equal(await loadLocalAi(undefined),undefined);
 const directory=await fs.mkdtemp(path.join(tmpdir(),'loft-ai-config-')),file=path.join(directory,'config.json'),messages=[],warn=console.warn;
 console.warn=message=>messages.push(message);
 try{
  for(const content of ['PRIVATE_TOKEN_NOT_JSON','x'.repeat(4097),JSON.stringify({...config,image:'mutable:tag'})]){await fs.writeFile(file,content);assert.equal(await loadLocalAi(file),undefined);}
  assert.equal(messages.length,3);assert.ok(messages.every(m=>m==='Local AI disabled: configuration, image or isolation preflight failed.'));
 }finally{console.warn=warn;await fs.rm(directory,{recursive:true,force:true});}
});
test('container dispatch pins isolation, validates provenance and always removes its container',async()=>{
 const fixture=mock(),runner=await createAiContainer(config,fixture);
 assert.deepEqual(await runner.execute({job,attempt:1,artifact}),result);
 const create=fixture.calls.find(x=>x.args[0]==='create').args;
 for(const flag of ['--network=none','--read-only','--cap-drop=ALL','--pids-limit=64','--memory=256m','--memory-swap=256m','--pull=never','--log-driver=none','--user=65534:65534'])assert.ok(create.includes(flag));
 assert.ok(!create.some(x=>x.includes('tenant')||x.includes('owner')));assert.equal(fixture.calls.at(-1).args[0],'rm');
 await assert.rejects(runner.execute({job,attempt:1,artifact:{wrong:true}}),{code:'DIGEST'});
 await runner.close();assert.equal(runner.status().ready,false);
 for(const raw of ['invalid',JSON.stringify({...result,attempt:2}),JSON.stringify({...result,model:'other'}),JSON.stringify({...result,tools:['shell']})]){const f=mock({raw}),r=await createAiContainer(config,f);await assert.rejects(r.execute({job,attempt:1,artifact}));assert.equal(f.calls.at(-1).args[0],'rm');}
 const f=mock({cleanupFail:true}),r=await createAiContainer(config,f);await assert.rejects(r.execute({job,attempt:1,artifact}),{code:'CLEANUP'});assert.equal(r.status().ready,false);
});
test('container preflight fails closed and unsupported jobs never start a process',async()=>{
 for(const override of [{OSType:'windows'},{MemoryLimit:false},{SwapLimit:false},{PidsLimit:false},{CpuCfsQuota:false}]){
  const f=mock(),command=async(args,o)=>args[0]==='info'?JSON.stringify({...JSON.parse(await f.command(args,o)),...override}):f.command(args,o);
  await assert.rejects(createAiContainer(config,{command}),{code:'ENGINE_LIMITS'});
 }
 const f=mock(),r=await createAiContainer(config,f);
 for(const kind of ['content','security-review'])await assert.rejects(r.execute({job:{...job,kind},attempt:1,artifact}),{code:'SCOPE'});
 const large={text:'x'.repeat(1048577)},largeJob={...job,artifactDigest:createHash('sha256').update(JSON.stringify(large)).digest('hex')};
 await assert.rejects(r.execute({job:largeJob,attempt:1,artifact:large}),{code:'INPUT_LIMIT'});
 assert.ok(!f.calls.some(c=>c.args[0]==='create'));
 await assert.rejects(createAiContainer(config,{command:async args=>args[0]==='image'?JSON.stringify([{Id:config.image,Os:'linux',Config:{Volumes:{'/data':{}}}}]):f.command(args)}),{code:'IMAGE'});
});
test('cancel during create does not start; concurrent call cannot hide cleanup from close',async()=>{
 let release,entered;const started=new Promise(r=>entered=r),f=mock(),controller=new AbortController();
 const runner=await createAiContainer(config,{command:async(args,o)=>{if(args[0]==='create'){entered();await new Promise(r=>release=r);}return f.command(args,o);}});
 const task=runner.execute({job,attempt:1,artifact,signal:controller.signal});await started;
 await assert.rejects(runner.execute({job,attempt:1,artifact}),{code:'NOT_READY'});
 let done=false;const closing=runner.close().then(()=>done=true);await new Promise(r=>setImmediate(r));assert.equal(done,false);
 const rejected=assert.rejects(task,{code:'ABORTED'});release();await rejected;await closing;
 assert.equal(f.calls.at(-1).args[0],'rm');assert.ok(!f.calls.some(c=>c.args[0]==='start'));assert.equal(runner.status().ready,false);
});
test('real offline container isolation, output limits, timeout and cancellation',{skip:!process.env.LOFT_TEST_AI_IMAGE},async()=>{
 const runner=await createAiContainer({...config,image:process.env.LOFT_TEST_AI_IMAGE});
 const before=await dockerCommand(['ps','--all','--quiet','--filter','label=studio.ai.worker=1']);
 process.env.LOFT_TEST_SENTINEL='must-not-reach-worker';
 try{
  assert.match((await runner.execute({job,attempt:1,artifact})).output.summary,/Isolation fixture passed/);
  for(const id of ['invalid','wrong-model','flood'])await assert.rejects(runner.execute({job:{...job,id},attempt:1,artifact}));
  await assert.rejects(runner.execute({job:{...job,id:'hang',budget:{...job.budget,timeoutMs:1000}},attempt:1,artifact}));
  const controller=new AbortController();const pending=runner.execute({job:{...job,id:'hang'},attempt:1,artifact,signal:controller.signal});setTimeout(()=>controller.abort(),500);await assert.rejects(pending);
  assert.equal(await dockerCommand(['ps','--all','--quiet','--filter','label=studio.ai.worker=1']),before,'no surviving worker container');
 }finally{delete process.env.LOFT_TEST_SENTINEL;await runner.close();}
});
test('container watchdog survives abrupt orchestrator exit',{skip:!process.env.LOFT_TEST_AI_IMAGE},async()=>{
 const child=spawnSync(process.execPath,['test/fixtures/ai-container-crash.mjs'],{cwd:path.resolve(import.meta.dirname,'../..'),encoding:'utf8',windowsHide:true,timeout:15000});
 assert.equal(child.status,0,child.stderr);const name=child.stdout.trim();assert.match(name,/^loft-ai-[a-f0-9-]{36}$/);
 try{
  let state;for(let i=0;i<30;i++){state=JSON.parse(await dockerCommand(['inspect','--format','{{json .State}}',name]));if(state.Status==='exited')break;await new Promise(r=>setTimeout(r,100));}
  assert.equal(state.Status,'exited');assert.notEqual(state.ExitCode,0);
 }finally{await dockerCommand(['rm','--force','--volumes',name]);}
});
