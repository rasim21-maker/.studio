import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {zipSync,strToU8} from 'fflate';
import {Store} from '../../src/store.mjs';
import {createPlatform} from '../../src/v2/platform.ts';
import {createFeatures} from '../../src/features.mjs';
import studioModules, {studioIntegrations} from '../../studio.config.mjs';
import {Booking,ensureBookingSite} from '@loft-studio/booking';
import {field,validateFields,parseFields} from '@loft-studio/sdk';
import {inspectFiles,readZip} from '../../src/v2/import.ts';
import {createRegistry,discover} from '../../src/v2/adapters.ts';
import {assertSnapshot} from '../../src/v2/snapshots.ts';
import {fixture} from '../../src/v2/fixtures.ts';
import {newSection} from '../../shared/v2/model.ts';

const root=path.resolve(import.meta.dirname,'../..');
test('I08 HTTP: CRM slot, automatic delivery, deferred permission revocation and disabled integration routes',async t=>{
 const f=await platformFixture(t),site=await f.site(),base='sites/'+site,bridge=base+'/extension-links/studio.booking-crm';
 assert.equal((await f.call(base+'/extensions/studio.crm/install','POST',{revision:-1})).status,200);
 const contact=(await f.call(base+'/extensions/studio.crm/collections/contacts','PUT',{data:{name:'Lead',email:'customer@example.test'}})).data;
 const created=f.features.booking.create(site,bookingInput(),'owner');f.platform.deliverEvents();
 assert.equal((await f.call(base+'/extensions')).data.packages.find(p=>p.id==='studio.crm').views.length,1);
 assert.equal((await f.call(bridge+'/commands/link','POST',{contactId:contact.id,bookingId:created.id})).status,200);
 assert.equal((await f.call(bridge+'/commands/timeline','POST',{contactId:contact.id})).data.items.length,1);
 assert.equal((await f.call(base+'/members','PUT',{email:'editor@test.example',permissions:['operations']})).status,200);
 const waiting=gate(),request=f.call(bridge+'/commands/unlink','POST',{},'editor',()=>waiting.read().then(()=>({contactId:contact.id,bookingId:created.id,revision:0})));
 await waiting.entered;await f.call(base+'/members','PUT',{email:'editor@test.example',permissions:['content']});waiting.release();
 assert.equal((await request).status,403);
 assert.equal((await f.call(bridge+'/commands/timeline','POST',{contactId:contact.id})).data.links.length,1);
 assert.equal((await f.call(base+'/extensions/studio.booking/disable','POST',{revision:0})).status,200);
 assert.equal((await f.call(base+'/extensions')).data.packages.find(p=>p.id==='studio.crm').views.length,0);
 for(const route of ['/commands/timeline','/commands/link','/commands/unlink'])assert.equal((await f.call(bridge+route,'POST',{contactId:contact.id,bookingId:created.id,revision:0})).status,409);
 assert.equal((await f.call(bridge+'/status')).status,409);
 assert.equal((await f.call(base+'/extensions/studio.crm/export')).data.integrations[0].records.filter(r=>r.collection==='links').length,1);
});
const html='<!doctype html><html><head><title>Review</title></head><body><main><section><h1>Review</h1><p>Text</p></section></main></body></html>';
const day=()=>new Date(Date.now()+7*86400000).toISOString().slice(0,10);
const bookingInput=()=>({requestId:randomUUID(),serviceId:'appointment',start:day()+'T10:00',quantity:1,customer:{name:'Test customer',email:'customer@example.test',phone:'123456789'},participants:[{name:'Participant'}],notes:'Customer note',consent:true,status:'confirmed'});
function configure(booking,site){const config=booking.settings(site);Object.assign(config.values,{timezone:'UTC',publicEnabled:true,approval:'automatic',cancellationHours:0});Object.assign(config.values.services[1],{enabled:true,minNoticeHours:0,priceMinor:1000,weekdays:[0,1,2,3,4,5,6]});return booking.saveSettings(site,config,'test');}
function standalone(t,options){const store=new Store(':memory:');t.after(()=>store.close());const booking=new Booking(store,options);ensureBookingSite(store,{id:'site',name:'Test'});configure(booking,'site');return {store,booking};}
function gate(){let release;const value=new Promise(resolve=>{release=resolve;});let enter;const entered=new Promise(resolve=>{enter=resolve;});return {entered,release,read(){enter();return value;}};}
async function platformFixture(t){
 const dir=await fs.mkdtemp(path.join(root,'test-results','review-regression-')),store=new Store(':memory:'),origin='http://127.0.0.1:4999';
 for(const id of ['owner','editor'])store.run('INSERT INTO users VALUES (?,?,?,?)',id,id+'@test.example','unused-test-hash',new Date().toISOString());
 const features=await createFeatures({store,dataDir:dir,origin,security:{integrationFetcher:async()=>{throw Error('Unexpected provider call');}}});
 const platform=await createPlatform({store,dataDir:dir,features,modules:studioModules({store,features}),integrations:studioIntegrations,legacyAdapter:{metadata:()=>({name:'Test'})}});
 t.after(async()=>{await platform.close();store.close();});
 const response=()=>{const result={};return {result,res:{setHeader(){},writeHead(status){result.status=status;},end(text){result.data=JSON.parse(text);}}};};
 async function call(tail,method='GET',value={},user='owner',body){const {result,res}=response();try{await platform.route({req:{},res,url:new URL('/api/v2/'+tail,origin),method,user:{user_id:user,email:user+'@test.example'},body:body||(()=>Promise.resolve(value)),json:(_r,status,data)=>Object.assign(result,{status,data})});}catch(e){Object.assign(result,{status:e.status||500,error:e.message});}return result;}
 async function publicCall(site,tail,method='GET',value,token,body){const {result,res}=response();try{await features.publicRoute({req:{headers:{origin,...(token?{'x-booking-token':token}:{})},socket:{remoteAddress:'127.0.0.1'}},res,url:new URL('/public/'+site+'/'+tail,origin),method,body:body||(()=>Promise.resolve(value)),rateLimit(){}});}catch(e){Object.assign(result,{status:e.status||500,error:e.message});}return result;}
 const org=(await call('workspace')).data.organizations[0].id;
 async function job(){const created=await call('imports','POST',{orgId:org,kind:'example',example:'static',requestId:randomUUID()});assert.equal(created.status,202);for(let n=0;n<100;n++){const state=await call('imports/'+created.data.id);if(state.data.status==='review')return created.data.id;assert.ok(['queued','analyzing'].includes(state.data.status));await new Promise(r=>setImmediate(r));}throw Error('Import did not reach review');}
 async function site(){const result=await call('imports/'+await job()+'/commit','POST',{});assert.equal(result.status,201,JSON.stringify(result));const id=result.data.siteId;assert.equal((await call('sites/'+id+'/extensions/studio.booking/install','POST',{revision:-1})).status,200);configure(features.booking,id);return id;}
 return {store,features,platform,call,publicCall,job,site,response};
}

