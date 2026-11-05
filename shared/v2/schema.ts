import {themes,schemaId} from './model.ts';
const id={type:'string',pattern:'^[a-zA-Z][a-zA-Z0-9_-]{0,79}$'};
const text=(max:number,min=0)=>({type:'string',minLength:min,maxLength:max});
const integer=(min:number,max:number)=>({type:'integer',minimum:min,maximum:max});
const object=(properties:Record<string,unknown>,required:string[]=Object.keys(properties))=>({type:'object',additionalProperties:false,properties,required});
export const layoutSchema=object({display:{enum:['stack','grid','flex']},columns:integer(1,4),gap:integer(0,160),padding:integer(0,160),margin:integer(0,160),maxWidth:integer(320,1920),align:{enum:['left','center','right','stretch']},vertical:{enum:['start','center','end']},textAlign:{enum:['left','center','right','justify']},autoAlign:{type:'boolean'}},[]);
const responsive=object({desktop:layoutSchema,tablet:layoutSchema,mobile:layoutSchema});
const localized={type:'object',maxProperties:30,propertyNames:{pattern:'^[a-z]{2,3}(-[A-Z]{2})?$'},additionalProperties:text(12000)};
const field=object({id,label:text(120,1),type:{enum:['text','rich','url','image','number','boolean','enum']},value:{type:['string','number','boolean'],maxLength:12000},required:{type:'boolean'},min:{type:'number'},max:{type:'number'},maxLength:integer(1,12000),step:{type:'number',exclusiveMinimum:0},dictionary:id,translations:localized},['id','label','type','value']);
const section=object({id,name:text(150,1),kind:{enum:['source','text','hero','image','cta','booking','gadget']},enabled:{type:'boolean'},fields:{type:'array',maxItems:40,items:field},layout:responsive});
export const documentSchema={$id:schemaId,type:'object',additionalProperties:false,required:['schemaVersion','name','locale','locales','theme','pages','dictionaries'],properties:{
 schemaVersion:{const:2},name:text(120,1),locale:{type:'string',pattern:'^[a-z]{2,3}(-[A-Z]{2})?$'},locales:{type:'array',minItems:1,maxItems:30,uniqueItems:true,items:{type:'string',pattern:'^[a-z]{2,3}(-[A-Z]{2})?$'}},
 theme:object({preset:{enum:Object.keys(themes)},font:{enum:['system','serif','mono']},radius:integer(0,48)}),
 pages:{type:'array',minItems:1,maxItems:40,items:object({id,name:text(120,1),path:text(200,1),title:text(160),description:text(400),layout:responsive,sections:{type:'array',maxItems:60,items:section}})},
 dictionaries:{type:'array',maxItems:30,items:object({id,version:integer(1,2147483647),mode:{enum:['strict','suggest']},entries:{type:'array',maxItems:500,items:object({id,labels:localized,active:{type:'boolean'},aliases:{type:'array',maxItems:30,uniqueItems:true,items:text(120,1)}})}})}
}};
