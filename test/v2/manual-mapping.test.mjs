import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inspectFiles} from '../../src/v2/import.ts';
import {createRegistry} from '../../src/v2/adapters.ts';
import {manualCandidates,applyManualFields} from '../../src/v2/manual-mapping.ts';
import {inspectFramework} from '../../src/v2/framework-discovery.ts';
import {selectFields} from '../../src/v2/field-mapping.ts';
import {assertSnapshot} from '../../src/v2/snapshots.ts';
const adapter=createRegistry().get('static');
const source=html=>inspectFiles({'index.html':Buffer.from('<html><head><title>Manual</title></head><body><main><section>'+html+'</section></main></body></html>')}).source;
test('manual leaf DOM mapping is explicit, disjoint, permanent and source-version bound',()=>{
 const result=adapter.discover(source('<h1>Heading <span>Bound</span></h1><ul><li>First</li><li><span class="label">Second &amp; third</span></li></ul><span onclick="bad()">Unsafe</span><span>{{dynamic}}</span>'));
 const candidates=manualCandidates(result.document,result.source);assert.equal(candidates.length,2);assert.match(candidates[1].path,/li:nth-of-type\(2\).*span/);
 assert.equal(result.document.pages[0].sections[0].fields.length,1);
 const mapped=applyManualFields(result.document,result.source,[candidates[1].key]);assertSnapshot(adapter,mapped.document,mapped.source);
 const next=structuredClone(mapped.document);next.pages[0].sections[0].fields.at(-1).value='Changed & safe';
 const written=adapter.write(mapped.document,next,mapped.source);assert.match(written.files['index.html'],/Changed &amp; safe/);assert.match(written.files['index.html'],/<li>First<\/li>/);assert.match(written.files['index.html'],/class="label"/);
 const restored=adapter.discover(inspectFiles(Object.fromEntries(Object.entries(adapter.export(next,written)).map(([p,v])=>[p,Buffer.from(v)]))).source);assert.deepEqual(restored.document,next);
 const stale=structuredClone(result.source);stale.files['index.html']+='<!-- changed -->';assert.throws(()=>applyManualFields(result.document,stale,[candidates[0].key]),e=>e.status===422);
 for(const keys of [['forged'],[candidates[0].key,candidates[0].key],null])assert.throws(()=>applyManualFields(result.document,result.source,keys),e=>e.status===422);
 const deselected=selectFields(result.document,result.source,[]);assert.deepEqual(manualCandidates(deselected.document,deselected.source).map(c=>c.key),candidates.map(c=>c.key));
});
test('manual mapping respects explicit authority, framework boundaries and field caps',()=>{
 const result=adapter.discover(source('<span>Manual</span>'+Array.from({length:40},(_,i)=>'<p>Text '+i+'</p>').join(''))),candidate=manualCandidates(result.document,result.source)[0];
 assert.throws(()=>applyManualFields(result.document,result.source,[candidate.key]),e=>e.status===422);
 const scoped=structuredClone(result.source);scoped.manifest.editableFields=[];assert.deepEqual(manualCandidates(result.document,scoped),[]);
 const react=structuredClone(result.source);react.files['package.json']=JSON.stringify({dependencies:{react:'*'}});assert.deepEqual(manualCandidates(result.document,react),[]);
 assert.deepEqual(applyManualFields(result.document,react,[]).source,react);
 const many=adapter.discover(source(Array.from({length:205},(_,i)=>'<span>'+i+'</span>').join('')));assert.equal(manualCandidates(many.document,many.source).length,200);
});
test('framework discovery is evidence-only and preserves adapter authority',()=>{
 const input=source('<p>Static</p>');input.files['package.json']=JSON.stringify({scripts:{postinstall:'must never execute'},dependencies:{react:'*',next:'*',vue:'*',nuxt:'*',svelte:'*','@sveltejs/kit':'*',astro:'*','@angular/core':'*'}});
 const before=structuredClone(input),report=inspectFramework(input);assert.equal(report.names.length,8);assert.equal(report.codeExecuted,false);assert.equal(report.status,'integration-required');assert.equal(report.adapter,'static');assert.equal(JSON.stringify(input),JSON.stringify(before));
 const html=source('<div id="__NEXT_DATA__">snapshot</div>');assert.ok(inspectFramework(html).names.includes('Next.js'));
 input.manifest.adapter.id='react-sdk';assert.equal(inspectFramework(input).status,'sdk');
 const unknown=source('<p>Unknown</p>');unknown.files['package.json']='invalid';assert.equal(inspectFramework(unknown).status,'static-or-unknown');
});