test('R01: runtime secret filenames are excluded across case, directory, ZIP and exported files',()=>{
 const vault=JSON.stringify({formatVersion:1,activeKeyId:'test',keys:{test:Buffer.alloc(32,7).toString('base64')}}),registry=createRegistry();
 for(const name of ['studio-vault.json','STUDIO-VAULT.JSON','data/Studio-Vault.Json','data/.ENV','data/STUDIO-KEY','data/INTEGRATION-KEY'])for(const archive of [false,true]){
  const files={'index.html':Buffer.from(html),[name]:Buffer.from(vault)},scan=inspectFiles(archive?readZip(Buffer.from(zipSync(files))):files);
  assert.ok(scan.report.rejected.some(r=>r.path===name),name);assert.equal(scan.source.files[name],undefined);
  const found=discover(scan.source,registry),exported=registry.get('static').export(found.document,found.source);
  const zip=readZip(Buffer.from(zipSync(Object.fromEntries(Object.entries(exported).map(([p,text])=>[p,strToU8(text)])))));
  assert.equal(zip[name],undefined);assert.ok(!JSON.stringify(exported).includes(vault));
 }
 const old=discover(inspectFiles({'index.html':Buffer.from(html)}).source,registry);old.source.files['STUDIO-VAULT.JSON']=vault;
 assert.throws(()=>assertSnapshot(registry.get('static'),old.document,old.source),{status:422});
});

test('R02: customer cancellation has the same public allowlist as viewing, including after staff edits',async t=>{
 const {features,publicCall,site}=await platformFixture(t),id=await site(),created=features.booking.create(id,bookingInput(),'customer',{publicRequest:true});
 features.booking.update(id,created.id,{revision:0,notes:'STAFF-ONLY confidential note'},'owner');
 const before=await publicCall(id,'bookings/'+created.id,'GET',undefined,created.manageToken);
 const cancelled=await publicCall(id,'bookings/'+created.id+'/cancel','POST',{revision:before.data.revision},created.manageToken);
 assert.equal(cancelled.status,200);assert.equal(cancelled.data.status,'cancelled');
 const expected=features.booking.publicView(id,created.id,created.manageToken);assert.deepEqual(cancelled.data,expected);
 assert.ok(!JSON.stringify(cancelled).includes('STAFF-ONLY'));for(const key of ['notes','customer','pets','participants','token_hash','resource'])assert.equal(cancelled.data[key],undefined,key);
});

