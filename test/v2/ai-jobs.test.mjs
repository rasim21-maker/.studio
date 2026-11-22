import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {SQLiteStorage,PostgreSQLStorage} from '@loft-studio/module-core/storage';
import {AsyncAudit} from '@loft-studio/audit/async';
import {AiJobs} from '../../src/v2/ai-jobs.mjs';
import {benchmarkFixtures} from '../../scripts/ai-benchmark-fixtures.mjs';
for(const backend of ['sqlite','postgres'])test('durable AI jobs: '+backend,{skip:backend==='postgres'&&!process.env.LOFT_TEST_POSTGRES_URL},async t=>{
 let storage,pool;
 const filename=path.join(tmpdir(),'loft-ai-jobs-'+randomUUID()+'.sqlite');
 if(backend==='sqlite'){storage=new SQLiteStorage(filename);t.after(()=>storage.close());}
 else{const {Pool}=await import('pg'),schema='aijobs_'+randomUUID().replaceAll('-','');pool=new Pool({connectionString:process.env.LOFT_TEST_POSTGRES_URL,options:'-c search_path='+schema});await pool.query('CREATE SCHEMA '+schema);storage=new PostgreSQLStorage(pool);t.after(async()=>{try{await pool.query('DROP SCHEMA '+schema+' CASCADE');}finally{await pool.end();}});}
 let permitted=true,broken=false,revoke=false,now=0;const actor={user_id:'owner'};
 const authorize=async(a,site,action)=>{if(!permitted||a.user_id!=='owner')throw Object.assign(Error('Denied'),{status:403});return{tenantId:'tenant',siteId:site,maxActive:1,workerId:'worker'};};
 const audit=await new AsyncAudit({storage}).initialize(),wrapped={async append(tx,e){await audit.append(tx,e);if(broken)throw Error('audit unavailable');if(revoke)permitted=false;}};
 const make=()=>new AiJobs({storage,authorize,audit:wrapped,clock:()=>now});let repo=await make().initialize();
 const job={...benchmarkFixtures()[0].job,tenantId:'tenant',actorId:'owner'};
 const created=await repo.submit(actor,job);assert.deepEqual(await repo.submit(actor,job),created);
 await assert.rejects(repo.submit(actor,{...job,baseRevision:2}),{status:409});
 const other={...job,id:'other',idempotencyKey:'other'};await assert.rejects(repo.submit(actor,other),{status:429});
 await assert.rejects(repo.get({user_id:'intruder'},job.siteId,job.id),{status:403});await assert.rejects(repo.get(actor,'different-site',job.id),{status:404});
 await assert.rejects(repo.submit(actor,{...other,tenantId:'forged'}),{status:403});
 await assert.rejects(repo.transition(actor,job.siteId,job.id,{type:'claim',revision:0,owner:'forged',ttl:1000}),{status:403});
 broken=true;await assert.rejects(repo.transition(actor,job.siteId,job.id,{type:'cancel',revision:0}));broken=false;assert.equal((await repo.get(actor,job.siteId,job.id)).state.status,'queued');
 revoke=true;await assert.rejects(repo.transition(actor,job.siteId,job.id,{type:'cancel',revision:0}),{status:403});revoke=false;permitted=true;assert.equal((await repo.get(actor,job.siteId,job.id)).state.revision,0);
 const claims=await Promise.allSettled([repo.transition(actor,job.siteId,job.id,{type:'claim',revision:0,owner:'worker',ttl:1000}),repo.transition(actor,job.siteId,job.id,{type:'claim',revision:0,owner:'worker',ttl:1000})]);assert.equal(claims.filter(r=>r.status==='fulfilled').length,1);
 repo=await make().initialize();assert.equal((await repo.get(actor,job.siteId,job.id)).state.status,'leased');
 if(backend==='sqlite'){const readerStorage=new SQLiteStorage(filename);try{const reader=await new AiJobs({storage:readerStorage,authorize,audit:wrapped}).initialize();assert.equal((await reader.get(actor,job.siteId,job.id)).state.attempt,1);}finally{await readerStorage.close();}}
 now=1000;const leased=await repo.transition(actor,job.siteId,job.id,{type:'claim',revision:1,owner:'worker',ttl:1000});assert.equal(leased.state.attempt,2);
 await assert.rejects(repo.transition(actor,job.siteId,job.id,{type:'start',revision:2,owner:'worker',attempt:1}),{status:409});
 await repo.transition(actor,job.siteId,job.id,{type:'start',revision:2,owner:'worker',attempt:2});
 const output={version:1,jobId:job.id,attempt:2,baseRevision:job.baseRevision,artifactDigest:job.artifactDigest,model:'fixture',modelRevision:'test',runtimeRevision:'test',usage:{inputTokens:1,outputTokens:1,elapsedMs:1},output:{kind:'refusal',reason:'Fixture only'}};
 await assert.rejects(repo.transition(actor,job.siteId,job.id,{type:'complete',revision:3,owner:'worker',attempt:2},{...output,attempt:1}),{status:409});
 await repo.transition(actor,job.siteId,job.id,{type:'complete',revision:3,owner:'worker',attempt:2},output);
 assert.deepEqual((await repo.get(actor,job.siteId,job.id)).result,output);
 await assert.rejects(repo.submit(actor,other),{status:429},'review still reserves a slot');
 await repo.transition(actor,job.siteId,job.id,{type:'cancel',revision:4});
 const race=await Promise.allSettled([repo.submit(actor,other),repo.submit(actor,{...other,id:'third',idempotencyKey:'third'})]);assert.equal(race.filter(r=>r.status==='fulfilled').length,1);
 assert.equal((await audit.pending(100)).length,7);
});
