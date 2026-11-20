import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {SQLiteStorage,PostgreSQLStorage} from '@loft-studio/module-core/storage';
import {AsyncModuleHost} from '@loft-studio/module-core/async';
import {AsyncAudit} from '@loft-studio/audit/async';
import {Booking} from '@loft-studio/booking';
import {createAsyncBookingModule} from '@loft-studio/booking/async';
import seo from '@loft-studio/seo/async';
import crm from '@loft-studio/crm/async';
import bridge from '@loft-studio/booking-crm/async';
import {Store} from '../../src/store.mjs';
const url=process.env.LOFT_TEST_POSTGRES_URL;
for(const backend of ['sqlite','postgres'])test('async connections: '+backend,{skip:backend==='postgres'&&!url},async t=>{
 let storage,pool;
 if(backend==='sqlite'){storage=new SQLiteStorage(':memory:');t.after(()=>storage.close());}
 else{const {Pool}=await import('pg');pool=new Pool({connectionString:url,max:4,statement_timeout:5000});storage=new PostgreSQLStorage(pool);t.after(()=>pool.end());}
 const store=new Store(':memory:');t.after(()=>store.close());const booking=new Booking(store),binding=createAsyncBookingModule({store,booking});
 const id=randomUUID(),org=randomUUID(),actor={user_id:'owner'},site={id,org_id:org,name:'Site',revision:0,document:{pages:[{id:'home',name:'Home',title:'Home',description:'Description',path:'index.html'}]},allowed:['members','content','operations']};
 let permitted=true,auditFail=false,deliveryFail=false;
 const authorize=async(a,siteId)=>{if(a.user_id!=='owner'||!permitted||siteId!==id)throw Object.assign(Error('Denied'),{status:403});return structuredClone(site);};
 const audit=await new AsyncAudit({storage,context:()=>({requestId:'request-test',ip:'192.0.2.1',device:{browser:'test'}})}).initialize();
 const integration={...bridge,subscriptions:[{...bridge.subscriptions[0],async run(ctx,e){await bridge.subscriptions[0].run(ctx,e);if(deliveryFail)throw Error('SECRET_DO_NOT_LOG');}}]};
 const host=await new AsyncModuleHost({storage,modules:[binding.module,seo,crm],integrations:[integration],sources:{'studio.booking':binding.source},authorize,
  audit:{async append(tx,e){await audit.append(tx,e);if(auditFail)throw Object.assign(Error('Audit unavailable'),{status:503});}},
  ports:{'booking.operations':binding.invoke,'site.document.save':async(ctx,input)=>{
   await authorize(ctx.actor,ctx.siteId);if(input.revision!==site.revision)throw Object.assign(Error('Stale document'),{status:409});site.document=input.document;site.revision++;return {revision:site.revision};
  }}
 }).initialize();
 await host.lifecycle(actor,id,'studio.booking','install',-1);await binding.provision(site);
 await host.lifecycle(actor,id,'studio.crm','install',-1);await host.lifecycle(actor,id,'studio.seo','install',-1);
 const config=booking.settings(id);Object.assign(config.values,{timezone:'UTC',publicEnabled:true,approval:'automatic',cancellationHours:0});Object.assign(config.values.services[1],{enabled:true,capacity:2,minNoticeHours:0,weekdays:[0,1,2,3,4,5,6]});booking.saveSettings(id,config,'owner');
 let reservation,contact;
 await t.test('booking port persists operational IDs and idempotent requests; SEO persists with expected revision',async()=>{
  const input={requestId:randomUUID(),serviceId:'appointment',start:new Date(Date.now()+7*86400000).toISOString().slice(0,10)+'T10:00',name:'Customer',email:'test@example.test',phone:'1234567',consent:true,participants:[{name:'Person'}]};
  reservation=await host.execute(actor,id,'studio.booking','create',input);
  assert.equal((await host.execute(actor,id,'studio.booking','create',input)).id,reservation.id);assert.equal(booking.list(id).length,1);
  const metadata=await host.collection(actor,id,'studio.seo','pages','GET',{id:'home'});
  await host.collection(actor,id,'studio.seo','pages','PUT',{id:'home',revision:metadata.revision,data:{...metadata.data,title:'New title'}});
  assert.deepEqual(await host.execute(actor,id,'studio.seo','applyPage',{recordId:'home',siteRevision:0}),{revision:1});assert.equal(site.document.pages[0].title,'New title');
  await assert.rejects(host.execute(actor,id,'studio.seo','applyPage',{recordId:'home',siteRevision:0}),{status:409});
  await host.collection(actor,id,'studio.seo','settings','PUT',{data:{baseUrl:'https://example.test'}});
  assert.match((await host.execute(actor,id,'studio.seo','sitemap',{})).files[0].content,/https:\/\/example.test/);
 });
 await t.test('async delivery rollback, retries, identity links, disabled visibility and retained references',async()=>{
  assert.deepEqual(await host.integrations.ingest(),{failedSources:[]});deliveryFail=true;
  assert.equal((await host.integrations.drain()).failed,1);
  contact=await host.collection(actor,id,'studio.crm','contacts','PUT',{data:{name:'Lead',email:'lead@example.test'}});
  let timeline=await host.integrations.execute(actor,id,bridge.id,'timeline',{contactId:contact.id});assert.equal(timeline.candidates.length,0,'failed handler must roll back projection');
  deliveryFail=false;assert.equal((await host.integrations.drain({now:Date.now()+60001})).delivered,1);
  const link=await host.integrations.execute(actor,id,bridge.id,'link',{contactId:contact.id,bookingId:reservation.id});
  timeline=await host.integrations.execute(actor,id,bridge.id,'timeline',{contactId:contact.id});assert.equal(timeline.items.length,1);
  await host.lifecycle(actor,id,'studio.booking','disable',0);
  assert.equal((await host.catalog(actor,id)).find(m=>m.id==='studio.crm').views.length,0);
  await assert.rejects(host.integrations.execute(actor,id,bridge.id,'timeline',{contactId:contact.id}),{status:409});
  await assert.rejects(host.collection(actor,id,'studio.crm','contacts','DELETE',{id:contact.id,revision:0}),{status:409});
  await host.lifecycle(actor,id,'studio.booking','enable',1);
  await host.integrations.execute(actor,id,bridge.id,'unlink',{contactId:contact.id,bookingId:reservation.id,revision:link.revision});
  const next=await host.integrations.execute(actor,id,bridge.id,'link',{contactId:contact.id,bookingId:reservation.id});assert.ok(next.revision>link.revision);
  await assert.rejects(host.integrations.execute(actor,id,bridge.id,'unlink',{contactId:contact.id,bookingId:reservation.id,revision:link.revision}),{status:409});
  await host.integrations.ingest();assert.equal((await host.integrations.drain()).delivered,0,'cursor must not duplicate events');
  const other=new AsyncModuleHost({storage,modules:[crm],authorize});await other.initialize();await assert.rejects(other.collection(actor,id,'studio.crm','contacts','DELETE',{id:contact.id,revision:0}),{status:409},'reference survives integration removal');
 });
 await t.test('audit is atomic, includes before/after and request provenance, and authorization is enforced',async()=>{
  auditFail=true;await assert.rejects(host.collection(actor,id,'studio.crm','contacts','PUT',{id:contact.id,revision:0,data:{...contact.data,name:'Must roll back'}}),{code:'STORAGE_FAILURE'});auditFail=false;
  assert.equal((await host.collection(actor,id,'studio.crm','contacts','GET',{id:contact.id})).data.name,'Lead');
  await host.collection(actor,id,'studio.crm','contacts','PUT',{id:contact.id,revision:0,data:{...contact.data,name:'Changed'}});
  const rows=await audit.pending(500),entries=rows.map(r=>JSON.parse(r.payload)).filter(e=>e.siteId===id);
  const change=entries.find(e=>e.before?.data?.name==='Lead'&&e.after?.data?.name==='Changed');assert.ok(change);assert.equal(change.context.ip,'192.0.2.1');assert.equal(change.context.requestId,'request-test');
  assert.ok(!JSON.stringify(entries).includes('Must roll back'));
  permitted=false;await assert.rejects(host.execute(actor,id,'studio.booking','list',{}),{status:403});permitted=true;
 });
});
