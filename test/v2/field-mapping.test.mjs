import {test} from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import net from 'node:net';
import {randomUUID} from 'node:crypto';
import {zipSync,strToU8} from 'fflate';
import {createApp} from '../../src/server.mjs';
import {inspectFiles} from '../../src/v2/import.ts';
import {createRegistry} from '../../src/v2/adapters.ts';
import {fieldCandidates,selectFields} from '../../src/v2/field-mapping.ts';
import {assertSnapshot} from '../../src/v2/snapshots.ts';
const adapter=createRegistry().get('static');
const discover=html=>adapter.discover(inspectFiles({'index.html':Buffer.from('<!doctype html><html><head><title>Mapping</title></head><body><main>'+html+'</main></body></html>')}).source);

test('unmarked direct and nested text maps to stable source fields without wrappers',()=>{
 const original='<h1>Title</h1><p>Intro</p><section class="hero"><div><h2>Title</h2><p>Text <strong>bold</strong></p></div></section>';
 const result=discover(original),candidates=fieldCandidates(result.document,result.source);
 assert.equal(candidates.length,4);assert.equal(new Set(candidates.map(c=>c.key)).size,4);
 assert.ok(!result.source.files['index.html'].includes('<div data-studio'));
 assert.deepEqual(fieldCandidates(adapter.discover(result.source).document,result.source),candidates);
 assertSnapshot(adapter,result.document,result.source);
 const next=structuredClone(result.document);next.pages[0].sections[0].fields[0].value='Changed';
 const saved=adapter.write(result.document,next,result.source);
 assert.match(saved.files['index.html'],/>Changed<\/h1>/);assert.match(saved.files['index.html'],/class="hero"/);
 assertSnapshot(adapter,next,saved);
});

test('selection preserves unselected HTML, rejects forged keys and survives export/reimport',()=>{
 const result=discover('<section><h1>Same label</h1><p>Same label</p></section>');
 const candidates=fieldCandidates(result.document,result.source),selected=selectFields(result.document,result.source,[candidates[1].key]);
 assert.equal(selected.source.files['index.html'],result.source.files['index.html']);
 assert.equal(selected.document.pages[0].sections[0].fields.length,1);
 assertSnapshot(adapter,selected.document,selected.source);
 const files=adapter.export(selected.document,selected.source);
 const restored=adapter.discover(inspectFiles(Object.fromEntries(Object.entries(files).map(([p,v])=>[p,Buffer.from(v)]))).source);
 assert.deepEqual(restored.document,selected.document);
 const after=structuredClone(restored.document);after.pages[0].sections[0].fields[0].value='Only paragraph';
 const saved=adapter.write(restored.document,after,restored.source);
 assert.match(saved.files['index.html'],/>Same label<\/h1>/);assert.match(saved.files['index.html'],/>Only paragraph<\/p>/);
 for(const keys of [['forged'],[candidates[0].key,candidates[0].key],{},null])assert.throws(()=>selectFields(result.document,result.source,keys),e=>e.status===422);
 const empty=selectFields(result.document,result.source,[]);assertSnapshot(adapter,empty.document,empty.source);assert.equal(fieldCandidates(empty.document,empty.source).length,0);
});

test('dynamic hidden structured and ambiguous text stays in source, never executable preview data',()=>{
 const html='<section><h1>Safe</h1><p onclick="alert(1)">Event</p><div hidden><p>Hidden</p></div><p>{{customer}}</p><p><a href="/buy">Link</a></p><p><span class="widget">Widget</span></p><form><p>Form text</p></form><p>Plain <em>format</em></p></section>';
 const result=discover(html),candidates=fieldCandidates(result.document,result.source);
 assert.equal(candidates.length,2);assert.ok(result.warnings.length>=5);
 assert.ok(result.source.files['index.html'].includes('onclick="alert(1)"'));assert.ok(result.source.files['index.html'].includes('{{customer}}'));
 const stale=structuredClone(result.source);stale.files['index.html']+='<!--external-->';
 assert.throws(()=>adapter.discover(stale),e=>e.status===409);
});

test('HTTP mapping validates scoped keys and CSRF, commits once and persists selection after restart',async t=>{
 const root=path.resolve(import.meta.dirname,'../..'),dataDir=path.join(root,'test-results','field-mapping-'+randomUUID());
 const probe=net.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));const origin='http://127.0.0.1:'+port;
 let app=await createApp({projectRoot:root,dataDir,origin});
 await new Promise(r=>app.server.listen(port,'127.0.0.1',r));
 let cookie='',csrf='';
 const api=async(url,method='GET',input,headers={})=>{const r=await fetch(origin+url,{method,headers:{Origin:origin,Cookie:cookie,'X-CSRF-Token':csrf,'Content-Type':'application/json',...headers},...(input===undefined?{}:{body:JSON.stringify(input)})});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];const data=await r.json();if(data.csrf)csrf=data.csrf;return{status:r.status,data};};
 t.after(async()=>app?.close());
 assert.equal((await api('/api/setup','POST',{token:app.setupToken,email:'mapping@example.test',password:'Mapping-test-password-2026!'})).status,201);
 const orgId=(await api('/api/v2/workspace')).data.organizations[0].id;
 const base64=Buffer.from(zipSync({'index.html':strToU8('<!doctype html><html><head><title>Map</title></head><body><main><h1>Heading</h1><section><p>Keep this text</p></section></main></body></html>')})).toString('base64');
 const job=(await api('/api/v2/imports','POST',{kind:'zip',base64,orgId,requestId:randomUUID()})).data;
 let review;for(let i=0;i<100;i++){review=(await api('/api/v2/imports/'+job.id)).data;if(!['queued','analyzing'].includes(review.status))break;await new Promise(r=>setTimeout(r,10));}
 assert.equal(review.status,'review',JSON.stringify(review));const keys=review.report.fieldCandidates.map(c=>c.key);assert.equal(keys.length,2);
 const endpoint='/api/v2/imports/'+job.id+'/commit';
 assert.equal((await api(endpoint,'POST',{selectedFields:['foreign-field']})).status,422);
 assert.equal((await api(endpoint,'POST',{selectedFields:[keys[0],keys[0]]})).status,422);
 assert.equal((await api(endpoint,'POST',{selectedFields:[keys[0]]},{'X-CSRF-Token':''})).status,403);
 const committed=await api(endpoint,'POST',{selectedFields:[keys[0]]});assert.equal(committed.status,201,JSON.stringify(committed));
 assert.equal((await api(endpoint,'POST',{selectedFields:[]})).data.siteId,committed.data.siteId);
 const url='/api/v2/sites/'+committed.data.siteId;let site=(await api(url)).data;
 assert.equal(site.document.pages[0].sections.flatMap(s=>s.fields).length,1);
 assert.ok((await api(url+'/source?path=index.html')).data.text.includes('Keep this text'));
 await app.close();app=await createApp({projectRoot:root,dataDir,origin});await new Promise(r=>app.server.listen(port,'127.0.0.1',r));
 site=(await api(url)).data;assert.equal(site.document.pages[0].sections.flatMap(s=>s.fields).length,1);
});