test('R03: revocation while reading each operational write body denies the write without side effects',async t=>{
 const f=await platformFixture(t),site=await f.site(),base='sites/'+site+'/modules/';
 const booking=f.features.booking,existing=booking.create(site,{...bookingInput(),start:day()+'T12:00'},'owner');
 const event={title:'Existing',start:day()+'T16:00',end:day()+'T17:00',resource:'appointments',blocks:false};
 const eventId=booking.event(site,event,'owner').ids[0],settings=booking.settings(site);settings.values.timezone='Europe/Istanbul';
 const cases=[['booking-settings','PUT',settings],['bookings','POST',bookingInput()],['bookings/'+existing.id,'PUT',{revision:0,notes:'revoked edit'}],['calendar','POST',{...event,title:'revoked event'}],['calendar/'+eventId,'PUT',{...event,revision:0,title:'revoked edit'}],['calendar/'+eventId,'DELETE',{revision:0}],['integrations/stripe','PUT',{revision:0,enabled:true,mode:'sandbox',secrets:{secretKey:'test-key'}}],['bookings/'+existing.id+'/checkout','POST',{provider:'stripe'}]];
 const snapshot=()=>JSON.stringify(['booking_settings','reservations','calendar_events','integrations','payment_transactions','events'].map(table=>f.store.all('SELECT * FROM '+table)));
 for(const [tail,method,value]of cases){
  assert.equal((await f.call('sites/'+site+'/members','PUT',{email:'editor@test.example',permissions:['operations','integrations']})).status,200);
  const before=snapshot(),body=gate(),pending=f.call(base+tail,method,{},'editor',body.read);await body.entered;
  await f.call('sites/'+site+'/members','DELETE',{userId:'editor'});body.release(value);const result=await pending;
  assert.equal(result.status,404,tail+': '+JSON.stringify(result));assert.equal(snapshot(),before,tail);
 }
 // The legacy route uses membership(), not the V2 authorize callback.
 f.store.run('INSERT INTO memberships VALUES (?,?,?)','editor',site,'admin');const body=gate(),{res,result}=f.response();
 const pending=f.features.adminRoute({req:{},res,siteId:site,tail:'booking-settings',method:'PUT',body:body.read,user:{user_id:'editor',email:'editor@test.example'}}).catch(error=>Object.assign(result,{status:error.status}));
 await body.entered;f.store.run('DELETE FROM memberships WHERE user_id=? AND site_id=?','editor',site);body.release(settings);await pending;assert.equal(result.status,404);
});

test('R04: overlapping commits converge on one site, workspace, project and version',async t=>{
 const f=await platformFixture(t),job=await f.job(),a=gate(),b=gate();
 const first=f.call('imports/'+job+'/commit','POST',{},'owner',a.read),second=f.call('imports/'+job+'/commit','POST',{},'owner',b.read);
 await Promise.all([a.entered,b.entered]);a.release({});const one=await first;b.release({});const two=await second;
 assert.equal(one.status,201);assert.equal(two.status,200);assert.equal(one.data.siteId,two.data.siteId);
 for(const table of ['studio_sites','studio_workspaces','studio_projects','studio_versions'])assert.equal(f.store.get('SELECT COUNT(*) n FROM '+table).n,1,table);
});
test('R04: cancellation wins over a commit that is still reading its body',async t=>{
 const f=await platformFixture(t),job=await f.job(),body=gate(),pending=f.call('imports/'+job+'/commit','POST',{},'owner',body.read);
 await body.entered;assert.equal((await f.call('imports/'+job+'/cancel','POST')).status,200);body.release({});assert.equal((await pending).status,409);
 assert.equal((await f.call('imports/'+job)).data.status,'cancelled');assert.equal(f.store.get('SELECT COUNT(*) n FROM studio_sites').n,0);
});

