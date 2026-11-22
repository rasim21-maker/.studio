import {parse,serialize} from 'parse5';
import {randomBytes} from 'node:crypto';
import {manualCandidates} from './manual-mapping.ts';
import {findNodes,inertPreview} from './render.ts';
import {fail} from '../util.mjs';
import type {Document,Source} from '../../shared/v2/model.ts';
export function selectionPreview(document:Document,source:Source,file:string){
 if(!document.pages.some(p=>p.path===file))fail(404,'Seçim sayfası bulunamadı.');
 const candidates=manualCandidates(document,source).filter(c=>c.file===file),html=source.files[file];
 if(typeof html!=='string')fail(422,'Bu adaptör kaynak HTML seçimini desteklemiyor.');
 const tree=parse(html,{sourceCodeLocationInfo:true}) as any;
 const byOffset=new Map(candidates.map(c=>[c.offset,c.key]));
 for(const node of findNodes(tree,n=>Boolean(n.tagName))){
  node.attrs=node.attrs.filter((a:any)=>a.name!=='data-studio-pick');
  const end=node.sourceCodeLocation?.startTag?.endOffset;let offset=end-1;if(html[offset-1]==='/')offset--;
  const key=byOffset.get(offset);if(key){node.attrs.push({name:'data-studio-pick',value:key});node.attrs=node.attrs.filter((a:any)=>!['tabindex','role'].includes(a.name));node.attrs.push({name:'tabindex',value:'0'},{name:'role',value:'button'});}
 }
 const channel=randomBytes(24).toString('hex'),nonce=randomBytes(24).toString('hex'),keys=candidates.map(c=>c.key);
 let preview=inertPreview(serialize(tree),source,file).replace("script-src 'none'","script-src 'nonce-"+nonce+"'");
 const script=`(()=>{const channel=${JSON.stringify(channel)},keys=new Set(${JSON.stringify(keys)});function pick(e){const node=e.target.closest('[data-studio-pick]');if(!node||!keys.has(node.dataset.studioPick))return;e.preventDefault();parent.postMessage({type:'studio.pick',version:1,channel,key:node.dataset.studioPick},'*');}document.addEventListener('click',pick);document.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')pick(e);});})();`;
 preview=preview.replace('</body>','<style>[data-studio-pick]{outline:2px dashed #1976d2;cursor:pointer}[data-studio-pick]:focus{outline:3px solid #ae3c00}</style><script nonce="'+nonce+'">'+script+'</script></body>');
 return{html:preview,channel,keys,file};
}
