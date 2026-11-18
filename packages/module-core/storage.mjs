import {AsyncLocalStorage} from 'node:async_hooks';
import {DatabaseSync} from 'node:sqlite';

export const STORAGE_API_VERSION = 1;
export class StorageError extends Error {
  constructor(code, message, options) { super(message, options); this.code=code; }
}
const error=(code,message)=>new StorageError(code,message);
function normalize(e) {
  if(Number.isInteger(e?.status)&&e.status>=400&&e.status<500)return e;
  if(e instanceof StorageError)return e;
  const code=e?.code==='40001'||e?.code==='40P01'?'RETRY_TRANSACTION':
    e?.code==='23505'||String(e?.message).includes('UNIQUE constraint failed')?'CONFLICT':'STORAGE_FAILURE';
  return new StorageError(code,'Storage operation failed.',{cause:e});
}
function statement(input,dialect) {
  const sql=typeof input==='string'?input:input?.[dialect];
  if(typeof sql!=='string'||!sql.trim())throw error('INVALID_STATEMENT','A statement for the selected dialect is required.');
  return sql;
}
// SQL is a trusted repository implementation detail, never a module/user API.
function unit(execute,dialect) {
  let active=true,pending=Promise.resolve(),failed;
  const query=(sql,params=[])=>{
    if(!active)return Promise.reject(error('TRANSACTION_CLOSED','Transaction scope has ended.'));
    if(!Array.isArray(params))return Promise.reject(error('INVALID_PARAMETERS','Parameters must be an array.'));
    let text;try{text=statement(sql,dialect);}catch(e){return Promise.reject(e);}
    const result=pending.then(()=>{if(failed)throw failed;return execute(text,params);});
    pending=result.then(()=>{},e=>{failed=normalize(e);});
    return result.catch(e=>{throw normalize(e);});
  };
  return {
    api:Object.freeze({query,
      async get(sql,params){return (await query(sql,params)).rows[0];},
      async all(sql,params){return (await query(sql,params)).rows;}}),
    async finish(){active=false;await pending;if(failed)throw failed;},
    async abort(){active=false;await pending;}
  };
}

/** Dedicated SQLite connection: do not share it with the synchronous legacy Store. */
export class SQLiteStorage {
  #db; #tail=Promise.resolve(); #context=new AsyncLocalStorage(); #closed=false;
  dialect='sqlite'; apiVersion=STORAGE_API_VERSION;
  constructor(filename) {
    this.#db=new DatabaseSync(filename);
    this.#db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;');
  }
  #enqueue(work) {const result=this.#tail.then(work);this.#tail=result.catch(()=>{});return result;}
  async transaction(work) {
    if(this.#context.getStore())throw error('NESTED_TRANSACTION','Use the supplied transaction handle; nested transactions are unsupported.');
    if(this.#closed)throw error('STORAGE_CLOSED','Storage is closed.');
    return this.#enqueue(()=>this.#context.run(true,async()=>{
      let begun=false;
      const tx=unit(async(sql,params)=>{
        const prepared=this.#db.prepare(sql);
        if(prepared.columns().length)return {rows:prepared.all(...params),rowCount:undefined};
        const result=prepared.run(...params);return {rows:[],rowCount:Number(result.changes)};
      },this.dialect);
      try {
        this.#db.exec('BEGIN IMMEDIATE');begun=true;
        const result=await work(tx.api);await tx.finish();
        this.#db.exec('COMMIT');return result;
      } catch(e) {
        await tx.abort();
        if(begun)try{this.#db.exec('ROLLBACK');}catch(rollback){this.#closed=true;throw new StorageError('ROLLBACK_FAILED','SQLite connection cannot be reused.',{cause:rollback});}
        throw normalize(e);
      }
    }));
  }
  async close() {
    if(this.#context.getStore())throw error('NESTED_TRANSACTION','Cannot close storage inside a transaction.');
    if(this.#closed)return;this.#closed=true;await this.#enqueue(()=>this.#db.close());
  }
}

/** Inject a node-postgres compatible pool; the application owns pool shutdown. */
export class PostgreSQLStorage {
  #pool; #context=new AsyncLocalStorage();
  dialect='postgres'; apiVersion=STORAGE_API_VERSION;
  constructor(pool) {if(typeof pool?.connect!=='function')throw error('INVALID_POOL','A PostgreSQL connection pool is required.');this.#pool=pool;}
  async transaction(work) {
    if(this.#context.getStore())throw error('NESTED_TRANSACTION','Use the supplied transaction handle; nested transactions are unsupported.');
    return this.#context.run(true,async()=>{
      let client,begun=false,discard=false,tx;
      try {
        client=await this.#pool.connect();
        await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');begun=true;
        tx=unit(async(sql,params)=>{const result=await client.query(sql,params);return {rows:result.rows,rowCount:result.rowCount};},this.dialect);
        const result=await work(tx.api);await tx.finish();
        await client.query('COMMIT');return result;
      } catch(e) {
        if(tx)await tx.abort();
        if(client&&begun)try{await client.query('ROLLBACK');}catch{discard=true;}
        else if(client)discard=true;
        throw normalize(e);
      } finally {client?.release(discard);}
    });
  }
}
