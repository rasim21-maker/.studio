import fs from 'node:fs/promises';
import path from 'node:path';
import {DatabaseSync,backup} from 'node:sqlite';
import {parseArgs} from 'node:util';
import {createHash} from 'node:crypto';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function backupData(source,target,{offline=false}={}){
 if(!offline)throw Error('Stop the application first and pass --offline. No service is stopped automatically.');
 const from=await fs.realpath(source),parent=await fs.realpath(path.dirname(path.resolve(target))),to=path.join(parent,path.basename(target));
 const relative=path.relative(from,to);if(!relative||relative!=='..'&&!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative))throw Error('Backup must be outside the source directory.');
 const database=new DatabaseSync(path.join(from,'console.sqlite'),{readOnly:true});
 try{
  if(database.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw Error('Source database integrity check failed.');
  await fs.mkdir(to,{mode:0o700}); // Exclusive destination; never overwrite a previous backup.
  await backup(database,path.join(to,'console.sqlite'));
  const entries=[];
  async function copy(dir,relativeDir=''){
   for(const entry of await fs.readdir(dir,{withFileTypes:true})){
    if(!relativeDir&&['console.sqlite','console.sqlite-wal','console.sqlite-shm'].includes(entry.name))continue;
    if(entry.isSymbolicLink()||!entry.isDirectory()&&!entry.isFile())throw Error('Backup refuses links and special files.');
    const relativeFile=path.join(relativeDir,entry.name),destination=path.join(to,relativeFile);
    if(entry.isDirectory()){await fs.mkdir(destination,{mode:0o700});await copy(path.join(dir,entry.name),relativeFile);}
    else{const bytes=await fs.readFile(path.join(dir,entry.name));await fs.writeFile(destination,bytes,{flag:'wx',mode:0o600});entries.push({path:relativeFile.replaceAll('\\','/'),size:bytes.length,sha256:digest(bytes)});}
   }
  }
  await copy(from);
  const bytes=await fs.readFile(path.join(to,'console.sqlite'));entries.push({path:'console.sqlite',size:bytes.length,sha256:digest(bytes)});
  const verify=new DatabaseSync(path.join(to,'console.sqlite'),{readOnly:true});try{if(verify.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw Error('Backup integrity check failed.');}finally{verify.close();}
  const report={formatVersion:1,created:new Date().toISOString(),databaseVersion:database.prepare('PRAGMA user_version').get().user_version,files:entries};
  await fs.writeFile(path.join(to,'backup-manifest.json'),JSON.stringify(report,null,2)+'\n',{mode:0o600,flag:'wx'});return report;
 }finally{database.close();}
}
if(process.argv[1]&&path.resolve(process.argv[1])===import.meta.filename){
 const {values}=parseArgs({options:{source:{type:'string'},target:{type:'string'},offline:{type:'boolean',default:false}}});
 if(!values.source||!values.target)throw Error('Usage: node scripts/backup-v2.mjs --source <stopped data directory> --target <new backup directory> --offline');
 const report=await backupData(values.source,values.target,{offline:values.offline});console.log(JSON.stringify({files:report.files.length,databaseVersion:report.databaseVersion,integrity:'ok'}));
}
