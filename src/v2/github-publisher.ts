import {createHash} from 'node:crypto';
import {safeRequest} from './network.ts';
import {claimSourcePath,limits} from './import.ts';
import {isRuntimeSecretName} from '../security/runtime-files.mjs';
import {fail} from '../util.mjs';

export interface GitHubTarget {repository:string;branch:string;expectedCommit:string}
export interface GitHubPublication extends GitHubTarget {commit:string;tree:string;changedPaths:string[]}
type Transport=typeof safeRequest;
const sha=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{40}$/.test(v);
const blobSha=(bytes:Buffer)=>createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex');
const protectedPath=(p:string)=>p.split('/').some(part=>/^\.(git|github|svn|aws|ssh)$/i.test(part)||/^node_modules$/i.test(part)||isRuntimeSecretName(part))||/(^|\/)(?:\.env(?:\..*)?|\.npmrc|credentials[^/]*|id_rsa|id_ed25519)(\/|$)|\.(pem|key|p12|pfx|sqlite|db|bak|sql|dump|log)$/i.test(p);
function target(input:GitHubTarget){
 if(!input||!/^[-A-Za-z0-9_]+\/[A-Za-z0-9_.-]+$/.test(input.repository)||input.repository.split('/').some(p=>p==='.'||p==='..')||!sha(input.expectedCommit))fail(422,'GitHub hedefi veya beklenen commit geçersiz.');
 const b=input.branch;
 if(typeof b!=='string'||!b||b.length>200||b==='@'||/[\x00-\x20\x7f~^:?*\[\\]/.test(b)||b.includes('..')||b.includes('@{')||b.endsWith('.')||b.split('/').some(p=>!p||p.startsWith('.')||p.endsWith('.lock')))fail(422,'GitHub dal adı geçersiz.');
 return{...input};
}
function client(input:GitHubTarget,token:string,request:Transport){
 const t=target(input);if(typeof token!=='string'||!token||token.length>500||/[\r\n]/.test(token))fail(422,'Yayın için GitHub erişim belirteci gerekli.');
 const base='https://api.github.com/repos/'+t.repository,ref=t.branch.split('/').map(encodeURIComponent).join('/');
 const call=async(path:string,method='GET',body?:unknown)=>{
  let response;try{response=await request(base+path,{method,headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',Authorization:'Bearer '+token},...(body===undefined?{}:{body:JSON.stringify(body)})});}catch{fail(502,'GitHub yanıtı alınamadı. Dal değiştirme sonucunu yeniden göndermeden önce kontrol edin.');}
  if([401,403,404].includes(response!.status))fail(422,'GitHub deposu veya yazma izni doğrulanamadı.');
  if([409,422].includes(response!.status))fail(409,'GitHub dalı değişmiş, korunuyor veya isteği kabul etmiyor. Kaynağı kontrol edin.');
  if(response!.status<200||response!.status>=300)fail(502,'GitHub işlemi tamamlanamadı.');
  let data:any;try{data=JSON.parse(response!.body.toString('utf8'));}catch{fail(502,'GitHub yanıt biçimi geçersiz.');}return data;
 };
 const head=async()=>{const data=await call('/git/ref/heads/'+ref);if(data.ref!=='refs/heads/'+t.branch||data.object?.type!=='commit'||!sha(data.object.sha))fail(502,'GitHub dal yanıtı uyuşmuyor.');return data.object.sha as string;};
 return{t,ref,call,head};
}

/** Upgrade a legacy tree-only import to a branch-bound expected commit.
 * A tag or raw SHA cannot resolve through the exact heads endpoint.
 */
export async function resolveGitHubTarget(config:{endpoint:string;remoteRevision:string},token:string,{request=safeRequest}:{request?:Transport}={}):Promise<GitHubTarget>{
 const match=/^https:\/\/api\.github\.com\/repos\/([-A-Za-z0-9_]+\/[A-Za-z0-9_.-]+)\/git\/trees\/([^?#]+)$/.exec(config.endpoint||'');
 if(!match||!sha(config.remoteRevision))fail(422,'GitHub dal bağlantısı gerekli; kaynağı yeniden import edin.');
 let branch:string;try{branch=decodeURIComponent(match![2]);}catch{fail(422,'GitHub dal bağlantısı geçersiz.');}
 const input={repository:match![1],branch:branch!,expectedCommit:config.remoteRevision};const c=client(input,token,request),head=await c.head(),commit=await c.call('/git/commits/'+head);
 if(commit.sha!==head||commit.tree?.sha!==config.remoteRevision)fail(409,'GitHub kaynağı import sonrasında değişmiş; yeniden import ve karşılaştırma gerekli.');
 return{...input,expectedCommit:head};
}

/** Creates immutable Git objects only. Persist the result before advancing a branch.
 * files is an explicit overlay: omitted paths are preserved, never implicitly deleted.
 * .github workflows and credential/runtime paths cannot be written through this port.
 */
export async function prepareGitHubPublication(input:GitHubTarget,files:Record<string,Buffer>,token:string,{request=safeRequest,authorize=async()=>{}}:{request?:Transport;authorize?:()=>Promise<void>}={}):Promise<GitHubPublication>{
 const {t,call,head}=client(input,token,request),names=new Set<string>(),entries=Object.entries(files||{});let total=0;
 if(!entries.length||entries.length>limits.count)fail(422,'Yayın dosya sayısı sınır dışında.');
 // Validate the complete input before making any remote request.
 for(const [p,bytes]of entries){claimSourcePath(p,names);if(protectedPath(p)||!Buffer.isBuffer(bytes))fail(422,'Yayın yolu veya dosya türü desteklenmiyor.');total+=bytes.length;if(bytes.length>limits.file||total>limits.expanded)fail(422,'Yayın boyutu sınır dışında.');}
 await authorize();if(await head()!==t.expectedCommit)fail(409,'Uzak dal değişmiş; önce yeniden import ve karşılaştırma yapın.');
 const commit=await call('/git/commits/'+t.expectedCommit);if(commit.sha!==t.expectedCommit||!sha(commit.tree?.sha))fail(502,'GitHub commit ağacı doğrulanamadı.');
 const baseTree=commit.tree.sha,tree=await call('/git/trees/'+baseTree+'?recursive=1');
 if(tree.sha!==baseTree||tree.truncated||!Array.isArray(tree.tree)||tree.tree.length>limits.count)fail(422,'GitHub ağacı tam veya sınırlar içinde değil.');
 const existing=new Map<string,any>(),remoteNames=new Set<string>();
 for(const item of tree.tree){claimSourcePath(item.path,remoteNames);if(!sha(item.sha)||!['blob','tree','commit'].includes(item.type))fail(502,'GitHub ağaç kaydı geçersiz.');existing.set(item.path,item);}
 const changed:{path:string;mode:string;type:'blob';sha:string}[]=[];
 for(const [p,bytes]of entries){const old=existing.get(p);if(old&&(old.type!=='blob'||!['100644','100755'].includes(old.mode)))fail(422,'Bağlantı, alt modül veya dizin üzerine yayın yapılamaz.');
  const identity=p.normalize('NFC').toLowerCase();if(!old&&remoteNames.has(identity))fail(422,'Uzak dosya adı Unicode veya harf boyutu bakımından çakışıyor.');
  const parts=p.split('/');for(let i=1;i<parts.length;i++){const ancestor=existing.get(parts.slice(0,i).join('/'));if(ancestor&&ancestor.type!=='tree')fail(422,'Yayın üst yolu bir dizin değil.');}
  const digest=blobSha(bytes);if(old?.sha===digest)continue;
  await authorize();const blob=await call('/git/blobs','POST',{content:bytes.toString('base64'),encoding:'base64'});if(blob.sha!==digest)fail(502,'GitHub dosya özeti uyuşmuyor.');
  changed.push({path:p,mode:old?.mode||'100644',type:'blob',sha:digest});
 }
 if(!changed.length)return{...t,commit:t.expectedCommit,tree:baseTree,changedPaths:[]};
 await authorize();const createdTree=await call('/git/trees','POST',{base_tree:baseTree,tree:changed});if(!sha(createdTree.sha))fail(502,'GitHub yeni ağaç yanıtı geçersiz.');
 await authorize();const created=await call('/git/commits','POST',{message:'Studio: publish reviewed site snapshot',tree:createdTree.sha,parents:[t.expectedCommit]});if(!sha(created.sha))fail(502,'GitHub yeni commit yanıtı geçersiz.');
 return{...t,commit:created.sha,tree:createdTree.sha,changedPaths:changed.map(e=>e.path)};
}

/** Safe to retry with the SAME persisted publication. Never force-pushes. */
export async function finalizeGitHubPublication(publication:GitHubPublication,token:string,{request=safeRequest,authorize=async()=>{}}:{request?:Transport;authorize?:()=>Promise<void>}={}){
 const {t,ref,call,head}=client(publication,token,request);if(!sha(publication.commit)||!sha(publication.tree))fail(422,'Kalıcı yayın kaydı geçersiz.');
 await authorize();let current=await head();if(current===publication.commit)return{remoteRevision:current,status:'published' as const};
 if(current!==t.expectedCommit)fail(409,'Uzak dal değişmiş; yayın durduruldu.');
 const candidate=await call('/git/commits/'+publication.commit);
 if(candidate.sha!==publication.commit||candidate.tree?.sha!==publication.tree||candidate.parents?.length!==1||candidate.parents[0].sha!==t.expectedCommit)fail(409,'Yayın commit kaydı beklenen kaynağa bağlı değil.');
 await authorize();if(await head()!==t.expectedCommit)fail(409,'Yayın sırasında uzak dal değişti.');
 // A concurrent divergent commit is rejected by GitHub's fast-forward check.
 // Ambiguous network failures propagate: caller reconciles this persisted commit.
 await call('/git/refs/heads/'+ref,'PATCH',{sha:publication.commit,force:false});
 current=await head();if(current!==publication.commit)fail(409,'Dal yayından sonra değişti; uzak durum incelenmeli.');
 return{remoteRevision:current,status:'published' as const};
}
