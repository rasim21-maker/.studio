import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {createHash,timingSafeEqual} from 'node:crypto';
import {readZip,limits,safePath} from './import.ts';
import {staticArtifact} from './hosting-providers.ts';

const hash=(b:Buffer|string)=>createHash('sha256').update(b).digest('hex');
const uuid=(s:any)=>typeof s==='string'&&/^[a-f0-9-]{36}$/.test(s);
/** Dedicated single-process static host. Run behind a TLS reverse proxy on its own origin.
 * This is not an arbitrary shell/build executor, multi-user host or shared-FTP adapter.
 */
export async function createStaticDeployAgent({directory,token,instanceId,publicUrl}:{directory:string;token:string;instanceId:string;publicUrl:string}){
 if(token.length<32||!uuid(instanceId))throw Error('A 32-character token and instance UUID are required.');
 const origin=new URL(publicUrl);if(origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)throw Error('A dedicated HTTPS origin is required.');
 await fs.mkdir(directory,{recursive:true,mode:0o700});if((await fs.lstat(directory)).isSymbolicLink())throw Error('Agent directory must not be a symlink.');const root=await fs.realpath(directory),releases=path.join(root,'releases');await fs.mkdir(releases,{recursive:true,mode:0o700});if((await fs.lstat(releases)).isSymbolicLink())throw Error('Releases directory must not be a symlink.');let busy=false;
 const current=async()=>{try{return JSON.parse(await fs.readFile(path.join(root,'current.json'),'utf8'));}catch(e:any){if(e.code==='ENOENT')return null;throw e;}};
 const metadata=async(id:string)=>{try{return JSON.parse(await fs.readFile(path.join(releases,id,'release.json'),'utf8'));}catch(e:any){if(e.code==='ENOENT')return null;throw e;}};
 const state=async(id:string)=>{const m=await metadata(id),c=await current();return m?{id,instanceId,sha256:m.sha256,state:c?.id===id?'ready':'review',url:origin.href}:null;};
 const server=http.createServer(async(req,res)=>{
  const send=(status:number,data:any)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  try{
   const url=new URL(req.url||'/',origin),api=url.pathname.startsWith('/_studio/');
   if(api){const supplied=String(req.headers.authorization||''),expected='Bearer '+token;if(!timingSafeEqual(Buffer.from(hash(supplied)),Buffer.from(hash(expected))))return send(401,{error:'Unauthorized'});
    if(url.pathname==='/_studio/v1/info'&&req.method==='GET')return send(200,{protocol:'studio-static-deploy/1',instanceId,current:(await current())?.id||null});
    const match=/^\/_studio\/v1\/releases\/([a-f0-9-]{36})$/.exec(url.pathname);if(!match)return send(404,{error:'Unknown endpoint'});const id=match[1];
    if(req.method==='GET'){const s=await state(id);return send(s?200:404,s||{error:'Unknown release'});}
    if(req.method!=='POST')return send(405,{error:'Method not allowed'});if(busy)return send(409,{error:'Another deployment is in progress'});
    const expectedHash=req.headers['x-studio-artifact-sha256'];if(typeof expectedHash!=='string'||!/^[a-f0-9]{64}$/.test(expectedHash)||req.headers['content-type']!=='application/zip')return send(422,{error:'ZIP and SHA256 required'});
    if(Number(req.headers['content-length']||0)>limits.compressed)return send(413,{error:'Payload too large'});
    busy=true;try{
     const chunks:Buffer[]=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>limits.compressed){send(413,{error:'Payload too large'});req.destroy();return;}chunks.push(Buffer.from(chunk));}const archive=Buffer.concat(chunks);if(hash(archive)!==expectedHash)return send(422,{error:'Artifact digest mismatch'});
     const existing=await metadata(id);if(existing){if(existing.sha256!==expectedHash)return send(409,{error:'Release ID conflict'});return send(200,await state(id));}
     const c=await current();if(req.headers['if-match']!==(c?.id||'empty'))return send(409,{error:'Current release changed'});
     const files=readZip(archive);staticArtifact(files);if(Object.keys(files).some(p=>p==='_studio'||p.startsWith('_studio/')))return send(422,{error:'Reserved path'});
     const stored=await fs.readdir(releases),stages=(await fs.readdir(root)).filter(p=>p.startsWith('stage-'));if(stored.length+stages.length>=32)return send(507,{error:'Release quota reached; operator cleanup required'});
     // A staging directory is never served. No code/install scripts are executed.
     const staging=await fs.mkdtemp(path.join(root,'stage-'));await fs.mkdir(path.join(staging,'files'));
     for(const [name,bytes]of Object.entries(files)){const destination=path.join(staging,'files',name);await fs.mkdir(path.dirname(destination),{recursive:true,mode:0o700});await fs.writeFile(destination,bytes,{mode:0o600,flag:'wx'});}
     await fs.writeFile(path.join(staging,'release.json'),JSON.stringify({id,sha256:expectedHash,paths:Object.keys(files)}),{flag:'wx',mode:0o600});
     await fs.rename(staging,path.join(releases,id));const pointer=path.join(root,'pointer-'+id+'.json');await fs.writeFile(pointer,JSON.stringify({id}),{mode:0o600,flag:'wx'});await fs.rename(pointer,path.join(root,'current.json'));
     return send(201,await state(id));
    }finally{busy=false;}
   }
   if(!['GET','HEAD'].includes(req.method||''))return send(405,{error:'Method not allowed'});const c=await current();if(!c)return send(404,{error:'No release'});let file;try{file=decodeURIComponent(url.pathname).replace(/^\//,'')||'index.html';}catch{return send(400,{error:'Invalid path'});}if(file.endsWith('/'))file+='index.html';if(!safePath(file))return send(404,{error:'Not found'});
   const m=await metadata(c.id);if(!m?.paths.includes(file))return send(404,{error:'Not found'});const filename=path.join(releases,c.id,'files',file),real=await fs.realpath(filename);if(!real.startsWith(path.join(releases,c.id,'files')+path.sep))return send(404,{error:'Not found'});const bytes=await fs.readFile(real);
   const mime:Record<string,string>={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2'};res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache','X-Studio-Release':c.id});res.end(req.method==='HEAD'?undefined:bytes);
  }catch(e:any){if(!res.headersSent)send(e.status===422?422:500,{error:'Deployment operation failed'});else res.destroy();}
 });
 server.requestTimeout=30_000;server.headersTimeout=10_000;
 return{server,close:()=>new Promise<void>((resolve,reject)=>{server.close(e=>e?reject(e):resolve());server.closeIdleConnections();})};
}
