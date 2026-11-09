import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Store} from '../../src/store.mjs';
import {ModuleHost} from '@loft-studio/module-core';
import {defineModule,field,validateFields} from '@loft-studio/sdk';
import {Booking,createBookingModule,ensureBookingSite} from '@loft-studio/booking';
import crm from '@loft-studio/crm';
import commerce from '@loft-studio/commerce';
import seo from '@loft-studio/seo';
import {createRegistry,discover} from '../../src/v2/adapters.ts';
import {fixture} from '../../src/v2/fixtures.ts';
const owner={user_id:'owner'},outsider={user_id:'outsider'};
function setup(t,extra=[]){
 const store=new Store(':memory:');t.after(()=>store.db.close());
 store.db.exec('CREATE TABLE studio_sites(id TEXT PRIMARY KEY);');store.run('INSERT INTO studio_sites VALUES (?)','one');store.run('INSERT INTO studio_sites VALUES (?)','two');
 const document=discover(fixture('static'),createRegistry()).document;
 const sites={one:{id:'one',name:'One',org_id:'org1',revision:0,document},two:{id:'two',name:'Two',org_id:'org2',revision:0,document:structuredClone(document)}};
 const allowed={owner:['members','operations','content'],viewer:['content']};
 const authorize=(actor,id,permission)=>{if(actor.user_id==='outsider'||!sites[id]||actor.user_id==='viewer'&&id==='two')throw Object.assign(Error('scope'),{status:404});if(permission&&!allowed[actor.user_id]?.includes(permission))throw Object.assign(Error('permission'),{status:403});return {...sites[id],allowed:allowed[actor.user_id]};};
 const booking=new Booking(store),modules=[crm,commerce,seo,createBookingModule({store,booking}),...extra];
 const host=new ModuleHost({store,modules,authorize,services:{'site.document.save':({actor,siteId},input)=>{authorize(actor,siteId,'content');assert.equal(input.revision,sites[siteId].revision);sites[siteId].document=input.document;sites[siteId].revision++;return {revision:sites[siteId].revision};}}});
 const install=(id,site='one')=>host.lifecycle(owner,site,id,'install',-1);
 const put=(id,name,data,other={})=>host.collection(owner,'one',id,name,'PUT',{data,...other});
 return{host,store,booking,sites,allowed,authorize,modules,install,put};
}
test('module SDK: shared validation rejects extra fields, invalid dictionaries, money and nested inputs',()=>{
 const fields={amount:field('amount','number',{min:0,max:1000}),email:field('email','email',{normalize:'lowercase'}),status:field('status','enum',{values:['new','done']}),items:field('items','items',{fields:{quantity:field('quantity','number',{min:1,max:4})}})};
 const good=validateFields(fields,{amount:10,email:' A@EXAMPLE.COM ',status:'new',items:[{quantity:1}]});assert.deepEqual(good.errors,[]);assert.equal(good.value.email,'a@example.com');
 for(const data of [{amount:1.5},{amount:-1},{amount:NaN},{status:'invented'},{extra:true},{items:[{quantity:9}]},{email:'<script>'}])assert.ok(validateFields(fields,data).errors.length);
});
test('module registry rejects duplicate IDs, missing dependencies, cycles and API mismatches',t=>{
 const {store,authorize}=setup(t);
 assert.throws(()=>new ModuleHost({store,authorize,modules:[crm,crm]}),{status:422});
 assert.throws(()=>new ModuleHost({store,authorize,modules:[{...crm,manifest:{...crm.manifest,dependencies:{'absent.module':1}}}]}),{status:422});
 assert.throws(()=>new ModuleHost({store,authorize,modules:[{...crm,manifest:{...crm.manifest,dependencies:{'studio.crm':1}}}]}),{status:422});
 assert.throws(()=>defineModule({...crm,manifest:{...crm.manifest,apiVersion:2}}),{status:422});
 assert.throws(()=>defineModule({...crm,manifest:{...crm.manifest,dependencies:{'acme.base':-1}}}),{status:422});
 const base={...crm,manifest:{...crm.manifest,id:'acme.base',version:'0.1.0'}},addon={...crm,manifest:{...crm.manifest,id:'acme.addon',dependencies:{'acme.base':0}}};
 const host=new ModuleHost({store,authorize,modules:[base,addon]});
 assert.throws(()=>host.lifecycle(owner,'one','acme.addon','install',-1),{status:409});
 host.lifecycle(owner,'one','acme.base','install',-1);host.lifecycle(owner,'one','acme.addon','install',-1);
 assert.throws(()=>host.lifecycle(owner,'one','acme.base','disable',0),{status:409});
 host.lifecycle(owner,'one','acme.addon','disable',0);host.lifecycle(owner,'one','acme.base','disable',0);
});
test('module CRM: scopes, references, unique values, concurrency and server validation',t=>{
 const {host,install,put}=setup(t);install('studio.crm');install('studio.crm','two');
 const company=put('studio.crm','companies',{name:'Acme'}),person=put('studio.crm','contacts',{name:'A',email:' A@EXAMPLE.COM ',companyId:company.id,status:'lead'});
 assert.equal(person.data.email,'a@example.com');
 assert.throws(()=>put('studio.crm','contacts',{name:'B',email:'a@example.com',status:'lead'}),{status:409});
 assert.throws(()=>put('studio.crm','deals',{title:'Bad',contactId:'missing',stage:'new',valueMinor:100,currency:'TRY'}),{status:404});
 assert.throws(()=>host.collection(owner,'two','studio.crm','contacts','GET',{id:person.id}),{status:404});
 assert.throws(()=>host.collection(outsider,'one','studio.crm','contacts','GET'),{status:404});
 assert.throws(()=>host.collection({user_id:'viewer'},'one','studio.crm','contacts','GET'),{status:403});
 assert.throws(()=>host.collection(owner,'one','studio.crm','companies','DELETE',{id:company.id,revision:company.revision}),{status:409});
 const saved=put('studio.crm','contacts',{...person.data,status:'customer'},{id:person.id,revision:person.revision});assert.equal(saved.revision,1);
 assert.throws(()=>put('studio.crm','contacts',person.data,{id:person.id,revision:person.revision}),{status:409});
 assert.throws(()=>put('studio.crm','contacts',{...person.data,name:'<script>'},{id:person.id,revision:saved.revision}),{status:422});
});
test('module lifecycle: disabling and uninstalling retain readable/exportable records, reinstallation preserves IDs',t=>{
 const {host,install,put}=setup(t);install('studio.crm');const row=put('studio.crm','contacts',{name:'Customer',status:'customer'});
 assert.throws(()=>host.lifecycle({user_id:'viewer'},'one','studio.crm','disable',0),{status:403});
 host.lifecycle(owner,'one','studio.crm','disable',0);
 assert.throws(()=>put('studio.crm','contacts',{name:'New',status:'lead'}),{status:409});
 assert.equal(host.export(owner,'one','studio.crm').records[0].id,row.id);
 host.lifecycle(owner,'one','studio.crm','uninstall',1);assert.equal(host.collection(owner,'one','studio.crm','contacts','GET').total,1);
 host.lifecycle(owner,'one','studio.crm','install',2);assert.equal(host.collection(owner,'one','studio.crm','contacts','GET').items[0].id,row.id);
 assert.throws(()=>host.lifecycle(owner,'one','studio.crm','disable',0),{status:409});
});
test('external module migrates atomically and cannot write through a read command',async t=>{
 const custom=defineModule({manifest:{id:'acme.notes',name:'Notes',description:'External',apiVersion:1,version:'1.0.0',schemaVersion:1,permissions:['content']},collections:{notes:{label:'Notes',permission:'content',fields:{title:field('Title','text',{required:true})}}},migrations:[{version:1,up(){}}],commands:{badRead:{label:'Invalid writer',permission:'content',write:false,run:ctx=>ctx.records.put('notes',{data:{title:'hidden write'}})}}});
 const {host,store,authorize,install}=setup(t,[custom]);install('acme.notes');
 const row=host.collection(owner,'one','acme.notes','notes','PUT',{data:{title:'Original'}});
 await assert.rejects(host.execute(owner,'one','acme.notes','badRead',{}),{status:403});
 const upgrade={...custom,manifest:{...custom.manifest,version:'1.1.0',schemaVersion:2},migrations:[...custom.migrations,{version:2,up(ctx){const item=ctx.records.get('notes',row.id);ctx.records.put('notes',{...item,data:{title:'Migrated'}});throw Error('migration failed');}}]};
 const next=new ModuleHost({store,authorize,modules:[upgrade]});assert.throws(()=>next.lifecycle(owner,'one','acme.notes','upgrade',0),/migration failed/);
 assert.equal(host.collection(owner,'one','acme.notes','notes','GET',{id:row.id}).data.title,'Original');assert.equal(next.installation('one','acme.notes').version,'1.0.0');
 upgrade.migrations[1].up=ctx=>{const item=ctx.records.get('notes',row.id);ctx.records.put('notes',{...item,data:{title:'Migrated'}});};
 next.lifecycle(owner,'one','acme.notes','upgrade',0);assert.equal(next.collection(owner,'one','acme.notes','notes','GET',{id:row.id}).data.title,'Migrated');
 assert.throws(()=>host.lifecycle(owner,'one','acme.notes','enable',1),{status:409});
});
test('commerce: orders use catalog prices, consume stock once and roll back mixed/insufficient baskets',async t=>{
 const {host,install,put}=setup(t);install('studio.commerce');
 const p=put('studio.commerce','products',{name:'Product',sku:'SKU-1',priceMinor:1250,currency:'TRY',stock:3,active:true});
 const order={requestId:'order-1',customerName:'Buyer',customerEmail:'buyer@example.com',items:[{productId:p.id,quantity:2}]};
 const created=await host.execute(owner,'one','studio.commerce','createOrder',order);assert.equal(created.data.totalMinor,2500);assert.equal(created.data.paymentStatus,'unpaid');
 assert.equal((await host.execute(owner,'one','studio.commerce','createOrder',order)).id,created.id);
 await assert.rejects(host.execute(owner,'one','studio.commerce','createOrder',{...order,customerName:'Other'}),{status:409});
 await assert.rejects(host.execute(owner,'one','studio.commerce','createOrder',{...order,requestId:'order-2'}),{status:409});
 await assert.rejects(host.execute(owner,'one','studio.commerce','createOrder',{...order,requestId:'evil',totalMinor:1}),{status:422});
 const other=put('studio.commerce','products',{name:'Other',sku:'other',priceMinor:100,currency:'EUR',stock:4,active:true});
 await assert.rejects(host.execute(owner,'one','studio.commerce','createOrder',{...order,requestId:'mixed',items:[{productId:p.id,quantity:1},{productId:other.id,quantity:1}]}),{status:422});
 assert.equal(host.collection(owner,'one','studio.commerce','products','GET',{id:p.id}).data.stock,1);
 assert.throws(()=>host.collection(owner,'one','studio.commerce','products','DELETE',{id:p.id,revision:1}),{status:409});
 assert.throws(()=>put('studio.commerce','orders',created.data),{status:403});
 const cancelled=await host.execute(owner,'one','studio.commerce','transition',{id:created.id,revision:0,status:'cancelled'});assert.equal(cancelled.data.status,'cancelled');
 assert.equal(host.collection(owner,'one','studio.commerce','products','GET',{id:p.id}).data.stock,3);
 await assert.rejects(host.execute(owner,'one','studio.commerce','transition',{id:created.id,revision:1,status:'cancelled'}),{status:409});
});
test('commerce: simultaneous last-stock orders cannot oversell',async t=>{
 const {host,install,put}=setup(t);install('studio.commerce');const p=put('studio.commerce','products',{name:'Last',sku:'last',priceMinor:1,currency:'TRY',stock:1,active:true});
 const results=await Promise.allSettled(['a','b'].map(requestId=>host.execute(owner,'one','studio.commerce','createOrder',{requestId,customerName:'Buyer',customerEmail:'b@example.com',items:[{productId:p.id,quantity:1}]})));
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(host.collection(owner,'one','studio.commerce','products','GET',{id:p.id}).data.stock,0);
});
test('SEO package seeds page mappings, applies through the site service and generates escaped files',async t=>{
 const {host,sites,install,put}=setup(t);install('studio.seo');
 const page=host.collection(owner,'one','studio.seo','pages','GET').items[0];put('studio.seo','pages',{...page.data,title:'Updated title'},{id:page.id,revision:0});
 const reply=await host.execute(owner,'one','studio.seo','applyPage',{recordId:page.id,siteRevision:0});assert.equal(reply.revision,1);assert.equal(sites.one.document.pages.find(p=>p.id===page.data.pageId).title,'Updated title');
 put('studio.seo','settings',{baseUrl:'https://example.com'});
 const files=(await host.execute(owner,'one','studio.seo','sitemap',{})).files;assert.equal(files.length,2);assert.match(files[0].content,/https:\/\/example.com\//);assert.match(files[1].content,/Sitemap:/);
 assert.throws(()=>put('studio.seo','pages',{pageId:'missing',title:'Bad'}),{status:422});
});
test('booking package adopts existing settings without replacing data; disabled engine refuses new work',t=>{
 const {host,booking,store,sites,install}=setup(t);ensureBookingSite(store,sites.one);const initial=booking.settings('one');initial.values.services[0].name='Existing service';booking.saveSettings('one',initial,'owner');
 install('studio.booking');assert.equal(booking.settings('one').values.services[0].name,'Existing service');
 host.lifecycle(owner,'one','studio.booking','disable',0);
 assert.throws(()=>booking.create('one',{},'owner'),{status:409});assert.throws(()=>booking.saveSettings('one',booking.settings('one'),'owner'),{status:409});
 assert.equal(host.export(owner,'one','studio.booking').operational.settings.values.services[0].name,'Existing service');
});
test('booking SDK command preserves client idempotency and operational history across disabling',async t=>{
 const {host,booking,install}=setup(t);install('studio.booking');
 const settings=booking.settings('one');settings.values.timezone='UTC';const service=settings.values.services[1];Object.assign(service,{enabled:true,minNoticeHours:0,weekdays:[0,1,2,3,4,5,6]});booking.saveSettings('one',settings,'owner');
 const input={requestId:randomUUID(),serviceId:service.id,start:new Date(Date.now()+2*86400000).toISOString().slice(0,10)+'T10:00',name:'Customer',email:'test@example.com',phone:'123456789',consent:true,participants:[{name:'Attendee'}]};
 const first=await host.execute(owner,'one','studio.booking','create',input),second=await host.execute(owner,'one','studio.booking','create',input);
 assert.equal(first.id,second.id);assert.equal(booking.list('one').length,1);
 host.lifecycle(owner,'one','studio.booking','disable',0);assert.equal(booking.isEnabled('one'),false);
 assert.equal(host.export(owner,'one','studio.booking').operational.bookings[0].id,first.id);
 assert.equal(booking.update('one',first.id,{revision:first.revision,status:'cancelled'},'owner').status,'cancelled');
});
