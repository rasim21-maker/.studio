import {randomUUID,createHash} from 'node:crypto';
import {zipSync} from 'fflate';
import {safeRequest} from './network.ts';
import {claimSourcePath,limits} from './import.ts';
import {isRuntimeSecretName} from '../security/runtime-files.mjs';
import {fail} from '../util.mjs';

export type DeploymentState='pending'|'ready'|'failed'|'review';
export interface DeploymentResult {id:string;state:DeploymentState;url?:string;artifactHash?:string}
export interface StaticArtifact {zip:Buffer;sha256:string}
export interface GitRelease {repository:string;branch:string;commit:string}
export interface HostingProvider {
 id:string;name:string;mode:'static-artifact'|'git-branch';
 validate(config:any):Record<string,string>;
 verify(config:any,token:string,request?:typeof safeRequest):Promise<void>;
 submit(config:any,token:string,input:{artifact?:StaticArtifact;git?:GitRelease;requestId?:string;authorize?:()=>Promise<void>},request?:typeof safeRequest):Promise<DeploymentResult>;
 status(config:any,token:string,id:string,git?:GitRelease,request?:typeof safeRequest):Promise<DeploymentResult>;
}
const uuid=(v:any)=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
const netlifyId=(v:any)=>typeof v==='string'&&/^[a-f0-9]{24}$/i.test(v);
const ref=(v:any)=>typeof v==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9/_.-]{0,199}$/.test(v)&&!v.includes('..')&&!v.includes('//')&&!v.endsWith('/')&&!v.endsWith('.lock');
const hash=(v:any)=>typeof v==='string'&&/^[a-f0-9]{40}$/.test(v);
function secret(token:string){if(typeof token!=='string'||token.length<1||token.length>2000||/[\r\n]/.test(token))fail(422,'Sağlayıcı erişim belirteci geçersiz.');}
function url(value:any,suffix:string){if(typeof value!=='string')return undefined;try{const u=new URL(value);if(u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.search&&!u.hash&&u.hostname.endsWith('.'+suffix))return u.href;}catch{}return undefined;}
async function call(endpoint:string,token:string,request:typeof safeRequest,options:{method?:string;headers?:Record<string,string>;body?:string|Buffer}={}){
 secret(token);let response;try{response=await request(endpoint,{...options,headers:{Authorization:'Bearer '+token,...options.headers}});}catch{fail(502,'Dağıtım sağlayıcısı yanıtı alınamadı. Gönderim sonucu belirsiz olabilir; otomatik tekrar yapılmadı.');}
 if(response!.status<200||response!.status>=300)fail(response!.status===429?429:502,'Dağıtım sağlayıcısı işlemi kabul etmedi. Hesap, proje ve izinleri kontrol edin.');
 try{return JSON.parse(response!.body.toString('utf8'));}catch{fail(502,'Dağıtım sağlayıcısı yanıtı geçersiz.');}
}
export function staticArtifact(files:Record<string,Buffer>):StaticArtifact{
 const names=new Set<string>(),entries=Object.entries(files);let bytes=0;if(!entries.length||entries.length>limits.count||!Object.hasOwn(files,'index.html'))fail(422,'Statik dağıtım index.html ve sınırlar içinde dosya listesi gerektirir.');
 for(const [p,b]of entries){claimSourcePath(p,names);if(!Buffer.isBuffer(b)||p.split('/').some(x=>isRuntimeSecretName(x)||/^\.(git|github|ssh|aws)$|^node_modules$/i.test(x))||/\.(?:pem|key|pfx|p12|sqlite|db|sql|dump|log|php|ts|tsx)$/i.test(p)||/(^|\/)(package(?:-lock)?\.json|\.npmrc|id_rsa|id_ed25519)$/i.test(p))fail(422,'Kaynak veya gizli dosyalar statik çıktı olarak dağıtılamaz. Önce doğrulanmış derleme çıktısı gerekir.');bytes+=b.length;if(b.length>limits.file||bytes>limits.expanded)fail(422,'Dağıtım dosya boyutu sınırı aşıldı.');}
 const zip=Buffer.from(zipSync(files,{level:6}));if(zip.length>limits.compressed)fail(422,'Dağıtım arşivi boyut sınırını aştı.');return{zip,sha256:createHash('sha256').update(zip).digest('hex')};
}
function netlifyConfig(c:any){if(!c||Object.keys(c).some(k=>k!=='siteId')||!uuid(c.siteId))fail(422,'Netlify proje kimliği UUID olmalı.');return{siteId:c.siteId};}
function netlifyResult(data:any,siteId:string,id?:string):DeploymentResult{
 if(!netlifyId(data.id)||data.site_id!==siteId||id&&data.id!==id)fail(502,'Netlify yanıtı hedef proje/dağıtımla uyuşmuyor.');
 const state=data.state==='ready'?'ready':['error','rejected'].includes(data.state)?'failed':['new','pending_review','accepted','enqueued','building','uploading','uploaded','preparing','prepared','processing','processed','retrying'].includes(data.state)?'pending':'review';
 const link=url(data.deploy_ssl_url,'netlify.app');return{id:data.id,state:state==='ready'&&!link?'review':state,...(link?{url:link}:{})};
}
export const netlify:HostingProvider={id:'netlify',name:'Netlify',mode:'static-artifact',validate:netlifyConfig,
 async verify(c,token,request=safeRequest){c=netlifyConfig(c);const d=await call('https://api.netlify.com/api/v1/sites/'+c.siteId,token,request);if(d.id!==c.siteId)fail(502,'Netlify proje kimliği doğrulanamadı.');},
 async submit(c,token,input,request=safeRequest){c=netlifyConfig(c);const a=input.artifact;if(!a||!Buffer.isBuffer(a.zip)||a.zip.length>limits.compressed||createHash('sha256').update(a.zip).digest('hex')!==a.sha256)fail(422,'Doğrulanmış statik yayın çıktısı gerekli.');await input.authorize?.();const d=await call('https://api.netlify.com/api/v1/sites/'+c.siteId+'/deploys',token,request,{method:'POST',headers:{'Content-Type':'application/zip'},body:a!.zip});return netlifyResult(d,c.siteId);},
 async status(c,token,id,_git,request=safeRequest){c=netlifyConfig(c);if(!netlifyId(id))fail(422,'Netlify dağıtım kimliği geçersiz.');return netlifyResult(await call('https://api.netlify.com/api/v1/sites/'+c.siteId+'/deploys/'+id,token,request),c.siteId,id);}
};
function cloudflareConfig(c:any){if(!c||Object.keys(c).some(k=>!['accountId','project','repository','branch'].includes(k))||!/^[a-f0-9]{32}$/i.test(c.accountId||'')||!/^([a-z0-9][a-z0-9-]{0,57})$/.test(c.project||'')||!/^[-A-Za-z0-9_]+\/[A-Za-z0-9_.-]+$/.test(c.repository||'')||!ref(c.branch))fail(422,'Cloudflare hesap, proje, GitHub deposu veya dalı geçersiz.');return{accountId:c.accountId,project:c.project,repository:c.repository,branch:c.branch};}
const cfBase=(c:any)=>'https://api.cloudflare.com/client/v4/accounts/'+c.accountId+'/pages/projects/'+c.project;
function cfEnvelope(data:any){if(data?.success!==true||!data.result)fail(502,'Cloudflare işlemi doğrulanamadı.');return data.result;}
function cfResult(d:any,c:any,git:GitRelease,id?:string):DeploymentResult{
 if(!uuid(d.id)||id&&d.id!==id||d.project_name!==c.project)fail(502,'Cloudflare dağıtım kimliği/projesi uyuşmuyor.');
 const m=d.deployment_trigger?.metadata,stage=d.latest_stage;
 const matching=m?.commit_hash===git.commit&&m?.branch===git.branch;
 const state=!matching?'review':stage?.status==='failure'||stage?.status==='canceled'?'failed':stage?.name==='deploy'&&stage?.status==='success'?'ready':['idle','active','success'].includes(stage?.status)?'pending':'review';
 const link=url(d.url,'pages.dev');return{id:d.id,state:state==='ready'&&!link?'review':state,...(link?{url:link}:{})};
}
export const cloudflare:HostingProvider={id:'cloudflare-pages',name:'Cloudflare Pages',mode:'git-branch',validate:cloudflareConfig,
 async verify(c,token,request=safeRequest){c=cloudflareConfig(c);const d=cfEnvelope(await call(cfBase(c),token,request)),s=d.source;if(d.name!==c.project||s?.type!=='github'||String(s.config?.owner+'/'+s.config?.repo_name).toLowerCase()!==c.repository.toLowerCase()||d.production_branch!==c.branch)fail(422,'Cloudflare projesi belirtilen GitHub deposu ve üretim dalına bağlı değil.');},
 async submit(c,token,input,request=safeRequest){c=cloudflareConfig(c);const git=input.git;if(!git||git.repository!==c.repository||git.branch!==c.branch||!hash(git.commit))fail(422,'Bu hedefe ait tamamlanmış GitHub yayını gerekli.');
  // Cloudflare deploys the branch HEAD. Do not pass our expected SHA as metadata:
  // it would claim a pinned build that this API does not guarantee.
  const boundary='studio-'+randomUUID(),body=`--${boundary}\r\nContent-Disposition: form-data; name="branch"\r\n\r\n${c.branch}\r\n--${boundary}--\r\n`;
  await input.authorize?.();return cfResult(cfEnvelope(await call(cfBase(c)+'/deployments',token,request,{method:'POST',headers:{'Content-Type':'multipart/form-data; boundary='+boundary},body})),c,git!);
 },
 async status(c,token,id,git,request=safeRequest){c=cloudflareConfig(c);if(!uuid(id)||!git||!hash(git.commit)||git.repository!==c.repository||git.branch!==c.branch)fail(422,'Cloudflare dağıtım kaydı geçersiz.');return cfResult(cfEnvelope(await call(cfBase(c)+'/deployments/'+id,token,request)),c,git!,id);}
};
function agentConfig(c:any){let u:URL;try{u=new URL(c?.origin);}catch{fail(422,'Dağıtım servisi HTTPS adresi gerekli.');}if(Object.keys(c).some(k=>!['origin','instanceId'].includes(k))||u!.protocol!=='https:'||u!.port||u!.username||u!.password||u!.pathname!=='/'||u!.search||u!.hash||!uuid(c.instanceId))fail(422,'Servis için kök HTTPS adresi ve instance UUID gerekli.');return{origin:u!.origin,instanceId:c.instanceId};}
async function agentInfo(c:any,token:string,request:typeof safeRequest){const info=await call(c.origin+'/_studio/v1/info',token,request);if(info.protocol!=='studio-static-deploy/1'||info.instanceId!==c.instanceId||info.current!==null&&!uuid(info.current))fail(422,'Dağıtım servisi kimliği veya protokolü uyuşmuyor.');return info;}
function agentResult(d:any,c:any,id:string):DeploymentResult{if(d.id!==id||d.instanceId!==c.instanceId||!['ready','review'].includes(d.state)||!/^[a-f0-9]{64}$/.test(d.sha256)||d.url!==c.origin+'/')fail(502,'Dağıtım servisi sonucu uyuşmuyor.');return{id,state:d.state,url:c.origin+'/',artifactHash:d.sha256};}
function agentProvider(id:string,name:string):HostingProvider{return{id,name,mode:'static-artifact',validate:agentConfig,
 async verify(c,token,request=safeRequest){c=agentConfig(c);await agentInfo(c,token,request);},
 async submit(c,token,input,request=safeRequest){c=agentConfig(c);const a=input.artifact;if(!a||!Buffer.isBuffer(a.zip)||a.zip.length>limits.compressed||createHash('sha256').update(a.zip).digest('hex')!==a.sha256||!uuid(input.requestId))fail(422,'Doğrulanmış statik çıktı ve kalıcı dağıtım kimliği gerekli.');const info=await agentInfo(c,token,request);await input.authorize?.();const result=agentResult(await call(c.origin+'/_studio/v1/releases/'+input.requestId,token,request,{method:'POST',headers:{'Content-Type':'application/zip','X-Studio-Artifact-SHA256':a!.sha256,'If-Match':info.current||'empty'},body:a!.zip}),c,input.requestId!);if(result.artifactHash!==a!.sha256)fail(502,'Yayın çıktısının özeti uyuşmuyor.');return result;},
 async status(c,token,id,_git,request=safeRequest){c=agentConfig(c);if(!uuid(id))fail(422,'Dağıtım kimliği geçersiz.');return agentResult(await call(c.origin+'/_studio/v1/releases/'+id,token,request),c,id);}
};}
export const selfHosted=agentProvider('self-hosted','Kendi sunucum · statik yayın servisi');
export const natro=agentProvider('natro','Natro VPS/VDS · statik yayın servisi');
export const hostingProviders=new Map<string,HostingProvider>([netlify,cloudflare,selfHosted,natro].map(p=>[p.id,p]));
