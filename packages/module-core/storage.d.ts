export const STORAGE_API_VERSION: 1;
export type Dialect = 'sqlite'|'postgres';
export type Statement = string | {sqlite:string;postgres:string};
export interface QueryResult<T=Record<string,unknown>> {rows:T[];rowCount?:number|null}
export interface Transaction {
  query<T=Record<string,unknown>>(sql:Statement,params?:unknown[]):Promise<QueryResult<T>>;
  get<T=Record<string,unknown>>(sql:Statement,params?:unknown[]):Promise<T|undefined>;
  all<T=Record<string,unknown>>(sql:Statement,params?:unknown[]):Promise<T[]>;
}
export interface Storage {
  readonly dialect:Dialect;
  readonly apiVersion:1;
  transaction<T>(work:(tx:Transaction)=>Promise<T>|T):Promise<T>;
}
export class StorageError extends Error {code:string}
export class SQLiteStorage implements Storage {
  constructor(filename:string);
  readonly dialect:'sqlite';readonly apiVersion:1;
  transaction<T>(work:(tx:Transaction)=>Promise<T>|T):Promise<T>;
  close():Promise<void>;
}
export interface PostgreSQLPool {
  connect():Promise<{query(sql:string,params?:unknown[]):Promise<QueryResult>;release(discard?:boolean):void}>;
}
export class PostgreSQLStorage implements Storage {
  constructor(pool:PostgreSQLPool);
  readonly dialect:'postgres';readonly apiVersion:1;
  transaction<T>(work:(tx:Transaction)=>Promise<T>|T):Promise<T>;
}
