import {parse} from 'parse5';
import {attr,findNodes} from './render.ts';
import {safeTextCandidate} from './field-mapping.ts';
import {digest} from './import.ts';
import {inspectFramework} from './framework-discovery.ts';
import {fail} from '../util.mjs';
import type {Document,Source} from '../../shared/v2/model.ts';
const tags=new Set(['span','li','dt','dd','figcaption','address','div','label']);
const bound=(n:any)=>(n.attrs||[]).some((a:any)=>/^data-studio-(field|href|src|alt)$/.test(a.name));
export function manualCandidates(document:Document,source:Source){
 const result:{key:string;file:string;page:string;sectionId:string;section:string;tag:string;path:string;sample:string;value:string;offset:number}[]=[];
 if(source.manifest.adapter.id!=='static'||source.manifest.editableFields!==undefined||inspectFramework(source).names.length)return result;
 for(const page of document.pages){
  const html=source.files[page.path],fingerprint=digest(html),tree=parse(html,{sourceCodeLocationInfo:true}) as any;
  for(const section of page.sections.filter(s=>s.kind==='source')){
   const roots=findNodes(tree,n=>attr(n,'data-studio-id')===section.id);if(roots.length!==1)continue;
   const visit=(node:any,path:string,blocked:boolean)=>{
    if(result.length>=200)return;
    blocked=blocked||bound(node);
    const value=(node.childNodes||[]).map((n:any)=>n.nodeName==='#text'?n.value:'').join('');
    if(!blocked&&tags.has(node.tagName)&&safeTextCandidate(node)&&(node.childNodes||[]).every((n:any)=>n.nodeName==='#text')&&value.trim()&&value.length<=12000&&!/[<>\u0000-\u001f\u007f]/.test(value)){
     let offset=node.sourceCodeLocation.startTag.endOffset-1;if(html[offset-1]==='/')offset--;
     result.push({key:digest(JSON.stringify([page.path,section.id,fingerprint,offset])),file:page.path,page:page.id,sectionId:section.id,section:section.name,tag:node.tagName,path,sample:value.slice(0,300),value,offset});
    }
    const counts:Record<string,number>={};for(const child of node.childNodes||[])if(child.tagName){counts[child.tagName]=(counts[child.tagName]||0)+1;visit(child,path+' > '+child.tagName+':nth-of-type('+counts[child.tagName]+')',blocked);}
   };visit(roots[0],roots[0].tagName, false);
  }
 }
 return result;
}
export function applyManualFields(document:Document,source:Source,keys:unknown){
 const candidates=manualCandidates(document,source),byKey=new Map(candidates.map(c=>[c.key,c]));
 if(!Array.isArray(keys)||keys.length>200||keys.some(k=>typeof k!=='string'||!byKey.has(k))||new Set(keys).size!==keys.length)fail(422,'DOM seçimi geçersiz veya kaynak değişmiş; keşif raporunu yenileyin.');
 if(!(keys as string[]).length)return{document:structuredClone(document),source:structuredClone(source)};
 const next=structuredClone(document),mapped=structuredClone(source),patches=new Map<string,{offset:number;text:string}[]>();
 for(const key of keys as string[]){const c=byKey.get(key)!,section=next.pages.find(p=>p.id===c.page)!.sections.find(s=>s.id===c.sectionId)!,id='m'+key.slice(0,30);
  if(section.fields.length>=40)fail(422,'Bölüm başına 40 alan sınırı aşıldı; otomatik veya manuel seçimleri azaltın.');
  if(section.fields.some(f=>f.id===id))fail(422,'Alan zaten eşlenmiş.');
  section.fields.push({id,label:c.value.trim().slice(0,70),type:'text',value:c.value,maxLength:12000});
  mapped.bindings.push({id,page:c.page,section:c.sectionId,field:id,file:c.file,tag:c.tag});
  const list=patches.get(c.file)||[];list.push({offset:c.offset,text:' data-studio-field="'+id+'"'});patches.set(c.file,list);
 }
 for(const [file,list]of patches)for(const p of list.sort((a,b)=>b.offset-a.offset))mapped.files[file]=mapped.files[file].slice(0,p.offset)+p.text+mapped.files[file].slice(p.offset);
 mapped.files['studio/source-state.json']=JSON.stringify({version:1,document:next,hashes:Object.fromEntries(next.pages.map(p=>[p.path,digest(mapped.files[p.path])]))},null,2);
 return{document:next,source:mapped};
}
