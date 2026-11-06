import path from 'node:path';
import {inflateRawSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {fail} from '../util.mjs';
import type {Source,Asset} from '../../shared/v2/model.ts';
export const limits={compressed:8*1024*1024,expanded:24*1024*1024,file:4*1024*1024,text:2*1024*1024,count:800,ratio:100};
export const digest=(value:Buffer|string)=>createHash('sha256').update(value).digest('hex');
export const safePath=(value:string)=>typeof value==='string'&&value.length<=240&&!/[\\\u0000-\u001f\u007f:%]/.test(value)&&!value.startsWith('/')&&!value.split('/').some(p=>!p||p==='.'||p==='..'||/[. ]$/.test(p)||/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(p));
// Compare canonical identities without renaming source paths: CSS/HTML references
// must keep resolving to the exact spelling supplied by the source author.
export function claimSourcePath(value:string,seen:Set<string>):void{
 if(!safePath(value))fail(422,'Güvensiz kaynak dosyası yolu.');
 const identity=value.normalize('NFC').toLowerCase();
 if(seen.has(identity))fail(422,'Unicode veya büyük/küçük harf bakımından çakışan kaynak yolu.');
 seen.add(identity);
}
const secretPath=/(^|\/)(\.git|\.svn|node_modules|\.env(?:\..*)?|\.aws|\.ssh|\.npmrc|id_rsa|id_ed25519|credentials[^/]*)(\/|$)|\.(pem|key|p12|pfx|sqlite|db|bak|sql|dump|log)$/i;
const secretValue=/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:gh[pousr]_[A-Za-z0-9_]{30,}|github_pat_[A-Za-z0-9_]{40,}|sk_live_[A-Za-z0-9]{16,}|AKIA[A-Z0-9]{16})\b|(?:api[_-]?secret|client[_-]?secret|password|access[_-]?token)\s*[=:]\s*["'][^"'\s]{12,}["']/i;
function crc32(bytes:Buffer){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let n=0;n<8;n++)crc=crc>>>1^(-(crc&1)&0xedb88320);}return(crc^0xffffffff)>>>0;}
// Read the central directory before decompression; zlib's output bound also protects against
// forged uncompressed-size headers. Imported installation scripts are never executed.
export function readZip(bytes:Buffer):Record<string,Buffer>{
 if(bytes.length>limits.compressed||bytes.length<22)fail(422,'Arşiv boyutu sınır dışında.');
 let end=-1;for(let n=bytes.length-22;n>=Math.max(0,bytes.length-65557);n--)if(bytes.readUInt32LE(n)===0x06054b50&&n+22+bytes.readUInt16LE(n+20)===bytes.length){end=n;break;}
 if(end<0)fail(422,'ZIP son kaydı bulunamadı.');
 const count=bytes.readUInt16LE(end+10),size=bytes.readUInt32LE(end+12),start=bytes.readUInt32LE(end+16);
 if(bytes.readUInt16LE(end+4)||bytes.readUInt16LE(end+6)||count!==bytes.readUInt16LE(end+8)||count>limits.count||start+size!==end)fail(422,'Çok parçalı, ZIP64 veya sınır dışı arşiv.');
 const result:Record<string,Buffer>=Object.create(null),seen=new Set<string>(),ranges:[number,number][]=[];let at=start,total=0;
 for(let i=0;i<count;i++){
  if(at+46>end||bytes.readUInt32LE(at)!==0x02014b50)fail(422,'Bozuk ZIP dizini.');
  const flags=bytes.readUInt16LE(at+8),method=bytes.readUInt16LE(at+10),crc=bytes.readUInt32LE(at+16),compressed=bytes.readUInt32LE(at+20),expanded=bytes.readUInt32LE(at+24),nl=bytes.readUInt16LE(at+28),el=bytes.readUInt16LE(at+30),cl=bytes.readUInt16LE(at+32),attrs=bytes.readUInt32LE(at+38),offset=bytes.readUInt32LE(at+42),next=at+46+nl+el+cl;
  if(next>end||flags&1||![0,8].includes(method)||offset+30>start||compressed===0xffffffff||expanded===0xffffffff||bytes.readUInt32LE(offset)!==0x04034b50)fail(422,'ZIP kaydı desteklenmiyor.');
  const raw=bytes.subarray(at+46,at+46+nl),name=new TextDecoder('utf-8',{fatal:true}).decode(raw),directory=name.endsWith('/'),clean=directory?name.slice(0,-1):name;
  const kind=(attrs>>>16)&0xf000;
  claimSourcePath(clean,seen);
  if(kind!==0&&kind!==0x8000&&kind!==0x4000)fail(422,'Bağlantı içeren arşiv yolu.');
  total+=expanded;
  if(expanded>limits.file||total>limits.expanded||expanded>Math.max(1024,compressed*limits.ratio))fail(422,'Arşiv açılım sınırını aşıyor.');
  const localNameLength=bytes.readUInt16LE(offset+26),localExtra=bytes.readUInt16LE(offset+28),dataStart=offset+30+localNameLength+localExtra,dataEnd=dataStart+compressed;
  if(dataEnd>start||!raw.equals(bytes.subarray(offset+30,offset+30+localNameLength))||method!==bytes.readUInt16LE(offset+8)||(bytes.readUInt16LE(offset+6)&1))fail(422,'ZIP yerel kaydı uyuşmuyor.');
  if(ranges.some(([a,b])=>offset<b&&dataEnd>a))fail(422,'Çakışan ZIP kayıtları.');ranges.push([offset,dataEnd]);
  if(!directory){let out:Buffer;try{out=method===0?Buffer.from(bytes.subarray(dataStart,dataEnd)):inflateRawSync(bytes.subarray(dataStart,dataEnd),{maxOutputLength:Math.min(limits.file,expanded+1)});}catch{fail(422,'Bozuk veya aşırı açılan sıkıştırılmış veri.');}
   if(out!.length!==expanded||crc32(out!)!==crc)fail(422,'ZIP bütünlük doğrulaması başarısız.');result[clean]=out!;
  }at=next;
 }if(at!==end)fail(422,'ZIP dizin uzunluğu uyuşmuyor.');return result;
}
export function imageInfo(bytes:Buffer):{mime:string;extension:string;width:number;height:number}|null{
 if(bytes.length>=24&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return{mime:'image/png',extension:'png',width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)};
 if(bytes.length>=10&&/^GIF8[79]a/.test(bytes.toString('ascii',0,6)))return{mime:'image/gif',extension:'gif',width:bytes.readUInt16LE(6),height:bytes.readUInt16LE(8)};
 if(bytes.length>=30&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'){
  const type=bytes.toString('ascii',12,16);if(type==='VP8X')return{mime:'image/webp',extension:'webp',width:1+bytes.readUIntLE(24,3),height:1+bytes.readUIntLE(27,3)};
  if(type==='VP8 '&&bytes.length>=30)return{mime:'image/webp',extension:'webp',width:bytes.readUInt16LE(26)&16383,height:bytes.readUInt16LE(28)&16383};
  if(type==='VP8L'&&bytes.length>=25){const bits=bytes.readUInt32LE(21);return{mime:'image/webp',extension:'webp',width:1+(bits&16383),height:1+((bits>>>14)&16383)};}
 }
 if(bytes.length>4&&bytes[0]===255&&bytes[1]===216){let i=2;while(i+4<bytes.length){if(bytes[i++]!==255)break;const marker=bytes[i++],length=bytes.readUInt16BE(i);if(length<2||i+length>bytes.length)break;if([192,193,194].includes(marker)&&length>=7)return{mime:'image/jpeg',extension:'jpg',width:bytes.readUInt16BE(i+5),height:bytes.readUInt16BE(i+3)};i+=length;}}
 return null;
}
export function mediaAsset(bytes:Buffer,filename:string,mime?:string):{key:string;asset:Asset}{
 const info=imageInfo(bytes),ext=path.extname(filename).slice(1).toLowerCase();
 if(bytes.length>limits.file||!info||!([info.extension,...(info.extension==='jpg'?['jpeg']:[])].includes(ext))||(mime&&mime!==info.mime)||info.width<1||info.height<1||info.width>8192||info.height>8192||info.width*info.height>32_000_000)fail(422,'Görsel türü, gerçek içeriği, boyutu veya ölçüleri geçersiz.');
 return{key:`media/${digest(bytes)}.${info!.extension}`,asset:{mime:info!.mime,base64:bytes.toString('base64'),size:bytes.length,width:info!.width,height:info!.height}};
}
export interface ImportReport {accepted:string[];rejected:{path:string;reason:string}[];warnings:string[];bytes:number}
export function inspectFiles(input:Record<string,Buffer>):{source:Source;report:ImportReport}{
 const files:Record<string,string>=Object.create(null),assets:Record<string,Asset>=Object.create(null),report:ImportReport={accepted:[],rejected:[],warnings:[],bytes:0},names=new Set<string>();
 if(Object.keys(input).length>limits.count)fail(422,'Dosya sayısı sınırı aşıldı.');
 for(const [filename,bytes]of Object.entries(input)){
  claimSourcePath(filename,names);report.bytes+=bytes.length;if(report.bytes>limits.expanded||bytes.length>limits.file)fail(422,'Import boyut sınırı aşıldı.');
  const reject=(reason:string)=>report.rejected.push({path:filename,reason});
  if(secretPath.test(filename)){reject('Sır, çalışma zamanı verisi veya bağımlılık dizini dışlandı.');continue;}
  if(/\.(zip|gz|tar|7z|rar|exe|dll|bat|cmd|ps1|sh)$/i.test(filename)){reject('Arşiv veya çalıştırılabilir dosya dışlandı.');continue;}
  if(/\.(png|jpg|jpeg|webp|gif)$/i.test(filename)){try{const {asset}=mediaAsset(bytes,filename);assets[filename]=asset;report.accepted.push(filename);}catch{reject('Görsel içeriği veya ölçüleri doğrulanamadı.');}continue;}
  if(!/\.(html?|css|[cm]?js|tsx?|jsx|json|md|txt|xml|svg)$/i.test(filename)&&!['LICENSE','NOTICE','.gitignore'].includes(path.basename(filename))){reject('Desteklenmeyen dosya türü.');continue;}
  let text:string;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{reject('UTF-8 metin bekleniyor.');continue;}
  if(bytes.length>limits.text||text.includes('\0')){reject('Metin boyutu veya içeriği geçersiz.');continue;}
  if(secretValue.test(text!)){reject('Olası sır algılandı; içerik içe alınmadı.');continue;}
  if(/\.html?$/i.test(filename)&&!/<(?:!doctype|html|head|body|main|div|section|h[1-6])\b/i.test(text!)){reject('HTML içeriği doğrulanamadı.');continue;}
  files[filename]=text!;report.accepted.push(filename);
 }
 if(!Object.keys(files).length)fail(422,'Desteklenen kaynak dosyası bulunamadı.',report);
 report.warnings.push('Dosyalar çalıştırılmadı. Sır taraması sezgiseldir; eksiksiz güvenlik garantisi değildir.');
 const manifest=files['studio.manifest.json']?JSON.parse(files['studio.manifest.json']):{manifestVersion:2,adapter:{id:'static',version:1},name:'İçe aktarılan site',locales:['tr'],connections:[{id:'source',kind:'files',authority:['code','content']}],preview:{mode:'inert'},publish:{mode:'export'}};
 return{source:{files,assets,bindings:[],manifest},report};
}