test('R05: standalone booking supports create, move and cancel without payment tables',t=>{
 const {store,booking}=standalone(t),created=booking.create('site',bookingInput(),'owner');
 const moved=booking.update('site',created.id,{revision:0,start:day()+'T14:00'},'owner');assert.notEqual(moved.start,created.start);
 assert.equal(booking.update('site',created.id,{revision:moved.revision,status:'cancelled'},'owner').status,'cancelled');
 assert.equal(store.get("SELECT name FROM sqlite_master WHERE name='payment_transactions'"),undefined);
});
test('R05: an injected payment lock still protects rescheduling',t=>{
 let locked=true,checked;const {booking}=standalone(t,{hasPaymentLock:(site,id)=>{checked={site,id};return locked;}}),created=booking.create('site',bookingInput(),'owner');
 assert.throws(()=>booking.update('site',created.id,{revision:0,start:day()+'T14:00'},'owner'),{status:409});assert.deepEqual(checked,{site:'site',id:created.id});
 locked=false;assert.equal(booking.update('site',created.id,{revision:0,start:day()+'T14:00'},'owner').revision,1);
});

for(const state of ['disabled','uninstalled','public-closed'])test('R06: existing customer management survives '+state+' while new work stays closed',async t=>{
 const f=await platformFixture(t),site=await f.site(),b=f.features.booking,created=b.create(site,bookingInput(),'customer',{publicRequest:true}),payment=randomUUID();
 f.features.integrations.save(site,'stripe',{revision:0,enabled:true,mode:'sandbox',secrets:{secretKey:'test-key'}},'owner');
 const stamp=new Date().toISOString();f.store.run('INSERT INTO payment_transactions VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',payment,site,created.id,'stripe','cs_test','https://checkout.stripe.com/test',1000,'TRY','created',stamp,stamp,'{}');
 f.features.integrations.fetcher=async()=>new Response(JSON.stringify({payment_status:'paid',status:'complete',amount_total:1000,currency:'try',client_reference_id:created.id}));
 if(state==='public-closed'){const config=b.settings(site);config.values.publicEnabled=false;b.saveSettings(site,config,'owner');}
 else assert.equal((await f.call('sites/'+site+'/extensions/studio.booking/'+(state==='disabled'?'disable':'uninstall'),'POST',{revision:0})).status,200);
 assert.equal((await f.publicCall(site,'catalog')).data.enabled,false);
 for(const tail of ['bookings','availability','bookings/'+created.id+'/checkout'])assert.equal((await f.publicCall(site,tail,'POST',bookingInput(),created.manageToken)).status,403,tail);
 assert.equal((await f.publicCall(site,'bookings/'+created.id,'GET',undefined,'wrong')).status,404);
 assert.equal((await f.publicCall(site,'bookings/'+created.id,'GET',undefined,created.manageToken)).status,200);
 const verified=await f.publicCall(site,'bookings/'+created.id+'/verify','POST',{paymentId:payment},created.manageToken);assert.equal(verified.status,200);assert.equal(verified.data.status,'paid');
 const current=(await f.publicCall(site,'bookings/'+created.id,'GET',undefined,created.manageToken)).data;
 const cancelled=await f.publicCall(site,'bookings/'+created.id+'/cancel','POST',{revision:current.revision},created.manageToken);assert.equal(cancelled.status,200);assert.equal(cancelled.data.status,'cancelled');
 assert.equal((await f.publicCall(site,'catalog')).data.enabled,false);
});

test('R06: closing intake during body reads also prevents new availability, bookings and checkout',async t=>{
 const f=await platformFixture(t),site=await f.site(),b=f.features.booking,created=b.create(site,bookingInput(),'customer',{publicRequest:true});
 for(const tail of ['availability','bookings','bookings/'+created.id+'/checkout']){
  const settings=b.settings(site);settings.values.publicEnabled=true;b.saveSettings(site,settings,'owner');
  const body=gate(),pending=f.publicCall(site,tail,'POST',undefined,created.manageToken,body.read);await body.entered;
  const closed=b.settings(site);closed.values.publicEnabled=false;b.saveSettings(site,closed,'owner');
  body.release({...bookingInput(),date:day(),provider:'stripe'});assert.equal((await pending).status,403,tail);
  assert.equal(f.store.get('SELECT COUNT(*) n FROM reservations').n,1);assert.equal(f.store.get('SELECT COUNT(*) n FROM payment_transactions').n,0);
 }
});

