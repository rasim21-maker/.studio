import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {PostgreSQLStorage} from '@loft-studio/module-core/storage';
import {Store} from '../../src/store.mjs';
import {Booking,ensureBookingSite} from '@loft-studio/booking';
import {Integrations} from '../../src/integrations.mjs';
import {createOperations} from '../../src/operations.mjs';
for(const backend of ['sqlite','postgres'])test('operational migration and restart: '+backend,{skip:backend==='postgres'&&!process.env.LOFT_TEST_POSTGRES_URL},async()=>{
 const dir=await fs.mkdtemp(path.resolve('test-results/ops-migration-')),source=new Store(':memory:');let operations,pool,admin,schema;
 try{
  const oldBooking=new Booking(source),oldPayments=await Integrations.open(source,dir);
  ensureBookingSite(source,{id:'site',name:'Migration'});const c=oldBooking.settings('site');Object.assign(c.values,{timezone:'UTC',publicEnabled:true});Object.assign(c.values.services[1],{enabled:true,minNoticeHours:0,priceMinor:2500,weekdays:[0,1,2,3,4,5,6]});oldBooking.saveSettings('site',c,'owner');
  const input={requestId:randomUUID(),serviceId:'appointment',start:new Date(Date.now()+7*86400000).toISOString().slice(0,10)+'T10:00',quantity:1,customer:{name:'Customer',email:'test@example.test',phone:'1234567'},participants:[{name:'Guest'}],consent:true};
  const booking=oldBooking.create('site',input,'customer',{publicRequest:true});
  oldPayments.save('site','stripe',{revision:0,enabled:true,mode:'sandbox',secrets:{secretKey:'fixture-preserved-key'}},'owner');
  const payment=randomUUID(),stamp=new Date().toISOString();source.run('INSERT INTO payment_transactions VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',payment,'site',booking.id,'stripe','cs_fixture','https://checkout.stripe.com/fixture',2500,'TRY','created',stamp,stamp,'{}');
  const before=source.get('SELECT * FROM reservations WHERE id=?',booking.id),events=source.all('SELECT * FROM booking_changes');
  let operationsStorage;if(backend==='postgres'){
   const{Pool}=await import('pg');admin=new Pool({connectionString:process.env.LOFT_TEST_POSTGRES_URL});schema='ops_test_'+randomUUID().replaceAll('-','');await admin.query('CREATE SCHEMA '+schema);
   pool=new Pool({connectionString:process.env.LOFT_TEST_POSTGRES_URL,options:'-c search_path='+schema,max:3});operationsStorage=new PostgreSQLStorage(pool);
  }
  const options={store:source,dataDir:dir,security:{operationsStorage,integrationFetcher:async()=>{throw Error('Unexpected network');}}};
  operations=await createOperations(options);
  assert.deepEqual(await operations.booking.row('site',booking.id),{...before});
  assert.equal((await operations.integrations.config('site','stripe')).secrets.secretKey,'fixture-preserved-key');
  assert.equal((await operations.integrations.paymentRows('site'))[0].id,payment);
  assert.equal((await operations.booking.publicView('site',booking.id,booking.manageToken)).id,booking.id);
  assert.equal((await operations.repository.changes(0,100)).length,events.length);
  assert.throws(()=>oldBooking.create('site',{...input,requestId:randomUUID(),start:input.start.replace('10:00','12:00')},'owner'),/moved to async/);
  await operations.booking.update('site',booking.id,{revision:0,notes:'After migration'},'owner');
  await operations.close();operations=await createOperations(options);
  assert.equal((await operations.booking.row('site',booking.id)).revision,1);
  assert.equal((await operations.booking.create('site',input,'customer',{publicRequest:true})).reference,booking.reference);
  assert.equal((await operations.repository.changes(0,100)).length,events.length+1);
 }finally{await operations?.close();await pool?.end();if(admin){await admin.query('DROP SCHEMA '+schema+' CASCADE');await admin.end();}source.close();}
});
