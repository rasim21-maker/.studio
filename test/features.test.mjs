import {test,describe,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import {randomUUID,createHmac} from 'node:crypto';
import {createApp} from '../src/server.mjs';
import {richHtml,validRich} from '../public/rich-core.js';
import {localEpoch,localParts} from '../src/booking.mjs';
import {layoutDefaults,themes,templates,validateDesign} from '../src/design.mjs';
const root=path.resolve(import.meta.dirname,'..'),dataDir=path.join(root,'test-results','features-'+Date.now()),password='Fixture-only-password-2026!';
const future=n=>new Date(Date.now()+(n+3)*86400000).toISOString().slice(0,10);
const customer={name:'Test Customer',email:'test@example.invalid',phone:'+905550000000'};
const payload=(day=0,patch={})=>({requestId:randomUUID(),serviceId:'pet-grooming',start:future(day)+'T10:00',quantity:1,customer,pets:[{name:'Test Pet',species:'dog',notes:''}],notes:'Test only',consent:true,status:'confirmed',...patch});
const response=x=>new Response(JSON.stringify(x),{status:200,headers:{'Content-Type':'application/json'}});
function client(origin){const state={cookie:'',csrf:''};return{state,async call(tail,method='GET',input,headers={}){const r=await fetch(origin+tail,{method,headers:{Origin:origin,Cookie:state.cookie,'X-CSRF-Token':state.csrf,'Content-Type':'application/json',...headers},...(input?{body:JSON.stringify(input)}:{})});if(r.headers.get('set-cookie'))state.cookie=r.headers.get('set-cookie').split(';')[0];const raw=await r.text();let data;try{data=JSON.parse(raw);}catch{data=raw;}if(data.csrf)state.csrf=data.csrf;return{status:r.status,data,headers:r.headers};}};}
describe('Studio expanded features',{concurrency:false},()=>{
 let app,origin,admin,editor,anonymous,mock=async()=>{throw Error('No network allowed in tests');},settings;
 const api=(tail,method,input)=>admin.call('/api/sites/loft/'+tail,method,input);
 before(async()=>{const s=net.createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const port=s.address().port;await new Promise(r=>s.close(r));origin=`http://127.0.0.1:${port}`;app=await createApp({projectRoot:root,dataDir,origin,security:{integrationFetcher:(...args)=>mock(...args)}});await new Promise(r=>app.server.listen(port,'127.0.0.1',r));admin=client(origin);editor=client(origin);anonymous=client(origin);assert.equal((await admin.call('/api/setup','POST',{token:app.setupToken,email:'admin@fixture.invalid',password})).status,201);await api('members','POST',{email:'editor@fixture.invalid',password,role:'editor'});await editor.call('/api/login','POST',{email:'editor@fixture.invalid',password});settings=app.features.booking.settings('loft');for(const s of settings.values.services){s.enabled=true;s.priceMinor=10000;s.minNoticeHours=0;s.weekdays=[0,1,2,3,4,5,6];s.bufferMinutes=0;}settings.values.services[0].capacity=2;settings.values.services[1].capacity=1;settings.values.publicEnabled=true;settings.values.allowedOrigins=['https://loftpethouse.com'];settings=app.features.booking.saveSettings('loft',settings,'test');});
 after(async()=>{await app?.close();});
 test('Rich HTML rejects executable markup, event attributes, CSS injection and protocol tricks',()=>{
  assert.equal(richHtml('<strong>Hello</strong> <span class="rt-align-justify">World</span>'),'<strong>Hello</strong> <span class="rt-align-justify">World</span>');
  for(const text of ['<script>alert(1)</script>','<img src="x" onerror="alert(1)">','<span onclick="alert(1)">x</span>','<a href="javascript:alert(1)">x</a>','<a href="https://ok.com\\@evil.com">x</a>','<span style="background:url(x)">x</span>','<svg><a>x</a></svg>','<strong><em>x</strong></em>','<a href="&#106;avascript:x">x</a>','<span class="rt-align-justify" class="x">x</span>'])assert.equal(validRich(text),false,text);
  assert.match(richHtml('<a href="https://example.com/">Go</a>'),/noopener/);assert.equal(validRich('Plain < 5'),true);
 });
 test('Design ranges and 12 themes / 7 templates validate',()=>{assert.equal(Object.keys(themes).length,12);assert.equal(Object.keys(templates).length,7);assert.equal(validateDesign(layoutDefaults),true);for(const patch of[{gap:-1},{columns:50},{maxWidth:100},{autoAlign:'yes'},{paddingTop:'1;position:fixed'}])assert.equal(validateDesign({...layoutDefaults,...patch}),false);});
 test('Rich draft and justified section render actual HTML, with responsive grid and gadgets in export',async()=>{
  const doc=(await api('documents/tr')).data;doc.values['seo:body.home']='<span class="rt-align-justify"><strong>Rich body fixture</strong> with emphasis.</span>';assert.equal((await api('documents/tr','PUT',{revision:doc.revision,values:doc.values,note:'Rich content test'})).status,200);
  const layout=(await api('structure')).data;layout.values.pages[0].layout={...layoutDefaults,mode:'grid',columns:2};layout.values.pages[0].sections[0].layout={align:'right',padding:16,span:2};layout.values.pages[0].sections[0].content.tr={heading:'<em>Rich heading</em>'};layout.values.pages[0].sections.push({id:'fixture-weather',kind:'gadget',gadget:'weather',label:'Weather',enabled:true,content:{tr:{heading:'Hava durumu'}}});layout.values.theme.preset='ocean';assert.equal((await api('structure','PUT',{revision:layout.revision,values:layout.values,note:'Layout and gadget fixture'})).status,200);
  const build=(await api('builds','POST',{kind:'preview'})).data.build;assert.equal(build.status,'ready');const html=await fs.readFile(path.join(dataDir,'builds',build.id,'workspace/dist/index.html'),'utf8');assert.match(html,/<em>Rich heading<\/em>/);assert.match(html,/<strong>Rich body fixture<\/strong>/);assert.match(html,/data-gadget="weather"/);assert.doesNotMatch(html,/STUDIORICH/);const css=await fs.readFile(path.join(dataDir,'builds',build.id,'workspace/dist/studio-layout.css'),'utf8');assert.match(css,/@media\(max-width:900px\)/);assert.match(css,/repeat\(2,minmax\(0,1fr\)\)/);assert.match(css,/#123e52/);
 });
 test('Booking, integration, calendar and payment admin endpoints enforce site role and CSRF',async()=>{for(const tail of ['bookings','booking-settings','calendar','calendar.ics','integrations','payments']){assert.equal((await editor.call('/api/sites/loft/'+tail)).status,403);assert.equal((await anonymous.call('/api/sites/loft/'+tail)).status,401);}assert.equal((await admin.call('/api/sites/loft/bookings','POST',payload(),{'X-CSRF-Token':''})).status,403);});
 test('Appointment pricing, duplicate request handling, stale revisions and overlapping capacity',async()=>{
  const p=payload(),a=await api('bookings','POST',p);assert.equal(a.status,201,JSON.stringify(a.data));assert.equal(a.data.price_minor,10000);assert.equal((await api('bookings','POST',p)).data.id,a.data.id);
  assert.equal((await api('bookings','POST',payload())).status,409);assert.equal((await api('bookings','PUT',payload())).status,404);
  assert.equal((await api('bookings/'+a.data.id,'PUT',{revision:99,status:'cancelled'})).status,409);
  assert.equal((await api('bookings/'+a.data.id,'PUT',{revision:a.data.revision,status:'completed'})).status,200);
 });
 test('Concurrent booking requests cannot overbook and adjacent appointments remain available',async()=>{
  const results=await Promise.all([api('bookings','POST',payload(1)),api('bookings','POST',payload(1))]);assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);assert.equal((await api('bookings','POST',payload(1,{start:future(1)+'T11:00'}))).status,201);
 });
 test('Overnight charges use local nights and share capacity over every overlap',async()=>{
  const p=payload(2,{serviceId:'pet-hotel',startDate:future(2),endDate:future(5),quantity:2,pets:[{name:'A',species:'cat'},{name:'B',species:'cat'}]});const a=await api('bookings','POST',p);assert.equal(a.status,201,JSON.stringify(a.data));assert.equal(a.data.price_minor,60000);assert.equal((await api('bookings','POST',payload(3,{serviceId:'pet-hotel',startDate:future(3),endDate:future(4)}))).status,409);
  assert.equal((await api('availability','POST',{serviceId:'pet-hotel',startDate:future(5),endDate:future(6),quantity:1})).data.available,true);
 });
 test('Shared resources, scheduling boundaries, expired holds and capacity release',async()=>{
  const p=payload(7,{status:'pending'}),a=(await api('bookings','POST',p)).data;assert.equal(a.status,'pending');app.store.run('UPDATE reservations SET hold_until=? WHERE id=?',Date.now()-1000,a.id);assert.equal((await api('bookings','POST',payload(7))).status,201);assert.equal(app.features.booking.row('loft',a.id).status,'cancelled');
  for(const start of [future(8)+'T07:00',future(8)+'T10:13',future(8)+'T19:00','2020-01-01T10:00'])assert.equal((await api('bookings','POST',payload(8,{start}))).status,422);
 });
 test('Public booking requires consent and pet count, returns no staff notes, and management needs its own token',async()=>{
  assert.equal((await anonymous.call('/public/loft/bookings','POST',payload(9,{consent:false}))).status,422);
  assert.equal((await anonymous.call('/public/loft/bookings','POST',payload(9,{quantity:2}))).status,422);
  const p=payload(9),a=await anonymous.call('/public/loft/bookings','POST',p);assert.equal(a.status,201,JSON.stringify(a.data));assert.ok(a.data.manageToken);assert.equal(a.data.customer,undefined);const id=a.data.id,headers={'X-Booking-Token':a.data.manageToken};assert.equal((await anonymous.call('/public/loft/bookings/'+id)).status,404);
  const r=await anonymous.call('/public/loft/bookings/'+id,'GET',undefined,headers);assert.equal(r.status,200);assert.equal(r.data.notes,undefined);assert.equal((await anonymous.call('/public/loft/bookings/'+id+'/cancel','POST',{revision:r.data.revision},headers)).status,200);
 });
 test('Public origins allow only configured websites and never bypass admin authentication',async()=>{assert.equal((await anonymous.call('/public/loft/catalog','GET',undefined,{Origin:'https://attacker.invalid'})).status,403);const allowed=await anonymous.call('/public/loft/catalog','GET',undefined,{Origin:'https://loftpethouse.com'});assert.equal(allowed.status,200);assert.equal(allowed.headers.get('access-control-allow-origin'),'https://loftpethouse.com');assert.equal((await anonymous.call('/api/sites/loft/bookings','GET',undefined,{Origin:'https://loftpethouse.com'})).status,401);});
 test('Calendar blocks stop bookings, cannot cover an existing booking, repeat, edit and delete with revision',async()=>{
  const p={title:'Closed fixture',start:future(12)+'T09:00',end:future(12)+'T18:00',resource:'grooming',blocks:true,notes:'Test',repeat:'weekly',count:3};const a=await api('calendar','POST',p);assert.equal(a.status,201,JSON.stringify(a.data));assert.equal(a.data.ids.length,3);assert.equal((await api('bookings','POST',payload(12))).status,409);assert.equal((await api('calendar','POST',{...p,start:future(1)+'T09:00',end:future(1)+'T18:00',count:1,repeat:'none'})).status,409);const id=a.data.ids[0];assert.equal((await api('calendar/'+id,'PUT',{...p,count:1,repeat:'none',revision:9})).status,409);assert.equal((await api('calendar/'+id,'DELETE',{revision:0})).status,200);assert.equal((await api('bookings','POST',payload(12))).status,201);const ics=await api('calendar.ics');assert.match(ics.data,/BEGIN:VCALENDAR/);assert.match(ics.data,/BEGIN:VEVENT/);
 });
 test('Time zone conversion handles Istanbul and spring DST nonexistent local time',()=>{assert.equal(new Date(localEpoch('2026-11-05T10:00','Europe/Istanbul')).toISOString(),'2026-11-05T07:00:00.000Z');assert.throws(()=>localEpoch('2027-03-28T02:30','Europe/Berlin'));assert.equal(localParts(localEpoch('2027-03-29T09:00','Europe/Berlin'),'Europe/Berlin').time,'09:00');});
 test('Malformed calendar dates return validation errors, not server errors',async()=>{for(const start of ['2027-99-99T10:00','2027-02-30T10:00'])assert.equal((await api('bookings','POST',payload(15,{start}))).status,422);});
 test('Settings cannot orphan reservations or reduce shared capacity below bookings',async()=>{
  const current=(await api('booking-settings')).data;
  for(const change of [
   v=>v.services.splice(v.services.findIndex(s=>s.id==='pet-hotel'),1),
   v=>v.services.find(s=>s.id==='pet-hotel').capacity=1,
   v=>v.services.find(s=>s.id==='pet-hotel').resource='another-hotel'
  ]){const copy=structuredClone(current);change(copy.values);assert.equal((await api('booking-settings','PUT',copy)).status,409);}
  assert.equal((await api('booking-settings')).data.revision,current.revision);
 });
 test('Provider keys are encrypted, redacted, revision-controlled, and excluded from public catalog',async()=>{const a=await api('integrations/stripe','PUT',{revision:0,enabled:true,mode:'sandbox',options:{symbol:'IBM',query:'pets',language:'en',latitude:41,longitude:29},secrets:{secretKey:'sk_test_private_fixture',webhookSecret:'whsec_test_fixture'}});assert.equal(a.status,200,JSON.stringify(a.data));assert.equal(a.data.configured.secretKey,true);assert.doesNotMatch(JSON.stringify(a.data),/sk_test_private_fixture/);assert.doesNotMatch(app.store.get('SELECT secrets FROM integrations WHERE provider=?','stripe').secrets,/sk_test_private_fixture/);assert.equal((await api('integrations/stripe','PUT',{revision:0})).status,409);assert.doesNotMatch(JSON.stringify((await anonymous.call('/public/loft/catalog')).data),/secretKey|whsec|sk_test/);});
 test('Prepared gadgets handle data, quota errors, missing keys, attribution and timestamps',async()=>{
  assert.equal((await api('integrations/stocks/test','POST',{})).data.status,'not_configured');
  await api('integrations/weather','PUT',{revision:0,enabled:true,mode:'sandbox',options:{latitude:41,longitude:29,symbol:'IBM',query:'pets',language:'en'},secrets:{}});
  mock=async(u,o)=>{assert.equal(new URL(u).hostname,'api.open-meteo.com');assert.equal(o.redirect,'error');return response({current:{temperature_2m:18,wind_speed_10m:4,weather_code:0,time:'2026-11-02T12:00'}});};const r=(await api('integrations/weather/test','POST',{})).data;assert.equal(r.status,'ready');assert.match(r.items[0].value,/18/);assert.ok(r.attribution.url);assert.ok(r.fetchedAt);
  mock=async()=>{throw Error('Offline');};assert.equal((await api('integrations/weather/test','POST',{})).data.status,'stale');
 });
 test('Stripe hosted checkout is idempotent and verifies amount/currency/reference before confirming payment',async()=>{
  const r=(await api('bookings','POST',payload(18,{status:'pending'}))).data;let tx,creates=0;mock=async(u,o)=>{if(o.method==='POST'){creates++;const v=new URLSearchParams(o.body);assert.equal(v.get('line_items[0][price_data][unit_amount]'),'10000');assert.equal(v.get('client_reference_id'),r.id);tx=o.headers['Idempotency-Key'];return response({id:'cs_fixture',url:'https://checkout.stripe.com/c/pay/fixture'});}return response({id:'cs_fixture',payment_status:'paid',status:'complete',amount_total:9999,currency:'try',client_reference_id:r.id});};
  const p=await api(`bookings/${r.id}/checkout`,'POST',{provider:'stripe'});assert.equal(p.status,200,JSON.stringify(p.data));assert.equal((await api(`bookings/${r.id}/checkout`,'POST',{provider:'stripe'})).data.id,p.data.id);assert.equal(creates,1);assert.equal((await api(`payments/${tx}/verify`,'POST',{})).status,502);assert.equal(app.features.booking.row('loft',r.id).status,'pending');
  assert.equal((await api(`bookings/${r.id}`,'PUT',{revision:r.revision,start:future(18)+'T12:00'})).status,409);
  assert.equal(app.features.booking.row('loft',r.id).start,r.start);
  mock=async()=>response({id:'cs_fixture',payment_status:'paid',status:'complete',amount_total:10000,currency:'try',client_reference_id:r.id});assert.equal((await api(`payments/${tx}/verify`,'POST',{})).data.status,'paid');assert.equal(app.features.booking.row('loft',r.id).status,'confirmed');assert.equal((await api(`payments/${tx}/verify`,'POST',{})).data.status,'paid');
 });
 test('Stripe webhook rejects forged/expired signatures and accepts replay safely',async()=>{const raw=JSON.stringify({id:'evt_fixture',data:{object:{id:'unknown'}}}),t=String(Math.floor(Date.now()/1000)),sig=createHmac('sha256','whsec_test_fixture').update(t+'.'+raw).digest('hex');const send=signature=>fetch(origin+'/payments/loft/stripe/webhook',{method:'POST',headers:{'Content-Type':'application/json','Stripe-Signature':signature},body:raw});assert.equal((await send(`t=${t},v1=bad`)).status,400);assert.equal((await send(`t=${t},v1=${sig}`)).status,200);assert.equal((await send(`t=${t},v1=${sig}`)).status,200);});
 test('PayPal rejects TRY, supports sandbox order/capture, and never trusts browser approval',async()=>{
  await api('integrations/paypal','PUT',{revision:0,enabled:true,mode:'sandbox',secrets:{clientId:'fixture-client',clientSecret:'fixture-secret'}});const r=(await api('bookings','POST',payload(20))).data;assert.equal((await api(`bookings/${r.id}/checkout`,'POST',{provider:'paypal'})).status,422);
  app.store.run('UPDATE reservations SET currency=? WHERE id=?','EUR',r.id);let tx,approved=false;
  mock=async(u,o)=>{u=String(u);if(u.endsWith('/oauth2/token'))return response({access_token:'fixture-token'});if(u.endsWith('/v2/checkout/orders')){tx=o.headers['PayPal-Request-Id'];return response({id:'ORDER-FIXTURE',links:[{rel:'payer-action',href:'https://www.sandbox.paypal.com/checkoutnow?token=ORDER-FIXTURE'}]});}if(u.endsWith('/capture')){assert.equal(o.headers['PayPal-Request-Id'],tx+'-capture');approved=true;return response({status:'COMPLETED',purchase_units:[{custom_id:r.id,payments:{captures:[{id:'CAPTURE',status:'COMPLETED',amount:{value:'100.00',currency_code:'EUR'}}]}}]});}return response({status:'APPROVED',purchase_units:[{custom_id:r.id,amount:{value:'100.00',currency_code:'EUR'}}]});};
  assert.equal((await api(`bookings/${r.id}/checkout`,'POST',{provider:'paypal'})).status,200);assert.equal((await api(`payments/${tx}/verify`,'POST',{})).data.status,'paid');assert.equal(approved,true);
 });
 test('iyzico signs the exact payload and confirms only a signed successful payment',async()=>{
  await api('integrations/iyzico','PUT',{revision:0,enabled:true,mode:'sandbox',secrets:{apiKey:'fixture-api',secretKey:'fixture-secret'}});const r=(await api('bookings','POST',payload(21))).data;let tx;
  mock=async(u,o)=>{const pathname=new URL(u).pathname,p=JSON.parse(o.body),auth=Buffer.from(o.headers.Authorization.slice(8),'base64').toString(),expected=createHmac('sha256','fixture-secret').update(o.headers['x-iyzi-rnd']+pathname+o.body).digest('hex');assert.ok(auth.includes(expected));tx=p.conversationId;
   if(pathname.includes('initialize'))return response({status:'success',token:'token-fixture',paymentPageUrl:'https://sandbox-cpp.iyzipay.com/?token=token-fixture',signature:createHmac('sha256','fixture-secret').update(tx+':token-fixture').digest('hex')});
   const data={status:'success',paymentStatus:'SUCCESS',paymentId:'123',currency:'TRY',basketId:r.id,conversationId:tx,paidPrice:100,price:100,token:'token-fixture',fraudStatus:1};data.signature=createHmac('sha256','fixture-secret').update(['SUCCESS','123','TRY',r.id,tx,100,100,'token-fixture'].join(':')).digest('hex');return response(data);
  };
  const p=await api(`bookings/${r.id}/checkout`,'POST',{provider:'iyzico',billing:{surname:'Fixture',identityNumber:'11111111111',address:'Test address',city:'Istanbul',country:'Turkey'}});assert.equal(p.status,200,JSON.stringify(p.data));assert.equal((await api(`payments/${tx}/verify`,'POST',{})).data.status,'paid');
 });
 test('Late payment after cancellation is held for review, never rebooks capacity',async()=>{
  const r=(await api('bookings','POST',payload(23))).data;let tx;mock=async(u,o)=>o.method==='POST'?(tx=o.headers['Idempotency-Key'],response({id:'cs_late',url:'https://checkout.stripe.com/c/pay/late'})):response({payment_status:'paid',status:'complete',amount_total:10000,currency:'try',client_reference_id:r.id});await api(`bookings/${r.id}/checkout`,'POST',{provider:'stripe'});await api(`bookings/${r.id}`,'PUT',{revision:r.revision,status:'cancelled'});assert.equal((await api(`payments/${tx}/verify`,'POST',{})).data.status,'review');assert.equal(app.features.booking.row('loft',r.id).status,'cancelled');
 });
});
