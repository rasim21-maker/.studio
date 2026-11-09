import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID,randomBytes,createDecipheriv} from 'node:crypto';
import {zipSync,strToU8} from 'fflate';
import {fail} from '../util.mjs';
import {createRegistry,discover} from './adapters.ts';
import {digest,readZip,inspectFiles,mediaAsset,limits,claimSourcePath} from './import.ts';
import {safeRequest} from './network.ts';
import {assertSnapshot,assertRestorable} from './snapshots.ts';
import {sealSecret,openSecret} from '../security/envelope.mjs';
import {openLocalKeyProvider} from '../security/local-keys.mjs';
import {createAgentAccess} from './agent-access.mjs';
import {createRegionalSettings} from './regional-settings.mjs';
import {fixture} from './fixtures.ts';
import {ModuleHost} from '@loft-studio/module-core';
import {permissions} from '../../shared/v2/model.ts';
import type {Document,Source,Adapter,SiteRecord} from '../../shared/v2/model.ts';
type Store=any;
const now=()=>new Date().toISOString();
const encode=(v:unknown)=>JSON.stringify(v);
const parse=(v:string)=>JSON.parse(v);
const uuid=(v:unknown)=>typeof v==='string'&&/^[a-f0-9-]{36}$/.test(v);
const name=(v:unknown)=>typeof v==='string'&&v.trim().length>0&&v.length<=120&&!/[<>\u0000-\u001f]/.test(v);
const packed=(row:any)=>({...row,document:parse(row.document),source:parse(row.source)});
export async function createPlatform({store,dataDir,legacyAdapter,features,modules=[],transport=safeRequest,secretProvider}:{store:Store;dataDir:string;legacyAdapter:any;features?:any;modules?:any[];transport?:typeof safeRequest;secretProvider?:any}){
 store.db.exec(`
 CREATE TABLE IF NOT EXISTS studio_migrations(version INTEGER PRIMARY KEY, applied TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS studio_orgs(id TEXT PRIMARY KEY,name TEXT NOT NULL,owner TEXT NOT NULL REFERENCES users(id));
 CREATE TABLE IF NOT EXISTS studio_workspaces(id TEXT PRIMARY KEY,org_id TEXT NOT NULL REFERENCES studio_orgs(id),name TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS studio_projects(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL REFERENCES studio_workspaces(id),name TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS studio_sites(id TEXT PRIMARY KEY,org_id TEXT NOT NULL REFERENCES studio_orgs(id),workspace_id TEXT NOT NULL REFERENCES studio_workspaces(id),project_id TEXT NOT NULL REFERENCES studio_projects(id),environment TEXT NOT NULL,adapter TEXT NOT NULL,name TEXT NOT NULL,revision INTEGER NOT NULL,document TEXT NOT NULL,source TEXT NOT NULL,created TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS studio_members(site_id TEXT NOT NULL REFERENCES studio_sites(id),user_id TEXT NOT NULL REFERENCES users(id),permissions TEXT NOT NULL,PRIMARY KEY(site_id,user_id));
 CREATE TABLE IF NOT EXISTS studio_versions(id TEXT PRIMARY KEY,site_id TEXT NOT NULL REFERENCES studio_sites(id),revision INTEGER NOT NULL,document TEXT NOT NULL,source TEXT NOT NULL,actor TEXT NOT NULL,actor_type TEXT NOT NULL,note TEXT NOT NULL,created TEXT NOT NULL,UNIQUE(site_id,revision));
 CREATE TABLE IF NOT EXISTS studio_releases(id TEXT PRIMARY KEY,site_id TEXT NOT NULL REFERENCES studio_sites(id),version_id TEXT NOT NULL REFERENCES studio_versions(id),actor TEXT NOT NULL,created TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS studio_imports(id TEXT PRIMARY KEY,owner TEXT NOT NULL REFERENCES users(id),org_id TEXT NOT NULL REFERENCES studio_orgs(id),site_id TEXT,expected INTEGER,status TEXT NOT NULL,progress INTEGER NOT NULL,result TEXT,error TEXT,created TEXT NOT NULL,request_key TEXT NOT NULL,fingerprint TEXT NOT NULL,UNIQUE(owner,request_key));
 CREATE TABLE IF NOT EXISTS studio_connections(site_id TEXT PRIMARY KEY REFERENCES studio_sites(id),kind TEXT NOT NULL,config TEXT NOT NULL,sealed TEXT NOT NULL,revision INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS studio_audit(id TEXT PRIMARY KEY,site_id TEXT,org_id TEXT NOT NULL,actor TEXT NOT NULL,actor_type TEXT NOT NULL,action TEXT NOT NULL,revision INTEGER,created TEXT NOT NULL,detail TEXT NOT NULL);
 `);
 store.run('INSERT OR IGNORE INTO studio_migrations VALUES (1,?)',now());
 store.run("UPDATE studio_imports SET status='failed',error='İş kesildi; yeni istek anahtarıyla yeniden deneyin.' WHERE status IN ('queued','analyzing')");
 const registry=createRegistry();let closed=false,active=0;const pending:(()=>Promise<void>)[]=[],running=new Set<Promise<void>>(),controllers=new Map<string,AbortController>();
 const pump=()=>{if(closed||active||!pending.length)return;active++;const task=pending.shift()!;const promise=new Promise<void>(resolve=>setImmediate(()=>void task().finally(()=>{active--;running.delete(promise);resolve();pump();})));running.add(promise);};
 const keyFile=path.join(dataDir,'studio-key');let key:Buffer;try{key=await fs.readFile(keyFile);}catch(e:any){if(e.code!=='ENOENT')throw e;key=randomBytes(32);await fs.writeFile(keyFile,key,{mode:0o600,flag:'wx'});}if(key!.length!==32)throw Error('Studio key is invalid.');
 const wrapping=secretProvider||await openLocalKeyProvider(dataDir);
 const secretContext=(orgId:string,kind:string)=>'org:'+orgId+':connector:'+kind;
 const seal=async(value:unknown,orgId:string,kind:string)=>'envelope:'+await sealSecret(value,secretContext(orgId,kind),wrapping);
 const unseal=async(value:string,orgId:string,kind:string)=>{
  if(value.startsWith('envelope:'))return openSecret(value.slice(9),secretContext(orgId,kind),wrapping);
  const bytes=Buffer.from(value,'base64'),decipher=createDecipheriv('aes-256-gcm',key!,bytes.subarray(0,12));decipher.setAuthTag(bytes.subarray(12,28));return parse(Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]).toString());
 };
 function audit(site:any,user:any,action:string,revision:number|null,detail:unknown={},actorType='human'){store.run('INSERT INTO studio_audit VALUES (?,?,?,?,?,?,?,?,?)',randomUUID(),site.id||null,site.org_id,user.user_id,actorType,action,revision,now(),encode(detail));}
 function personal(user:any){let org=store.get('SELECT * FROM studio_orgs WHERE owner=? ORDER BY rowid LIMIT 1',user.user_id);if(!org){const id=randomUUID();store.run('INSERT INTO studio_orgs VALUES (?,?,?)',id,'Kişisel çalışma alanı',user.user_id);org={id,name:'Kişisel çalışma alanı',owner:user.user_id};}return org;}
 function organization(user:any,id:string){const org=store.get('SELECT * FROM studio_orgs WHERE id=? AND owner=?',id,user.user_id);if(!org)fail(404,'Kurum bulunamadı veya işlem yetkiniz yok.');return org;}
 function access(user:any,id:string,permission?:string):any{
  const row=store.get('SELECT s.*,o.owner,m.permissions FROM studio_sites s JOIN studio_orgs o ON o.id=s.org_id LEFT JOIN studio_members m ON m.site_id=s.id AND m.user_id=? WHERE s.id=?',user.user_id,id);
  if(!row||row.owner!==user.user_id&&!row.permissions)fail(404,'Site bulunamadı veya erişiminiz yok.');
  row.allowed=row.owner===user.user_id?[...permissions]:parse(row.permissions);if(permission&&!row.allowed.includes(permission))fail(403,'Bu işlem için '+permission+' yetkisi gerekli.');return packed(row);
 }
 function summary(site:any){return{id:site.id,name:site.name,orgId:site.org_id,workspaceId:site.workspace_id,projectId:site.project_id,environment:site.environment,adapter:site.adapter,revision:site.revision,capabilities:{...registry.get(site.adapter).capabilities(site.source),operations:store.get('SELECT id FROM sites WHERE id=?',site.id)?{state:'partial',reason:'Rezervasyon, takvim ve sağlayıcı ayarları hazır. Canlı kullanım ayrıca etkinleştirilir.'}:{state:'unsupported',reason:'İş modülleri henüz kurulmadı.'}},permissions:site.allowed};}
 function getVersion(site:any,revision:number){const row=store.get('SELECT * FROM studio_versions WHERE site_id=? AND revision=?',site.id,revision);if(!row)fail(404,'Sürüm bulunamadı.');return row;}
 function recordVersion(site:any,user:any,note:string,actorType:string){const id=randomUUID();store.run('INSERT INTO studio_versions VALUES (?,?,?,?,?,?,?,?,?)',id,site.id,site.revision,encode(site.document),encode(site.source),user.user_id,actorType,note,now());return id;}
 function assertRevision(site:any,expected:unknown){if(!Number.isInteger(expected)||site.revision!==expected)fail(409,'Başka bir oturum kaynak sürümünü değiştirdi. Yerel düzenlemeleriniz korunuyor; farkları inceleyin.',{currentRevision:site.revision});}
 function authorizeImport(user:any,job:any){
  const current=store.get('SELECT * FROM studio_imports WHERE id=? AND owner=?',job.id,user.user_id);
  if(!current||!['queued','analyzing'].includes(current.status))fail(409,'Import artık çalıştırılamaz.');
  if(current.org_id!==job.org_id||current.site_id!==job.site_id)fail(403,'Import kapsamı değişmiş.');
  if(!job.site_id){organization(user,job.org_id);return null;}
  const site=access(user,job.site_id,'import');
  if(site.org_id!==job.org_id)fail(404,'Import kurumu uyuşmuyor.');
  assertRevision(site,job.expected);return site;
 }
 function revokeImports(siteId:string,userId:string){
  const jobs=store.all("SELECT id FROM studio_imports WHERE site_id=? AND owner=? AND status IN ('queued','analyzing','review')",siteId,userId);
  for(const job of jobs){
   store.run("UPDATE studio_imports SET status='failed',result=NULL,error='Import yetkisi kaldırıldı.' WHERE id=?",job.id);
   controllers.get(job.id)?.abort();
  }
 }
 function save(user:any,id:string,input:any,onSaved?:()=>void){
  const site=access(user,id,'content');assertRevision(site,input.revision);
  if(!['human','ai'].includes(input.actorType||'human'))fail(422,'Değişiklik kaynağı geçersiz.');
  const after=input.document as Document,adapter=registry.get(site.adapter),issues=adapter.validate(site.document,after,site.source);if(issues.length)fail(422,'Belgedeki alanları kontrol edin.',issues);
  const design=(doc:Document)=>encode({theme:doc.theme,pages:doc.pages.map(p=>({id:p.id,layout:p.layout,sections:p.sections.map(s=>({id:s.id,kind:s.kind,enabled:s.enabled,layout:s.layout}))}))});
  if(design(site.document)!==design(after)&&!site.allowed.includes('design'))fail(403,'Yerleşim değişikliği için design yetkisi gerekli.');
  if(encode(after)===encode(site.document)){if(onSaved)fail(422,'Öneri içerik değişikliği içermiyor.');return{...summary(site),document:site.document,changed:false};}
  const source=adapter.write(site.document,after,site.source);
  return store.transaction(()=>{const current=access(user,id,'content');assertRevision(current,input.revision);site.revision++;site.document=after;site.source=source;site.name=after.name;store.run('UPDATE studio_sites SET name=?,revision=?,document=?,source=? WHERE id=?',site.name,site.revision,encode(after),encode(source),id);recordVersion(site,user,String(input.note||'Editör kaydı').slice(0,200),input.actorType||'human');audit(site,user,'content.saved',site.revision,{},input.actorType||'human');onSaved?.();return{...summary(site),document:after,changed:true};});
 }
 const agentAccess=createAgentAccess({store,access,registry,save,audit});
 const moduleHost=new ModuleHost({store,modules,authorize:access,services:{'site.document.save':({actor,siteId}:any,input:any)=>save(actor,siteId,{...input,actorType:'human'})}});
 const regional=createRegionalSettings({store,access,audit});
 store.run('INSERT OR IGNORE INTO studio_migrations VALUES (2,?)',now());
 async function analyze(user:any,job:any,input:any){
  if(closed||store.get('SELECT status FROM studio_imports WHERE id=?',job.id)?.status!=='queued')return;
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),60_000);controllers.set(job.id,controller);
  const remote=async(url:string,options:any={})=>{
   authorizeImport(user,job);
   const response=await transport(url,{...options,signal:controller.signal});
   authorizeImport(user,job);return response;
  };
  try{
   authorizeImport(user,job);
   store.run("UPDATE studio_imports SET status='analyzing',progress=15 WHERE id=?",job.id);
   let source:Source,report:any={accepted:[],rejected:[],warnings:[],bytes:0},connection:any=null;
   if(input.kind==='example'){if(!['static','react-sdk','wordpress'].includes(input.example))fail(422,'Örnek adaptör geçersiz.');source=fixture(input.example);report.warnings.push('Yerel sözleşme örneği; gerçek sağlayıcı bağlantısı değildir.');}
   else if(input.kind==='zip'){
    if(typeof input.base64!=='string'||input.base64.length>Math.ceil(limits.compressed*4/3)+4||!/^[A-Za-z0-9+/]*={0,2}$/.test(input.base64))fail(422,'ZIP verisi geçersiz.');
    let files=readZip(Buffer.from(input.base64,'base64'));const paths=Object.keys(files),prefix=paths[0]?.split('/')[0]+'/';if(paths.length&&paths.every(p=>p.startsWith(prefix))){files=Object.fromEntries(Object.entries(files).map(([p,b])=>[p.slice(prefix.length),b]));report.warnings.push('Tek üst klasör kaldırıldı.');}
    const scanned=inspectFiles(files);source=scanned.source;report={...scanned.report,warnings:[...report.warnings,...scanned.report.warnings]};
   }else if(input.kind==='wordpress'){
    if(typeof input.url!=='string'||!/^https:\/\//.test(input.url)||typeof input.username!=='string'||typeof input.password!=='string'||input.username.length>100||input.password.length>200||!Number.isSafeInteger(input.pageId)||input.pageId<1)fail(422,'WordPress HTTPS adresi, kullanıcı, uygulama parolası ve sayfa kimliği gerekli.');
    const url=new URL(input.url);if(url.search||url.hash||url.username||url.password)fail(422,'WordPress kök adresi geçersiz.');
    const endpoint=input.url.replace(/\/$/,'')+'/wp-json/loft-studio/v1/pages/'+input.pageId;
    const response=await remote(endpoint,{headers:{Authorization:'Basic '+Buffer.from(input.username+':'+input.password).toString('base64')}});
    if(response.status!==200)fail(422,'WordPress Studio köprüsü veya erişim izni doğrulanamadı.');
    const page=parse(response.body.toString());if(typeof page.html!=='string'||typeof page.revision!=='string'||page.html.length>limits.text)fail(422,'WordPress köprüsü sözleşmesi uyuşmuyor.');
    const scan=inspectFiles({'index.html':Buffer.from(page.html)});source=scan.source;source.manifest.adapter.id='wordpress';source.manifest.publish.mode='conditional-api';source.manifest.connections=[{id:'cms',kind:'wordpress',authority:['content','design']}];report=scan.report;connection={kind:'wordpress',config:{endpoint,remoteRevision:page.revision},secrets:{username:input.username,password:input.password}};
   }else if(input.kind==='github'){
    if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(input.repository||'')||typeof input.ref!=='string'||!input.ref||input.ref.length>200||typeof input.token!=='string'||input.token.length>500)fail(422,'GitHub depo, dal ve erişim belirteci biçimi geçersiz.');
    const headers:Record<string,string>={Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',...(input.token?{Authorization:'Bearer '+input.token}:{})},base='https://api.github.com/repos/'+input.repository;
    const treeResult=await remote(base+'/git/trees/'+encodeURIComponent(input.ref)+'?recursive=1',{headers,maxBytes:2*1024*1024});if(treeResult.status!==200)fail(422,'GitHub kaynağı okunamadı.');const tree=parse(treeResult.body.toString());
    if(tree.truncated||!Array.isArray(tree.tree)||tree.tree.length>limits.count)fail(422,'GitHub ağacı fazla büyük; daraltılmış ZIP kullanın.');
    const sourceNames=new Set<string>();
    for(const item of tree.tree){if(!item||typeof item.path!=='string')fail(422,'GitHub kaynak yolu geçersiz.');claimSourcePath(item.path,sourceNames);}
    const files:Record<string,Buffer>=Object.create(null);let total=0,processed=0;for(const item of tree.tree){if(item.type==='tree')continue;if(item.type!=='blob'||item.mode==='120000'||item.mode==='160000'||!Number.isInteger(item.size)||item.size>limits.file)fail(422,'GitHub ağacında bağlantı veya sınır dışı dosya.');total+=item.size;if(total>limits.expanded)fail(422,'GitHub kaynak boyutu sınırı aşıldı.');if(controller.signal.aborted)fail(422,'Import süresi aşıldı veya iptal edildi.');if(store.get('SELECT status FROM studio_imports WHERE id=?',job.id)?.status==='cancelled')return;const response=await remote(base+'/git/blobs/'+item.sha,{headers,maxBytes:Math.ceil(limits.file*1.4)});if(response.status!==200)fail(422,'GitHub dosyası okunamadı.');const blob=parse(response.body.toString());if(blob.encoding!=='base64')fail(422,'GitHub blob kodlaması geçersiz.');files[item.path]=Buffer.from(blob.content,'base64');if(files[item.path].length!==item.size)fail(422,'GitHub dosya boyutu uyuşmuyor.');store.run('UPDATE studio_imports SET progress=? WHERE id=?',15+Math.floor(++processed/tree.tree.length*45),job.id);}
    const scan=inspectFiles(files);source=scan.source;report=scan.report;source.manifest.connections=[{id:'git',kind:'github',authority:['code','content','design']}];connection={kind:'github',config:{endpoint:base+'/git/trees/'+encodeURIComponent(input.ref),remoteRevision:tree.sha},secrets:{token:input.token}};report.warnings.push('GitHub anlık görüntüsü alındı. Geri yazma kapalı; sürümü ZIP ile dışa aktarın. Kaynak ref: '+tree.sha);
   }else fail(422,'Import kaynağı desteklenmiyor.');
   if(input.kind!=='wordpress')source!.manifest.publish.mode='export';
   if(input.name){if(!name(input.name))fail(422,'Site adı 1–120 karakter olmalı.');source!.manifest.name=input.name.trim();}
   store.run('UPDATE studio_imports SET progress=65 WHERE id=?',job.id);const result=discover(source!,registry);
   report.warnings.push(...result.warnings);report.accepted=Object.keys(result.source.files);const previous=authorizeImport(user,job);
   const paths=new Set([...Object.keys(previous?.source.files||{}),...Object.keys(result.source.files)]);
   const changes=[...paths].map(p=>({path:p,action:!previous?.source.files[p]?'added':!result.source.files[p]?'removed':digest(previous.source.files[p])!==digest(result.source.files[p])?'changed':'unchanged'}));
   if(previous&&previous.adapter!==result.source.manifest.adapter.id)fail(422,'Yeniden import adaptör türünü değiştiremez.');
   if(store.get('SELECT status FROM studio_imports WHERE id=?',job.id)?.status==='cancelled')return;
   const sealed=connection?await seal(connection.secrets,job.org_id,connection.kind):null;
   authorizeImport(user,job);
   store.run("UPDATE studio_imports SET status='review',progress=100,result=? WHERE id=?",encode({...result,report,changes,connection:connection?{...connection,secrets:undefined,sealed}:null}),job.id);
  }catch(error:any){if(['queued','analyzing'].includes(store.get('SELECT status FROM studio_imports WHERE id=?',job.id)?.status))store.run("UPDATE studio_imports SET status='failed',result=NULL,error=? WHERE id=?",error.status?error.message:'Import tamamlanamadı; dosya biçimini kontrol edin.',job.id);}finally{clearTimeout(timeout);controllers.delete(job.id);}
 }
 async function route({req,res,url,method,user,body,json}:{req:any;res:any;url:URL;method:string;user:any;body:any;json:any}):Promise<boolean>{
  if(!url.pathname.startsWith('/api/v2/'))return false;
  const route=url.pathname.slice(8),send=(data:unknown,status=200)=>{json(res,status,data);return true;};
  if(route==='workspace'&&method==='GET'){
   personal(user);const sites=store.all('SELECT DISTINCT s.id FROM studio_sites s JOIN studio_orgs o ON o.id=s.org_id LEFT JOIN studio_members m ON m.site_id=s.id WHERE o.owner=? OR m.user_id=?',user.user_id,user.user_id).map((r:any)=>summary(access(user,r.id)));
   const legacy=store.get("SELECT role FROM memberships WHERE user_id=? AND site_id='loft'",user.user_id);
   return send({organizations:store.all('SELECT id,name FROM studio_orgs WHERE owner=?',user.user_id),sites,adapters:registry.list(),legacy:legacy?{id:'loft',name:legacyAdapter.metadata().name||'Loft',role:legacy.role,url:'/',capabilities:{content:'supported',layout:'supported',bridge:'legacy-console'}}:null,mode:'local-preview',limits});
  }
  if(route==='organizations'&&method==='POST'){const input=await body(req);if(!name(input.name))fail(422,'Kurum adı gerekli (en çok 120 karakter).');if(store.get('SELECT COUNT(*) n FROM studio_orgs WHERE owner=?',user.user_id).n>=10)fail(422,'Yerel sürümde en çok 10 kurum.');const id=randomUUID();store.run('INSERT INTO studio_orgs VALUES (?,?,?)',id,input.name.trim(),user.user_id);return send({id,name:input.name},201);}
  if(route==='imports'&&method==='POST'){
   const input=await body(req,12*1024*1024),org=input.siteId?{id:access(user,input.siteId,'import').org_id}:organization(user,input.orgId||personal(user).id);
   if(!uuid(input.requestId))fail(422,'Benzersiz istek kimliği gerekli.');
   const fingerprint=digest(encode(input)),existing=store.get('SELECT * FROM studio_imports WHERE owner=? AND request_key=?',user.user_id,input.requestId);
   if(existing){if(existing.fingerprint!==fingerprint)fail(409,'İstek kimliği başka içerik için kullanılmış.');return send({id:existing.id,status:existing.status});}
   if(input.siteId){const site=access(user,input.siteId,'import');if(site.org_id!==org.id)fail(404,'Site kurumu uyuşmuyor.');assertRevision(site,input.revision);}
   if(store.get("SELECT COUNT(*) n FROM studio_imports WHERE owner=? AND status IN ('queued','analyzing','review')",user.user_id).n>=5)fail(429,'En fazla beş açık import olabilir.');
   const id=randomUUID();store.run('INSERT INTO studio_imports VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',id,user.user_id,org.id,input.siteId||null,input.revision??null,'queued',0,null,null,now(),input.requestId,fingerprint);
   const job=store.get('SELECT * FROM studio_imports WHERE id=?',id);pending.push(()=>analyze(user,job,input));pump();return send({id,status:'queued'},202);
  }
  const importMatch=route.match(/^imports\/([a-f0-9-]{36})(?:\/(commit|cancel))?$/);
  if(importMatch){
   const job=store.get('SELECT * FROM studio_imports WHERE id=? AND owner=?',importMatch[1],user.user_id);if(!job)fail(404,'Import bulunamadı.');if(job.site_id)access(user,job.site_id,'import');else organization(user,job.org_id);
   if(method==='GET'){const result=job.result?parse(job.result):null;return send({id:job.id,status:job.status,progress:job.progress,error:job.error,siteId:job.site_id,report:result?.report,changes:result?.changes,document:result?.document,capabilities:result?registry.get(result.source.manifest.adapter.id).capabilities(result.source):null});}
   if(method==='POST'&&importMatch[2]==='cancel'){if(job.status==='committed')fail(409,'Tamamlanmış import iptal edilemez; içerik sürümünü geri yükleyin.');store.run("UPDATE studio_imports SET status='cancelled',result=NULL WHERE id=?",job.id);controllers.get(job.id)?.abort();return send({ok:true});}
   if(method==='POST'&&importMatch[2]==='commit'){
    const input=await body(req);
    const committed=store.transaction(()=>{
     // Re-read state and ownership inside the write transaction after body I/O.
     const job=store.get('SELECT * FROM studio_imports WHERE id=? AND owner=?',importMatch[1],user.user_id);
     if(!job)fail(404,'Import bulunamadı.');
     if(job.site_id)access(user,job.site_id,'import');else organization(user,job.org_id);
     if(job.status==='committed')return{data:{siteId:job.site_id},status:200};
     if(job.status!=='review')fail(409,'Import incelemeye hazır değil.');
     const result=parse(job.result);
     if(input.acceptRejected!==true&&result.report.rejected.length)fail(422,'Reddedilen dosyaları inceleyip dışlamayı onaylayın.');
     let site:any;if(job.site_id){site=access(user,job.site_id,'import');assertRevision(site,job.expected);if(!site.allowed.includes('content')||!site.allowed.includes('design'))fail(403,'Yeniden import içerik ve tasarım yetkisi gerektirir.');site.document=result.document;site.source=result.source;site.revision++;store.run('UPDATE studio_sites SET revision=?,document=?,source=?,name=? WHERE id=?',site.revision,encode(site.document),encode(site.source),site.document.name,site.id);}
     else{if(store.get('SELECT COUNT(*) n FROM studio_sites WHERE org_id=?',job.org_id).n>=20)fail(422,'Yerel sürümde kurum başına en çok 20 site.');const workspace=randomUUID(),project=randomUUID();store.run('INSERT INTO studio_workspaces VALUES (?,?,?)',workspace,job.org_id,result.document.name);store.run('INSERT INTO studio_projects VALUES (?,?,?)',project,workspace,result.document.name);site={id:randomUUID(),org_id:job.org_id,workspace_id:workspace,project_id:project,environment:'development',adapter:result.source.manifest.adapter.id,name:result.document.name,revision:0,document:result.document,source:result.source};store.run('INSERT INTO studio_sites VALUES (?,?,?,?,?,?,?,?,?,?,?)',site.id,site.org_id,workspace,project,site.environment,site.adapter,site.name,0,encode(site.document),encode(site.source),now());}
     if(result.connection)store.run('INSERT INTO studio_connections VALUES (?,?,?,?,0) ON CONFLICT(site_id) DO UPDATE SET kind=excluded.kind,config=excluded.config,sealed=excluded.sealed,revision=studio_connections.revision+1',site.id,result.connection.kind,encode(result.connection.config),result.connection.sealed);
     else if(job.site_id)store.run('DELETE FROM studio_connections WHERE site_id=?',site.id);
     recordVersion(site,user,'Import tamamlandı','human');audit(site,user,'import.committed',site.revision,{jobId:job.id});store.run("UPDATE studio_imports SET status='committed',site_id=?,result=NULL WHERE id=?",site.id,job.id);return{data:{siteId:site.id},status:201};
    });
    return send(committed.data,committed.status);
   }
  }
  const match=route.match(/^sites\/([a-f0-9-]{36})(?:\/(.*))?$/);
  if(match){
   const [,id,action='']=match,site=access(user,id),adapter=registry.get(site.adapter);
   if(action==='extensions'&&method==='GET')return send({packages:moduleHost.catalog(user,id)});
   const extension=action.match(/^extensions\/([a-z][a-z0-9.-]+)\/(install|enable|disable|uninstall|upgrade|export|collections\/[a-zA-Z][a-zA-Z0-9_-]*|commands\/[a-zA-Z][a-zA-Z0-9_-]*)$/);
   if(extension){
    const [,moduleId,operation]=extension;
    if(operation==='export'&&method==='GET')return send(moduleHost.export(user,id,moduleId));
    if(operation.startsWith('collections/')){
     const input=method==='GET'?{...(url.searchParams.has('id')?{id:url.searchParams.get('id')}:{limit:Number(url.searchParams.get('limit')||100),offset:Number(url.searchParams.get('offset')||0),search:url.searchParams.get('search')||''})}:await body(req);
     return send(moduleHost.collection(user,id,moduleId,operation.slice(12),method,input));
    }
    if(operation.startsWith('commands/')&&method==='POST')return send(await moduleHost.execute(user,id,moduleId,operation.slice(9),await body(req)));
    if(['install','enable','disable','uninstall','upgrade'].includes(operation)&&method==='POST'){const input=await body(req);return send(moduleHost.lifecycle(user,id,moduleId,operation,input.revision));}
    fail(405,'Modül yöntemi desteklenmiyor.');
   }
   if(action==='regional'||action==='regional-options'){
    if(await regional.route({req,user,siteId:id,action,method,url,body,send}))return true;
   }
   if(action==='agent-tokens'||action.startsWith('ai-proposals')){
    if(await agentAccess.humanRoute({req,url,method,user,siteId:id,action,body,send}))return true;
   }
   if(action==='modules'&&method==='GET'){if(!site.allowed.includes('operations')&&!site.allowed.includes('integrations'))fail(403,'İş modülü yetkisi gerekli.');return send({enabled:!!store.get('SELECT id FROM sites WHERE id=?',id),views:['bookings','calendar','bookingSettings','connect']});}
   if(action==='modules/enable'&&method==='POST'){
    access(user,id,'operations');access(user,id,'integrations');
    if(!features)fail(503,'İş modülü bulunamadı.');
    if(!store.get('SELECT id FROM sites WHERE id=?',id)){features.enableSite(site);audit(site,user,'modules.enabled',site.revision);}return send({enabled:true});
   }
   if(action.startsWith('modules/')){
    const tail=action.slice(8),required=/^(integrations|payments)|\/checkout$/.test(tail)?'integrations':'operations';
    access(user,id,required);if(!features||!store.get('SELECT id FROM sites WHERE id=?',id))fail(422,'Önce iş modüllerini kurun.');
    return await features.adminRoute({req,res,siteId:id,tail,method,body,user,authorize:()=>access(user,id,required)});
   }
   if(action===''&&method==='GET')return send({...summary(site),document:site.document,manifest:site.source.manifest,media:Object.entries(site.source.assets).map(([path,a]:any)=>({path,...a})),sourceFiles:Object.keys(site.source.files),sourceHash:digest(encode(site.source.files))});
   if(action==='document'&&method==='PUT')return send(save(user,id,await body(req)));
   if(action==='validate'&&method==='POST'){const input=await body(req);access(user,id,'content');return send({issues:adapter.validate(site.document,input.document,site.source)});}
   if(action==='preview'&&method==='GET'){assertSnapshot(adapter,site.document,site.source);return send({html:adapter.preview(site.document,site.source,url.searchParams.get('page')||site.document.pages[0].id),revision:site.revision});}
   if(action==='preview'&&method==='POST'){access(user,id,'content');const input=await body(req),issues=adapter.validate(site.document,input.document,site.source);if(issues.length)fail(422,'Önizleme doğrulanamadı.',issues);const source=adapter.write(site.document,input.document,site.source);return send({html:adapter.preview(input.document,source,input.page),revision:site.revision});}
   if(action==='source'&&method==='GET'){const file=url.searchParams.get('path')||'';if(!Object.hasOwn(site.source.files,file))fail(404,'Kaynak bulunamadı.');return send({path:file,text:site.source.files[file],readOnly:true});}
   if(action==='connection/check'&&method==='GET'){
    access(user,id,'import');const conn=store.get('SELECT * FROM studio_connections WHERE site_id=?',id);if(!conn)return send({status:'snapshot',message:'Dosya anlık görüntüsü bağlı. Dış değişiklikleri karşılaştırmak için yeniden import edin.'});
    const config=parse(conn.config),secret=await unseal(conn.sealed,site.org_id,conn.kind),headers:Record<string,string>=conn.kind==='wordpress'?{Authorization:'Basic '+Buffer.from(secret.username+':'+secret.password).toString('base64')}:{Accept:'application/vnd.github+json',...(secret.token?{Authorization:'Bearer '+secret.token}:{})};
    access(user,id,'import');
    const response=await transport(config.endpoint,{headers});if(response.status!==200)fail(502,'Kaynak sürümü okunamadı.');const result=parse(response.body.toString()),revision=conn.kind==='wordpress'?result.revision:result.sha;if(typeof revision!=='string')fail(502,'Kaynak sürüm yanıtı geçersiz.');return send({status:revision===config.remoteRevision?'current':'changed',message:revision===config.remoteRevision?'Kaynak bağlantısından bu yana değişiklik yok.':'Kaynak dışarıda değişmiş. Yeniden import raporuyla karşılaştırın.',importedRevision:config.remoteRevision,remoteRevision:revision});
   }
   if(action==='history'&&method==='GET')return send({versions:store.all('SELECT id,revision,actor,actor_type,note,created FROM studio_versions WHERE site_id=? ORDER BY revision DESC LIMIT 100',id),releases:store.all('SELECT id,version_id,created FROM studio_releases WHERE site_id=? ORDER BY created DESC LIMIT 100',id)});
   if(action==='audit'&&method==='GET'){access(user,id,'members');return send({events:store.all('SELECT actor,actor_type,action,revision,created,detail FROM studio_audit WHERE site_id=? ORDER BY created DESC LIMIT 100',id)});}
   if(action==='diff'&&method==='GET'){const revision=Number(url.searchParams.get('revision'));if(!Number.isInteger(revision))fail(422,'Sürüm gerekli.');const v=getVersion(site,revision);return send({before:parse(v.document),after:site.document,revision});}
   if(action==='restore'&&method==='POST'){
    access(user,id,'publish');access(user,id,'design');access(user,id,'content');const input=await body(req);
    return send(store.transaction(()=>{
     const current=access(user,id,'content');access(user,id,'design');access(user,id,'publish');assertRevision(current,input.revision);
     const version=getVersion(current,input.target),document=parse(version.document),source=parse(version.source);
     assertRestorable(adapter,current.document,document,source);
     current.document=document;current.source=source;current.revision++;
     store.run('UPDATE studio_sites SET revision=?,document=?,source=?,name=? WHERE id=?',current.revision,version.document,version.source,document.name,id);
     recordVersion(current,user,'İçerik sürümü geri yüklendi: '+input.target,'human');audit(current,user,'content.restored',current.revision,{target:input.target});return{revision:current.revision};
    }));
   }
   if(action==='releases'&&method==='POST'){
    access(user,id,'publish');const input=await body(req),current=access(user,id,'publish');assertRevision(current,input.revision);
    const version=getVersion(current,current.revision);assertSnapshot(adapter,parse(version.document),parse(version.source));
    const release=randomUUID();store.run('INSERT INTO studio_releases VALUES (?,?,?,?,?)',release,id,version.id,user.user_id,now());audit(current,user,'release.created',current.revision,{release});return send({id:release,url:'/api/v2/sites/'+id+'/releases/'+release+'/download'},201);
   }
   const download=action.match(/^releases\/([a-f0-9-]{36})\/download$/);
   if(download&&method==='GET'){access(user,id,'publish');const release=store.get('SELECT v.* FROM studio_releases r JOIN studio_versions v ON v.id=r.version_id WHERE r.id=? AND r.site_id=?',download[1],id);if(!release)fail(404,'Yayın paketi bulunamadı.');const source=parse(release.source),doc=parse(release.document);assertSnapshot(adapter,doc,source);const files=adapter.export(doc,source);const bytes=zipSync({...Object.fromEntries(Object.entries(files).map(([p,t])=>[p,strToU8(t)])),...Object.fromEntries(Object.entries(source.assets).map(([p,a]:any)=>[p,Buffer.from(a.base64,'base64')]))},{level:6});res.writeHead(200,{'Content-Type':'application/zip','Content-Disposition':'attachment; filename="studio-release-'+release.revision+'.zip"'});res.end(bytes);return true;}
   if(action==='media'&&method==='POST'){access(user,id,'content');const input=await body(req,6*1024*1024);if(typeof input.base64!=='string'||input.base64.length>6*1024*1024||typeof input.name!=='string')fail(422,'Görsel verisi geçersiz.');const {key,asset}=mediaAsset(Buffer.from(input.base64,'base64'),input.name,input.mime);return send(store.transaction(()=>{const current=access(user,id,'content');assertRevision(current,input.revision);if(Object.keys(current.source.assets).length>=200&&!current.source.assets[key])fail(422,'En çok 200 medya dosyası.');if(Object.values(current.source.assets).reduce((n:number,a:any)=>n+a.size,0)+asset.size>64*1024*1024)fail(422,'Site medya kotası doldu.');current.source.assets[key]=asset;current.revision++;store.run('UPDATE studio_sites SET revision=?,source=? WHERE id=?',current.revision,encode(current.source),id);recordVersion(current,user,'Medya eklendi','human');audit(current,user,'media.added',current.revision,{size:asset.size});return{path:key,revision:current.revision};}),201);}
   if(action==='members'&&method==='GET'){access(user,id,'members');return send({members:store.all('SELECT u.email,m.user_id,m.permissions FROM studio_members m JOIN users u ON u.id=m.user_id WHERE m.site_id=?',id).map((r:any)=>({...r,permissions:parse(r.permissions)})),available:permissions});}
   if(action==='members'&&method==='PUT'){
    access(user,id,'members');const input=await body(req);access(user,id,'members');
    if(!Array.isArray(input.permissions)||input.permissions.some((p:string)=>!permissions.includes(p as any))||new Set(input.permissions).size!==input.permissions.length||typeof input.email!=='string')fail(422,'Üye veya izin listesi geçersiz.');
    const target=store.get('SELECT id FROM users WHERE email=?',input.email.trim().toLowerCase());if(!target)fail(422,'Kullanıcı önce Studio üzerinde oluşturulmalı.');if(target.id===site.owner)fail(422,'Kurum sahibinin izinleri buradan değiştirilemez.');
    store.run('INSERT INTO studio_members VALUES (?,?,?) ON CONFLICT(site_id,user_id) DO UPDATE SET permissions=excluded.permissions',id,target.id,encode(input.permissions));
    if(!input.permissions.includes('import'))revokeImports(id,target.id);
    audit(site,user,'member.permissions',site.revision,{userId:target.id,permissions:input.permissions});return send({ok:true});
   }
   if(action==='members'&&method==='DELETE'){
    access(user,id,'members');const input=await body(req);access(user,id,'members');
    if(typeof input.userId!=='string')fail(422,'Üye kimliği gerekli.');
    if(input.userId===site.owner)fail(422,'Kurum sahibinin izinleri buradan değiştirilemez.');
    store.run('DELETE FROM studio_members WHERE site_id=? AND user_id=?',id,input.userId);revokeImports(id,input.userId);
    audit(site,user,'member.removed',site.revision);return send({ok:true});
   }
   if(action==='publish'&&method==='POST'){
    access(user,id,'publish');const input=await body(req),current=access(user,id,'publish');assertRevision(current,input.revision);assertSnapshot(adapter,current.document,current.source);const conn=store.get('SELECT * FROM studio_connections WHERE site_id=?',id);
    if(!conn||!adapter.publish)fail(422,'Canlı yayın adaptörü yapılandırılmamış.');const config=parse(conn.config);
    const secrets=await unseal(conn.sealed,current.org_id,conn.kind);access(user,id,'publish');assertRevision(access(user,id),input.revision);
    const result=await adapter.publish!(current.document,current.source,{kind:conn.kind,config,secrets,request:transport});
    store.run('UPDATE studio_connections SET config=?,revision=revision+1 WHERE site_id=?',encode({...config,remoteRevision:result.remoteRevision}),id);audit(current,user,'provider.published',current.revision);return send({ok:true,revision:current.revision,...result});
   }
  }
  fail(404,'Studio V2 işlemi bulunamadı.');return true;
 }
 return{route,registry,save,access,agentRoute:agentAccess.agentRoute,async close(){closed=true;pending.length=0;for(const c of controllers.values())c.abort();await Promise.allSettled(running);}};
}
