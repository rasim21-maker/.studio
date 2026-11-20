import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {SQLiteStorage,PostgreSQLStorage} from '@loft-studio/module-core/storage';
import {OperationsRepository} from '@loft-studio/booking/repository';
import {AsyncBooking} from '@loft-studio/booking/async-engine';
import {AsyncPayments} from '../../src/async-payments.mjs';
import {AsyncAudit} from '@loft-studio/audit/async';
for(const backend of ['sqlite','postgres'])test('operational repositories: '+backend,{skip:backend==='postgres'&&!process.env.LOFT_TEST_POSTGRES_URL},async t=>{
 let storage,pool;if(backend==='sqlite'){storage=new SQLiteStorage(':memory:');t.after(()=>storage.close());}else{const{Pool}=await import('pg');pool=new Pool({connectionString:process.env.LOFT_TEST_POSTGRES_URL,max:5,statement_timeout:5000});storage=new PostgreSQLStorage(pool);t.after(()=>pool.end());}
 const site=randomUUID(),org=randomUUID();let state='enabled',permitted=true,auditFailure=false;
 const audit=await new AsyncAudit({storage}).initialize();
 const repo=await new OperationsRepository({storage,resolveSite:async id=>id===site?{id,org_id:org}:undefined,authorize:()=>{if(!permitted)throw Object.assign(Error('Denied'),{status:403});},audit:{async append(tx,e){await audit.append(tx,e);if(auditFailure)throw Error('Audit unavailable');}}}).initialize();
 let fetcher=async()=>{throw Error('Unexpected provider request');};
 const booking=new AsyncBooking(repo,{stateReader:async()=>state,hasPaymentLock:(site,id)=>payments.hasPaymentLock(site,id)});
 const payments=new AsyncPayments(repo,randomBytes(32),{fetcher:(...args)=>fetcher(...args),assertWritable:site=>booking.assertWritable(site)});
 await booking.provision({id:site});const settings=await booking.settings(site);Object.assign(settings.values,{timezone:'UTC',publicEnabled:true,approval:'manual',pendingMinutes:60,cancellationHours:0});Object.assign(settings.values.services[1],{enabled:true,capacity:1,minNoticeHours:0,priceMinor:10000,weekdays:[0,1,2,3,4,5,6]});await booking.saveSettings(site,settings,'owner');
 const input=(hour='10:00')=>({requestId:randomUUID(),serviceId:'appointment',start:new Date(Date.now()+7*86400000).toISOString().slice(0,10)+'T'+hour,quantity:1,customer:{name:'Customer',email:'test@example.test',phone:'1234567'},participants:[{name:'Person'}],consent:true});
 const retry=async fn=>{for(let n=0;;n++)try{return await fn();}catch(e){if(e.code!=='RETRY_TRANSACTION'||n>=4)throw e;}};
 let reservation;
 await t.test('capacity race, stable idempotency, rollback and event capture use the real storage',async()=>{
  const values=[input(),input()],results=await Promise.allSettled(values.map(v=>retry(()=>booking.create(site,v,'owner'))));assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  const winner=results.findIndex(r=>r.status==='fulfilled');reservation=results[winner].value;assert.equal((await booking.create(site,values[winner],'owner')).id,reservation.id);
  await assert.rejects(booking.create(site,{...values[winner],notes:'Changed'},'owner'),{status:409});
  assert.equal((await booking.list(site)).length,1);
  auditFailure=true;await assert.rejects(booking.update(site,reservation.id,{revision:0,notes:'ROLLBACK'},'owner'));auditFailure=false;assert.equal((await booking.row(site,reservation.id)).revision,0);
  const events=await repo.changes(0,500);assert.ok(events.some(e=>e.siteId===site&&e.data.bookingId===reservation.id));
 });
 await t.test('payment network runs outside SQL locks and concurrent verify confirms only once',async()=>{
  await payments.save(site,'stripe',{revision:0,enabled:true,mode:'sandbox',secrets:{secretKey:'fixture-key'}},'owner');
  let entered,release;const started=new Promise(r=>entered=r),gate=new Promise(r=>release=r);
  fetcher=async(url,options)=>{if(String(url).endsWith('/checkout/sessions')){entered();await gate;return new Response(JSON.stringify({id:'cs_'+reservation.id,url:'https://checkout.stripe.com/test'}));}return new Response(JSON.stringify({payment_status:'paid',status:'complete',amount_total:10000,currency:'try',client_reference_id:reservation.id,payment_intent:'pi_test'}));};
  const checkout=payments.checkout(site,await booking.row(site,reservation.id),'stripe',null,'http://localhost','127.0.0.1');await started;
  await assert.rejects(booking.update(site,reservation.id,{revision:0,start:input('14:00').start},'owner'),{status:409});
  assert.equal((await booking.list(site)).length,1,'reads complete while provider is paused');release();const payment=await checkout;
  const second=new AsyncPayments(repo,payments.key,{fetcher:(...args)=>fetcher(...args)});
  const results=await Promise.all([retry(()=>payments.verify(site,payment.id)),retry(()=>second.verify(site,payment.id))]);assert.ok(results.every(r=>r.status==='paid'));assert.equal((await booking.row(site,reservation.id)).revision,1);
 });
 await t.test('late payments require review, disabled history stays readable, tenant and permission checks hold',async()=>{
  const another=await booking.create(site,input('15:00'),'owner');
  fetcher=async(url)=>new Response(JSON.stringify(String(url).endsWith('/checkout/sessions')?{id:'cs_'+another.id,url:'https://checkout.stripe.com/late'}:{payment_status:'paid',status:'complete',amount_total:10000,currency:'try',client_reference_id:another.id}));
  const p=await payments.checkout(site,await booking.row(site,another.id),'stripe',null,'http://localhost','127.0.0.1');await booking.update(site,another.id,{revision:0,status:'cancelled'},'owner');state='disabled';
  assert.equal((await payments.verify(site,p.id)).status,'review');assert.equal((await booking.row(site,another.id)).status,'cancelled');
  await assert.rejects(booking.create(site,input('16:00'),'owner'),{status:409});assert.equal((await booking.list(site)).length,2);
  await assert.rejects(booking.list('other'),{status:403});permitted=false;await assert.rejects(booking.list(site),{status:403});permitted=true;
 });
});
