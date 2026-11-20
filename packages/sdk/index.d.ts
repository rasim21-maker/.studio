export const API_VERSION: 1;
export type FieldType = 'text'|'textarea'|'email'|'url'|'path'|'number'|'boolean'|'enum'|'date'|'datetime'|'reference'|'items';
export interface Field {label:string; type:FieldType; required?:boolean; default?:unknown; min?:number; max?:number; step?:number; integer?:boolean; minLength?:number; maxLength?:number; values?:string[]; normalize?:'lowercase'; unique?:boolean; generate?:'uuid'; collection?:string; module?:string; fields?:Record<string,Field>; minItems?:number; maxItems?:number; help?:string}
export interface ModuleRecord<T=Record<string,any>> {id:string; revision:number; data:T; created:string; updated:string}
export interface Records {
 list(collection:string, options?:{offset?:number;limit?:number;search?:string}): {items:ModuleRecord[];total:number};
 get(collection:string,id:string):ModuleRecord;
 find(collection:string,uniqueField:string,value:unknown):ModuleRecord|undefined;
 put(collection:string,input:{id?:string;revision?:number;data:Record<string,unknown>}):ModuleRecord;
 remove(collection:string,id:string,revision:number):void;
}
export interface Context {site:{id:string;name:string;org_id:string;revision:number;document:any};actor:any;records:Records; transaction<T>(fn:()=>T):T;emit(type:string,data:Record<string,unknown>):void;services:Record<string,any>}
export interface Collection {label:string;permission:string;fields:Record<string,Field>;singleton?:boolean;readOnly?:boolean;beforeSave?:(ctx:Context,value:any,before?:ModuleRecord)=>void;beforeDelete?:(ctx:Context,record:ModuleRecord)=>void}
export interface Command {label:string;permission:string;write?:boolean;fields?:Record<string,Field>;run:(ctx:Context,input:any)=>unknown;help?:string}
export interface EventContract {version:number;fields:Record<string,Field>}
export interface SourceEvent {sequence:number;siteId:string;type:string;data:Record<string,unknown>;actor:string;occurredAt:string}
export interface ModuleDefinition {manifest:{id:string;name:string;description:string;version:string;apiVersion:1;schemaVersion:number;permissions:string[];dependencies?:Record<string,number>;services?:string[]};collections?:Record<string,Collection>;commands?:Record<string,Command>;migrations:{version:number;up:(ctx:Context)=>void}[];onInstall?:(ctx:Context)=>void;exportData?:(ctx:Context)=>unknown;events?:Record<string,EventContract>;eventSource?:{read(after:number,limit:number):SourceEvent[]}}
export function field(label:string,type?:FieldType,options?:Partial<Field>):Field;
export function currencyField():Field;
export function fail(status:number,message:string,details?:unknown):never;
export function checkFields(fields:Record<string,Field>):void;
export function validateFields(fields:Record<string,Field>,input:unknown):{value:Record<string,any>;errors:{path:string;message:string}[]};
export function parseFields(fields:Record<string,Field>,input:unknown):Record<string,any>;
export function defineModule<T extends ModuleDefinition>(definition:T):T;
export type IntegrationRecord = Pick<ModuleRecord,'id'|'revision'|'data'>;
export interface IntegrationContext {
 siteId:string;actor:any;
 records:{get(collection:string,id:string):IntegrationRecord|undefined;list(collection:string,options?:{where?:Record<string,unknown>;limit?:number;offset?:number;search?:string;orderBy?:string}):{items:IntegrationRecord[];total:number};put(collection:string,input:{id?:string;revision?:number;data:Record<string,unknown>}):IntegrationRecord;remove:Records['remove']};
 modules:{get(module:string,collection:string,id:string):ModuleRecord};audit(action:string,data:Record<string,unknown>):void;
}
export interface IntegrationDefinition {
 id:string;name:string;version:string;requires:Record<string,number>;permissions:string[];
 collections:Record<string,{fields:Record<string,Field>}>;
 subscriptions:{module:string;type:string;version:number;run(ctx:IntegrationContext,event:{id:string;type:string;version:number;data:any;actor:string;occurredAt:string}):void}[];
 commands:Record<string,{write?:boolean;fields?:Record<string,Field>;run(ctx:IntegrationContext,input:any):unknown}>;
 views?:{id:string;label:string;module:string;collection:string;kind:'relatedTimeline';command:string;contextField:string;linkCommand?:string;unlinkCommand?:string;linkField?:string}[];
}
export function defineIntegration<T extends IntegrationDefinition>(definition:T):T;
/** Version 2 context: all repository operations must be awaited. */
export interface AsyncRecords {
 list(collection:string,options?:{offset?:number;limit?:number;search?:string}):Promise<{items:ModuleRecord[];total:number}>;
 get(collection:string,id:string):Promise<ModuleRecord>;
 find(collection:string,field:string,value:unknown):Promise<ModuleRecord|undefined>;
 put(collection:string,input:{id?:string;revision?:number;data:Record<string,unknown>}):Promise<ModuleRecord>;
 remove(collection:string,id:string,revision:number):Promise<void>;
}
export interface AsyncContext {
 site:Context['site'];actor:Context['actor'];records:AsyncRecords;
 transaction<T>(work:(ctx:AsyncContext)=>Promise<T>|T):Promise<T>;
 emit(type:string,data:Record<string,unknown>):Promise<void>;
}
export interface AsyncCollection extends Omit<Collection,'beforeSave'|'beforeDelete'> {
 beforeSave?:(ctx:AsyncContext,value:any,before?:ModuleRecord)=>Promise<void>|void;
 beforeDelete?:(ctx:AsyncContext,record:ModuleRecord)=>Promise<void>|void;
}
export interface AsyncCommand extends Omit<Command,'run'> {port?:string;run:(ctx:AsyncContext,input:any)=>Promise<unknown>|unknown}
export interface AsyncModuleDefinition {
 manifest:Omit<ModuleDefinition['manifest'],'apiVersion'|'services'>&{apiVersion:2};
 collections?:Record<string,AsyncCollection>;commands?:Record<string,AsyncCommand>;
 migrations:{version:number;up:(ctx:AsyncContext)=>Promise<void>|void}[];
 onInstall?:(ctx:AsyncContext)=>Promise<void>|void;events?:Record<string,EventContract>;
 ports?:string[];
}
export function defineAsyncModule<T extends AsyncModuleDefinition>(definition:T):T;
export interface AsyncIntegrationContext {
 siteId:string;actor:any;
 records:{get(collection:string,id:string):Promise<IntegrationRecord|undefined>;list(collection:string,options?:Parameters<IntegrationContext['records']['list']>[1]):Promise<{items:IntegrationRecord[];total:number}>;put(collection:string,input:Parameters<Records['put']>[1]):Promise<IntegrationRecord>;remove(collection:string,id:string,revision:number):Promise<void>};
 modules:{get(module:string,collection:string,id:string):Promise<ModuleRecord>};audit(action:string,data:Record<string,unknown>):Promise<void>;
}
export interface AsyncIntegrationDefinition extends Omit<IntegrationDefinition,'commands'|'subscriptions'> {
 apiVersion:2;
 commands:Record<string,{write?:boolean;fields?:Record<string,Field>;run(ctx:AsyncIntegrationContext,input:any):Promise<unknown>}>;
 subscriptions:{module:string;type:string;version:number;run(ctx:AsyncIntegrationContext,event:Parameters<IntegrationDefinition['subscriptions'][number]['run']>[1]):Promise<void>}[];
}
