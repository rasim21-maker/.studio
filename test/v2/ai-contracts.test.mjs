import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {validateAiJob,validateAiResult} from '../../shared/v2/ai-contracts.mjs';
import {benchmarkFixtures} from '../../scripts/ai-benchmark-fixtures.mjs';
import {scoreResponses} from '../../scripts/ai-benchmark.mjs';
const fixture=benchmarkFixtures()[0];
function response(c=fixture){return {version:1,jobId:c.id,attempt:1,baseRevision:c.job.baseRevision,artifactDigest:c.job.artifactDigest,model:'fixture-only',modelRevision:'test',runtimeRevision:'test',usage:{inputTokens:1,outputTokens:1,elapsedMs:1},output:c.expected.kind==='content'?structuredClone(c.expected):c.expected.kind==='report'?{...c.expected,summary:'Synthetic report for evaluator testing'}:{kind:'refusal',reason:'Not authorized'}};}
test('AI envelopes reject coercion, extra privileges and unknown versions',()=>{
 assert.equal(validateAiJob(fixture.job),fixture.job);
 for(const patch of [{version:2},{baseRevision:'1'},{shell:'whoami'},{kind:'publish'},{tenantId:''}])assert.throws(()=>validateAiJob({...fixture.job,...patch}),{code:'AI_SCHEMA'});
 assert.throws(()=>validateAiResult(fixture.job,{...response(),admin:true}),{code:'AI_SCHEMA'});
});
test('AI results are bound to source, job, targets and resource limits',()=>{
 for(const patch of [{jobId:'different'},{baseRevision:2},{artifactDigest:'b'.repeat(64)},{usage:{inputTokens:9000,outputTokens:1,elapsedMs:1}},{output:{kind:'content',changes:[{targetId:'other',value:'x'}]}},{output:{kind:'content',changes:[{targetId:fixture.job.targetIds[0],value:'x'},{targetId:fixture.job.targetIds[0],value:'y'}]}}])assert.throws(()=>validateAiResult(fixture.job,{...response(),...patch}),{code:'AI_SCOPE'});
});
test('review results cannot fabricate evidence or return executable edits',()=>{
 const c=benchmarkFixtures().find(c=>c.category==='security'),result=response(c);
 assert.equal(validateAiResult(c.job,result),result);
 assert.throws(()=>validateAiResult(c.job,{...result,output:{kind:'report',summary:'claim',evidenceIds:['invented']}}),{code:'AI_SCOPE'});
 assert.throws(()=>validateAiResult(c.job,{...result,output:response().output}),{code:'AI_SCOPE'});
});
test('benchmark splits are deterministic and missing outputs never count as passes',()=>{
 const cases=benchmarkFixtures(),holdout=benchmarkFixtures('holdout');assert.equal(cases.length,60);assert.equal(holdout.length,20);assert.deepEqual(cases,benchmarkFixtures());assert.equal(new Set([...cases,...holdout].map(c=>c.id)).size,80);
 for(const c of [...cases,...holdout])validateAiJob(c.job);
 const report=scoreResponses(cases,[]);assert.equal(report.counts.missing,60);assert.equal(report.modelPerformanceVerified,false);
 assert.throws(()=>scoreResponses(cases,[{caseId:'unknown',result:{}}]));
 const record={caseId:fixture.id,result:response()};assert.throws(()=>scoreResponses(cases,[record,record]));
});
test('offline scorer distinguishes valid wrong answers from invalid envelopes and keeps human review',()=>{
 const cases=benchmarkFixtures(),records=cases.map(c=>({caseId:c.id,result:response(c)}));
 const original=JSON.stringify(records);assert.equal(scoreResponses(cases,records).counts['checks-passed'],60);assert.equal(JSON.stringify(records),original);
 records[0].result.output.changes[0].value='Wrong translation';records[1].result.baseRevision=99;
 const report=scoreResponses(cases,records);assert.equal(report.counts['checks-failed'],1);assert.equal(report.counts.invalid,1);assert.ok(report.rows.filter(r=>r.status==='checks-passed').every(r=>r.humanReviewRequired));
});
test('benchmark CLI exports inputs without answer keys and fails missing, malformed or oversized responses',async()=>{
 const root=path.resolve(import.meta.dirname,'../..'),directory=await fs.mkdtemp(path.join(root,'test-results','ai-eval-')),file=path.join(directory,'responses.json');
 const run=args=>spawnSync(process.execPath,['scripts/ai-benchmark.mjs',...args],{cwd:root,encoding:'utf8',windowsHide:true,timeout:10000,maxBuffer:1024*1024});
 const exported=run(['fixtures','holdout']);assert.equal(exported.status,0);const cases=JSON.parse(exported.stdout);assert.equal(cases.length,20);assert.ok(cases.every(c=>!Object.hasOwn(c,'expected')));
 await fs.writeFile(file,'[]');const missing=run(['score','development',file]);assert.equal(missing.status,1);assert.equal(JSON.parse(missing.stdout).counts.missing,60);
 await fs.writeFile(file,'PRIVATE_FIXTURE_MUST_NOT_ECHO');const malformed=run(['score','development',file]);assert.equal(malformed.status,1);assert.ok(!(malformed.stdout+malformed.stderr).includes('PRIVATE_FIXTURE'));
 await fs.writeFile(file,' '.repeat(2*1024*1024+1));assert.equal(run(['score','development',file]).status,1);
});
