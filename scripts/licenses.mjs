import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const lock=JSON.parse(await fs.readFile('package-lock.json','utf8'));
const root=JSON.parse(await fs.readFile('package.json','utf8'));
const allowed=new Set(['MIT','BSD-2-Clause','BSD-3-Clause','0BSD','Apache-2.0']);
const entries=[],notices=[],problems=[];
for(const [location,item] of Object.entries(lock.packages).filter(([key])=>key).sort(([a],[b])=>a.localeCompare(b))){
 let pkg,files=[];try{pkg=JSON.parse(await fs.readFile(path.join(location,'package.json'),'utf8'));files=await fs.readdir(location);}catch(error){if(error.code!=='ENOENT')throw error;}
 const name=pkg?.name||location.split('node_modules/').at(-1),license=pkg?.license||item.license;
 if(!allowed.has(license))problems.push(name+': review license '+license);
 if(pkg&&pkg.version!==item.version)problems.push(name+': installed version differs from lock');
 let repo=typeof pkg?.repository==='string'?pkg.repository:pkg?.repository?.url;
 repo=repo?.replace(/^git\+/,'').replace(/^git:\/\//,'https://').replace(/\.git$/,'');
 const licenseFiles=files.filter(f=>/^(licen[sc]e|copying|notice)(\.|$)/i.test(f));
 const evidence=[];
 for(const file of licenseFiles){const text=await fs.readFile(path.join(location,file),'utf8');evidence.push({file,sha256:createHash('sha256').update(text).digest('hex')});notices.push(`## ${name}@${item.version} — ${file}\n\n${text.trim()}\n`);}
 // Platform-specific esbuild packages use the same upstream MIT license. They are
 // lockfile entries, not installed or redistributed on this platform.
 if(!pkg&&!name.startsWith('@esbuild/'))problems.push(name+': package not installed; license text requires review');
 if(pkg&&!licenseFiles.length){
  if(name.startsWith('@esbuild/')&&lock.packages['node_modules/esbuild'].version===item.version){const text=await fs.readFile('node_modules/esbuild/LICENSE.md','utf8');evidence.push({file:'node_modules/esbuild/LICENSE.md (same upstream version)',sha256:createHash('sha256').update(text).digest('hex')});notices.push(`## ${name}@${item.version} — upstream esbuild license\n\n${text.trim()}\n`);}
  else problems.push(name+': no packaged license notice');
 }
 entries.push({name,version:item.version,license,source:repo||(name.startsWith('@esbuild/')?'https://github.com/evanw/esbuild':null),location,direct:Boolean(root.dependencies?.[name]||root.devDependencies?.[name]),development:Boolean(item.dev),installed:Boolean(pkg),integrity:item.integrity,evidence,obligations:license==='Apache-2.0'?'Retain license and applicable NOTICE; mark modified source; review patent terms.':'Retain copyright and license notices; BSD also preserves its disclaimer and non-endorsement terms.'});
}
await fs.mkdir('docs/v2',{recursive:true});
await fs.writeFile('docs/v2/dependencies.json',JSON.stringify({lockfileVersion:lock.lockfileVersion,packages:entries,reviewRequired:problems},null,2)+'\n');
await fs.writeFile('THIRD_PARTY_NOTICES.md','# Third-party notices\n\nGenerated from the installed, pinned packages. Preserve this file with redistributed bundles. Platform-specific optional packages are listed in docs/v2/dependencies.json; only installed package notices follow. Source code for the bundled legacy Loft site retains its existing ownership and is not relicensed by this inventory.\n\n'+notices.join('\n'));
console.log(JSON.stringify({locked:entries.length,installed:entries.filter(e=>e.installed).length,licenses:[...new Set(entries.map(e=>e.license))],reviewRequired:problems},null,2));
if(problems.length)process.exitCode=1;
