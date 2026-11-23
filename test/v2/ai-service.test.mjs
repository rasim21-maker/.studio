import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {SQLiteStorage,PostgreSQLStorage} from '@loft-studio/module-core/storage';
import {AsyncAudit} from '@loft-studio/audit/async';
import {createAiService} from '../../src/v2/ai-service.mjs';
const result=({job,attempt})=>({version:1,jobId:job.id,attempt,baseRevision:job.baseRevision,artifactDigest:job.artifactDigest,model:'fixture-not-qwen',modelRevision:'test',runtimeRevision:'test',usage:{inputTokens:1,outputTokens:1,elapsedMs:1},output:{kind:'report',summary:'Fixture report only',evidenceIds:[]}});
for(const backend of ['sqlite','postgres'])test('AI service authority, worker fencing and restart: '+backend,{skip:backend==='postgres'&&!process.env.LOFT_TEST_POSTGRES_URL},async t=>{
 let storage,pool,schema;const filename=path.join(tmpdir(),'loft-ai-service-'+randomUUID()+'.sqlite');
 if(backend==='sqlite'){storage=new SQLiteStorage(filename);t.after(()=>storage.close());}
 else{const {Pool}=await import('pg');schema='aiservice_'+randomUUID().replaceAll('-','');pool=new Pool({connectionString:process.env.LOFT_TEST_POSTGRES_URL,options:'-c search_path='+schema});await pool.query('CREATE SCHEMA '+schema);storage=new PostgreSQLStorage(pool);t.after(async()=>{try{await pool.query('DROP SCHEMA '+schema+' CASCADE');}finally{await pool.end();}});}
 const audit=await new AsyncAudit({storage}).initialize();let permitted=true,now=1000;
 const site={id:'site',org_id:'tenant',environment:'development',revision:0,document:{name:'Fixture'}};
 const access=(actor,id)=>{if(!permitted||actor.user_id!=='owner'||id!=='site')throw Object.assign(Error('Denied'),{status:403});return structuredClone(site);};
 const base={storage,audit,access,store:{get:(_sql,id)=>id==='owner'?{id}:null},clock:()=>now,intervalMs:3600000};
 let service=await createAiService(base);t.after(()=>service.close());
 const route=(method,action,input,user={user_id:'owner'})=>service.route({method,action,siteId:'site',user,url:new URL('http://localhost/'),body:async()=>input,send:x=>x});
 assert.equal((await route('GET','ai-jobs')).runner.available,false);
 await assert.rejects(route('POST','ai-jobs',{revision:0,idempotencyKey:randomUUID()}),{status:503});
 let release,started;const begin=new Promise(r=>started=r);
 const blocked={execute:args=>{started(args);return new Promise(r=>release=()=>r(result(args)));}};
 await service.close();service=await createAiService({...base,connector:blocked});
 const input={revision:0,idempotencyKey:randomUUID()};const first=await route('POST','ai-jobs',input);
 assert.deepEqual(await route('POST','ai-jobs',input),first);
 await assert.rejects(route('GET','ai-jobs',null,{user_id:'outsider'}),{status:403});
 await assert.rejects(service.jobs.transition({user_id:'owner'},'site',first.job.id,{type:'claim',revision:0,owner:'spoof',ttl:1000}),{status:403});
 const work=service.worker.tick();await begin;
 assert.equal((await route('GET','ai-jobs/'+first.job.id)).state.status,'running');
 await service.close();await work; // abort even when the connector ignores AbortSignal
 assert.equal((await service.jobs.get({user_id:'owner'},'site',first.job.id)).state.status,'running');
 service=await createAiService({...base,connector:{execute:async args=>result(args)}});
 await service.worker.tick();assert.equal((await route('GET','ai-jobs/'+first.job.id)).state.attempt,1,'live lease cannot be stolen');
 now+=65001;await service.worker.tick();await service.worker.tick();
 const recovered=await route('GET','ai-jobs/'+first.job.id);assert.equal(recovered.state.status,'review');assert.equal(recovered.state.attempt,2);
 release();await new Promise(r=>setImmediate(r));assert.deepEqual(await route('GET','ai-jobs/'+first.job.id),recovered,'late old worker cannot replace recovered result');
 assert.equal((await route('POST','ai-jobs/'+first.job.id+'/reject',{revision:recovered.state.revision})).state.status,'rejected');
 await assert.rejects(route('POST','ai-jobs/'+first.job.id+'/reject',{revision:recovered.state.revision}),{status:409});
 const stale=await route('POST','ai-jobs',{revision:0,idempotencyKey:randomUUID()});site.revision++;
 await service.worker.tick();await service.worker.tick();assert.equal((await route('GET','ai-jobs/'+stale.job.id)).state.status,'failed');
 const revoked=await route('POST','ai-jobs',{revision:1,idempotencyKey:randomUUID()});permitted=false;await service.worker.tick();await service.worker.tick();permitted=true;
 assert.equal((await route('GET','ai-jobs/'+revoked.job.id)).state.status,'queued');
 assert.equal((await route('POST','ai-jobs/'+revoked.job.id+'/cancel',{revision:0})).state.status,'cancelled');
 const crashJob=await route('POST','ai-jobs',{revision:1,idempotencyKey:randomUUID()});
 const child=spawnSync(process.execPath,['test/fixtures/ai-crash-worker.mjs',backend,filename,schema||'',crashJob.job.id,String(now)],{cwd:path.resolve(import.meta.dirname,'../..'),encoding:'utf8',windowsHide:true,timeout:15000});
 assert.equal(child.status,0,child.stderr);assert.equal((await route('GET','ai-jobs/'+crashJob.job.id)).state.status,'running');
 now+=1001;await service.worker.tick();await service.worker.tick();const afterCrash=await route('GET','ai-jobs/'+crashJob.job.id);assert.equal(afterCrash.state.status,'review');assert.equal(afterCrash.state.attempt,2);
 for(const scenario of ['cancel','revoke','invalid-result']){
  await service.close();let entered,finish,args;const ready=new Promise(r=>entered=r);
  service=await createAiService({...base,connector:{execute:input=>{args=input;entered();return new Promise(r=>finish=r);}}});
  const item=await route('POST','ai-jobs',{revision:1,idempotencyKey:randomUUID()});const running=service.worker.tick();await ready;
  const current=await route('GET','ai-jobs/'+item.job.id);
  if(scenario==='cancel'){await route('POST','ai-jobs/'+item.job.id+'/cancel',{revision:current.state.revision});assert.equal(args.signal.aborted,true);}
  if(scenario==='revoke')permitted=false;
  finish(scenario==='invalid-result'?{...result(args),jobId:'forged'}:result(args));await running;permitted=true;
  const saved=await route('GET','ai-jobs/'+item.job.id);assert.equal(saved.result,null);assert.equal(saved.state.status,scenario==='cancel'?'cancelled':scenario==='revoke'?'running':'failed');
  if(scenario==='revoke')await route('POST','ai-jobs/'+item.job.id+'/cancel',{revision:saved.state.revision});
 }
 await service.close();let transportBusy=true;
 service=await createAiService({...base,connector:{status:()=>({ready:true,busy:transportBusy}),execute:async args=>result(args)}});
 const waiting=await route('POST','ai-jobs',{revision:1,idempotencyKey:randomUUID()});await service.worker.tick();
 assert.equal((await route('GET','ai-jobs/'+waiting.job.id)).state.status,'queued','cleanup in progress must not consume/fail the next job');
 transportBusy=false;await service.worker.tick();assert.equal((await route('GET','ai-jobs/'+waiting.job.id)).state.status,'review');
 const entries=await audit.pending(100);assert.ok(entries.every(e=>JSON.parse(e.payload).resource.startsWith('ai-job:')));
 assert.ok(entries.some(e=>JSON.parse(e.payload).actor.user_id==='system:ai-worker'));
});
