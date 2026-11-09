import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

// Reuse npm's native CycloneDX generator. Normalize workspace scopes against
// the lockfile; npm can omit the group on local links. No registry access.
if(!process.env.npm_execpath)throw Error('Run through npm run sbom.');
const result=spawnSync(process.execPath,[process.env.npm_execpath,'sbom','--sbom-format=cyclonedx','--sbom-type=application','--package-lock-only','--include=dev','--include=optional'],{encoding:'utf8',maxBuffer:20*1024*1024,windowsHide:true});
if(result.error)throw result.error;
if(result.status!==0){process.stderr.write(result.stderr);throw Error('npm SBOM generation failed.');}
const bom=JSON.parse(result.stdout);
if(bom.bomFormat!=='CycloneDX'||!Array.isArray(bom.components)||!Array.isArray(bom.dependencies))throw Error('Unexpected SBOM output.');
const lock=JSON.parse(await fs.readFile('package-lock.json','utf8'));
const locked=Object.entries(lock.packages).filter(([key,item])=>key&&!item.link);
const fullName=c=>(c.group?c.group+'/':'')+c.name;
const own=locked.filter(([location,item])=>location.startsWith('packages/')&&item.name?.startsWith('@loft-studio/'));
for(const [location,item]of own){
 const native=bom.components.find(c=>c['bom-ref']===item.name+'@'+item.version);
 if(native&&!native.group&&native.name===item.name.split('/').at(-1))native.group=item.name.split('/')[0];
 if(!bom.components.some(c=>fullName(c)===item.name&&c.version===item.version)){
  const ref='pkg:npm/'+item.name.replace('@','%40')+'@'+item.version;
  bom.components.push({type:'library',name:item.name,version:item.version,'bom-ref':ref,purl:ref,properties:[{name:'studio:source',value:location},{name:'studio:ownership',value:'first-party'}]});
 }
}
const componentRef=name=>bom.components.find(c=>fullName(c)===name)?.['bom-ref'];
for(const [,item]of own){
 const ref=componentRef(item.name),dependsOn=Object.keys(item.dependencies||{}).map(componentRef);
 if(dependsOn.some(v=>!v))throw Error('Workspace dependency absent from SBOM: '+item.name);
 const existing=bom.dependencies.find(d=>d.ref===ref);if(existing)existing.dependsOn=[...new Set([...existing.dependsOn,...dependsOn])];else bom.dependencies.push({ref,dependsOn});
}
const application=bom.dependencies.find(d=>d.ref===bom.metadata.component['bom-ref']);
if(!application)throw Error('SBOM application dependency node is missing.');
application.dependsOn=[...new Set([...application.dependsOn,...own.map(([,item])=>componentRef(item.name))])];
for(const [location,item]of locked){
 const name=item.name||location.split('node_modules/').at(-1);
 if(!bom.components.some(c=>(c.group?c.group+'/':'')+c.name===name&&c.version===item.version))throw Error('SBOM is missing a locked dependency: '+name);
}
const output=path.resolve('test-results/sbom.cdx.json');
await fs.mkdir(path.dirname(output),{recursive:true});
await fs.writeFile(output,JSON.stringify(bom,null,2)+'\n');
console.log(JSON.stringify({output:'test-results/sbom.cdx.json',format:bom.bomFormat,specVersion:bom.specVersion,components:bom.components.length,locked:locked.length}));
