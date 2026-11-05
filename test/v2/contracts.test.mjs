import {test} from 'node:test';
import assert from 'node:assert/strict';
import {zipSync,strToU8} from 'fflate';
import {createRegistry,discover} from '../../src/v2/adapters.ts';
import {fixture} from '../../src/v2/fixtures.ts';
import {validateDocument,validRich,safeUrl} from '../../shared/v2/validation.ts';
import {newSection} from '../../shared/v2/model.ts';
import {readZip,inspectFiles,safePath} from '../../src/v2/import.ts';
import {publicAddress} from '../../src/v2/network.ts';
import {AdapterRegistry} from '../../src/v2/adapters.ts';
import {build} from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
import {localEpoch,validateBookingSettings,bookingDefaults} from '../../src/booking.mjs';
const registry=createRegistry();
for(const kind of ['static','react-sdk','wordpress'])test(kind+' adapter: discover, persistent edit/reorder, isolated preview and export',()=>{
 const {document:before,source}=discover(fixture(kind),registry),adapter=registry.get(kind),after=structuredClone(before);
 const field=after.pages[0].sections[0].fields[0];field.value=field.type==='rich'?'<strong>Kalıcı değişiklik</strong>':'Kalıcı değişiklik';
 after.pages[0].sections.reverse();after.pages[0].layout.desktop={display:'grid',columns:2,padding:32,gap:16};after.pages[0].layout.mobile={columns:1,padding:12};
 assert.deepEqual(adapter.validate(before,after,source),[]);const written=adapter.write(before,after,source),files=adapter.export(after,written),preview=adapter.preview(after,written,after.pages[0].id);
 assert.ok(JSON.stringify(files).includes('Kalıcı değişiklik'));assert.ok(preview.includes('Kalıcı değişiklik'));assert.ok(!/<script\b/.test(preview));assert.ok(preview.includes("script-src 'none'"));
 if(kind!=='react-sdk'){assert.ok(files['index.html'].includes('window.examplePreserved = true'));assert.ok(files['index.html'].indexOf(after.pages[0].sections[0].id)<files['index.html'].indexOf(after.pages[0].sections[1].id));}
 else assert.equal(files['src/App.tsx'],source.files['src/App.tsx']);
});
test('HTML editor rejects executable attributes, obfuscated protocols and malformed nesting',()=>{
 for(const html of ['<img src=x onerror=alert(1)>','<p onclick="x">x</p>','<a href="javascript:alert(1)">x</a>','<a href="jav&#97;script:x">x</a>','<p style="background:url(x)">x</p>','<p><strong>x</p></strong>'])assert.equal(validRich(html),false,html);
 assert.equal(validRich('<p style="text-align: justify;"><strong>Güvenli</strong> <em>metin</em></p><ul><li>Bir</li></ul>'),true);
 assert.equal(safeUrl('//evil.test'),false);assert.equal(safeUrl('https://example.com'),true);
});
test('field schemas cannot be relaxed and invalid layout is blocked for AI/manual alike',()=>{
 const {document:before,source}=discover(fixture('static'),registry),adapter=registry.get('static'),after=structuredClone(before);
 after.pages[0].sections[0].fields[0].maxLength=999999;assert.ok(adapter.validate(before,after,source).length);
 assert.ok(adapter.validate(before,null,source).length);
 const valid=structuredClone(before);valid.pages[0].layout.mobile.padding=-1;assert.ok(validateDocument(valid).length);
});
test('dictionary inactive values retain historical records but cannot be assigned anew',()=>{
 const {document:before}=discover(fixture('react-sdk'),registry);before.pages[0].sections.push(newSection('gadget','gadget'));
 const after=structuredClone(before);after.dictionaries[0].entries[0].active=false;after.dictionaries[0].version++;
 assert.deepEqual(validateDocument(after,before),[]);after.pages[0].sections.push(newSection('gadget','another'));assert.ok(validateDocument(after,before).length);
 const removed=structuredClone(before);removed.dictionaries[0].entries.shift();removed.dictionaries[0].version++;assert.ok(validateDocument(removed,before).length);
});
test('safe ZIP import excludes secrets and rejects traversal, case collision, corrupt data and bombs',()=>{
 const entries=readZip(Buffer.from(zipSync({'index.html':strToU8('<html><body>Site</body></html>'),'.env':strToU8('SECRET=value')})));
 const {report,source}=inspectFiles(entries);assert.equal(report.rejected.length,1);assert.equal(source.files['.env'],undefined);
 for(const name of ['../index.html','/index.html','C:/index.html','a\\b.html','a/../../b','CON.txt'])assert.equal(safePath(name),false);
 assert.throws(()=>readZip(Buffer.from(zipSync({'../index.html':strToU8('bad')}))));
 assert.throws(()=>readZip(Buffer.from(zipSync({'A.html':strToU8('one'),'a.html':strToU8('two')}))));
 const corrupt=Buffer.from(zipSync({'index.html':strToU8('hello')}));corrupt[42]^=255;assert.throws(()=>readZip(corrupt));
 assert.throws(()=>readZip(Buffer.from(zipSync({'bomb.txt':strToU8('x'.repeat(1000000))}))));
});
test('SSRF policy blocks private, reserved and IPv6 addresses',()=>{
 for(const ip of ['127.0.0.1','10.0.0.1','172.16.0.1','192.168.1.2','169.254.169.254','100.64.0.1','0.0.0.0','::1','::ffff:127.0.0.1','198.18.0.1'])assert.equal(publicAddress(ip),false,ip);
 assert.equal(publicAddress('8.8.8.8'),true);
});
test('booking rejects ambiguous DST times and credentials inside public runtime URLs',()=>{
 assert.throws(()=>localEpoch('2026-11-01T01:30','America/New_York'),/iki kez/);
 assert.throws(()=>localEpoch('2026-04-05T01:45','Australia/Lord_Howe'),/iki kez/);
 assert.equal(new Date(localEpoch('2026-11-01T02:30','America/New_York')).toISOString(),'2026-11-01T07:30:00.000Z');
 assert.throws(()=>validateBookingSettings({...bookingDefaults(),runtimeUrl:'https://user:secret@example.test'}),/kimlik bilgisi/);
});
test('new section addition, hiding and repeated writes do not duplicate source sections',()=>{
 const {document:before,source}=discover(fixture('static'),registry),adapter=registry.get('static'),after=structuredClone(before);
 after.pages[0].sections[0].enabled=false;after.pages[0].sections.push(newSection('cta','newcta'));
 const a=adapter.write(before,after,source),b=adapter.write(after,after,a);
 assert.equal(b.files['index.html'].match(/<section data-studio-id="newcta"/g).length,1);assert.match(b.files['index.html'],/hidden>/);
});
test('export and reimport preserve field identities, translated values, theme, layout and custom sections',()=>{
 const adapter=registry.get('static'),{document:before,source}=discover(fixture('static'),registry),after=structuredClone(before);
 after.theme.preset='forest';after.pages[0].layout.desktop={padding:27,maxWidth:900};after.pages[0].sections.reverse();
 const field=after.pages[0].sections[0].fields[1];field.value='<p style="text-align: justify;">Bir paragraf</p><ul><li>Bir seçenek</li></ul>';field.translations={en:'<p>A paragraph</p>'};
 after.pages[0].sections.push(newSection('cta','added'));
 const written=adapter.write(before,after,source),files=readZip(Buffer.from(zipSync(Object.fromEntries(Object.entries(adapter.export(after,written)).map(([k,v])=>[k,strToU8(v)])))));
 const scanned=inspectFiles(files),again=discover(scanned.source,registry);
 assert.deepEqual(again.document,after);
 const edited=structuredClone(after);edited.pages[0].sections[0].fields[1].value='<p>İkinci kayıt</p>';
 assert.match(adapter.write(after,edited,again.source).files['index.html'],/İkinci kayıt/);
 const stale=structuredClone(written);stale.files['index.html']+='<!-- external edit -->';assert.throws(()=>discover(stale,registry),/eşleştirmesi eski/);
});
test('source headings preserve their tag when rich editor supplies paragraphs and alignment',()=>{
 const adapter=registry.get('static'),{document:before,source}=discover(fixture('static'),registry),after=structuredClone(before);
 after.pages[0].sections[0].fields[0].value='<p style="text-align: center;">Yeni <strong>başlık</strong></p>';
 const result=adapter.write(before,after,source);assert.match(result.files['index.html'],/<h1[^>]*style="text-align: center;"[^>]*>Yeni <strong>başlık<\/strong><\/h1>/);assert.doesNotMatch(result.files['index.html'],/<h1[^>]*><p/);
});
test('new adapter registration uses the same discovery entry point without core changes',()=>{
 const base=registry.get('static'),custom={id:'custom-test',version:1,discover:s=>base.discover(s),capabilities:()=>base.capabilities(),validate:(...a)=>base.validate(...a),write:(...a)=>base.write(...a),preview:(...a)=>base.preview(...a),export:(...a)=>base.export(...a)};
 const source=fixture('static');source.manifest.adapter.id='custom-test';const result=discover(source,new AdapterRegistry().register(custom));assert.equal(result.source.manifest.adapter.id,'custom-test');
});
test('independent React source compiles and consumes edited content and responsive design',async()=>{
 const adapter=registry.get('react-sdk'),{document:before,source}=discover(fixture('react-sdk'),registry),after=structuredClone(before);after.pages[0].sections[0].fields[0].value='Bağımsız React doğrulaması';after.pages[0].layout.desktop={maxWidth:880};
 const written=adapter.write(before,after,source),dir=path.resolve('test-results/react-build-'+Date.now());await fs.mkdir(dir,{recursive:true});
 for(const [file,text]of Object.entries(written.files)){const full=path.join(dir,file);await fs.mkdir(path.dirname(full),{recursive:true});await fs.writeFile(full,text);}
 const result=await build({entryPoints:[path.join(dir,'src/main.tsx')],bundle:true,write:false,outdir:path.join(dir,'dist'),jsx:'automatic',charset:'utf8'});assert.deepEqual(result.warnings,[]);
 assert.ok(result.outputFiles.some(f=>f.path.endsWith('.js')&&f.text.includes('Bağımsız React doğrulaması')));assert.ok(result.outputFiles.some(f=>f.path.endsWith('.css')&&f.text.includes('max-width: 880px')));
});
