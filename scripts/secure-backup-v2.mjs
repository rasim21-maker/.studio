import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {parseArgs} from 'node:util';
import {backupData} from './backup-v2.mjs';
import {sealSecret,openSecret,localKeyProvider,maxSecretBytes} from '../src/security/envelope.mjs';
import {safePath} from '../src/v2/import.ts';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const keyName=name=>['studio-key','integration-key','studio-vault.json'].includes(name)||/^\.env(?:\.|$)/.test(name);
const inside=(parent,child)=>{const relative=path.relative(parent,child);return !relative||relative!=='..'&&!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative);};
async function destination(value){
 const absolute=path.resolve(value),parent=await fs.realpath(path.dirname(absolute));
 return path.join(parent,path.basename(absolute));
}
async function regular(file){
 const stat=await fs.lstat(file);if(!stat.isFile()||stat.isSymbolicLink())throw Error('Only regular files are allowed.');
 return stat;
}
async function smallJson(file){
 const stat=await regular(file);if(stat.size>2*1024*1024)throw Error('Backup metadata is too large.');
 return {bytes:await fs.readFile(file)};
}
function provider(key){if(!Buffer.isBuffer(key)||key.length!==32)throw Error('A separate 32-byte recovery key is required.');return localKeyProvider('recovery-v1',{'recovery-v1':key});}

