import type {AsyncModuleDefinition,ModuleRecord} from '@loft-studio/sdk';
import type {Storage} from './storage.mjs';
export interface AuthorizedSite {id:string;org_id:string;name:string;revision?:number;document?:unknown;allowed?:string[]}
export interface Actor {user_id:string}
export interface AsyncHostOptions {
 storage:Storage;modules:AsyncModuleDefinition[];
 authorize:(actor:Actor,siteId:string,permission?:string)=>Promise<AuthorizedSite>|AuthorizedSite;
 trustPolicy?:{mode:'trusted-local'|'reviewed-only';packages?:Record<string,string>};
}
export class AsyncModuleHost {
 constructor(options:AsyncHostOptions);
 initialize():Promise<this>;
 lifecycle(actor:Actor,siteId:string,moduleId:string,action:'install'|'upgrade'|'enable'|'disable'|'uninstall',expected:number):Promise<unknown>;
 collection(actor:Actor,siteId:string,moduleId:string,collection:string,method:'GET'|'PUT'|'DELETE',input?:Record<string,unknown>):Promise<unknown>;
 execute(actor:Actor,siteId:string,moduleId:string,command:string,input:unknown):Promise<unknown>;
 export(actor:Actor,siteId:string,moduleId:string):Promise<{format:string;version:number;module:AsyncModuleDefinition['manifest'];siteId:string;installation:unknown;records:(ModuleRecord&{collection:string})[]}>;
 importLegacy(actor:Actor,siteId:string,moduleId:string,snapshot:unknown):Promise<{records:number;installation:unknown}>;
}
