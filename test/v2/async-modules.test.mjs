import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {SQLiteStorage,PostgreSQLStorage} from '@loft-studio/module-core/storage';
import {AsyncModuleHost} from '@loft-studio/module-core/async';
import crm from '@loft-studio/crm/async';
import commerce from '@loft-studio/commerce/async';
import {field} from '@loft-studio/sdk';
import {ModuleHost} from '@loft-studio/module-core';
import legacyCrm from '@loft-studio/crm';
import {Store} from '../../src/store.mjs';
const url=process.env.LOFT_TEST_POSTGRES_URL;
for(const backend of ['sqlite','postgres']){
 test('async modules: '+backend,{skip:backend==='postgres'&&!url},async t=>{
  let pool,storage;
  if(backend==='sqlite')storage=new SQLiteStorage(':memory:');
  else{const {Pool}=await import('pg');pool=new Pool({connectionString:url,max:4,statement_timeout:5000});storage=new PostgreSQLStorage(pool);t.after(()=>pool.end());}
  if(backend==='sqlite')t.after(()=>storage.close());
  const site=randomUUID(),org=randomUUID(),other=randomUUID(),actor={user_id:'owner'};let permitted=true;
  const authorize=async(a,id,p)=>{await Promise.resolve();if(a.user_id!=='owner'||!permitted)throw Object.assign(Error('Denied'),{status:403});return{id,org_id:id===site?org:other,name:'Test',allowed:['members','operations'],document:{pages:[]}};};
  const probe={manifest:{id:'test.probe',version:'1.0.0',apiVersion:2,schemaVersion:1,name:'Probe',permissions:['operations']},migrations:[{version:1,async up(){await Promise.resolve();}}],collections:{notes:{label:'Notes',permission:'operations',fields:{title:field('Title','text',{required:true})}}},commands:{
   abort:{label:'Abort',permission:'operations',async run(ctx){await ctx.records.put('notes',{data:{title:'discard'}});throw Object.assign(Error('abort'),{status:422});}},
   readonly:{label:'Read-only',permission:'operations',write:false,async run(ctx){return ctx.records.put('notes',{data:{title:'forbidden'}});}},
   revoke:{label:'Revoke',permission:'operations',async run(ctx){await ctx.records.put('notes',{data:{title:'discard'}});permitted=false;}},
   escape:{label:'Escape',permission:'operations',write:false,run(ctx){return ctx;}}
   ,forgotAwait:{label:'Track repository operation',permission:'operations',run(ctx){ctx.records.put('notes',{data:{title:'Tracked'}});}}
   ,caught:{label:'Catch nested failure',permission:'operations',async run(ctx){try{await ctx.transaction(async tx=>{await tx.records.put('notes',{data:{title:'Nested'}});throw Object.assign(Error('Nested failure'),{status:422});});}catch{};}}
  }};
  const host=await new AsyncModuleHost({storage,modules:[crm,commerce,probe],authorize}).initialize();
  const retry=async fn=>{for(let n=0;;n++)try{return await fn();}catch(e){if(e.code!=='RETRY_TRANSACTION'||n>=4)throw e;}};
  const put=(module,name,data,extra={})=>host.collection(actor,site,module,name,'PUT',{data,...extra});
  for(const id of ['studio.crm','studio.commerce','test.probe'])await host.lifecycle(actor,site,id,'install',-1);
  await t.test('actual v1 records migrate without changing IDs, revisions or values; repeat is refused',async()=>{
   const source=new Store(':memory:');const migrationSite=randomUUID();
   try{
    source.db.exec('CREATE TABLE studio_sites(id TEXT PRIMARY KEY)');source.run('INSERT INTO studio_sites VALUES (?)',migrationSite);
    const legacy=new ModuleHost({store:source,modules:[legacyCrm],authorize:(a,id)=>({id,org_id:org,allowed:['members','operations']})});
    legacy.lifecycle(actor,migrationSite,'studio.crm','install',-1);
    const person=legacy.collection(actor,migrationSite,'studio.crm','contacts','PUT',{id:'legacy-person',data:{name:'Before',email:'legacy@example.test'}});
    legacy.collection(actor,migrationSite,'studio.crm','contacts','PUT',{id:person.id,revision:0,data:{...person.data,name:'After'}});
    const snapshot=legacy.export(actor,migrationSite,'studio.crm');
    await host.importLegacy(actor,migrationSite,'studio.crm',snapshot);
    const migrated=await host.export(actor,migrationSite,'studio.crm');assert.deepEqual(migrated.records,snapshot.records);assert.equal(migrated.installation.revision,snapshot.installation.revision);
    await assert.rejects(host.importLegacy(actor,migrationSite,'studio.crm',snapshot),{status:409});
    assert.deepEqual(legacy.export(actor,migrationSite,'studio.crm').records,snapshot.records);
    const rejectedSite=randomUUID(),bad={...snapshot,siteId:rejectedSite,records:[...snapshot.records,{...snapshot.records[0]}]};
    await assert.rejects(host.importLegacy(actor,rejectedSite,'studio.crm',bad),{status:422});
    await assert.rejects(host.export(actor,rejectedSite,'studio.crm'),{status:409});
    await assert.rejects(host.importLegacy(actor,rejectedSite,'studio.crm',{...snapshot,siteId:rejectedSite,integrations:[{records:[{id:'link'}]}]}),{status:409});
   }finally{source.db.close();}
  });
  await t.test('scoped CRUD, references, uniqueness and stale revisions',async()=>{
   const company=await put('studio.crm','companies',{name:'Company'});
   const contact=await put('studio.crm','contacts',{name:'Ada',email:'ada@example.test',companyId:company.id});
   await assert.rejects(put('studio.crm','contacts',{name:'Duplicate',email:'ADA@example.test'}),{status:409});
   await assert.rejects(host.collection(actor,site,'studio.crm','companies','DELETE',{id:company.id,revision:0}),{status:409});
   await assert.rejects(host.collection({user_id:'outsider'},site,'studio.crm','contacts','GET',{id:contact.id}),{status:403});
   await host.lifecycle(actor,other,'studio.crm','install',-1);
   assert.equal((await host.collection(actor,other,'studio.crm','contacts','GET')).total,0);
   const updated=await put('studio.crm','contacts',{...contact.data,name:'Updated'},{id:contact.id,revision:0});assert.equal(updated.revision,1);
   await assert.rejects(put('studio.crm','contacts',contact.data,{id:contact.id,revision:0}),{status:409});
   assert.equal((await host.execute(actor,site,'studio.crm','pipeline',{})).contacts,1);
  });
  await t.test('transaction rollback also rolls back events; readonly and revoked access cannot write',async()=>{
   const count=()=>storage.transaction(async tx=>Number((await tx.get({sqlite:'SELECT COUNT(*) n FROM studio_async_outbox WHERE site_id=?',postgres:'SELECT COUNT(*) n FROM studio_async_outbox WHERE site_id=$1'},[site])).n));
   const before=await count();
   await assert.rejects(host.execute(actor,site,'test.probe','abort',{}),{status:422});
   assert.equal(await count(),before);
   await assert.rejects(host.execute(actor,site,'test.probe','readonly',{}),{status:403});
   await assert.rejects(host.execute(actor,site,'test.probe','revoke',{}),{status:403});permitted=true;
   assert.equal((await host.collection(actor,site,'test.probe','notes','GET')).total,0);
   const escaped=await host.execute(actor,site,'test.probe','escape',{});
   await assert.rejects(escaped.records.list('notes'),{status:409});
  });
  await t.test('atomic orders, idempotency, rollback and cancellation',async()=>{
   const product=await put('studio.commerce','products',{name:'One',sku:'one',priceMinor:100,currency:'TRY',stock:2,active:true});
   const input={requestId:'order-one',customerName:'Test',customerEmail:'test@example.test',items:[{productId:product.id,quantity:1}]};
   const order=await host.execute(actor,site,'studio.commerce','createOrder',input);
   assert.equal((await host.execute(actor,site,'studio.commerce','createOrder',input)).id,order.id);
   await assert.rejects(host.execute(actor,site,'studio.commerce','createOrder',{...input,customerName:'Other'}),{status:409});
   await host.execute(actor,site,'studio.commerce','transition',{id:order.id,revision:0,status:'cancelled'});
   assert.equal((await host.collection(actor,site,'studio.commerce','products','GET',{id:product.id})).data.stock,2);
   await assert.rejects(host.execute(actor,site,'studio.commerce','transition',{id:order.id,revision:1,status:'cancelled'}),{status:409});
   await assert.rejects(host.execute(actor,site,'studio.commerce','createOrder',{...input,requestId:'invalid',items:[{productId:product.id,quantity:1},{productId:'missing',quantity:1}]}),{status:404});
   assert.equal((await host.collection(actor,site,'studio.commerce','products','GET',{id:product.id})).data.stock,2);
  });
  await t.test('submitted repository operations finish before commit and caught nested errors abort',async()=>{
   await host.execute(actor,site,'test.probe','forgotAwait',{});
   assert.equal((await host.collection(actor,site,'test.probe','notes','GET')).total,1);
   await assert.rejects(host.execute(actor,site,'test.probe','caught',{}),{status:422});
   const rows=await host.collection(actor,site,'test.probe','notes','GET');assert.equal(rows.total,1);
   await host.collection(actor,site,'test.probe','notes','DELETE',{id:rows.items[0].id,revision:0});
  });
  await t.test('concurrent last-stock competition has exactly one successful order',async()=>{
   const product=await put('studio.commerce','products',{name:'Last',sku:'last',priceMinor:100,currency:'TRY',stock:1,active:true});
   const outcomes=await Promise.allSettled(['a','b'].map(requestId=>retry(()=>host.execute(actor,site,'studio.commerce','createOrder',{requestId,customerName:'Test',customerEmail:'test@example.test',items:[{productId:product.id,quantity:1}]}))));
   assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);
   assert.equal(outcomes.find(r=>r.status==='rejected').reason.status,409);
   assert.equal((await host.collection(actor,site,'studio.commerce','products','GET',{id:product.id})).data.stock,0);
  });
  await t.test('tombstone revision cannot revive an old update; lifecycle preserves data',async()=>{
   const note=await put('test.probe','notes',{title:'Original'},{id:'fixed'});
   await host.collection(actor,site,'test.probe','notes','DELETE',{id:note.id,revision:note.revision});
   const recreated=await put('test.probe','notes',{title:'New'},{id:'fixed'});assert.equal(recreated.revision,2);
   await assert.rejects(put('test.probe','notes',{title:'Old'},{id:'fixed',revision:0}),{status:409});
   await host.lifecycle(actor,site,'test.probe','disable',0);
   await assert.rejects(put('test.probe','notes',{title:'Disabled'}),{status:409});
   assert.equal((await host.export(actor,site,'test.probe')).records.length,1);
   await host.lifecycle(actor,site,'test.probe','enable',1);
  });
  await t.test('failed asynchronous upgrade rolls back schema state and records',async()=>{
   const upgrade={...probe,manifest:{...probe.manifest,version:'1.1.0',schemaVersion:2},migrations:[...probe.migrations,{version:2,async up(ctx){await ctx.records.put('notes',{data:{title:'migration'}});throw Object.assign(Error('migration'),{status:422});}}]};
   const newer=await new AsyncModuleHost({storage,modules:[upgrade],authorize}).initialize();
   await assert.rejects(newer.lifecycle(actor,site,'test.probe','upgrade',2),{status:422});
   const data=await host.export(actor,site,'test.probe');assert.equal(data.installation.version,'1.0.0');assert.equal(data.records.length,1);
  });
 });
}
