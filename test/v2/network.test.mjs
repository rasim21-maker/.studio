import {test} from 'node:test';
import assert from 'node:assert/strict';
import dns from 'node:dns/promises';
import https from 'node:https';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {safeRequest} from '../../src/v2/network.ts';

// All transport is replaced inside each test. These fixtures exercise the actual
// destination policy and stream bounds without contacting public/private hosts.
function transport(t,{status=200,chunks=[Buffer.from('ok')],headers={}}={}){
 const calls=[];
 t.mock.method(https,'request',(url,options,receive)=>{
  calls.push({url,options});const request=new EventEmitter();
  request.write=()=>{};request.destroy=()=>request;
  request.end=()=>queueMicrotask(()=>{const response=new PassThrough();response.statusCode=status;response.headers=headers;receive(response);for(const chunk of chunks)response.write(chunk);response.end();});
  return request;
 });return calls;
}
test('E-24: private, metadata and mixed DNS answers never reach HTTPS',async(t)=>{
 const calls=transport(t);let addresses=[];
 t.mock.method(dns,'lookup',async()=>addresses);
 for(const answer of [['127.0.0.1'],['169.254.169.254'],['8.8.8.8','10.0.0.1'],['::1'],[]]){
  addresses=answer.map(address=>({address,family:address.includes(':')?6:4}));
  await assert.rejects(()=>safeRequest('https://source.example.test'),e=>e.status===422);
 }assert.equal(calls.length,0);
});
test('E-24: HTTPS connects to the validated address without a second DNS resolution',async(t)=>{
 const calls=transport(t);let queries=0;
 t.mock.method(dns,'lookup',async()=>[{address:++queries===1?'8.8.8.8':'127.0.0.1',family:4}]);
 assert.equal((await safeRequest('https://source.example.test/page')).body.toString(),'ok');
 const {options}=calls[0];assert.equal(options.servername,'source.example.test');
 options.lookup('source.example.test',{},(error,address,family)=>{assert.equal(error,null);assert.equal(address,'8.8.8.8');assert.equal(family,4);});
 options.lookup('source.example.test',{all:true},(error,addresses)=>{assert.equal(error,null);assert.deepEqual(addresses,[{address:'8.8.8.8',family:4}]);});
 assert.equal(queries,1);
});
test('E-24: redirects cannot forward connector credentials to another destination',async(t)=>{
 t.mock.method(dns,'lookup',async()=>[{address:'8.8.8.8',family:4}]);
 const calls=transport(t,{status:302,headers:{location:'http://169.254.169.254/latest/meta-data/'}});
 await assert.rejects(()=>safeRequest('https://source.example.test',{headers:{Authorization:'Bearer fixture-only'}}),e=>e.status===422);
 assert.equal(calls.length,1);assert.equal(calls[0].url.hostname,'source.example.test');
});
test('E-24: response streams stop at the configured byte limit',async(t)=>{
 t.mock.method(dns,'lookup',async()=>[{address:'8.8.8.8',family:4}]);transport(t,{chunks:[Buffer.alloc(6),Buffer.alloc(6)]});
 await assert.rejects(()=>safeRequest('https://source.example.test',{maxBytes:10}),e=>e.status===422);
});
test('E-24: unsafe URL forms fail before DNS or transport',async(t)=>{
 const calls=transport(t);let queries=0;t.mock.method(dns,'lookup',async()=>{queries++;return[{address:'8.8.8.8',family:4}];});
 for(const url of ['http://source.example.test','https://127.0.0.1','https://user:secret@source.example.test','https://source.example.test:444','https://source.example.test/#fragment'])await assert.rejects(()=>safeRequest(url),e=>e.status===422);
 assert.equal(queries,0);assert.equal(calls.length,0);
});
test('E-24: an already cancelled import never opens a remote connection',async(t)=>{
 const calls=transport(t);let queries=0;t.mock.method(dns,'lookup',async()=>{queries++;return[{address:'8.8.8.8',family:4}];});
 await assert.rejects(()=>safeRequest('https://source.example.test',{signal:AbortSignal.abort()}),e=>e.status===422);
 assert.equal(queries,0);assert.equal(calls.length,0);
});
