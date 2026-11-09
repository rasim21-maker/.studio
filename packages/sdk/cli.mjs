#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {defineModule} from './index.mjs';
const [action, target, id='acme.notes'] = process.argv.slice(2);
if(action==='check'&&target){
  const module=defineModule((await import(pathToFileURL(path.resolve(target)).href)).default);
  console.log(JSON.stringify({id:module.manifest.id,version:module.manifest.version,apiVersion:module.manifest.apiVersion,collections:Object.keys(module.collections||{}),commands:Object.keys(module.commands||{})},null,2));
}else if(action==='create'&&target){
  if(!/^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/.test(id))throw Error('Use a namespaced module ID, for example acme.notes.');
  const directory=path.resolve(target);await fs.mkdir(directory); // Never overwrite an existing directory.
  const pkg={name:id.replace('.','-'),version:'0.1.0',private:true,type:'module',exports:'./index.mjs',files:['index.mjs','README.md'],peerDependencies:{'@loft-studio/sdk':'0.1.0'},scripts:{check:'studio-module check index.mjs'}};
  const code=`import {defineModule,field} from '@loft-studio/sdk';
export default defineModule({
 manifest:{id:${JSON.stringify(id)},name:'Notes',description:'An independent example module.',version:'1.0.0',apiVersion:1,schemaVersion:1,permissions:['content']},
 collections:{notes:{label:'Notes',permission:'content',fields:{title:field('Title','text',{required:true,maxLength:120}),body:field('Body','textarea',{maxLength:4000})}}},
 migrations:[{version:1,up(){}}],commands:{}
});
`;
  await fs.writeFile(path.join(directory,'package.json'),JSON.stringify(pkg,null,2)+'\n');
  await fs.writeFile(path.join(directory,'index.mjs'),code);
  await fs.writeFile(path.join(directory,'README.md'),'# '+id+'\n\nInstall the pinned Studio SDK, then run npm run check. Add this trusted package to studio.config.mjs. The host supplies scoped storage, validation, forms and authorization. Choose your package license before distribution.\n');
  console.log('Created '+directory);
}else{
 console.error('Usage: studio-module create <new-directory> [namespace.name]\n       studio-module check <trusted-module-entry.mjs>');process.exitCode=1;
}
