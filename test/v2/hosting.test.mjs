import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import net from 'node:net';
import {netlify,cloudflare,selfHosted,natro,staticArtifact} from '../../src/v2/hosting-providers.ts';
import {createStaticDeployAgent} from '../../src/v2/static-deploy-agent.ts';
import {createApp} from '../../src/server.mjs';
const siteId='11111111-2222-3333-4444-555555555555',deployId='a'.repeat(24),cfId='11111111-2222-3333-4444-666666666666',commit='b'.repeat(40);
const json=data=>({status:200,headers:{},body:Buffer.from(JSON.stringify(data))});
const cf={accountId:'a'.repeat(32),project:'studio-fixture',repository:'example/site',branch:'main'},git={repository:'example/site',branch:'main',commit};
test('hosting static artifact rejects source/runtime files and preserves a binary ZIP payload',async()=>{
 for(const p of ['../escape','studio-key','.github/workflows/a.yml','package.json','src/App.tsx','secret.pem'])assert.throws(()=>staticArtifact({'index.html':Buffer.from('hi'),[p]:Buffer.from('x')}),e=>e.status===422);
 const a=staticArtifact({'index.html':Buffer.from('<h1>Hi</h1>'),'image.png':Buffer.from([0,255,3])});assert.equal(a.sha256.length,64);
 const calls=[];const request=async(url,o)=>{calls.push({url,o});return json({id:deployId,site_id:siteId,state:'processing'});};
 assert.equal((await netlify.submit({siteId},'fixture-token',{artifact:a},request)).state,'pending');assert.ok(Buffer.isBuffer(calls[0].o.body));assert.equal(calls[0].o.headers['Content-Type'],'application/zip');assert.ok(calls[0].o.body.equals(a.zip));
 a.zip[0]=0;await assert.rejects(netlify.submit({siteId},'fixture-token',{artifact:a},request),e=>e.status===422);assert.equal(calls.length,1);
});
test('hosting Netlify validates identity, states, URLs and never follows provider-provided endpoints',async()=>{
 const request=async(url)=>{assert.equal(url,'https://api.netlify.com/api/v1/sites/'+siteId+'/deploys/'+deployId);return json({id:deployId,site_id:siteId,state:'ready',deploy_ssl_url:'https://fixture.netlify.app/'});};
 assert.equal((await netlify.status({siteId},'fixture-token',deployId,undefined,request)).state,'ready');
 await assert.rejects(netlify.status({siteId},'fixture-token','../escape',undefined,request),e=>e.status===422);
 await assert.rejects(netlify.status({siteId},'fixture-token',deployId,undefined,async()=>json({id:deployId,site_id:randomUUID(),state:'ready'})),e=>e.status===502);
 assert.equal((await netlify.status({siteId},'fixture-token',deployId,undefined,async()=>json({id:deployId,site_id:siteId,state:'ready',deploy_ssl_url:'https://evil.example'}))).state,'review');
 await assert.rejects(netlify.verify({siteId},'fixture-token',async()=>{throw Error('fixture-token');}),e=>e.status===502&&!e.message.includes('fixture-token'));
});
test('hosting Cloudflare checks repository, production branch and actual deployment commit',async()=>{
 await cloudflare.verify(cf,'fixture-token',async()=>json({success:true,result:{name:cf.project,production_branch:'main',source:{type:'github',config:{owner:'example',repo_name:'site'}}}}));
 await assert.rejects(cloudflare.verify(cf,'fixture-token',async()=>json({success:true,result:{name:cf.project,production_branch:'other',source:{type:'github',config:{owner:'example',repo_name:'site'}}}})),e=>e.status===422);
 const result={id:cfId,project_name:cf.project,latest_stage:{name:'deploy',status:'success'},deployment_trigger:{metadata:{branch:'main',commit_hash:commit}},url:'https://fixture.studio-fixture.pages.dev/'};
 const request=async(url,o)=>{assert.equal(url,'https://api.cloudflare.com/client/v4/accounts/'+cf.accountId+'/pages/projects/'+cf.project+'/deployments');assert.equal(o.method,'POST');assert.ok(o.body.includes('name="branch"'));assert.ok(!o.body.includes('commit_hash'));return json({success:true,result});};
 assert.equal((await cloudflare.submit(cf,'fixture-token',{git},request)).state,'ready');result.deployment_trigger.metadata.commit_hash='c'.repeat(40);
 assert.equal((await cloudflare.submit(cf,'fixture-token',{git},request)).state,'review');
 await assert.rejects(cloudflare.submit(cf,'fixture-token',{git:{...git,branch:'other'}},request),e=>e.status===422);
});
test('hosting HTTP encrypts credentials, persists deployment and prevents retry after ambiguous submission',async t=>{
 const root=path.resolve(import.meta.dirname,'../..'),dataDir=path.join(root,'test-results','hosting-'+randomUUID());let submitCount=0,loseReply=false,health=200;const calls=[];
 const transport=async(url,o={})=>{calls.push({url,method:o.method||'GET',authorization:o.headers?.Authorization});if(url==='https://fixture.netlify.app/'){assert.equal(o.headers?.Authorization,undefined);assert.equal(o.method,'HEAD');return{status:health,headers:{},body:Buffer.alloc(0)};}assert.equal(o.headers.Authorization,'Bearer fixture-secret-token');
  if(url.endsWith('/sites/'+siteId))return json({id:siteId});
  if(o.method==='POST'){submitCount++;assert.ok(Buffer.isBuffer(o.body));if(loseReply)throw Error('lost fixture-secret-token');return json({id:deployId,site_id:siteId,state:'processing'});}
  if(url.endsWith('/deploys/'+deployId))return json({id:deployId,site_id:siteId,state:'ready',deploy_ssl_url:'https://fixture.netlify.app/'});throw Error('unexpected route');};
 const probe=net.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));const origin='http://127.0.0.1:'+port;let app;
 const start=async()=>{app=await createApp({projectRoot:root,dataDir,origin,security:{studioTransport:transport}});await new Promise(r=>app.server.listen(port,'127.0.0.1',r));};await start();t.after(async()=>app?.close());
 let cookie='',csrf='';const api=async(url,method='GET',input,extra={})=>{const r=await fetch(origin+url,{method,headers:{Origin:origin,Cookie:cookie,'X-CSRF-Token':csrf,'Content-Type':'application/json',...extra},...(input===undefined?{}:{body:JSON.stringify(input)})});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];const data=await r.json();if(data.csrf)csrf=data.csrf;return{status:r.status,data};};
 assert.equal((await api('/api/setup','POST',{token:app.setupToken,email:'hosting@example.test',password:'Hosting-test-password-2026!'})).status,201);const orgId=(await api('/api/v2/workspace')).data.organizations[0].id;
 const job=(await api('/api/v2/imports','POST',{kind:'example',example:'static',orgId,requestId:randomUUID()})).data;for(let n=0;n<100;n++){const j=(await api('/api/v2/imports/'+job.id)).data;if(j.status==='review')break;await new Promise(r=>setTimeout(r,10));}
 const localSite=(await api('/api/v2/imports/'+job.id+'/commit','POST',{})).data.siteId,base='/api/v2/sites/'+localSite,revision=(await api(base)).data.revision;
 const config={revision:-1,config:{siteId},token:'fixture-secret-token'};assert.equal((await api(base+'/hosting/connections/netlify','PUT',config,{'X-CSRF-Token':''})).status,403);
 assert.equal((await api(base+'/hosting/connections/netlify','PUT',config)).status,200);assert.equal((await api(base+'/hosting/connections/netlify','PUT',config)).status,409);
 assert.ok(!app.store.get('SELECT sealed FROM studio_hosting_connections WHERE site_id=?',localSite).sealed.includes('fixture-secret-token'));assert.ok(!JSON.stringify((await api(base+'/hosting')).data).includes('fixture-secret-token'));
 const started=await api(base+'/hosting/deploy/netlify','POST',{revision});assert.equal(started.status,201,JSON.stringify(started));assert.equal(started.data.state,'pending');assert.equal(submitCount,1);
 assert.equal((await api(base+'/hosting/deploy/netlify','POST',{revision})).status,409);await app.close();await start();
 health=503;assert.equal((await api(base+'/hosting/deployments/'+started.data.id+'/check','POST',{})).data.state,'review');health=200;assert.equal((await api(base+'/hosting/deployments/'+started.data.id+'/check','POST',{})).data.state,'ready');
 loseReply=true;assert.equal((await api(base+'/hosting/deploy/netlify','POST',{revision})).status,502);const uncertain=(await api(base+'/hosting')).data.deployments.find(d=>d.state==='review');assert.ok(uncertain);assert.equal((await api(base+'/hosting/deploy/netlify','POST',{revision})).status,409);assert.equal(submitCount,2);
 assert.equal((await api(base+'/hosting/deployments/'+uncertain.id+'/acknowledge','POST',{})).status,422);assert.equal((await api(base+'/hosting/deployments/'+uncertain.id+'/acknowledge','POST',{confirmed:true})).status,200);
 assert.equal((await api('/api/v2/sites/'+randomUUID()+'/hosting')).status,404);assert.equal((await api(base+'/hosting/deploy/natro','POST',{revision})).status,422);
});
test('self-hosted and Natro agent serve immutable static releases with auth, CAS, retry and restart',async t=>{
 const directory=path.resolve('test-results/agent-'+randomUUID()),token='fixture-agent-token-'.repeat(3),instanceId=randomUUID(),publicUrl='https://static.example.test/',config={origin:publicUrl,instanceId};let agent,origin;
 const start=async()=>{agent=await createStaticDeployAgent({directory,token,instanceId,publicUrl});await new Promise(r=>agent.server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+agent.server.address().port;};await start();t.after(async()=>agent?.close());
 const transport=async(url,o={})=>{assert.ok(url.startsWith(publicUrl));const r=await fetch(origin+url.slice(publicUrl.length-1),{method:o.method||'GET',headers:o.headers,body:o.body});return{status:r.status,headers:Object.fromEntries(r.headers),body:Buffer.from(await r.arrayBuffer())};};
 assert.equal((await fetch(origin+'/_studio/v1/info')).status,401);await selfHosted.verify(config,token,transport);await natro.verify(config,token,transport);
 await assert.rejects(natro.verify({...config,instanceId:randomUUID()},token,transport),e=>e.status===422);
 const requestId=randomUUID(),artifact=staticArtifact({'index.html':Buffer.from('<h1>Release one</h1>'),'assets/data.json':Buffer.from('{"ok":true}')});
 const first=await selfHosted.submit(config,token,{artifact,requestId},transport);assert.equal(first.state,'ready');assert.equal(first.artifactHash,artifact.sha256);assert.equal((await fetch(origin+'/')).status,200);assert.match(await(await fetch(origin+'/')).text(),/Release one/);
 assert.equal((await natro.submit(config,token,{artifact,requestId},transport)).id,requestId);
 const other=staticArtifact({'index.html':Buffer.from('<h1>Release two</h1>')});
 await assert.rejects(natro.submit(config,token,{artifact:other,requestId},transport),e=>e.status===502);
 const stale=await fetch(origin+'/_studio/v1/releases/'+randomUUID(),{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/zip','X-Studio-Artifact-SHA256':other.sha256,'If-Match':'empty'},body:other.zip});assert.equal(stale.status,409);assert.match(await(await fetch(origin+'/')).text(),/Release one/);
 await agent.close();await start();assert.equal((await natro.status(config,token,requestId,undefined,transport)).state,'ready');
 const secondId=randomUUID();await natro.submit(config,token,{artifact:other,requestId:secondId},transport);assert.match(await(await fetch(origin+'/')).text(),/Release two/);assert.equal((await selfHosted.status(config,token,requestId,undefined,transport)).state,'review');
 assert.equal((await fetch(origin+'/release.json')).status,404);assert.equal((await fetch(origin+'/current.json')).status,404);
 const bad=await fetch(origin+'/_studio/v1/releases/'+randomUUID(),{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/zip','X-Studio-Artifact-SHA256':'0'.repeat(64),'If-Match':secondId},body:other.zip});assert.equal(bad.status,422);
});
