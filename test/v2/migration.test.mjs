import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {backupData} from '../../scripts/backup-v2.mjs';
test('offline backup preserves operational data and encryption keys without overwriting source or backups',async()=>{
 await fs.mkdir('test-results',{recursive:true});
 const root=await fs.mkdtemp(path.resolve('test-results/backup-')),source=path.join(root,'source'),target=path.join(root,'saved');await fs.mkdir(source);
 const db=new DatabaseSync(path.join(source,'console.sqlite'));db.exec("PRAGMA user_version=4; CREATE TABLE reservations(id TEXT, amount INTEGER); INSERT INTO reservations VALUES ('fixture',12345)");db.close();
 const key=Buffer.alloc(32,7);await fs.writeFile(path.join(source,'integration-key'),key);await fs.writeFile(path.join(source,'studio-key'),key);
 await assert.rejects(()=>backupData(source,target),/offline/);const before=await fs.readFile(path.join(source,'console.sqlite'));const report=await backupData(source,target,{offline:true});assert.equal(report.databaseVersion,4);
 assert.deepEqual(await fs.readFile(path.join(target,'studio-key')),key);assert.deepEqual(await fs.readFile(path.join(source,'console.sqlite')),before);
 const restored=new DatabaseSync(path.join(target,'console.sqlite'),{readOnly:true});assert.equal(restored.prepare('SELECT amount FROM reservations').get().amount,12345);restored.close();
 await assert.rejects(()=>backupData(source,target,{offline:true}),/EEXIST/);await assert.rejects(()=>backupData(source,path.join(source,'recursive'),{offline:true}),/outside/);
});
test('backup includes paired databases with WAL data and refuses a missing live pair',async()=>{
 await fs.mkdir('test-results',{recursive:true});const root=await fs.mkdtemp(path.resolve('test-results/paired-backup-')),source=path.join(root,'source');await fs.mkdir(source);
 const consoleDb=new DatabaseSync(path.join(source,'console.sqlite'));consoleDb.exec("CREATE TABLE studio_operations_origin(state TEXT); INSERT INTO studio_operations_origin VALUES ('live')");consoleDb.close();
 await assert.rejects(()=>backupData(source,path.join(root,'missing'),{offline:true}),/Missing paired operations.sqlite/);
 const opened=['modules.sqlite','operations.sqlite'].map(name=>{const db=new DatabaseSync(path.join(source,name));db.exec("PRAGMA journal_mode=WAL; CREATE TABLE sample(value TEXT); INSERT INTO sample VALUES ('preserved')");return db;});
 try{const target=path.join(root,'saved'),report=await backupData(source,target,{offline:true});
  for(const name of ['console.sqlite','modules.sqlite','operations.sqlite'])assert.ok(report.files.some(entry=>entry.path===name));
  assert.ok(!report.files.some(entry=>/-wal$|-shm$/.test(entry.path)));
  for(const name of ['modules.sqlite','operations.sqlite']){const db=new DatabaseSync(path.join(target,name),{readOnly:true});try{assert.equal(db.prepare('SELECT value FROM sample').get().value,'preserved');}finally{db.close();}}
 }finally{for(const db of opened)db.close();}
});
