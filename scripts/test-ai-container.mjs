import {spawnSync} from 'node:child_process';
if(!/^sha256:[a-f0-9]{64}$/.test(process.env.LOFT_TEST_AI_IMAGE||''))throw Error('LOFT_TEST_AI_IMAGE must identify the locally built isolation fixture. No silent skip in this acceptance gate.');
const result=spawnSync(process.execPath,['--test','--test-concurrency=1','test/v2/ai-container.test.mjs','test/v2/ai-http.test.mjs'],{stdio:'inherit',windowsHide:true});
if(result.error)throw result.error;
process.exitCode=result.status??1;
