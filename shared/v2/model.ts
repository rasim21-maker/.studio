export type FieldType = 'text' | 'rich' | 'url' | 'image' | 'number' | 'boolean' | 'enum';
export interface Field { id:string; label:string; type:FieldType; value:string|number|boolean; required?:boolean; min?:number; max?:number; maxLength?:number; step?:number; dictionary?:string; translations?:Record<string,string>; }
export interface Layout { display?:'stack'|'grid'|'flex'; columns?:number; gap?:number; padding?:number; margin?:number; maxWidth?:number; align?:'left'|'center'|'right'|'stretch'; vertical?:'start'|'center'|'end'; textAlign?:'left'|'center'|'right'|'justify'; autoAlign?:boolean; }
export interface Responsive { desktop:Layout; tablet:Layout; mobile:Layout; }
export interface Section { id:string; name:string; kind:'source'|'text'|'hero'|'image'|'cta'|'booking'|'gadget'; enabled:boolean; fields:Field[]; layout:Responsive; }
export interface Page { id:string; name:string; path:string; title:string; description:string; sections:Section[]; layout:Responsive; }
export interface Dictionary { id:string; version:number; mode:'strict'|'suggest'; entries:{id:string; labels:Record<string,string>; active:boolean; aliases:string[]}[]; }
export interface Document { schemaVersion:2; name:string; locale:string; locales:string[]; theme:{preset:string; font:'system'|'serif'|'mono'; radius:number}; pages:Page[]; dictionaries:Dictionary[]; }
export type CapabilityState = 'supported'|'partial'|'unsupported';
export interface Capability { state:CapabilityState; reason:string; }
export type Capabilities = Record<string,Capability>;
export type Files = Record<string,string>; // UTF-8 source files; media is stored separately, as base64.
export interface Asset { mime:string; base64:string; size:number; width?:number; height?:number; }
export interface Binding { id:string; page:string; section:string; field?:string; file:string; tag:string; attribute?:string; }
export interface Source { files:Files; assets:Record<string,Asset>; bindings:Binding[]; manifest:Manifest; }
export interface Connection { id:string; kind:'files'|'github'|'wordpress'|'studio'; authority:string[]; }
export interface Manifest { manifestVersion:2; adapter:{id:string; version:1}; name:string; contentPath?:string; locales:string[]; connections:Connection[]; editableFields?:string[]; preview:{mode:'inert'|'sdk'}; publish:{mode:'export'|'conditional-api'}; }
export interface SiteRecord { id:string; org_id:string; workspace_id:string; project_id:string; environment:string; adapter:string; name:string; revision:number; document:Document; source:Source; }
export interface Adapter {
 id:string; version:1; discover(source:Source):{document:Document; source:Source; warnings:string[]};
 capabilities(source:Source):Capabilities;
 validate(before:Document,after:Document,source:Source):{path:string;message:string}[];
 write(before:Document,after:Document,source:Source):Source;
 preview(document:Document,source:Source,page:string):string;
 export(document:Document,source:Source):Files;
 publish?(document:Document,source:Source,connection:{kind:string;config:any;secrets:any;request:(url:string,options:any)=>Promise<{status:number;body:Uint8Array}>}):Promise<{remoteRevision:string}>;
}
export const emptyLayout=():Responsive=>({desktop:{},tablet:{},mobile:{}});
export const themes:Record<string,[string,string,string,string,string]>={
 original:['Özgün','#ffffff','#171717','#f6d434','#f5f5ef'],warm:['Sıcak','#fff9ef','#382d22','#e8bd64','#f5ead9'],forest:['Orman','#f3f7ed','#244338','#c1d986','#e4edde'],midnight:['Gece','#f4f6fb','#252b48','#aeb9ee','#e7eaf4'],ocean:['Okyanus','#f0f9fb','#123e52','#8bd8e7','#dff0f5'],rose:['Gül','#fff5f6','#512a39','#efb5c3','#f7e4e9'],terracotta:['Terrakota','#fff7f0','#543527','#edb08b','#f2e4d9'],lavender:['Lavanta','#f8f5ff','#3c3159','#c9b6ed','#ede6f7'],mint:['Nane','#f1fcf7','#214c41','#9de0bd','#def2e7'],editorial:['Editoryal','#faf9f6','#252523','#d4d0c2','#edebe5'],citrus:['Narenciye','#fefff0','#374125','#dcdf7a','#f1f3d9'],slate:['Arduvaz','#f4f7f9','#283c4b','#a8c6d7','#e4ecf1']};
export const templates:Record<string,{name:string;layout:Layout}>={original:{name:'Özgün',layout:{}},spacious:{name:'Geniş tek sütun',layout:{display:'stack',gap:48,padding:32,maxWidth:1100}},cards:{name:'İki sütun kartlar',layout:{display:'grid',columns:2,gap:24,padding:24}},magazine:{name:'Üç sütun dergi',layout:{display:'grid',columns:3,gap:24,padding:24}},sidebar:{name:'İçerik + panel',layout:{display:'grid',columns:2,gap:32,maxWidth:1200}},compact:{name:'Kompakt',layout:{display:'stack',gap:12,padding:16,maxWidth:960}},landing:{name:'Geniş karşılama',layout:{display:'stack',gap:64,padding:48,maxWidth:1440}}};
export const permissions=['content','design','import','operations','integrations','publish','members'] as const;
export const schemaId='https://loft.studio/schemas/document/2';
export const newSection=(kind:Section['kind'],id:string):Section=>{
 const field=(key:string,label:string,type:FieldType,value:Field['value'],maxLength=500):Field=>({id:key,label,type,value,maxLength});
 const fields=[field('heading','Başlık','text','Yeni bölüm',160),field('body','İçerik','rich','<p>İçeriğinizi buraya ekleyin.</p>',12000)];
 if(kind==='image')fields.push(field('image','Görsel','image',''),{...field('alt','Alternatif metin','text',''),required:true});
 if(kind==='cta')fields.push(field('label','Bağlantı metni','text','Daha fazla'),field('href','Bağlantı','url','https://example.com'));
 if(kind==='gadget')fields.push({...field('gadget','Veri türü','enum','weather'),dictionary:'gadgets'});
 return {id,name:'Yeni bölüm',kind,enabled:true,fields,layout:emptyLayout()};
};
export const defaultDictionaries=():Dictionary[]=>[{id:'gadgets',version:1,mode:'strict',entries:[['weather','Hava durumu'],['news','Haberler'],['stocks','Hisseler'],['index','Endeks'],['traffic','Trafik']].map(([id,label])=>({id,labels:{tr:label,en:id},active:true,aliases:[]}))}];
