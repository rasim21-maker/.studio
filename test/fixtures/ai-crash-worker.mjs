// Dedicated fixture: deliberately exit without closing storage or releasing the lease.
import {SQLiteStorage,PostgreSQLStorage} from '@loft-studio/module-core/storage';
import {AsyncAudit} from '@loft-studio/audit/async';
import {AiJobs} from '../../src/v2/ai-jobs.mjs';
const [backend,filename,schema,id,now]=process.argv.slice(2);
let storage;
if(backend==='sqlite')storage=new SQLiteStorage(filename);
else{const {Pool}=await import('pg');storage=new PostgreSQLStorage(new Pool({connectionString:process.env.LOFT_TEST_POSTGRES_URL,options:'-c search_path='+schema}));}
const audit=await new AsyncAudit({storage}).initialize();
const jobs=await new AiJobs({storage,audit,clock:()=>Number(now),authorize:()=>({tenantId:'tenant',siteId:'site',maxActive:10,workerId:'crashed_worker'})}).initialize();
await jobs.transition({user_id:'system:ai-worker'},'site',id,{type:'claim',revision:0,owner:'crashed_worker',ttl:1000});
await jobs.transition({user_id:'system:ai-worker'},'site',id,{type:'start',revision:1,owner:'crashed_worker',attempt:1});
process.exit(0);
