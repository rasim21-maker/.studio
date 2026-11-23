import fs from 'node:fs/promises';
import {createAiContainer} from './ai-container.mjs';
/** Operator-owned file only. Not a manifest/import setting. Failure leaves CMS usable. */
export async function loadLocalAi(file){
 if(!file)return undefined;
 try{
  const handle=await fs.open(file,'r');let bytes;
  try{const stat=await handle.stat();if(!stat.isFile()||stat.size>4096)throw Error();bytes=Buffer.alloc(4097);const read=await handle.read(bytes,0,4097,0);if(read.bytesRead>4096)throw Error();bytes=bytes.subarray(0,read.bytesRead);}finally{await handle.close();}
  return await createAiContainer(JSON.parse(bytes.toString('utf8')));
 }catch{
  // Never echo configuration paths, Docker stderr or model text into logs.
  console.warn('Local AI disabled: configuration, image or isolation preflight failed.');
  return undefined;
 }
}