export async function secureBackupData(source,target,keyTarget,recoveryKey,{offline=false}={}){
 if(!offline)throw Error('Stop the application first and pass --offline.');
 const wrapping=provider(recoveryKey),from=await fs.realpath(source),to=await destination(target),keysTo=await destination(keyTarget);
 if(inside(from,to)||inside(from,keysTo)||inside(to,keysTo)||inside(keysTo,to))throw Error('Data backup and encrypted key backup must be separate and outside the source.');
 const entries=await fs.readdir(from,{withFileTypes:true}),names=entries.filter(e=>keyName(e.name)).map(e=>e.name),keys={};
 for(const name of names){
  if(!safePath(name)&&!/^\.env(?:\.[a-z0-9_-]+)?$/i.test(name))throw Error('Key backup filename is invalid.');
  const file=path.join(from,name),stat=await regular(file);if(stat.size>256*1024)throw Error('Key file exceeds backup limit.');keys[name]=(await fs.readFile(file)).toString('base64');
 }
 if(Buffer.byteLength(JSON.stringify(keys))>maxSecretBytes-1024)throw Error('Combined key backup exceeds size limit.');
 // Preserve the old offline API for existing installations; the secure entry point
 // explicitly excludes runtime key files from the data copy.
 const data=await backupData(from,to,{offline:true,excludeRoots:names});
 const manifest=await fs.readFile(path.join(to,'backup-manifest.json')),manifestHash=hash(manifest),id=randomUUID(),context='backup:'+id+':'+manifestHash;
 const sealed=await sealSecret({backupId:id,files:keys},context,wrapping);
 const envelope=JSON.stringify({formatVersion:1,backupId:id,manifestHash,sealed})+'\n';
 await fs.writeFile(keysTo,envelope,{flag:'wx',mode:0o600});
 const receipt={formatVersion:1,backupId:id,manifestHash,keyEnvelopeHash:hash(envelope),keyCount:names.length};
 // No completion marker is written until BOTH destinations have succeeded.
 await fs.writeFile(path.join(to,'secure-backup.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx',mode:0o600});
 return {backupId:id,files:data.files.length,keyFiles:names.length,complete:true};
}
async function verified(dataDirectory,keyFile,recoveryKey){
 const root=await fs.realpath(dataDirectory),wrapping=provider(recoveryKey);
 const receipt=JSON.parse((await smallJson(path.join(root,'secure-backup.json'))).bytes);
 const manifestBytes=(await smallJson(path.join(root,'backup-manifest.json'))).bytes,manifest=JSON.parse(manifestBytes);
 const keyBytes=(await smallJson(keyFile)).bytes,keyEnvelope=JSON.parse(keyBytes);
 if(receipt.formatVersion!==1||keyEnvelope.formatVersion!==1||receipt.backupId!==keyEnvelope.backupId||hash(manifestBytes)!==receipt.manifestHash||keyEnvelope.manifestHash!==receipt.manifestHash||hash(keyBytes)!==receipt.keyEnvelopeHash)throw Error('Backup components do not match.');
 const bundle=await openSecret(keyEnvelope.sealed,'backup:'+receipt.backupId+':'+receipt.manifestHash,wrapping);
 if(bundle.backupId!==receipt.backupId||!bundle.files||typeof bundle.files!=='object'||Array.isArray(bundle.files)||Object.keys(bundle.files).length!==receipt.keyCount)throw Error('Key backup is invalid.');
 for(const [name,value]of Object.entries(bundle.files)){
  if(!keyName(name)||!safePath(name)&&!/^\.env(?:\.[a-z0-9_-]+)?$/i.test(name)||name.includes('/')||name.includes('\\')||typeof value!=='string'||value.length>350000||Buffer.from(value,'base64').toString('base64')!==value)throw Error('Key backup path or value is invalid.');
 }
 if(manifest.formatVersion!==1||!Array.isArray(manifest.files)||manifest.files.length>100000)throw Error('Backup manifest is invalid.');
 const seen=new Set();
 for(const entry of manifest.files){
  if(!safePath(entry.path)||keyName(entry.path.split('/')[0])||seen.has(entry.path.normalize('NFC').toLowerCase())||!Number.isSafeInteger(entry.size)||entry.size<0||!/^[a-f0-9]{64}$/.test(entry.sha256))throw Error('Backup entry is invalid.');
  seen.add(entry.path.normalize('NFC').toLowerCase());
  let cursor=root;for(const segment of entry.path.split('/')){cursor=path.join(cursor,segment);if((await fs.lstat(cursor)).isSymbolicLink())throw Error('Backup links are forbidden.');}
  const actual=await fs.realpath(cursor);if(!inside(root,actual))throw Error('Backup path escapes its directory.');
  const stat=await regular(actual);if(stat.size!==entry.size||hash(await fs.readFile(actual))!==entry.sha256)throw Error('Backup data integrity check failed.');
 }
 if(!seen.has('console.sqlite'))throw Error('Backup database is missing.');
 const db=new DatabaseSync(path.join(root,'console.sqlite'),{readOnly:true});try{if(db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw Error('Backup database is corrupt.');}finally{db.close();}
 return {root,manifest,bundle,receipt};
}
export async function verifySecureBackup(dataDirectory,keyFile,recoveryKey){
 const data=await verified(dataDirectory,keyFile,recoveryKey);
 return {backupId:data.receipt.backupId,files:data.manifest.files.length,keyFiles:Object.keys(data.bundle.files).length,integrity:'ok'};
}
export async function restoreSecureBackup(dataDirectory,keyFile,target,recoveryKey){
 const data=await verified(dataDirectory,keyFile,recoveryKey),to=await destination(target);
 if(inside(data.root,to)||inside(to,data.root))throw Error('Restore target must be separate from backup.');
 await fs.mkdir(to,{mode:0o700}); // Refuse existing target: never restore over running data.
 for(const entry of data.manifest.files){
  const bytes=await fs.readFile(path.join(data.root,entry.path));if(hash(bytes)!==entry.sha256)throw Error('Backup changed during restore.');
  const file=path.join(to,entry.path);await fs.mkdir(path.dirname(file),{recursive:true,mode:0o700});await fs.writeFile(file,bytes,{flag:'wx',mode:0o600});
 }
 for(const [name,value]of Object.entries(data.bundle.files))await fs.writeFile(path.join(to,name),Buffer.from(value,'base64'),{flag:'wx',mode:0o600});
 const report={backupId:data.receipt.backupId,restored:new Date().toISOString(),files:data.manifest.files.length,keyFiles:Object.keys(data.bundle.files).length};
 await fs.writeFile(path.join(to,'restore-complete.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===import.meta.filename){
 try{
  const {values}=parseArgs({options:{mode:{type:'string'},source:{type:'string'},target:{type:'string'},keys:{type:'string'},'recovery-key-file':{type:'string'},offline:{type:'boolean',default:false}}});
  if(!['backup','verify','restore'].includes(values.mode)||!values.source||!values.keys||!values['recovery-key-file']||values.mode!=='verify'&&!values.target)throw Error('Use --mode backup|verify|restore --source DATA --keys ENCRYPTED_KEYS --recovery-key-file KEY [--target NEW_DIRECTORY] [--offline].');
  const recoveryFile=await fs.realpath(values['recovery-key-file']);
  const sourcePath=await fs.realpath(values.source),keyPath=await destination(values.keys);
  if(inside(sourcePath,recoveryFile)||recoveryFile===keyPath||values.target&&inside(await destination(values.target),recoveryFile))throw Error('Recovery key must be stored separately from source, backup and restore data.');
  await regular(recoveryFile);const recovery=await fs.readFile(recoveryFile);
  try{
   const result=values.mode==='backup'?await secureBackupData(values.source,values.target,values.keys,recovery,{offline:values.offline}):values.mode==='restore'?await restoreSecureBackup(values.source,values.keys,values.target,recovery):await verifySecureBackup(values.source,values.keys,recovery);
   console.log(JSON.stringify(result));
  }finally{recovery.fill(0);}
 }catch(error){console.error(error.message);process.exitCode=1;}
}
