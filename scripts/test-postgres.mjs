import {spawnSync} from 'node:child_process';
const value=process.env.LOFT_TEST_POSTGRES_URL;
if(!value)throw Error('LOFT_TEST_POSTGRES_URL is required; PostgreSQL acceptance must not silently skip.');
const url=new URL(value);
if(!['postgres:','postgresql:'].includes(url.protocol)||!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||!/^\/(?:loft_test|studio_test)$/.test(url.pathname))throw Error('Use a dedicated loopback loft_test or studio_test database.');
const result=spawnSync(process.execPath,['--test','--test-concurrency=1','test/v2/async-modules.test.mjs','test/v2/async-connections.test.mjs','test/v2/async-operations.test.mjs','test/v2/operations-migration.test.mjs','test/v2/ai-jobs.test.mjs'],{stdio:'inherit',windowsHide:true});
if(result.error)throw result.error;
process.exitCode=result.status??1;
