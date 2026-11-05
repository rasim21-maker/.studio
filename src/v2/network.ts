import https from 'node:https';
import dns from 'node:dns/promises';
import {isIP} from 'node:net';
import {fail} from '../util.mjs';
export function publicAddress(address:string):boolean{
 if(isIP(address)!==4)return false; // Fail closed for IPv6 until an audited dual-stack policy is configured.
 const [a,b,c]=address.split('.').map(Number);
 return !(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&(b===168||b===0||b===2)||a===100&&b>=64&&b<=127||a===198&&(b===18||b===19||b===51&&c===100)||a===203&&b===0&&c===113);
}
export async function safeRequest(url:string,{method='GET',headers={},body,maxBytes=2*1024*1024,signal}:{method?:string;headers?:Record<string,string>;body?:string;maxBytes?:number;signal?:AbortSignal}={}):Promise<{status:number;headers:Record<string,any>;body:Buffer}>{
 signal=AbortSignal.any([AbortSignal.timeout(10_000),...(signal?[signal]:[])]);
 let target:URL;try{target=new URL(url);}catch{fail(422,'Geçersiz bağlantı adresi.');}
 if(target!.protocol!=='https:'||target!.username||target!.password||target!.port&&target!.port!=='443'||target!.hash||target!.hostname.length>253||isIP(target!.hostname))fail(422,'HTTPS alan adı ve standart port gerekli.');
 let addresses;try{addresses=await new Promise<Awaited<ReturnType<typeof dns.lookup>>[]>((resolve,reject)=>{
  const stop=()=>reject(Error('DNS deadline'));signal!.addEventListener('abort',stop,{once:true});
  if(signal!.aborted){stop();return;}
  dns.lookup(target!.hostname,{all:true}).then(resolve,reject).finally(()=>signal!.removeEventListener('abort',stop));
 });}catch{fail(422,'Bağlantı alan adı çözümlenemedi veya zaman aşımına uğradı.');}
 if(!addresses!.length||addresses!.some(a=>!publicAddress(a.address)))fail(422,'Hedef ağ adresi güvenlik kuralıyla engellendi. IPv4 genel ağ adresi gerekli.');
 const address=addresses![0].address;
 return await new Promise((resolve,reject)=>{
  const req=https.request(target!,{method,headers:{...headers,'user-agent':'Loft-Studio/2','accept-encoding':'identity'},servername:target!.hostname,lookup:(_host,opts,cb:any)=>opts.all?cb(null,[{address,family:4}]):cb(null,address,4),signal,timeout:10_000},res=>{
   let length=0;const chunks:Buffer[]=[];
   res.on('data',chunk=>{length+=chunk.length;if(length>maxBytes){res.destroy();req.destroy();reject(Object.assign(Error('Uzak yanıt boyut sınırını aştı.'),{status:422}));return;}chunks.push(chunk);});
   res.on('error',()=>reject(Object.assign(Error('Uzak yanıt tamamlanamadı.'),{status:502})));
   res.on('end',()=>{if(res.statusCode!>=300&&res.statusCode!<400){reject(Object.assign(Error('Yönlendirme kabul edilmedi; doğrudan son HTTPS adresini kullanın.'),{status:422}));return;}resolve({status:res.statusCode!,headers:res.headers,body:Buffer.concat(chunks)});});
  });req.on('timeout',()=>req.destroy(Error('Bağlantı zaman aşımı.')));req.on('error',()=>reject(Object.assign(Error('Güvenli uzak bağlantı kurulamadı.'),{status:502})));if(body)req.write(body);req.end();
 });
}
