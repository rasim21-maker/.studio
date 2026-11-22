// Pure transition policy. Caller must authorize and persist with atomic revision CAS.
const fail=()=>{throw Object.assign(Error('Invalid or stale AI job transition'),{code:'AI_JOB_STATE'});};
const number=n=>Number.isSafeInteger(n)&&n>=0;
export const newAiJobState=()=>({status:'queued',revision:0,attempt:0,owner:null,expires:0});
export function transitionAiJob(state,command,now){
 if(!number(now)||!state||!command||!number(state.revision)||!number(state.attempt)||state.attempt>10||!number(state.expires)||command.revision!==state.revision)fail();
 const next={...state,revision:state.revision+1};if(!number(next.revision))fail();
 const active=['leased','running'].includes(state.status);
 if(command.type==='claim'){
  if(!(state.status==='queued'||active&&state.expires<=now)||state.attempt>=10||typeof command.owner!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(command.owner)||!Number.isInteger(command.ttl)||command.ttl<1000||command.ttl>300000||!number(now+command.ttl))fail();
  return {...next,status:'leased',attempt:state.attempt+1,owner:command.owner,expires:now+command.ttl};
 }
 if(command.type==='cancel'){
  if(!['queued','leased','running','review'].includes(state.status))fail();
  return {...next,status:'cancelled',owner:null,expires:0};
 }
 if(command.type==='accept'||command.type==='reject'){
  if(state.status!=='review')fail();
  return {...next,status:command.type==='accept'?'accepted':'rejected'};
 }
 if(!active||state.expires<=now||command.owner!==state.owner||command.attempt!==state.attempt)fail();
 if(command.type==='start'&&state.status==='leased')return {...next,status:'running'};
 if(command.type==='complete'&&state.status==='running')return {...next,status:'review',owner:null,expires:0};
 if(command.type==='fail')return {...next,status:'failed',owner:null,expires:0};
 fail();
}
