import {randomBytes,createCipheriv,createDecipheriv} from 'node:crypto';

const maxEnvelope=2*1024*1024;
export const maxSecretBytes=1024*1024;
function aad(context){if(typeof context!=='string'||!context||context.length>500)throw Error('Secret context is invalid.');return Buffer.from('studio-secret-v1:'+context);}
function encrypt(bytes,key,context){
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(aad(context));
 const data=Buffer.concat([cipher.update(bytes),cipher.final()]).toString('base64');
 return {iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data};
}
function decode(value,length){
 if(typeof value!=='string'||value.length>maxEnvelope||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value))throw Error('Invalid encrypted secret.');
 const bytes=Buffer.from(value,'base64');if(length!==undefined&&bytes.length!==length)throw Error('Invalid encrypted secret.');return bytes;
}
function decrypt(box,key,context){
 const decipher=createDecipheriv('aes-256-gcm',key,decode(box?.iv,12));decipher.setAAD(aad(context));decipher.setAuthTag(decode(box?.tag,16));
 return Buffer.concat([decipher.update(decode(box?.data)),decipher.final()]);
}
// Provider contract is asynchronous so a remote KMS can wrap/unwrap data keys.
// This local provider does not represent a connected or configured hosted KMS.
export function localKeyProvider(activeKeyId,entries){
 const keys=new Map(Object.entries(entries).map(([id,key])=>[id,Buffer.from(key)]));
 if(!/^[a-zA-Z0-9_-]{1,80}$/.test(activeKeyId)||!keys.has(activeKeyId)||[...keys.values()].some(key=>key.length!==32))throw Error('A 256-bit wrapping key is required.');
 return {
  id:'local-aes-gcm-v1',
  async wrapKey(bytes,context){if(bytes.length!==32)throw Error('Invalid data key.');return {keyId:activeKeyId,box:encrypt(bytes,keys.get(activeKeyId),context+':wrap:'+activeKeyId)};},
  async unwrapKey(wrapped,context){const key=keys.get(wrapped?.keyId);if(!key)throw Error('Wrapping key unavailable.');const bytes=decrypt(wrapped.box,key,context+':wrap:'+wrapped.keyId);if(bytes.length!==32)throw Error('Invalid data key.');return bytes;}
 };
}
function envelope(encoded,provider){
 if(typeof encoded!=='string'||encoded.length>maxEnvelope)throw Error('Invalid encrypted secret.');
 const value=JSON.parse(encoded);if(value.formatVersion!==1||value.algorithm!=='A256GCM'||value.provider!==provider.id)throw Error('Unsupported secret envelope.');
 return value;
}
export async function sealSecret(value,context,provider){
 const serialized=JSON.stringify(value);
 if(typeof serialized!=='string'||Buffer.byteLength(serialized)>maxSecretBytes)throw Error('Secret payload exceeds size limit.');
 const dataKey=randomBytes(32);
 try{const encoded=JSON.stringify({formatVersion:1,algorithm:'A256GCM',provider:provider.id,wrappedKey:await provider.wrapKey(dataKey,context),payload:encrypt(Buffer.from(serialized),dataKey,context)});
  if(encoded.length>maxEnvelope)throw Error('Secret envelope exceeds size limit.');return encoded;}
 finally{dataKey.fill(0);}
}
export async function openSecret(encoded,context,provider){
 let dataKey;
 try{const value=envelope(encoded,provider);dataKey=await provider.unwrapKey(value.wrappedKey,context);return JSON.parse(decrypt(value.payload,dataKey,context).toString('utf8'));}
 catch{throw Error('Secret authentication failed or its wrapping key is unavailable.');}
 finally{dataKey?.fill(0);}
}
export async function rewrapSecret(encoded,context,previous,next){
 let dataKey;
 try{const value=envelope(encoded,previous);dataKey=await previous.unwrapKey(value.wrappedKey,context);
  // Authenticate the payload before rotating; do not carry corrupt records forward.
  const plain=decrypt(value.payload,dataKey,context);plain.fill(0);
  const rotated=JSON.stringify({...value,provider:next.id,wrappedKey:await next.wrapKey(dataKey,context)});
  if(rotated.length>maxEnvelope)throw Error('Secret envelope exceeds size limit.');return rotated;
 }finally{dataKey?.fill(0);}
}
