import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SQLiteStorage,PostgreSQLStorage} from '@loft-studio/module-core/storage';
import {assertPackageTrust,loadReviewedPackage} from '@loft-studio/module-core/trust';
import {ModuleHost} from '@loft-studio/module-core';
const insert={sqlite:'INSERT INTO notes VALUES (?,?)',postgres:'INSERT INTO notes VALUES ($1,$2)'};
test('storage: SQLite awaits callbacks, rolls back and rejects escaped transaction handles',async()=>{
 const db=new SQLiteStorage(':memory:');let escaped;
 try {
  await db.transaction(tx=>tx.query('CREATE TABLE notes(id TEXT PRIMARY KEY,value TEXT NOT NULL)'));
  await assert.rejects(db.transaction(async tx=>{escaped=tx;await tx.query(insert,['one','before']);await Promise.resolve();throw Error('abort');}));
  assert.equal(await db.transaction(async tx=>(await tx.all('SELECT * FROM notes')).length),0);
  await assert.rejects(escaped.query('SELECT * FROM notes'),{code:'TRANSACTION_CLOSED'});
  await db.transaction(async tx=>{await tx.query(insert,['one','saved']);});
  assert.equal((await db.transaction(tx=>tx.get('SELECT * FROM notes'))).value,'saved');
  await assert.rejects(db.transaction(async tx=>{await tx.query(insert,['two','rollback']);try{await tx.query(insert,['one','duplicate']);}catch{}}),{code:'CONFLICT'});
  assert.equal(await db.transaction(async tx=>(await tx.all('SELECT * FROM notes')).length),1);
  await assert.rejects(db.transaction(()=>db.transaction(()=>{})),{code:'NESTED_TRANSACTION'});
 }finally{await db.close();}
 await assert.rejects(db.transaction(()=>{}),{code:'STORAGE_CLOSED'});
});
test('storage: concurrent SQLite async units cannot interleave writes or commit each other',async()=>{
 const db=new SQLiteStorage(':memory:');let enter,release;const entered=new Promise(r=>enter=r),gate=new Promise(r=>release=r);
 try{
  await db.transaction(tx=>tx.query('CREATE TABLE notes(id TEXT PRIMARY KEY,value TEXT)'));
  const first=db.transaction(async tx=>{await tx.query(insert,['a','discard']);enter();await gate;throw Error('rollback');});
  await entered;let secondEntered=false;
  const second=db.transaction(async tx=>{secondEntered=true;assert.equal((await tx.all('SELECT * FROM notes')).length,0);await tx.query(insert,['b','keep']);});
  await Promise.resolve();assert.equal(secondEntered,false);release();await assert.rejects(first);await second;
  assert.deepEqual((await db.transaction(tx=>tx.all('SELECT id FROM notes'))).map(r=>r.id),['b']);
 }finally{await db.close();}
});
function pgFixture(failQuery=()=>false) {
 const calls=[],releases=[];let connections=0;
 const pool={async connect(){const id=++connections;return{async query(sql,params){calls.push({id,sql,params});const failure=failQuery(sql);if(failure)throw failure;return{rows:sql.startsWith('SELECT')?[{id:'a'}]:[],rowCount:1};},release(discard){releases.push({id,discard});}};}};
 return {db:new PostgreSQLStorage(pool),calls,releases};
}
test('storage: PostgreSQL leases one client and commits only after callback completion',async()=>{
 const {db,calls,releases}=pgFixture();let escaped;
 const value=await db.transaction(async tx=>{escaped=tx;await tx.query(insert,['a','value']);await Promise.resolve();return (await tx.get('SELECT id FROM notes')).id;});
 assert.equal(value,'a');assert.deepEqual(calls.map(c=>c.sql),['BEGIN ISOLATION LEVEL SERIALIZABLE',insert.postgres,'SELECT id FROM notes','COMMIT']);
 assert.equal(new Set(calls.map(c=>c.id)).size,1);assert.deepEqual(releases,[{id:1,discard:false}]);
 await assert.rejects(escaped.query('SELECT 1'),{code:'TRANSACTION_CLOSED'});
});
test('storage: PostgreSQL serialization failure rolls back without replaying callback',async()=>{
 const {db,calls,releases}=pgFixture(sql=>sql==='COMMIT'?Object.assign(Error('serialization'),{code:'40001'}):false);let invoked=0;
 await assert.rejects(db.transaction(async tx=>{invoked++;await tx.query(insert,['a','value']);}),{code:'RETRY_TRANSACTION'});
 assert.equal(invoked,1);assert.equal(calls.at(-1).sql,'ROLLBACK');assert.equal(releases.length,1);
});
test('storage: failed PostgreSQL rollback discards connection',async()=>{
 const {db,releases}=pgFixture(sql=>sql==='ROLLBACK'?Error('connection lost'):false);
 await assert.rejects(db.transaction(()=>{throw Error('business failure');}));
 assert.equal(releases[0].discard,true);
});
test('storage: rejected PostgreSQL query cannot commit even when callback catches it',async()=>{
 const {db,calls}=pgFixture(sql=>sql===insert.postgres?Object.assign(Error('duplicate'),{code:'23505'}):false);
 await assert.rejects(db.transaction(async tx=>{try{await tx.query(insert,['a','x']);}catch{}}),{code:'CONFLICT'});
 assert.equal(calls.some(c=>c.sql==='COMMIT'),false);
});
test('trust: deployment approval precedes evaluation and applies to integrations',async()=>{
 const policy={mode:'reviewed-only',packages:{'acme.notes':'1.0.0'}};let evaluated=false;
 await assert.rejects(loadReviewedPackage({id:'acme.bad',version:'1.0.0',load:()=>{evaluated=true;}},policy));
 assert.equal(evaluated,false);
 const definition={manifest:{id:'acme.notes',version:'1.0.0'}};
 assert.equal(await loadReviewedPackage({id:'acme.notes',version:'1.0.0',load:()=>definition},policy),definition);
 await assert.rejects(loadReviewedPackage({id:'acme.notes',version:'1.0.0',load:()=>({manifest:{id:'acme.other',version:'1.0.0'}})},policy));
 assert.throws(()=>assertPackageTrust('acme.notes','1.0.0',{mode:'isolated'}));
 assert.throws(()=>new ModuleHost({store:{},authorize(){},modules:[],integrations:[{id:'acme.link',version:'1.0.0'}],trustPolicy:policy}),/not approved/);
});
