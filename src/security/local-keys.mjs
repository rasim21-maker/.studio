import fs from 'node:fs/promises';
import path from 'node:path';
import {randomBytes,randomUUID} from 'node:crypto';
import {localKeyProvider} from './envelope.mjs';

// Existing legacy studio-key is retained only for decrypting older records.
// Never remove historical wrapping keys until backups and stored envelopes have
// been migrated and a restore rehearsal has succeeded.
export async function openLocalKeyProvider(directory){
 const file=path.join(directory,'studio-vault.json');
 let config;
 try{
  const info=await fs.lstat(file);if(!info.isFile()||info.isSymbolicLink()||info.size>100000)throw Error('Local key store is invalid.');
  config=JSON.parse(await fs.readFile(file,'utf8'));
 }catch(error){
  if(error.code!=='ENOENT')throw error;
  const id=randomUUID();config={formatVersion:1,activeKeyId:id,keys:{[id]:randomBytes(32).toString('base64')}};
  try{await fs.writeFile(file,JSON.stringify(config)+'\n',{flag:'wx',mode:0o600});}
  catch(error){if(error.code!=='EEXIST')throw error;return openLocalKeyProvider(directory);}
 }
 if(config.formatVersion!==1||!config.keys||typeof config.keys!=='object'||Object.keys(config.keys).length>100)throw Error('Local key store format is unsupported.');
 const keys=Object.fromEntries(Object.entries(config.keys).map(([id,value])=>{
  if(typeof value!=='string'||!/^[A-Za-z0-9+/]{43}=$/.test(value))throw Error('Local wrapping key is invalid.');
  return [id,Buffer.from(value,'base64')];
 }));
 return localKeyProvider(config.activeKeyId,keys);
}
