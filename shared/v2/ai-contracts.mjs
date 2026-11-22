import Ajv from 'ajv';

// Preview wire contracts. Validation never grants permission or applies a result.
const id={type:'string',pattern:'^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'};
const digest={type:'string',pattern:'^[a-f0-9]{64}$'};
const integer=max=>({type:'integer',minimum:0,maximum:max});
const text=max=>({type:'string',minLength:1,maxLength:max});
const object=properties=>({type:'object',additionalProperties:false,required:Object.keys(properties),properties});
const list=(items,maxItems)=>({type:'array',items,maxItems,uniqueItems:true});
export const aiJobSchema={...object({
 version:{const:1},id,tenantId:id,siteId:id,environment:id,actorId:id,
 kind:{enum:['content','publication-review','security-review']},
 baseRevision:integer(Number.MAX_SAFE_INTEGER),artifactDigest:digest,
 targetIds:list(id,40),evidenceIds:list(id,200),
 region:id,retentionDays:integer(30),idempotencyKey:id,
 budget:object({inputTokens:{...integer(32768),minimum:1},outputTokens:{...integer(8192),minimum:1},timeoutMs:{type:'integer',minimum:1000,maximum:300000}})
}),$id:'urn:loft:ai:job:1'};
const change=object({targetId:id,value:{anyOf:[{type:'string',maxLength:12000},{type:'number'},{type:'boolean'}]}});
export const aiResultSchema={...object({
 version:{const:1},jobId:id,attempt:{type:'integer',minimum:1,maximum:10},
 baseRevision:integer(Number.MAX_SAFE_INTEGER),artifactDigest:digest,
 model:id,modelRevision:id,runtimeRevision:id,
 usage:object({inputTokens:integer(32768),outputTokens:integer(8192),elapsedMs:integer(300000)}),
 output:{oneOf:[object({kind:{const:'content'},changes:{...list(change,40),minItems:1}}),object({kind:{const:'report'},summary:text(4000),evidenceIds:list(id,200)}),object({kind:{const:'refusal'},reason:text(1000)})]}
}),$id:'urn:loft:ai:result:1'};
const ajv=new Ajv({strict:true,allErrors:false,coerceTypes:false});
const jobValidator=ajv.compile(aiJobSchema),resultValidator=ajv.compile(aiResultSchema);
function assertSchema(validate,value){if(!validate(value))throw Object.assign(Error('Invalid AI envelope: '+(validate.errors?.[0]?.instancePath||'/')),{code:'AI_SCHEMA'});return value;}
export const validateAiJob=value=>assertSchema(jobValidator,value);
export function validateAiResult(job,result){
 validateAiJob(job);assertSchema(resultValidator,result);
 const deny=()=>{throw Object.assign(Error('AI result does not match job scope or budget'),{code:'AI_SCOPE'});};
 if(result.jobId!==job.id||result.baseRevision!==job.baseRevision||result.artifactDigest!==job.artifactDigest)deny();
 if(result.usage.inputTokens>job.budget.inputTokens||result.usage.outputTokens>job.budget.outputTokens||result.usage.elapsedMs>job.budget.timeoutMs)deny();
 const output=result.output;
 if(output.kind==='content'){
  if(job.kind!=='content')deny();const seen=new Set();
  for(const c of output.changes){if(!job.targetIds.includes(c.targetId)||seen.has(c.targetId))deny();seen.add(c.targetId);}
 }else if(output.kind==='report'){
  if(job.kind==='content'||output.evidenceIds.some(id=>!job.evidenceIds.includes(id)))deny();
 }
 return result;
}
