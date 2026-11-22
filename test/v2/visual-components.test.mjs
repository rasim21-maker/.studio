import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {parse} from 'parse5';
import {fixture} from '../../src/v2/fixtures.ts';
import {inspectFiles} from '../../src/v2/import.ts';
import {createRegistry} from '../../src/v2/adapters.ts';
import {findNodes,attr} from '../../src/v2/render.ts';
import {selectionPreview} from '../../src/v2/selection-preview.ts';
import {selectionKey} from '../../shared/v2/selection-protocol.ts';
import {componentProps,validateComponentBindings} from '../../packages/sdk/components.mjs';

test('visual picker strips imported execution and forged markers; only nonce-bound controller remains',()=>{
 const adapter=createRegistry().get('static'),input=inspectFiles({'index.html':Buffer.from('<html><head><meta http-equiv="Content-Security-Policy" content="script-src *"></head><body><main><section><span data-studio-pick="forged">Pick me</span><script>window.pwned=true</script><iframe src="https://evil.test"></iframe><span onclick="steal()">Blocked</span></section></main></body></html>')}).source;
 const {document,source}=adapter.discover(input),before=JSON.stringify(source),preview=selectionPreview(document,source,'index.html'),tree=parse(preview.html);
 assert.equal(preview.keys.length,1);assert.ok(!preview.html.includes('pwned'));assert.ok(!preview.html.includes('onclick'));assert.ok(!preview.html.includes('forged'));assert.equal(findNodes(tree,n=>n.tagName==='iframe').length,0);
 const scripts=findNodes(tree,n=>n.tagName==='script');assert.equal(scripts.length,1);assert.ok(attr(scripts[0],'nonce'));assert.ok(preview.html.includes("script-src 'nonce-"+attr(scripts[0],'nonce')));assert.ok(preview.html.includes("connect-src 'none'"));
 assert.equal(JSON.stringify(source),before);assert.notEqual(selectionPreview(document,source,'index.html').channel,preview.channel);
 assert.throws(()=>selectionPreview(document,source,'../package.json'),e=>e.status===404);
 const frame={},data={type:'studio.pick',version:1,channel:preview.channel,key:preview.keys[0]},event={source:frame,origin:'null',data};assert.equal(selectionKey(event,frame,preview.channel,preview.keys),preview.keys[0]);
 for(const bad of [{...event,source:{}},{...event,origin:'https://evil.test'},{...event,data:{...data,channel:'old'}},{...event,data:{...data,key:'forged'}},{...event,data:{...data,extra:true}},{...event,data:null}])assert.equal(selectionKey(bad,frame,preview.channel,preview.keys),null);
});

test('declared React component props reflect persisted SDK edits without rewriting component source',async()=>{
 const source=fixture('react-sdk'),doc=JSON.parse(source.files['studio/content.json']),section=doc.pages[0].sections[0],component='import React from "react"; export default function Hero({title}) { return <article><h1>{title}</h1></article>; }';
 const bindings={version:1,components:[{id:'heroComponent',page:doc.pages[0].id,section:section.id,sourceFile:'src/Hero.tsx',exportName:'default',props:{title:'heading'}}]};
 source.files['src/Hero.tsx']=component;source.files['studio/components.json']=JSON.stringify(bindings);
 const adapter=createRegistry().get('react-sdk'),discovered=adapter.discover(source),after=structuredClone(discovered.document);after.pages[0].sections[0].fields.find(f=>f.id==='heading').value='Bound heading';
 const saved=adapter.write(discovered.document,after,discovered.source),exported=adapter.export(after,saved);assert.equal(exported['src/Hero.tsx'],component);
 const props=componentProps(JSON.parse(exported['studio/content.json']),bindings,'heroComponent');assert.equal(props.title,'Bound heading');
 // Compile only this trusted test fixture, never an imported customer project.
 const root=path.resolve(import.meta.dirname,'../..'),folder=await fs.mkdtemp(path.join(root,'test-results','react-component-'));
 const output=await build({stdin:{contents:component,loader:'tsx',resolveDir:root},bundle:true,write:false,format:'esm',platform:'node',external:['react']});const filename=path.join(folder,'hero.mjs');await fs.writeFile(filename,output.outputFiles[0].text);
 const Hero=(await import(pathToFileURL(filename).href)).default;assert.equal(renderToStaticMarkup(React.createElement(Hero,props)),'<article><h1>Bound heading</h1></article>');
 assert.deepEqual(adapter.discover(saved).document,after);
 for(const name of ['id','exportName'])for(const value of [undefined,null,123]){const invalid=structuredClone(bindings);invalid.components[0][name]=value;assert.throws(()=>validateComponentBindings(after,invalid),e=>e.status===422);}
 const malformed=structuredClone(after);malformed.pages[0].sections[0].fields.find(f=>f.id==='heading').value={html:'unsafe'};assert.throws(()=>componentProps(malformed,bindings,'heroComponent'),e=>e.status===422);
 const bad=structuredClone(bindings);bad.components[0].props={dangerouslySetInnerHTML:'heading'};assert.throws(()=>validateComponentBindings(after,bad),e=>e.status===422);
 bad.components[0].props={title:'missing'};assert.throws(()=>validateComponentBindings(after,bad),e=>e.status===422);
 bad.components[0].props={title:'heading'};bad.components[0].sourceFile='../outside.tsx';assert.throws(()=>validateComponentBindings(after,bad),e=>e.status===422);
 const missing=structuredClone(source);delete missing.files['src/Hero.tsx'];assert.throws(()=>adapter.discover(missing),e=>e.status===422);
 const removed=structuredClone(after);removed.pages[0].sections=[];assert.throws(()=>adapter.write(after,removed,saved),e=>e.status===422);
});
