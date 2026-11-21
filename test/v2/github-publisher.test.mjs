import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import net from 'node:net';
import {createApp} from '../../src/server.mjs';
import {fixture as siteFixture} from '../../src/v2/fixtures.ts';
import {prepareGitHubPublication,finalizeGitHubPublication} from '../../src/v2/github-publisher.ts';
const hash=v=>createHash('sha1').update(v).digest('hex'),old='a'.repeat(40),base='b'.repeat(40),nextTree='c'.repeat(40),next='d'.repeat(40),foreign='e'.repeat(40);
const target={repository:'example/site',branch:'release/studio',expectedCommit:old};
const blob=bytes=>hash(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`),bytes]));
function fixture(){
 const f={head:old,calls:[],race:false,loseReply:false,truncated:false,wrongBlob:false,tree:[{path:'index.html',mode:'100644',type:'blob',sha:blob(Buffer.from('before'))},{path:'untouched.txt',mode:'100644',type:'blob',sha:hash('untouched')},{path:'script.sh',mode:'100755',type:'blob',sha:hash('old-script')}],candidate:null};
 f.request=async(url,opts={})=>{assert.ok(url.startsWith('https://api.github.com/repos/example/site/'));assert.equal(opts.headers.Authorization,'Bearer fixture-token');const p=url.slice('https://api.github.com/repos/example/site'.length),method=opts.method||'GET',body=opts.body?JSON.parse(opts.body):undefined;f.calls.push({p,method,body});let result,status=200;
  if(p==='/git/ref/heads/release/studio')result={ref:'refs/heads/release/studio',object:{type:'commit',sha:f.head}};
  else if(p==='/git/commits/'+old)result={sha:old,tree:{sha:base}};
  else if(p==='/git/trees/'+base+'?recursive=1')result={sha:base,truncated:f.truncated,tree:f.tree};
  else if(p==='/git/blobs'&&method==='POST'){assert.equal(body.encoding,'base64');result={sha:f.wrongBlob?foreign:blob(Buffer.from(body.content,'base64'))};status=201;}
  else if(p==='/git/trees'&&method==='POST'){assert.equal(body.base_tree,base);result={sha:nextTree};status=201;}
  else if(p==='/git/commits'&&method==='POST'){assert.deepEqual(body.parents,[old]);f.candidate={sha:next,tree:{sha:body.tree},parents:[{sha:old}]};result=f.candidate;status=201;}
  else if(p==='/git/commits/'+next)result=f.candidate;
  else if(p==='/git/refs/heads/release/studio'&&method==='PATCH'){assert.equal(body.force,false);if(f.race){f.head=foreign;status=422;result={message:'do not leak fixture-token'};}else{f.head=body.sha;if(f.loseReply){f.loseReply=false;throw Error('lost reply fixture-token');}result={object:{sha:f.head}};}}
  else throw Error('Unexpected fixture route '+p);
  return{status,headers:{},body:Buffer.from(JSON.stringify(result))};
 };return f;
}
test('GitHub publication overlays only changed blobs, retains mode and never writes the branch during preparation',async()=>{
 const f=fixture(),files={'index.html':Buffer.from('after'),'script.sh':Buffer.from('#!/bin/sh\necho hello'),'image.png':Buffer.from([0,255,4])};
 const publication=await prepareGitHubPublication(target,files,'fixture-token',{request:f.request});
 assert.equal(f.head,old);assert.equal(f.calls.filter(c=>c.method==='PATCH').length,0);
 const tree=f.calls.find(c=>c.p==='/git/trees').body;assert.equal(tree.base_tree,base);assert.deepEqual(tree.tree.map(x=>x.path),Object.keys(files));assert.equal(tree.tree.find(x=>x.path==='script.sh').mode,'100755');assert.ok(!tree.tree.some(x=>x.sha===null));
 assert.deepEqual(await finalizeGitHubPublication(publication,'fixture-token',{request:f.request}),{status:'published',remoteRevision:next});
 const count=f.calls.filter(c=>c.method==='PATCH').length;await finalizeGitHubPublication(publication,'fixture-token',{request:f.request});assert.equal(f.calls.filter(c=>c.method==='PATCH').length,count);
});
test('GitHub publication rejects stale source before writes and a race without force-pushing',async()=>{
 const f=fixture();f.head=foreign;await assert.rejects(prepareGitHubPublication(target,{'index.html':Buffer.from('after')},'fixture-token',{request:f.request}),e=>e.status===409);assert.ok(f.calls.every(c=>c.method==='GET'));
 f.head=old;const p=await prepareGitHubPublication(target,{'index.html':Buffer.from('after')},'fixture-token',{request:f.request});f.race=true;
 await assert.rejects(finalizeGitHubPublication(p,'fixture-token',{request:f.request}),e=>e.status===409&&!e.message.includes('fixture-token'));assert.equal(f.head,foreign);
});
test('GitHub publication reconciles a lost PATCH reply using the persisted commit without replay',async()=>{
 const f=fixture(),p=await prepareGitHubPublication(target,{'index.html':Buffer.from('after')},'fixture-token',{request:f.request});f.loseReply=true;
 await assert.rejects(finalizeGitHubPublication(p,'fixture-token',{request:f.request}),e=>e.status===502&&!e.message.includes('fixture-token'));assert.equal(f.head,next);
 assert.equal((await finalizeGitHubPublication(p,'fixture-token',{request:f.request})).remoteRevision,next);assert.equal(f.calls.filter(c=>c.method==='PATCH').length,1);
});
test('GitHub publication validates inputs before network access and blocks unsafe remote structure',async()=>{
 for(const p of ['../x','/x','.env','.github/workflows/run.yml','node_modules/x','integration-key','a\\b']){const f=fixture();await assert.rejects(prepareGitHubPublication(target,{[p]:Buffer.from('x')},'fixture-token',{request:f.request}),e=>e.status===422);assert.equal(f.calls.length,0,p);}
 for(const branch of ['main..bad','heads/../main','main.lock','-bad//name','https:evil']){const f=fixture();await assert.rejects(prepareGitHubPublication({...target,branch},{'index.html':Buffer.from('x')},'fixture-token',{request:f.request}),e=>e.status===422);assert.equal(f.calls.length,0);}
 const f=fixture();f.tree.push({path:'link',type:'blob',mode:'120000',sha:foreign});await assert.rejects(prepareGitHubPublication(target,{'link/secret':Buffer.from('x')},'fixture-token',{request:f.request}),e=>e.status===422);
 const g=fixture();g.truncated=true;await assert.rejects(prepareGitHubPublication(target,{'index.html':Buffer.from('x')},'fixture-token',{request:g.request}),e=>e.status===422);
});
test('GitHub publication verifies blob hashes, no-op output and authorization before advancing the branch',async()=>{
 const f=fixture(),same=await prepareGitHubPublication(target,{'index.html':Buffer.from('before')},'fixture-token',{request:f.request});assert.equal(same.commit,old);assert.ok(f.calls.every(c=>c.method==='GET'));
 assert.equal((await finalizeGitHubPublication(same,'fixture-token',{request:f.request})).remoteRevision,old);
 const g=fixture();g.wrongBlob=true;await assert.rejects(prepareGitHubPublication(target,{'index.html':Buffer.from('after')},'fixture-token',{request:g.request}),e=>e.status===502);assert.equal(g.head,old);
 const h=fixture(),p=await prepareGitHubPublication(target,{'index.html':Buffer.from('after')},'fixture-token',{request:h.request});let calls=0;
 await assert.rejects(finalizeGitHubPublication(p,'fixture-token',{request:h.request,authorize:async()=>{if(++calls===2)throw Object.assign(Error('revoked'),{status:403});}}),e=>e.status===403);assert.equal(h.head,old);assert.ok(!h.calls.some(c=>c.method==='PATCH'));
 h.candidate.parents=[{sha:foreign}];await assert.rejects(finalizeGitHubPublication(p,'fixture-token',{request:h.request}),e=>e.status===409);
});
test('GitHub HTTP publication persists prepared commit across restart and reconciles uncertain delivery',async t=>{
 const root=path.resolve(import.meta.dirname,'../..'),dataDir=path.join(root,'test-results','github-publish-'+randomUUID()),f=fixture(),html=Buffer.from(siteFixture('static').files['index.html']),original=f.request;
 const json=x=>({status:200,headers:{},body:Buffer.from(JSON.stringify(x))});
 f.tree=[{path:'index.html',type:'blob',mode:'100644',sha:blob(html),size:html.length}];
 const transport=async(url,opts)=>{
  if(url.endsWith('/git/trees/release%2Fstudio?recursive=1'))return json({sha:base,tree:f.tree});
  if(url.endsWith('/git/blobs/'+blob(html)))return json({encoding:'base64',content:html.toString('base64')});
  return original(url,opts);
 };
 const probe=net.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));const origin='http://127.0.0.1:'+port;
 let app;const start=async()=>{app=await createApp({projectRoot:root,dataDir,origin,security:{studioTransport:transport}});await new Promise(r=>app.server.listen(port,'127.0.0.1',r));};await start();t.after(async()=>app?.close());
 let cookie='',csrf='';const api=async(route,method='GET',body,csrfOverride)=>{const r=await fetch(origin+route,{method,headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json','X-CSRF-Token':csrfOverride??csrf},...(body===undefined?{}:{body:JSON.stringify(body)})});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];const data=await r.json();if(data.csrf)csrf=data.csrf;return{status:r.status,data};};
 assert.equal((await api('/api/setup','POST',{token:app.setupToken,email:'github@example.test',password:'Github-test-password-2026!'})).status,201);
 const orgId=(await api('/api/v2/workspace')).data.organizations[0].id,job=(await api('/api/v2/imports','POST',{kind:'github',repository:target.repository,ref:target.branch,token:'fixture-token',orgId,requestId:randomUUID()})).data;
 let review;for(let i=0;i<100;i++){review=(await api('/api/v2/imports/'+job.id)).data;if(!['queued','analyzing'].includes(review.status))break;await new Promise(r=>setTimeout(r,10));}assert.equal(review.status,'review',JSON.stringify(review));
 const siteId=(await api('/api/v2/imports/'+job.id+'/commit','POST',{})).data.siteId,url='/api/v2/sites/'+siteId;
 const site=(await api(url)).data;site.document.pages[0].sections[0].fields[0].value='GitHub reviewed update';
 const saved=await api(url+'/document','PUT',{revision:site.revision,document:site.document});assert.equal(saved.status,200,JSON.stringify(saved));const revision=saved.data.revision;
 assert.equal((await api(url+'/github-publications','POST',{revision},'')).status,403);
 const prepared=await api(url+'/github-publications','POST',{revision});assert.equal(prepared.status,201,JSON.stringify(prepared));assert.equal(prepared.data.state,'prepared');assert.equal(f.head,old);
 assert.equal((await api(url+'/github-publications','POST',{revision})).data.id,prepared.data.id);
 assert.equal(JSON.stringify((await api(url+'/github-publications')).data).includes('fixture-token'),false);
 await app.close();await start();assert.equal((await api(url+'/github-publications')).data.items[0].id,prepared.data.id);
 f.loseReply=true;const publish=url+'/github-publications/'+prepared.data.id+'/publish';assert.equal((await api(publish,'POST',{})).status,502);assert.equal((await api(url+'/github-publications')).data.items[0].state,'review');
 const complete=await api(publish,'POST',{});assert.equal(complete.status,200,JSON.stringify(complete));assert.equal(complete.data.state,'published');assert.equal(f.calls.filter(c=>c.method==='PATCH').length,1);
 assert.equal(JSON.parse(app.store.get('SELECT config FROM studio_connections WHERE site_id=?',siteId).config).remoteRevision,nextTree);
 assert.equal((await api(publish,'POST',{})).data.state,'published');
 assert.equal((await api('/api/v2/sites/'+randomUUID()+'/github-publications')).status,404);
});
