import {test} from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import net from 'node:net';
import {randomUUID} from 'node:crypto';
import {zipSync,strToU8} from 'fflate';
import {createApp} from '../../src/server.mjs';
import {inspectFiles,digest} from '../../src/v2/import.ts';
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
 assert.equal(candidates.filter(c=>!c.attribute).length,2);assert.equal(candidates.filter(c=>c.attribute==='href').length,1);assert.ok(result.warnings.length>=5);
 assert.ok(result.source.files['index.html'].includes('onclick="alert(1)"'));assert.ok(result.source.files['index.html'].includes('{{customer}}'));
 const stale=structuredClone(result.source);stale.files['index.html']+='<!--external-->';
 assert.throws(()=>adapter.discover(stale),e=>e.status===409);
});

test('attribute mappings preserve markup and coalesce image src/alt patches through export and selection',()=>{
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWHkAAAAASUVORK5CYII=','base64');
 const html='<html><head><title>Attributes</title></head><body><main><section><a href="/old" hreflang="tr" title="Keep href=old"><strong>Buy</strong></a><img src="../assets/photo.png" alt="Old" title="Keep src=old" width="20"></section></main></body></html>';
 const result=adapter.discover(inspectFiles({'pages/index.html':Buffer.from(html),'assets/photo.png':png}).source);
 const candidates=fieldCandidates(result.document,result.source);assert.deepEqual(candidates.map(c=>c.attribute),['href','alt','src']);
 assert.match(result.source.files['pages/index.html'],/src="\.\.\/assets\/photo.png"/);
 const after=structuredClone(result.document),fields=after.pages[0].sections[0].fields;
 fields.find(f=>f.type==='url').value='https://example.test/new?q=1&b=2';fields.find(f=>f.type==='text').value='New "description"';
 // A different verified asset key forces a source update; source-file bytes remain controlled fixtures.
 const source=structuredClone(result.source),image=fields.find(f=>f.type==='image'),oldKey=image.value;
 const newKey='media/'+'a'.repeat(64)+'.png';source.assets[newKey]=source.assets[oldKey];image.value=newKey;
 const saved=adapter.write(result.document,after,source),output=saved.files['pages/index.html'];
 assert.match(output,/href="https:\/\/example.test\/new\?q=1&amp;b=2"/);assert.ok(output.includes('<strong>Buy</strong>'));
 assert.ok(output.includes('hreflang="tr"'));assert.ok(output.includes('title="Keep href=old"'));assert.ok(output.includes('title="Keep src=old"'));
 assert.ok(output.includes('alt="New &quot;description&quot;"'));assert.ok(output.includes('src="../'+newKey+'"'));assert.ok(output.includes('width="20"'));
 assertSnapshot(adapter,after,saved);
 const exported={...adapter.export(after,saved),...Object.fromEntries(Object.entries(saved.assets).map(([p,a])=>[p,Buffer.from(a.base64,'base64')]))};
 const restored=adapter.discover(inspectFiles(Object.fromEntries(Object.entries(exported).map(([p,b])=>[p,Buffer.from(b)]))).source);assert.deepEqual(restored.document,after);
 const onlyAlt=selectFields(after,saved,[candidates.find(c=>c.attribute==='alt').key]);assertSnapshot(adapter,onlyAlt.document,onlyAlt.source);
 assert.equal(onlyAlt.source.files['pages/index.html'],output);
 for(const bad of ['javascript:alert(1)','data:text/html,bad','//evil.test']){const doc=structuredClone(after);doc.pages[0].sections[0].fields.find(f=>f.type==='url').value=bad;assert.throws(()=>adapter.write(after,doc,saved),e=>e.status===422);}
 const badImage=structuredClone(after);badImage.pages[0].sections[0].fields.find(f=>f.type==='image').value='https://external.test/a.png';assert.throws(()=>adapter.write(after,badImage,saved),e=>e.status===422);
 const forged=structuredClone(saved);forged.files['pages/index.html']=output.replace('data-studio-href','data-studio-alt');
 const state=JSON.parse(forged.files['studio/source-state.json']);
 // Hash is a consistency check, never permission to bind arbitrary attributes.
 state.hashes['pages/index.html']=digest(forged.files['pages/index.html']);forged.files['studio/source-state.json']=JSON.stringify(state);
 assert.throws(()=>adapter.discover(forged),e=>e.status===422);
});

test('dynamic and responsive image sources stay unbound; safe alt remains editable',()=>{
 const result=discover('<section><a href="javascript:alert(1)">Unsafe</a><a href="/ok" onclick="go()">Dynamic</a><img src="https://example.test/a.png" alt="External"><picture><source srcset="a.webp"><img src="a.png" alt="Responsive"></picture><img src="a.png" srcset="b.png 2x" alt="Set"><img src="{{image}}" alt="Dynamic"></section>');
 const c=fieldCandidates(result.document,result.source);assert.equal(c.length,3);assert.ok(c.every(f=>f.attribute==='alt'));assert.ok(result.warnings.length);
 const bounded=discover('<section>'+Array.from({length:40},(_,i)=>'<p>Text '+i+'</p>').join('')+'<a href="/keep">Keep</a></section>');
 assert.equal(fieldCandidates(bounded.document,bounded.source).length,40);assert.ok(bounded.warnings.some(w=>w.includes('40 alan')));assert.ok(bounded.source.files['index.html'].includes('href="/keep"'));
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
