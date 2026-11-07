import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

// Reuse npm's native CycloneDX generator: no additional package or install script.
if(!process.env.npm_execpath)throw Error('Run through npm run sbom.');
const result=spawnSync(process.execPath,[process.env.npm_execpath,'sbom','--sbom-format=cyclonedx','--sbom-type=application','--package-lock-only','--include=dev','--include=optional'],{encoding:'utf8',maxBuffer:20*1024*1024,windowsHide:true});
if(result.error)throw result.error;
if(result.status!==0){process.stderr.write(result.stderr);throw Error('npm SBOM generation failed.');}
const bom=JSON.parse(result.stdout);
if(bom.bomFormat!=='CycloneDX'||!Array.isArray(bom.components)||!Array.isArray(bom.dependencies))throw Error('Unexpected SBOM output.');
const lock=JSON.parse(await fs.readFile('package-lock.json','utf8'));
const locked=Object.entries(lock.packages).filter(([key])=>key);
for(const [location,item]of locked){
 const name=location.split('node_modules/').at(-1);
 if(!bom.components.some(c=>(c.group?c.group+'/':'')+c.name===name&&c.version===item.version))throw Error('SBOM is missing a locked dependency: '+name);
}
const output=path.resolve('test-results/sbom.cdx.json');
await fs.mkdir(path.dirname(output),{recursive:true});
await fs.writeFile(output,JSON.stringify(bom,null,2)+'\n');
console.log(JSON.stringify({output:'test-results/sbom.cdx.json',format:bom.bomFormat,specVersion:bom.specVersion,components:bom.components.length,locked:locked.length}));
