import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {benchmarkFixtures} from './ai-benchmark-fixtures.mjs';
import {validateAiResult} from '../shared/v2/ai-contracts.mjs';

export function scoreResponses(cases,records){
 if(!Array.isArray(records)||records.length>cases.length)throw Error('Invalid response count');
 const known=new Set(cases.map(c=>c.id)),byId=new Map();
 for(const record of records){if(!record||Object.keys(record).sort().join(',')!=='caseId,result'||!known.has(record.caseId)||byId.has(record.caseId))throw Error('Unknown or duplicate response');byId.set(record.caseId,record.result);}
 const rows=cases.map(c=>{
  if(!byId.has(c.id))return {id:c.id,status:'missing'};
  const result=byId.get(c.id);
  try{validateAiResult(c.job,result);}catch{return{id:c.id,status:'invalid'};}
  const actual=result.output,expected=c.expected;
  const pass=actual.kind===expected.kind&&(expected.kind==='content'?isDeepStrictEqual(actual.changes,expected.changes):expected.kind==='report'?isDeepStrictEqual(actual.evidenceIds,expected.evidenceIds):true);
  return{id:c.id,status:pass?'checks-passed':'checks-failed',humanReviewRequired:pass};
 });
 return {version:1,mode:'offline-response-evaluation',modelPerformanceVerified:false,total:cases.length,counts:Object.fromEntries(['missing','invalid','checks-passed','checks-failed'].map(s=>[s,rows.filter(r=>r.status===s).length])),rows};
}
async function main(){
 const [command,split='development',file,...extra]=process.argv.slice(2);
 if(extra.length||!['fixtures','score'].includes(command))throw Error('Usage: node scripts/ai-benchmark.mjs fixtures|score development|holdout [responses.json]');
 const cases=benchmarkFixtures(split);
 if(command==='fixtures'){if(file)throw Error('Unexpected argument');console.log(JSON.stringify(cases.map(({expected,...publicCase})=>publicCase),null,2));return;}
 if(!file)throw Error('Response file required');
 const handle=await fs.open(file,'r');let bytes;
 try{if(!(await handle.stat()).isFile())throw Error('Responses must be a regular file');bytes=Buffer.alloc(2*1024*1024+1);const {bytesRead}=await handle.read(bytes,0,bytes.length,0);if(bytesRead>2*1024*1024)throw Error('Response file exceeds 2 MiB');bytes=bytes.subarray(0,bytesRead);}finally{await handle.close();}
 const report=scoreResponses(cases,JSON.parse(bytes.toString('utf8')));console.log(JSON.stringify(report,null,2));
 if(report.counts.missing||report.counts.invalid||report.counts['checks-failed'])process.exitCode=1;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(()=>{console.error('Benchmark input rejected; check command, split and response file. No inference was performed.');process.exitCode=1;});
