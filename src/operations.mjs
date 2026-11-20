import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {AsyncLocalStorage} from 'node:async_hooks';
import {SQLiteStorage,StorageError} from '@loft-studio/module-core/storage';
import {AsyncAudit} from '@loft-studio/audit/async';
import {OperationsRepository,operationTables} from '../packages/booking/repository.mjs';
import {AsyncBooking} from '../packages/booking/async-engine.mjs';
import {Booking} from '@loft-studio/booking';
import {Integrations} from './integrations.mjs';
import {AsyncPayments} from './async-payments.mjs';

export async function createOperations({store,dataDir,security={}}){
 // Only initializes/reads the legacy schema for migration; no compatibility writer is served.
 new Booking(store);new Integrations(store,Buffer.alloc(32));
 const owned=!security.operationsStorage,storage=security.operationsStorage||new SQLiteStorage(path.join(dataDir,'operations.sqlite'));
 const authorization=new AsyncLocalStorage();
 const resolveSite=async id=>{
  const exists=store.get("SELECT name FROM sqlite_master WHERE type='table' AND name='studio_sites'");
  const site=exists&&store.get('SELECT id,org_id FROM studio_sites WHERE id=?',id);
  if(site)return site;return store.get('SELECT id FROM sites WHERE id=?',id)?{id,org_id:'legacy-local'}:undefined;
 };
 try{
  const audit=await new AsyncAudit({storage,context:()=>store.audit?.current()||{}}).initialize();
  const repository=await new OperationsRepository({storage,resolveSite,audit,actor:()=>store.audit?(store.audit.current().actorId||'anonymous'):'system:operations',authorize:async()=>{await authorization.getStore()?.();}}).initialize();
  await migrate(store,repository);
  const booking=new AsyncBooking(repository,{hasPaymentLock:(site,id)=>payments.hasPaymentLock(site,id)});
  const payments=await AsyncPayments.open(repository,dataDir,{fetcher:security.integrationFetcher||fetch,assertWritable:site=>booking.assertWritable(site)});
  return {booking,integrations:payments,repository,asyncAudit:audit,
   authorized:(check,work)=>authorization.run(check,work),
   async enableSite(site){store.run('INSERT OR IGNORE INTO sites VALUES (?,?)',site.id,JSON.stringify({id:site.id,name:site.name,adapter:'studio-operations',studioSite:site.id}));await booking.provision(site);},
   async close(){if(owned)await storage.close();}
  };
 }catch(e){if(owned)await storage.close();throw e;}
}

async function migrate(source,repo){
 source.db.exec('CREATE TABLE IF NOT EXISTS studio_operations_origin(id TEXT PRIMARY KEY,state TEXT NOT NULL)');
 let origin=source.get('SELECT * FROM studio_operations_origin');if(!origin){origin={id:randomUUID(),state:'copying'};source.run('INSERT INTO studio_operations_origin VALUES (?,?)',origin.id,origin.state);}
 source.transaction(()=>{for(const table of operationTables)for(const op of ['INSERT','UPDATE','DELETE'])source.db.exec(`CREATE TRIGGER IF NOT EXISTS ops_freeze_${table}_${op} BEFORE ${op} ON ${table} BEGIN SELECT RAISE(ABORT,'Operational storage moved to async repository'); END;`);});
 await repo.storage.transaction(async tx=>{
  await tx.query('CREATE TABLE IF NOT EXISTS studio_operations_origin(id TEXT PRIMARY KEY)');
  const target=await tx.get('SELECT id FROM studio_operations_origin');
  if(target){if(target.id!==origin.id)throw new StorageError('MIGRATION_REQUIRED','Operations database belongs to another source.');return;}
  if(origin.state==='live')throw new StorageError('MIGRATION_REQUIRED','Authoritative operations database is missing; restore the complete backup.');
  for(const site of source.all('SELECT id FROM sites')){const scope=await repo.resolveSite(site.id);await tx.query(repo.sql('INSERT INTO studio_ops_scopes VALUES (?,?,0)'),[site.id,scope.org_id]);}
  for(const table of operationTables){
   if(Number((await tx.get(repo.sql('SELECT COUNT(*) n FROM '+table))).n))throw new StorageError('MIGRATION_REQUIRED','Operational migration target must be empty.');
   for(const row of source.all('SELECT * FROM '+table)){
    const columns=Object.keys(row);if(columns.some(c=>!/^\w+$/.test(c)))throw Error('Invalid source columns');
    await tx.query(repo.sql('INSERT INTO '+table+' ('+columns.join(',')+') VALUES ('+columns.map(()=>'?').join(',')+')'),Object.values(row));
   }
   const before=source.get('SELECT COUNT(*) n FROM '+table).n,after=Number((await tx.get(repo.sql('SELECT COUNT(*) n FROM '+table))).n);if(before!==after)throw Error('Operational copy count mismatch');
  }
  if(repo.storage.dialect==='postgres')await tx.query("SELECT setval(pg_get_serial_sequence('studio_ops_booking_changes','sequence'),COALESCE((SELECT MAX(sequence) FROM studio_ops_booking_changes),1),EXISTS(SELECT 1 FROM studio_ops_booking_changes))");
  await tx.query(repo.sql('INSERT INTO studio_operations_origin VALUES (?)'),[origin.id]);
 });
 source.run("UPDATE studio_operations_origin SET state='live' WHERE id=?",origin.id);
}
