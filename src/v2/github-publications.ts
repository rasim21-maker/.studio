import {randomUUID} from 'node:crypto';
import {fail} from '../util.mjs';
import {assertSnapshot} from './snapshots.ts';
import {resolveGitHubTarget,prepareGitHubPublication,finalizeGitHubPublication} from './github-publisher.ts';
import {safeRequest} from './network.ts';

// Host-owned state and authorization, not a raw database API for plugins.
export function createGitHubPublications({store,access,registry,unseal,audit,transport=safeRequest}:{store:any;access:any;registry:any;unseal:any;audit:any;transport?:typeof safeRequest}){
 store.db.exec(`CREATE TABLE IF NOT EXISTS studio_github_publications(
 id TEXT PRIMARY KEY,site_id TEXT NOT NULL REFERENCES studio_sites(id),revision INTEGER NOT NULL,
 connection_revision INTEGER NOT NULL,state TEXT NOT NULL,publication TEXT,actor TEXT NOT NULL,
 created TEXT NOT NULL,updated TEXT NOT NULL,error TEXT);
 CREATE UNIQUE INDEX IF NOT EXISTS studio_github_publication_source ON studio_github_publications(site_id,revision,connection_revision);`);
 const locks=new Set<string>(),now=()=>new Date().toISOString();
 const scoped=(user:any,id:string)=>access(user,id,'publish');
 const connection=(id:string)=>{const c=store.get('SELECT * FROM studio_connections WHERE site_id=?',id);if(c?.kind!=='github')fail(422,'Bu site için GitHub bağlantısı bulunamadı.');return c;};
 const row=(user:any,siteId:string,id:string)=>{scoped(user,siteId);const r=store.get('SELECT * FROM studio_github_publications WHERE id=? AND site_id=?',id,siteId);if(!r)fail(404,'Yayın kaydı bulunamadı.');return r;};
 const publicRow=(r:any)=>({id:r.id,revision:r.revision,state:r.state,created:r.created,updated:r.updated,error:r.error,...(r.publication?{publication:JSON.parse(r.publication)}:{})});
 const exclusive=async(siteId:string,work:()=>Promise<any>)=>{if(locks.has(siteId))fail(409,'Bu site için yayın işlemi sürüyor.');locks.add(siteId);try{return await work();}finally{locks.delete(siteId);}};
 function current(user:any,siteId:string,revision:number,connRevision:number){const site=scoped(user,siteId),conn=connection(siteId);if(site.revision!==revision||conn.revision!==connRevision)fail(409,'Site veya bağlantı değişti; yeni sürüm için yayın hazırlayın.');return{site,conn};}
 return{
  list(user:any,siteId:string){scoped(user,siteId);return{items:store.all('SELECT * FROM studio_github_publications WHERE site_id=? ORDER BY created DESC LIMIT 30',siteId).map(publicRow)};},
  async prepare(user:any,siteId:string,revision:number){return exclusive(siteId,async()=>{
   const site=scoped(user,siteId),conn=connection(siteId);if(!Number.isInteger(revision)||site.revision!==revision)fail(409,'Güncel site sürümü gerekli.');
   const existing=store.get('SELECT * FROM studio_github_publications WHERE site_id=? AND revision=? AND connection_revision=?',siteId,revision,conn.revision);
   if(existing?.publication)return publicRow(existing);
   const id=existing?.id||randomUUID(),at=now();store.transaction(()=>{if(existing)store.run("UPDATE studio_github_publications SET state='preparing',error=NULL,updated=? WHERE id=?",at,id);else store.run('INSERT INTO studio_github_publications VALUES (?,?,?,?,?,?,?,?,?,?)',id,siteId,revision,conn.revision,'preparing',null,user.user_id,at,at,null);});
   try{
    const adapter=registry.get(site.adapter);assertSnapshot(adapter,site.document,site.source);
    const files:Record<string,Buffer>=Object.fromEntries(Object.entries(adapter.export(site.document,site.source)).map(([p,text])=>[p,Buffer.from(text as string)]));
    for(const [p,a]of Object.entries(site.source.assets) as [string,any][])files[p]=Buffer.from(a.base64,'base64');
    const secret=await unseal(conn.sealed,site.org_id,conn.kind),config=JSON.parse(conn.config);current(user,siteId,revision,conn.revision);
    const target=await resolveGitHubTarget(config,secret.token,{request:transport});current(user,siteId,revision,conn.revision);
    const publication=await prepareGitHubPublication(target,files,secret.token,{request:transport,authorize:async()=>{current(user,siteId,revision,conn.revision);}});
    store.transaction(()=>{current(user,siteId,revision,conn.revision);store.run("UPDATE studio_github_publications SET state='prepared',publication=?,updated=?,error=NULL WHERE id=?",JSON.stringify(publication),now(),id);audit(site,user,'github.prepared',revision,{publicationId:id,commit:publication.commit});});
    return publicRow(row(user,siteId,id));
   }catch(e:any){store.run("UPDATE studio_github_publications SET state='failed',error=?,updated=? WHERE id=?",'Hazırlama tamamlanamadı. Güncel kaynak ve izinleri kontrol edin.',now(),id);throw e;}
  });},
  async publish(user:any,siteId:string,id:string){return exclusive(siteId,async()=>{
   const r=row(user,siteId,id);if(r.state==='published')return publicRow(r);if(!r.publication)fail(409,'Önce yayın hazırlığı tamamlanmalı.');
   const {site,conn}=current(user,siteId,r.revision,r.connection_revision),publication=JSON.parse(r.publication),secret=await unseal(conn.sealed,site.org_id,conn.kind);
   current(user,siteId,r.revision,r.connection_revision);store.run("UPDATE studio_github_publications SET state='publishing',updated=?,error=NULL WHERE id=?",now(),id);
   try{
    await finalizeGitHubPublication(publication,secret.token,{request:transport,authorize:async()=>{current(user,siteId,r.revision,r.connection_revision);}});
    store.transaction(()=>{current(user,siteId,r.revision,r.connection_revision);const config=JSON.parse(conn.config);store.run('UPDATE studio_connections SET config=?,revision=revision+1 WHERE site_id=?',JSON.stringify({...config,remoteRevision:publication.tree}),siteId);store.run("UPDATE studio_github_publications SET state='published',error=NULL,updated=? WHERE id=?",now(),id);audit(site,user,'github.published',r.revision,{publicationId:id,commit:publication.commit});});
    return publicRow(row(user,siteId,id));
   }catch(e:any){store.run("UPDATE studio_github_publications SET state='review',error=?,updated=? WHERE id=?",'Uzak sonuç doğrulanamadı. Aynı yayın kaydını yeniden kontrol edin; yeni yayın oluşturmayın.',now(),id);throw e;}
  });}
 };
}
