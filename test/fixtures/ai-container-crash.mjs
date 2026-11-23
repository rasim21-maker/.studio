import {createHash} from 'node:crypto';
import {createAiContainer,dockerCommand} from '../../src/v2/ai-container.mjs';
const artifact={text:'crash fixture'};
const job={version:1,id:'hang',tenantId:'tenant',siteId:'site',environment:'test',actorId:'owner',kind:'publication-review',baseRevision:1,artifactDigest:createHash('sha256').update(JSON.stringify(artifact)).digest('hex'),targetIds:[],evidenceIds:[],region:'local',retentionDays:0,idempotencyKey:'test',budget:{inputTokens:8192,outputTokens:2048,timeoutMs:1000}};
const runner=await createAiContainer({image:process.env.LOFT_TEST_AI_IMAGE,model:'qwen-fixture-not-model',modelRevision:'fixture',runtimeRevision:'fixture',memoryMiB:256,cpus:1},{command(args,options){const result=dockerCommand(args,options);if(args[0]==='start'){console.log(args.at(-1));setTimeout(()=>process.exit(0),200);}return result;}});
await runner.execute({job,attempt:1,artifact});
