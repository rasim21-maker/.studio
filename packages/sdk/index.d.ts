export const API_VERSION: 1;
export type FieldType = 'text'|'textarea'|'email'|'url'|'path'|'number'|'boolean'|'enum'|'date'|'datetime'|'reference'|'items';
export interface Field {label:string; type:FieldType; required?:boolean; default?:unknown; min?:number; max?:number; step?:number; integer?:boolean; minLength?:number; maxLength?:number; values?:string[]; normalize?:'lowercase'; unique?:boolean; generate?:'uuid'; collection?:string; fields?:Record<string,Field>; minItems?:number; maxItems?:number; help?:string}
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
export interface ModuleDefinition {manifest:{id:string;name:string;description:string;version:string;apiVersion:1;schemaVersion:number;permissions:string[];dependencies?:Record<string,number>;services?:string[]};collections?:Record<string,Collection>;commands?:Record<string,Command>;migrations:{version:number;up:(ctx:Context)=>void}[];onInstall?:(ctx:Context)=>void;exportData?:(ctx:Context)=>unknown}
export function field(label:string,type?:FieldType,options?:Partial<Field>):Field;
export function currencyField():Field;
export function fail(status:number,message:string,details?:unknown):never;
export function checkFields(fields:Record<string,Field>):void;
export function validateFields(fields:Record<string,Field>,input:unknown):{value:Record<string,any>;errors:{path:string;message:string}[]};
export function parseFields(fields:Record<string,Field>,input:unknown):Record<string,any>;
export function defineModule<T extends ModuleDefinition>(definition:T):T;
