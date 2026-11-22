import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newAiJobState,transitionAiJob as move} from '../../shared/v2/ai-job-state.mjs';
const claim=(s,owner='worker',now=0)=>move(s,{type:'claim',revision:s.revision,owner,ttl:1000},now);
const command=(s,type)=>({type,revision:s.revision,owner:s.owner,attempt:s.attempt});
test('AI job completion goes to review; acceptance is a separate transition',()=>{
 const queued=newAiJobState(),leased=claim(queued),running=move(leased,command(leased,'start'),10),review=move(running,command(running,'complete'),20);
 assert.equal(queued.revision,0);assert.equal(review.status,'review');assert.equal(review.owner,null);
 assert.equal(move(review,{type:'accept',revision:review.revision},30).status,'accepted');
 assert.throws(()=>move(running,command(running,'accept'),20),{code:'AI_JOB_STATE'});
});
test('expired ownership and old attempt cannot complete after reassignment',()=>{
 const first=claim(newAiJobState()),second=claim(first,'worker',1000);
 assert.equal(second.attempt,2);
 assert.throws(()=>move(first,command(first,'start'),1000),{code:'AI_JOB_STATE'});
 assert.throws(()=>move(second,{...command(first,'start'),revision:second.revision},1001),{code:'AI_JOB_STATE'});
 assert.throws(()=>move(second,{...command(second,'start'),owner:'other'},1001),{code:'AI_JOB_STATE'});
});
test('cancelled jobs reject late results; stale revisions and invalid lease bounds fail',()=>{
 const leased=claim(newAiJobState()),cancelled=move(leased,{type:'cancel',revision:leased.revision},10);
 assert.throws(()=>move(cancelled,{...command(leased,'complete'),revision:cancelled.revision},20),{code:'AI_JOB_STATE'});
 assert.throws(()=>claim(leased,'other',1),{code:'AI_JOB_STATE'});
 assert.throws(()=>move(leased,{type:'cancel',revision:0},1),{code:'AI_JOB_STATE'});
 assert.throws(()=>claim({...newAiJobState(),attempt:10}),{code:'AI_JOB_STATE'});
 for(const ttl of [-1,0,999,300001,Infinity])assert.throws(()=>move(newAiJobState(),{type:'claim',revision:0,owner:'worker',ttl},0),{code:'AI_JOB_STATE'});
});