test('R07: request fingerprints reject changed booking inputs and preserve identical replay after edits',t=>{
 const {store,booking}=standalone(t),input=bookingInput(),created=booking.create('site',input,'owner');
 const reordered={...input,customer:{phone:input.customer.phone,email:input.customer.email,name:input.customer.name}};
 assert.equal(booking.create('site',reordered,'owner').id,created.id);
 for(const patch of [{start:day()+'T14:00'},{customer:{...input.customer,name:'Different'}},{notes:'Changed'},{participants:[{name:'Other'}]}])assert.throws(()=>booking.create('site',{...input,...patch},'owner'),{status:409});
 booking.update('site',created.id,{revision:0,notes:'Admin note',status:'cancelled'},'owner');
 const config=booking.settings('site');config.values.services[1].enabled=false;booking.saveSettings('site',config,'owner');
 assert.equal(booking.create('site',input,'owner').id,created.id);assert.equal(store.get('SELECT COUNT(*) n FROM reservations').n,1);
});
test('R07: pre-fingerprint request migration preserves records and refuses unverifiable retries',t=>{
 const store=new Store(':memory:');t.after(()=>store.close());store.db.exec('CREATE TABLE booking_requests(site_id TEXT,request_id TEXT,booking_id TEXT,PRIMARY KEY(site_id,request_id));');
 const booking=new Booking(store);ensureBookingSite(store,{id:'site',name:'Migration'});configure(booking,'site');
 const input=bookingInput(),created=booking.create('site',input,'owner');store.run('UPDATE booking_requests SET fingerprint=NULL');
 const reopened=new Booking(store);assert.equal(reopened.row('site',created.id).id,created.id);
 assert.throws(()=>reopened.create('site',input,'owner'),{status:409});assert.equal(store.get('SELECT COUNT(*) n FROM reservations').n,1);
 assert.equal(reopened.update('site',created.id,{revision:0,status:'cancelled'},'owner').status,'cancelled');
});

test('R08: media resolves from root and nested pages in static and SDK preview/export under a subpath',()=>{
 const registry=createRegistry(),imagePath='media/'+ 'a'.repeat(64)+'.png',png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWHkAAAAASUVORK5CYII=','base64');
 for(const pagePath of ['index.html','nested/index.html','a/b/index.html'])for(const kind of ['static','react-sdk']){
  let source;if(kind==='static')source=inspectFiles({[pagePath]:Buffer.from(html),[imagePath]:png}).source;
  else{source=fixture('react-sdk');const doc=JSON.parse(source.files[source.manifest.contentPath]);doc.pages[0].path=pagePath;source.files[source.manifest.contentPath]=JSON.stringify(doc);source.assets=inspectFiles({'index.html':Buffer.from(html),[imagePath]:png}).source.assets;}
  const found=discover(source,registry),after=structuredClone(found.document),section=newSection('image','regression-image');section.fields.find(f=>f.id==='image').value=imagePath;section.fields.find(f=>f.id==='alt').value='Review image';after.pages[0].sections.push(section);
  const adapter=registry.get(kind),written=adapter.write(found.document,after,found.source),preview=adapter.preview(after,written,after.pages[0].id);
  assert.match(preview,/<img src="data:image\/png;base64,/);
  const output=kind==='static'?pagePath:'studio-preview/'+pagePath,exported=adapter.export(after,written),src=exported[output].match(/<img src="([^"]+)" alt="Review image"/)[1];
  assert.equal(new URL(src,'https://example.test/mounted/'+output).pathname,'/mounted/'+imagePath,kind+' '+pagePath);
  const roundtrip=discover(written,registry);assert.deepEqual(roundtrip.document,after);
 }
});
test('R09: shared field validation preserves zero limits and tests both sides of each boundary',()=>{
 const fields={items:field('Empty list','items',{maxItems:0,fields:{}}),text:field('Empty text','text',{maxLength:0}),number:field('Zero','number',{min:0,max:0})};
 assert.deepEqual(validateFields(fields,{items:[],text:'',number:0}).errors,[]);
 for(const input of [{items:[{}]},{text:'x'},{number:1},{number:-1}]){assert.ok(validateFields(fields,input).errors.length);assert.throws(()=>parseFields(fields,input),{status:422});}
 const range={text:field('Text','text',{minLength:2,maxLength:3}),items:field('List','items',{minItems:1,maxItems:2,fields:{}})};
 for(const input of [{text:'ab',items:[{}]},{text:'abc',items:[{},{}]}])assert.deepEqual(validateFields(range,input).errors,[]);
 for(const input of [{text:'a'},{text:'abcd'},{items:[]},{items:[{},{},{}]}])assert.ok(validateFields(range,input).errors.length);
});
