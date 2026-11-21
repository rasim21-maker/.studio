import {digest} from './import.ts';
import {fail} from '../util.mjs';
import type {Document,Source} from '../../shared/v2/model.ts';

// Identifiers are scoped to their source location, not labels or editable values.
export function fieldCandidates(document:Document,source:Source){
 return document.pages.flatMap(page=>page.sections.filter(s=>s.kind==='source').flatMap(section=>section.fields.map(field=>({
  key:digest(JSON.stringify([page.id,section.id,field.id])),file:page.path,section:section.name,
  label:field.label,type:field.type,sample:String(field.value).slice(0,300),
  tag:source.bindings.find(b=>b.page===page.id&&b.section===section.id&&b.field===field.id)?.tag||'',
 }))));
}

export function selectFields(document:Document,source:Source,selection:unknown){
 if(source.manifest.adapter.id!=='static')fail(422,'Alan seçimi statik HTML importu içindir.');
 const candidates=fieldCandidates(document,source),known=new Set(candidates.map(c=>c.key));
 if(!Array.isArray(selection)||selection.length>2000||selection.some(k=>typeof k!=='string'||!known.has(k))||new Set(selection).size!==selection.length)fail(422,'Alan seçimi geçersiz; keşif raporundaki alanları kullanın.');
 const selected=new Set(selection as string[]),next=structuredClone(document),mapped=structuredClone(source);
 for(const page of next.pages)for(const section of page.sections)if(section.kind==='source')section.fields=section.fields.filter(field=>selected.has(digest(JSON.stringify([page.id,section.id,field.id]))));
 mapped.bindings=mapped.bindings.filter(b=>!b.field||selected.has(digest(JSON.stringify([b.page,b.section,b.field]))));
 // Keep HTML bytes/markers: deselection changes the editing authority, not site content.
 mapped.files['studio/source-state.json']=JSON.stringify({version:1,document:next,hashes:Object.fromEntries(next.pages.map(p=>[p.path,digest(mapped.files[p.path])]))},null,2);
 return{document:next,source:mapped};
}

// Reject content whose replacement could silently remove behavior or structured markup.
export function safeTextCandidate(node:any):boolean{
 if(!node.sourceCodeLocation?.endTag)return false;
 for(let parent=node;parent;parent=parent.parentNode){
  if(['script','style','template','noscript','form','button','svg','math'].includes(parent.tagName))return false;
  if((parent.attrs||[]).some((a:any)=>/^(on|v-|x-|:|@)/.test(a.name)||['hidden','contenteditable','data-reactroot','data-reactid'].includes(a.name)||a.name==='aria-hidden'&&a.value==='true'))return false;
 }
 const visit=(n:any):boolean=>n.nodeName==='#text'?!/\{\{|\{%|<%/.test(n.value):
  ['b','strong','i','em','u','s','br','span','small','sup','sub','code','mark'].includes(n.tagName)&&!(n.attrs||[]).length&&(n.childNodes||[]).every(visit);
 return (node.childNodes||[]).every(visit);
}
