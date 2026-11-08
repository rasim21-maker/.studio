import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {secureBackupData,verifySecureBackup,restoreSecureBackup} from '../../scripts/secure-backup-v2.mjs';
async function fixture(){
 await fs.mkdir('test-results',{recursive:true});const root=await fs.mkdtemp(path.resolve('test-results/secure-backup-')),source=path.join(root,'source');
 await fs.mkdir(source);const db=new DatabaseSync(path.join(source,'console.sqlite'));
 db.exec("CREATE TABLE reservations(id TEXT PRIMARY KEY,amount INTEGER); INSERT INTO reservations VALUES ('after-upgrade',25000)");db.close();
 const key=randomBytes(32);await fs.writeFile(path.join(source,'studio-key'),key);await fs.writeFile(path.join(source,'integration-key'),key);
 await fs.writeFile(path.join(source,'studio-vault.json'),JSON.stringify({fixture:key.toString('base64')}));
 await fs.writeFile(path.join(source,'.env'),"EXAMPLE=fixture-secret\n");await fs.mkdir(path.join(source,'assets'));await fs.writeFile(path.join(source,'assets','example.txt'),'source preserved');
 return {root,source,key,recovery:randomBytes(32),target:path.join(root,'data-backup'),keys:path.join(root,'keys.enc')};
}
test('D-02 E-06: separate encrypted key backup restores into a new directory with operational records intact',async()=>{
 const f=await fixture(),sourceBefore=await fs.readFile(path.join(f.source,'console.sqlite'));
 const report=await secureBackupData(f.source,f.target,f.keys,f.recovery,{offline:true});assert.equal(report.keyFiles,4);
 const files=await fs.readdir(f.target);for(const key of ['studio-key','integration-key','studio-vault.json','.env'])assert.ok(!files.includes(key));
 assert.ok(!(await fs.readFile(f.keys,'utf8')).includes(f.key.toString('base64')));
 assert.equal((await verifySecureBackup(f.target,f.keys,f.recovery)).integrity,'ok');
 const restored=path.join(f.root,'restored');await restoreSecureBackup(f.target,f.keys,restored,f.recovery);
 assert.deepEqual(await fs.readFile(path.join(restored,'studio-key')),f.key);
 assert.equal(await fs.readFile(path.join(restored,'assets','example.txt'),'utf8'),'source preserved');
 const db=new DatabaseSync(path.join(restored,'console.sqlite'),{readOnly:true});assert.equal(db.prepare('SELECT amount FROM reservations').get().amount,25000);db.close();
 assert.deepEqual(await fs.readFile(path.join(f.source,'console.sqlite')),sourceBefore);
 await assert.rejects(()=>restoreSecureBackup(f.target,f.keys,restored,f.recovery),/EEXIST/);
});
test('D-02: wrong recovery key and mixed backup sets are rejected before creating a restore target',async()=>{
 const a=await fixture(),b=await fixture();await secureBackupData(a.source,a.target,a.keys,a.recovery,{offline:true});await secureBackupData(b.source,b.target,b.keys,b.recovery,{offline:true});
 const target=path.join(a.root,'not-created');
 await assert.rejects(()=>restoreSecureBackup(a.target,a.keys,target,randomBytes(32)),/authentication/);
 await assert.rejects(()=>restoreSecureBackup(a.target,b.keys,target,a.recovery),/match/);
 await assert.rejects(()=>fs.stat(target),{code:'ENOENT'});
});
test('D-02: corruption and incomplete two-part backups cannot be restored',async()=>{
 const f=await fixture();await secureBackupData(f.source,f.target,f.keys,f.recovery,{offline:true});
 await fs.appendFile(path.join(f.target,'assets','example.txt'),'corruption');
 await assert.rejects(()=>verifySecureBackup(f.target,f.keys,f.recovery),/integrity/);
 const incomplete=await fixture();await fs.writeFile(incomplete.keys,'occupied');
 await assert.rejects(()=>secureBackupData(incomplete.source,incomplete.target,incomplete.keys,incomplete.recovery,{offline:true}),/EEXIST/);
 await assert.rejects(()=>fs.stat(path.join(incomplete.target,'secure-backup.json')),{code:'ENOENT'});
});
test('D-02: secure backup requires an offline source and keeps both targets outside it',async()=>{
 const f=await fixture();
 await assert.rejects(()=>secureBackupData(f.source,f.target,f.keys,f.recovery),/offline/);
 await assert.rejects(()=>secureBackupData(f.source,path.join(f.source,'backup'),f.keys,f.recovery,{offline:true}),/separate/);
 await assert.rejects(()=>secureBackupData(f.source,f.target,path.join(f.source,'keys.enc'),f.recovery,{offline:true}),/separate/);
});

test('D-02: combined oversized key files fail before creating the data backup',async()=>{
 const f=await fixture();
 for(let i=0;i<4;i++)await fs.writeFile(path.join(f.source,'.env.fixture'+i),Buffer.alloc(256*1024,97));
 await assert.rejects(()=>secureBackupData(f.source,f.target,f.keys,f.recovery,{offline:true}),/size limit/);
 await assert.rejects(()=>fs.stat(f.target),{code:'ENOENT'});
 await assert.rejects(()=>fs.stat(f.keys),{code:'ENOENT'});
});

test('D-02 E-06: differently cased runtime keys never enter the unencrypted data copy',async()=>{
 const f=await fixture();
 // Rename via an intermediate path so the spelling changes on Windows too.
 await fs.rename(path.join(f.source,'studio-key'),path.join(f.source,'case-intermediate'));
 await fs.rename(path.join(f.source,'case-intermediate'),path.join(f.source,'STUDIO-KEY'));
 await fs.rename(path.join(f.source,'.env'),path.join(f.source,'env-intermediate'));
 await fs.rename(path.join(f.source,'env-intermediate'),path.join(f.source,'.ENV'));
 const result=await secureBackupData(f.source,f.target,f.keys,f.recovery,{offline:true});assert.equal(result.keyFiles,4);
 const entries=await fs.readdir(f.target);assert.ok(!entries.includes('STUDIO-KEY'));assert.ok(!entries.includes('.ENV'));
 assert.equal((await verifySecureBackup(f.target,f.keys,f.recovery)).integrity,'ok');
});
