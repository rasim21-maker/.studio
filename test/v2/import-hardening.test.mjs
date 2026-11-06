import {test} from 'node:test';
import assert from 'node:assert/strict';
import {zipSync} from 'fflate';
import {inspectFiles,readZip} from '../../src/v2/import.ts';

const html=Buffer.from('<main><section><p>Example</p></section></main>');
test('E-14 E-24: every file intake rejects Unicode and case aliases',()=>{
 for(const names of [['caf\u00e9.txt','cafe\u0301.txt'],['CAF\u00c9.txt','cafe\u0301.txt'],['A.txt','a.txt']]){
  const files={'index.html':html,[names[0]]:Buffer.from('one'),[names[1]]:Buffer.from('two')};
  assert.throws(()=>inspectFiles(files),/çakışan/);
  assert.throws(()=>readZip(Buffer.from(zipSync(files))),/çakışan/);
 }
});

test('E-14: canonical comparison preserves original source spelling and references',()=>{
 const filename='cafe\u0301.css',files={'index.html':Buffer.from('<html><head><link rel="stylesheet" href="'+filename+'"></head></html>'),[filename]:Buffer.from('body{color:green}')};
 const direct=inspectFiles(files),archive=inspectFiles(readZip(Buffer.from(zipSync(files))));
 assert.deepEqual(archive.source.files,direct.source.files);
 assert.equal(archive.source.files[filename],'body{color:green}');
 assert.ok(archive.source.files['index.html'].includes(filename));
});

test('E-14 E-24: direct intake and ZIP reject unsafe paths before adopting content',()=>{
 for(const filename of ['NUL.txt','a/COM1.css','../escape.txt','/absolute.txt','a\\b.txt','null\0.txt']){
  const files={'index.html':html,[filename]:Buffer.from('bad')};
  assert.throws(()=>inspectFiles(files));
  assert.throws(()=>readZip(Buffer.from(zipSync(files))));
 }
});
