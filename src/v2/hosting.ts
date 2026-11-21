import {randomUUID} from 'node:crypto';
import {fail} from '../util.mjs';
import {safeRequest} from './network.ts';
import {assertSnapshot} from './snapshots.ts';
import {type StaticArtifact,type GitRelease,hostingProviders,staticArtifact} from './hosting-providers.ts';

export function createHosting({store,access,registry,seal,unseal,audit,transport=safeRequest}:{store:any;access:any;registry:any;seal:any;unseal:any;audit:any;transport?:typeof safeRequest}){
 store.db.exec(`CREATE TABLE IF NOT EXISTS studio_hosting_connections(site_id TEXT NOT NULL REFERENCES studio_sites(id),provider TEXT NOT NULL,revision INTEGER NOT NULL,config TEXT NOT NULL,sealed TEXT NOT NULL,PRIMARY KEY(site_id,provider));
 CREATE TABLE IF NOT EXISTS studio_deployments(id TEXT PRIMARY KEY,site_id TEXT NOT NULL REFERENCES studio_sites(id),provider TEXT NOT NULL,revision INTEGER NOT NULL,connection_revision INTEGER NOT NULL,state TEXT NOT NULL,remote_id TEXT,url TEXT,git TEXT,artifact_hash TEXT,created TEXT NOT NULL,updated TEXT NOT NULL,error TEXT);
 CREATE UNIQUE INDEX IF NOT EXISTS studio_deployment_active ON studio_deployments(site_id,provider) WHERE state IN ('submitting','pending','review');`);
 const now=()=>new Date().toISOString(),locks=new Set<string>();
 const provider=(id:string)=>{const p=hostingProviders.get(id);if(!p)fail(422,'Bu dağıtım sağlayıcısının çalıştırıcısı henüz kullanılamıyor.');return p!;};
 const conn=(site:string,id:string)=>{const c=store.get('SELECT * FROM studio_hosting_connections WHERE site_id=? AND provider=?',site,id);if(!c)fail(422,'Önce dağıtım bağlantısını kaydedin.');return c;};
 const rows=(site:string)=>store.all('SELECT id,provider,revision,state,remote_id AS remoteId,url,artifact_hash AS artifactHash,created,updated,error FROM studio_deployments WHERE site_id=? ORDER BY created DESC LIMIT 30',site);
 const active=(site:string,id:string)=>store.get("SELECT id FROM studio_deployments WHERE site_id=? AND provider=? AND state IN ('submitting','pending','review')",site,id);
 const exclusive=async(key:string,fn:()=>Promise<any>)=>{if(locks.has(key))fail(409,'Bu dağıtım işlemi sürüyor.');locks.add(key);try{return await fn();}finally{locks.delete(key);}};
 const fresh=(user:any,siteId:string,revision:number,c:any,permission='publish')=>{const s=access(user,siteId,permission);if(s.revision!==revision||conn(siteId,c.provider).revision!==c.revision)fail(409,'Site veya bağlantı değişmiş; dağıtım durduruldu.');return s;};
 return{
  list(user:any,siteId:string){access(user,siteId,'publish');return{providers:[...hostingProviders.values()].map(p=>({id:p.id,name:p.name,mode:p.mode})),connections:store.all('SELECT provider,revision,config FROM studio_hosting_connections WHERE site_id=?',siteId).map((c:any)=>({...c,config:JSON.parse(c.config),hasToken:true})),deployments:rows(siteId),unavailable:[{id:'natro-shared',name:'Natro paylaşımlı / FTP hosting',reason:'Node.js yayın servisi kurulamayan paketlerde otomatik dağıtım henüz desteklenmiyor.'}]};},
  async configure(user:any,siteId:string,id:string,input:any){return exclusive(siteId+':'+id,async()=>{
   const site=access(user,siteId,'integrations'),p=provider(id),config=p.validate(input.config),existing=store.get('SELECT * FROM studio_hosting_connections WHERE site_id=? AND provider=?',siteId,id);
   if(input.revision!==(existing?.revision??-1))fail(409,'Bağlantı sürümü değişmiş.');if(active(siteId,id))fail(409,'Bekleyen veya belirsiz dağıtım varken bağlantı değiştirilemez.');
   if(typeof input.token!=='string'||!input.token||input.token.length>2000||/[\r\n]/.test(input.token))fail(422,'Sağlayıcı belirteci gerekli.');
   // Verify read access and project identity, but never trigger a deployment here.
   await p.verify(config,input.token,transport);access(user,siteId,'integrations');const encrypted=await seal({token:input.token},site.org_id,'hosting:'+id);
   store.transaction(()=>{access(user,siteId,'integrations');const latest=store.get('SELECT revision FROM studio_hosting_connections WHERE site_id=? AND provider=?',siteId,id);if((latest?.revision??-1)!==input.revision||active(siteId,id))fail(409,'Dağıtım bağlantısı değişmiş.');store.run('INSERT INTO studio_hosting_connections VALUES (?,?,?,?,?) ON CONFLICT(site_id,provider) DO UPDATE SET revision=excluded.revision,config=excluded.config,sealed=excluded.sealed',siteId,id,input.revision+1,JSON.stringify(config),encrypted);audit(site,user,'hosting.configured',site.revision,{provider:id});});return{provider:id,revision:input.revision+1,config};
  });},
  async submit(user:any,siteId:string,id:string,input:any){return exclusive(siteId+':'+id,async()=>{
   const site=access(user,siteId,'publish'),p=provider(id),c=conn(siteId,id),config=JSON.parse(c.config);if(!Number.isInteger(input.revision)||site.revision!==input.revision)fail(409,'Güncel site sürümü gerekli.');if(active(siteId,id))fail(409,'Önce mevcut dağıtımın durumunu kontrol edin.');
   let artifact:StaticArtifact|undefined,git:GitRelease|undefined;if(p.mode==='static-artifact'){
    if(site.adapter!=='static')fail(422,'Bu hedef doğrulanmış statik çıktı gerektirir. React kaynakları doğrudan dağıtılamaz.');const adapter=registry.get(site.adapter);assertSnapshot(adapter,site.document,site.source);
    const files:Record<string,Buffer>=Object.fromEntries(Object.entries(adapter.export(site.document,site.source)).map(([name,text])=>[name,Buffer.from(text as string)]));for(const [name,a]of Object.entries(site.source.assets) as [string,any][])files[name]=Buffer.from(a.base64,'base64');artifact=staticArtifact(files);
   }else{const release=store.get("SELECT * FROM studio_github_publications WHERE id=? AND site_id=? AND state='published'",String(input.publicationId||''),siteId);if(!release||release.revision!==site.revision)fail(422,'Bu site sürümüne ait tamamlanmış GitHub yayını gerekli.');const g=JSON.parse(release.publication);git={repository:g.repository,branch:g.branch,commit:g.commit};if(git.repository!==config.repository||git.branch!==config.branch)fail(422,'GitHub yayını dağıtım hedefiyle uyuşmuyor.');}
   const secret=await unseal(c.sealed,site.org_id,'hosting:'+id);await p.verify(config,secret.token,transport);fresh(user,siteId,site.revision,c);
   const deploymentId=randomUUID(),stamp=now();store.transaction(()=>{fresh(user,siteId,site.revision,c);if(active(siteId,id))fail(409,'Dağıtım zaten sürüyor.');store.run('INSERT INTO studio_deployments VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',deploymentId,siteId,id,site.revision,c.revision,'submitting',['self-hosted','natro'].includes(id)?deploymentId:null,null,git?JSON.stringify(git):null,artifact?.sha256||null,stamp,stamp,null);});
   try{fresh(user,siteId,site.revision,c);const result=await p.submit(config,secret.token,{artifact,git,requestId:deploymentId,authorize:async()=>{fresh(user,siteId,site.revision,c);}},transport);
    store.transaction(()=>{store.run('UPDATE studio_deployments SET state=?,remote_id=?,url=?,updated=? WHERE id=?',result.state==='ready'?'pending':result.state,result.id,result.url||null,now(),deploymentId);audit(site,user,'hosting.submitted',site.revision,{provider:id,deploymentId,state:result.state});});
   }catch(e:any){store.run("UPDATE studio_deployments SET state='review',remote_id=COALESCE(remote_id,?),updated=?,error=? WHERE id=?",['self-hosted','natro'].includes(id)?deploymentId:null,now(),'Gönderim sonucu belirsiz. Otomatik yeniden gönderilmez; sağlayıcı panelinde kontrol edin.',deploymentId);throw e;}
   return rows(siteId).find((r:any)=>r.id===deploymentId);
  });},
  async check(user:any,siteId:string,deploymentId:string){return exclusive(siteId+':check:'+deploymentId,async()=>{
   const site=access(user,siteId,'publish'),r=store.get('SELECT * FROM studio_deployments WHERE id=? AND site_id=?',deploymentId,siteId);if(!r)fail(404,'Dağıtım bulunamadı.');if(!r.remote_id)fail(409,'Sağlayıcı kimliği alınamadı; sağlayıcı panelinde manuel kontrol gerekli.');const c=conn(siteId,r.provider);if(c.revision!==r.connection_revision)fail(409,'Dağıtım bağlantısı değişmiş.');const p=provider(r.provider),secret=await unseal(c.sealed,site.org_id,'hosting:'+r.provider);access(user,siteId,'publish');const result=await p.status(JSON.parse(c.config),secret.token,r.remote_id,r.git?JSON.parse(r.git):undefined,transport);
   if(['self-hosted','natro'].includes(r.provider)&&result.artifactHash!==r.artifact_hash)result.state='review';
   if(result.state==='ready'&&result.url){try{const probe=await transport(result.url,{method:'HEAD',maxBytes:1024});if(probe.status<200||probe.status>=300||['self-hosted','natro'].includes(r.provider)&&probe.headers['x-studio-release']!==r.remote_id)result.state='review';}catch{result.state='review';}}
   store.transaction(()=>{access(user,siteId,'publish');store.run('UPDATE studio_deployments SET state=?,url=?,updated=?,error=NULL WHERE id=?',result.state,result.url||null,now(),r.id);audit(site,user,'hosting.checked',r.revision,{deploymentId:r.id,state:result.state});});return rows(siteId).find((x:any)=>x.id===r.id);
  });},
  async acknowledge(user:any,siteId:string,deploymentId:string){const site=access(user,siteId,'publish');access(user,siteId,'integrations');const r=store.get('SELECT * FROM studio_deployments WHERE id=? AND site_id=?',deploymentId,siteId);if(!r||!['review','submitting'].includes(r.state)||locks.has(siteId+':'+r.provider))fail(409,'Bu kayıt manuel kapatılabilir durumda değil.');store.transaction(()=>{store.run("UPDATE studio_deployments SET state='acknowledged',updated=? WHERE id=?",now(),r.id);audit(site,user,'hosting.manually-acknowledged',r.revision,{deploymentId:r.id});});return{ok:true};}
 };
}
