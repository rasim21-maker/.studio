import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {Store} from '../../src/store.mjs';
import {ModuleHost} from '@loft-studio/module-core';
import {Booking,createBookingModule,ensureBookingSite} from '@loft-studio/booking';
import crm from '@loft-studio/crm';
import bridge from '@loft-studio/booking-crm';
import {defineModule,defineIntegration,field} from '@loft-studio/sdk';

const owner={user_id:'owner'};
test('I09: additive migration captures existing reservations once as a baseline without inventing history',t=>{
 const f=setup(t);f.install('studio.booking');f.install('studio.crm');f.configure();
 const r=f.create();f.booking.update('one',r.id,{revision:0,status:'confirmed'},'owner');
 // Simulate the old release, which has reservations but no event-capture tables.
 f.store.db.exec('DROP TRIGGER booking_change_insert;DROP TRIGGER booking_change_update;DROP TABLE booking_changes;DROP TABLE booking_event_migrations;');
 const upgraded=new Booking(f.store);
 assert.equal(upgraded.row('one',r.id).revision,1);
 const baseline=f.store.all('SELECT * FROM booking_changes');
 assert.equal(baseline.length,1);assert.equal(JSON.parse(baseline[0].data).kind,'baseline');
 new Booking(f.store);assert.equal(f.store.get('SELECT COUNT(*) n FROM booking_changes').n,1);
 f.pump();const c=f.contact();f.call('link',{contactId:c.id,bookingId:r.id});
 assert.equal(f.call('timeline',{contactId:c.id}).items[0].title,'Mevcut rezervasyon kaydı');
});
test('I10: malformed event source cannot advance its cursor or block other sources and already queued deliveries',t=>{
 const f=setup(t);f.install('studio.booking');f.install('studio.crm');f.configure();f.create();
 const bad=defineModule({manifest:{id:'acme.broken',name:'Broken',description:'Test',version:'1.0.0',apiVersion:1,schemaVersion:1,permissions:['operations']},migrations:[{version:1,up(){}}],eventSource:{read(){throw Error('SECRET_SOURCE_TOKEN');}}});
 const host=new ModuleHost({store:f.store,modules:[bad,...f.modules],authorize:f.authorize,integrations:[bridge]});
 assert.deepEqual(host.integrations.ingest().failedSources,['acme.broken']);
 assert.equal(f.store.get("SELECT sequence FROM studio_event_cursors WHERE module_id='acme.broken'"),undefined);
 assert.equal(host.integrations.drain().delivered,1);
});
function setup(t,{filename=':memory:',integration=bridge}={}) {
 const store=new Store(filename);t.after(()=>store.close());
 store.db.exec("CREATE TABLE IF NOT EXISTS studio_sites(id TEXT PRIMARY KEY);INSERT OR IGNORE INTO studio_sites VALUES ('one'),('two');");
 const permissions={owner:['members','operations','content'],viewer:['content'],operator:['operations']};
 const authorize=(actor,site,permission)=>{
  if(!['one','two'].includes(site)||!permissions[actor.user_id]||actor.user_id==='operator'&&site==='two')throw Object.assign(Error('scope'),{status:404});
  if(permission&&!permissions[actor.user_id].includes(permission))throw Object.assign(Error('permission'),{status:403});
  return {id:site,name:site,allowed:permissions[actor.user_id]};
 };
 const booking=new Booking(store),modules=[crm,createBookingModule({booking,store})];
 let host=new ModuleHost({store,modules,authorize,integrations:[integration]});
 const install=(id,site='one')=>host.lifecycle(owner,site,id,'install',-1);
 const configure=(site='one')=>{
  const s=booking.settings(site);Object.assign(s.values,{timezone:'UTC',publicEnabled:true,approval:'automatic',cancellationHours:0});
  Object.assign(s.values.services[1],{enabled:true,capacity:100,minNoticeHours:0,weekdays:[0,1,2,3,4,5,6]});
  booking.saveSettings(site,s,'owner');
 };
 const create=(site='one',extra={})=>booking.create(site,{requestId:randomUUID(),serviceId:'appointment',start:new Date(Date.now()+7*86400000).toISOString().slice(0,10)+'T10:00',quantity:1,customer:{name:'Shared name',email:'customer@example.test',phone:'1234567'},participants:[{name:'Participant'}],consent:true,...extra},'owner');
 const contact=(site='one',email='customer@example.test')=>host.collection(owner,site,'studio.crm','contacts','PUT',{data:{name:'Lead',email,status:'lead'}});
 const call=(command,input,actor=owner,site='one')=>host.integrations.execute(actor,site,bridge.id,command,input);
 const pump=()=>{host.integrations.ingest();return host.integrations.drain();};
 return {store,booking,modules,authorize,permissions,install,configure,create,contact,call,pump,get host(){return host;},restart(next=integration){host=new ModuleHost({store,modules,authorize,integrations:[next]});return host;}};
}
test('I01: optional modules expose CRM timeline only together; explicit identity link, automatic changes, retained history',t=>{
 const f=setup(t);f.install('studio.booking');f.configure();
 const reservation=f.create();f.pump();
 assert.equal(f.host.catalog(owner,'one').find(p=>p.id==='studio.crm').views.length,0);
 f.install('studio.crm');const contact=f.contact();f.pump();
 assert.equal(f.host.catalog(owner,'one').find(p=>p.id==='studio.crm').views.length,1);
 assert.equal(f.call('timeline',{contactId:contact.id}).links.length,0,'email alone must not link identities');
 f.call('link',{contactId:contact.id,bookingId:reservation.id});
 assert.equal(f.call('timeline',{contactId:contact.id}).items.length,1);
 f.booking.update('one',reservation.id,{revision:0,status:'confirmed'},'owner');f.pump();f.pump();
 assert.equal(f.call('timeline',{contactId:contact.id}).items.length,2);
 assert.equal(f.call('timeline',{contactId:contact.id}).items[0].revision,1);
 f.host.lifecycle(owner,'one','studio.booking','disable',0);
 assert.equal(f.host.catalog(owner,'one').find(p=>p.id==='studio.crm').views.length,0);
 assert.throws(()=>f.call('timeline',{contactId:contact.id}),{status:409});
 f.booking.update('one',reservation.id,{revision:1,status:'cancelled'},'customer');f.pump();
 assert.equal(f.store.get("SELECT COUNT(*) n FROM studio_event_deliveries WHERE state='pending'").n,1);
 f.host.lifecycle(owner,'one','studio.booking','enable',1);f.pump();
 const resumed=f.call('timeline',{contactId:contact.id});
 assert.equal(resumed.items.length,3);assert.equal(resumed.links[0].id,reservation.id);
 assert.equal(f.host.collection(owner,'one','studio.crm','contacts','GET').total,1);
 f.host.lifecycle(owner,'one','studio.crm','disable',0);
 assert.throws(()=>f.call('timeline',{contactId:contact.id}),{status:409});
 const next=f.create();assert.ok(next.id,'booking works without CRM');
});
test('I02: all database mutation paths capture minimal events atomically, including expiry and payment confirmation',t=>{
 const f=setup(t);f.install('studio.booking');f.install('studio.crm');f.configure();
 const r=f.create('one',{notes:'SECRET staff note'});
 const count=()=>f.store.get('SELECT COUNT(*) n FROM booking_changes').n;
 assert.equal(count(),1);
 assert.throws(()=>f.store.transaction(()=>{f.store.run("UPDATE reservations SET revision=revision+1,status='confirmed' WHERE id=?",r.id);throw Error('rollback');}),/rollback/);
 assert.equal(count(),1);assert.equal(f.booking.row('one',r.id).revision,0);
 f.store.transaction(()=>f.store.run("UPDATE reservations SET revision=revision+1,status='confirmed',hold_until=NULL WHERE id=?",r.id));
 assert.equal(count(),2);
 const expiring=f.create();f.store.run('UPDATE reservations SET hold_until=? WHERE id=?',Date.now()-1,expiring.id);f.booking.expire('one');
 assert.equal(count(),4);f.pump();
 const data=JSON.stringify(f.store.all('SELECT data FROM booking_changes'));
 for(const secret of ['SECRET','customer@example.test','1234567','token_hash','manageToken','Participant'])assert.ok(!data.includes(secret),secret);
 const contact=f.contact();f.call('link',{contactId:contact.id,bookingId:expiring.id});
 assert.match(f.call('timeline',{contactId:contact.id}).items[0].detail,/İptal/);
});
test('I03: site/permission isolation, disabled references, stale edits and unlinking never delete business records',t=>{
 const f=setup(t);
 for(const site of ['one','two']){f.install('studio.booking',site);f.install('studio.crm',site);f.configure(site);}
 const a=f.create(),b=f.create('two'),c=f.contact(),foreign=f.contact('two');f.pump();
 assert.throws(()=>f.call('link',{contactId:c.id,bookingId:b.id}),{status:404});
 assert.throws(()=>f.call('link',{contactId:foreign.id,bookingId:a.id}),{status:404});
 assert.throws(()=>f.call('timeline',{contactId:c.id},{user_id:'viewer'}),{status:403});
 assert.throws(()=>f.call('timeline',{contactId:foreign.id},{user_id:'operator'},'two'),{status:404});
 const linked=f.call('link',{contactId:c.id,bookingId:a.id});
 assert.throws(()=>f.host.collection(owner,'one','studio.crm','contacts','DELETE',{id:c.id,revision:0}),{status:409});
 f.host.lifecycle(owner,'one','studio.booking','disable',0);
 assert.throws(()=>f.host.collection(owner,'one','studio.crm','contacts','DELETE',{id:c.id,revision:0}),{status:409});
 assert.ok(f.host.export(owner,'one','studio.crm').integrations[0].records.some(r=>r.collection==='links'&&r.data.contactId===c.id));
 f.host.lifecycle(owner,'one','studio.booking','enable',1);
 assert.throws(()=>f.call('unlink',{contactId:c.id,bookingId:a.id,revision:linked.revision+1}),{status:409});
 f.call('unlink',{contactId:c.id,bookingId:a.id,revision:linked.revision});
 const relinked=f.call('link',{contactId:c.id,bookingId:a.id});
 assert.throws(()=>f.call('unlink',{contactId:c.id,bookingId:a.id,revision:linked.revision}),{status:409},'old unlink must not remove a newly created link');
 const withoutBridge=new ModuleHost({store:f.store,modules:f.modules,authorize:f.authorize});
 assert.throws(()=>withoutBridge.collection(owner,'one','studio.crm','contacts','DELETE',{id:c.id,revision:0}),{status:409},'references survive removal of the package from composition');
 f.call('unlink',{contactId:c.id,bookingId:a.id,revision:relinked.revision});
 assert.equal(f.call('timeline',{contactId:c.id}).items.length,0);
 assert.equal(f.booking.row('one',a.id).id,a.id);
 f.host.collection(owner,'one','studio.crm','contacts','DELETE',{id:c.id,revision:0});
});
test('I04: handler rollback, bounded retry, sanitized diagnostics, permissioned recovery and replay deduplication',t=>{
 const broken={...bridge,subscriptions:bridge.subscriptions.map(s=>({...s,run(ctx,event){s.run(ctx,event);throw Error('SECRET_ACCESS_TOKEN');}}))};
 const f=setup(t,{integration:broken});f.install('studio.booking');f.install('studio.crm');f.configure();const r=f.create();f.host.integrations.ingest();
 for(let i=0;i<5;i++)f.host.integrations.drain({now:Date.now()+i*100000});
 assert.equal(f.store.get('SELECT COUNT(*) n FROM studio_integration_records').n,0,'handler writes roll back with delivery');
 assert.equal(f.host.integrations.status(owner,'one',bridge.id)[0].state,'failed');
 assert.ok(!JSON.stringify(f.store.all('SELECT * FROM studio_event_deliveries')).includes('SECRET'));
 assert.throws(()=>f.host.integrations.retry({user_id:'operator'},'one',bridge.id),{status:403});
 f.restart(); // still broken: changing callbacks is a deployment action, below uses the fixed definition
 f.restart(bridge);f.host.integrations.retry(owner,'one',bridge.id);f.pump();
 const c=f.contact();f.call('link',{contactId:c.id,bookingId:r.id});assert.equal(f.call('timeline',{contactId:c.id}).items.length,1);
 f.store.run("UPDATE studio_event_deliveries SET state='pending',next_attempt=0");f.pump();
 assert.equal(f.call('timeline',{contactId:c.id}).items.length,1);
});
test('I05: on-disk restart resumes undelivered events and preserves stable links without duplicates',t=>{
 fs.mkdirSync('test-results',{recursive:true});
 const filename=path.resolve('test-results','integration-'+randomUUID()+'.sqlite'),f=setup(t,{filename});
 f.install('studio.booking');f.install('studio.crm');f.configure();const r=f.create(),c=f.contact();f.pump();f.call('link',{contactId:c.id,bookingId:r.id});
 f.booking.update('one',r.id,{revision:0,status:'confirmed'},'owner');
 const secondStore=new Store(filename),booking=new Booking(secondStore);
 t.after(()=>secondStore.close());
 const next=new ModuleHost({store:secondStore,modules:[crm,createBookingModule({store:secondStore,booking})],authorize:f.authorize,integrations:[bridge]});
 next.integrations.ingest();next.integrations.drain();f.pump();
 const result=next.integrations.execute(owner,'one',bridge.id,'timeline',{contactId:c.id});
 assert.equal(result.items.length,2);assert.equal(result.links[0].id,r.id);
});
test('I06: an arbitrary SDK integration works without booking/CRM conditions in the core; contract validation and read-only enforcement',async t=>{
 const make=id=>defineModule({manifest:{id,name:id,description:'Test',version:'1.0.0',apiVersion:1,schemaVersion:1,permissions:['operations']},migrations:[{version:1,up(){}}],events:{'task.changed':{version:1,fields:{title:field('Title','text',{required:true,maxLength:20})}}},commands:{read:{label:'Read',permission:'operations',write:false,run:ctx=>ctx.emit('task.changed',{title:'bad'})},send:{label:'Send',permission:'operations',fields:{title:field('Title','text',{required:true,maxLength:100})},run:(ctx,input)=>ctx.emit('task.changed',input)}}});
 const a=make('acme.tasks'),b=make('acme.history');
 const custom=defineIntegration({id:'acme.activity',name:'Activity',version:'1.0.0',requires:{'acme.tasks':1,'acme.history':1},permissions:['operations'],collections:{items:{fields:{title:field('Title','text')}}},commands:{},subscriptions:[{module:'acme.tasks',type:'task.changed',version:1,run(ctx,e){ctx.records.put('items',{id:e.id,data:e.data});}}]});
 const f=setup(t),host=new ModuleHost({store:f.store,modules:[a,b],authorize:f.authorize,integrations:[custom]});
 for(const id of ['acme.tasks','acme.history'])host.lifecycle(owner,'one',id,'install',-1);
 await assert.rejects(host.execute(owner,'one','acme.tasks','read',{}),{status:403});
 await assert.rejects(host.execute(owner,'one','acme.tasks','send',{title:'x'.repeat(50)}),{status:422});
 assert.equal(f.store.get("SELECT COUNT(*) n FROM studio_module_events WHERE type='task.changed'").n,0);
 await host.execute(owner,'one','acme.tasks','send',{title:'hello'});host.integrations.drain();
 assert.equal(f.store.get("SELECT COUNT(*) n FROM studio_integration_records WHERE integration_id='acme.activity'").n,1);
 assert.throws(()=>defineIntegration({...custom,subscriptions:[{...custom.subscriptions[0],version:0}]}),{status:422});
 assert.throws(()=>new ModuleHost({store:f.store,modules:[a,b],authorize:f.authorize,integrations:[{...custom,subscriptions:[{...custom.subscriptions[0],version:2}]}]}),{status:422});
 const absent=new ModuleHost({store:f.store,modules:[a],authorize:f.authorize,integrations:[custom]});
 assert.equal(absent.integrations.active('one',custom),false);
});
test('I07: a disabled site cannot starve active deliveries and out-of-order replay cannot regress the latest state',t=>{
 const f=setup(t);for(const site of ['one','two']){f.install('studio.booking',site);f.install('studio.crm',site);f.configure(site);}
 const a=f.create(),b=f.create('two');f.host.lifecycle(owner,'one','studio.crm','disable',0);
 f.booking.update('two',b.id,{revision:0,status:'confirmed'},'owner');f.pump();
 assert.equal(f.store.get("SELECT COUNT(*) n FROM studio_event_deliveries q JOIN studio_event_outbox e ON e.id=q.event_id WHERE e.site_id='two' AND q.state='delivered'").n,2);
 const c=f.contact('two');f.call('link',{contactId:c.id,bookingId:b.id},owner,'two');
 f.store.run("UPDATE studio_event_deliveries SET state='pending',next_attempt=0 WHERE event_id IN (SELECT id FROM studio_event_outbox WHERE site_id='two' AND json_extract(data,'$.bookingRevision')=0)");
 f.pump();assert.match(f.call('timeline',{contactId:c.id},owner,'two').links[0].label,/Onaylandı/);
 assert.equal(f.store.get("SELECT COUNT(*) n FROM studio_event_deliveries q JOIN studio_event_outbox e ON e.id=q.event_id WHERE e.site_id='one' AND q.attempts=0").n,1);
 assert.ok(a.id);
});
