import {parse,serialize} from 'parse5';
import type {Document,Layout,Source,Section,Responsive} from '../../shared/v2/model.ts';
import {themes} from '../../shared/v2/model.ts';
export const escape=(v:unknown)=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export const findNodes=(node:any,predicate:(node:any)=>boolean,result:any[]=[]):any[]=>{if(predicate(node))result.push(node);for(const child of node.childNodes||[])findNodes(child,predicate,result);return result;};
export const attr=(node:any,key:string)=>node.attrs?.find((a:any)=>a.name===key)?.value;
export function layoutCss(l:Layout):string{
 const css:string[]=[];if(l.display)css.push('display:'+({stack:'grid',grid:'grid',flex:'flex'}[l.display]),'grid-template-columns:'+ (l.display==='grid'?`repeat(${l.columns||2},minmax(0,1fr))`:'minmax(0,1fr)'),'flex-wrap:wrap');
 if(l.columns!==undefined)css.push('grid-template-columns:repeat('+l.columns+',minmax(0,1fr))');
 for(const k of ['gap','padding','margin','maxWidth'] as const)if(l[k]!==undefined)css.push(`${k==='maxWidth'?'max-width':k}:${l[k]}px`);
 if(l.align)css.push('justify-items:'+({left:'start',center:'center',right:'end',stretch:'stretch'}[l.align]),'justify-content:'+({left:'flex-start',center:'center',right:'flex-end',stretch:'normal'}[l.align]));
 if(l.vertical)css.push('align-items:'+l.vertical);if(l.textAlign)css.push('text-align:'+l.textAlign);
 return css.join(';');
}
export function designCss(doc:Document):string{
 const [,bg,fg,accent,surface]=themes[doc.theme.preset];let css=`:root{--studio-bg:${bg};--studio-fg:${fg};--studio-accent:${accent};--studio-surface:${surface};--studio-radius:${doc.theme.radius}px;}[data-studio-page],[data-studio-id]{box-sizing:border-box;min-width:0;max-width:100%;overflow-wrap:anywhere}[data-studio-page]{margin-inline:auto}[data-studio-page] img{max-width:100%;height:auto}`;
 if(doc.theme.preset!=='original')css+=`body{background:var(--studio-bg);color:var(--studio-fg)}[data-studio-section]{border-radius:var(--studio-radius)}`;
 if(doc.theme.font!=='system')css+=`body{font-family:${doc.theme.font==='serif'?'Georgia,serif':'monospace'}}`;
 for(const page of doc.pages)for(const [selector,layout]of [[`[data-studio-page="${page.id}"]`,page.layout],...page.sections.map(s=>[`[data-studio-id="${s.id}"]`,s.layout])] as [string,Responsive][]){
  css+=`${selector}{${layoutCss(layout.desktop)}}@media(max-width:1024px){${selector}{${layoutCss(layout.tablet)}}}@media(max-width:640px){${selector}{${(layout.mobile.autoAlign??layout.tablet.autoAlign??layout.desktop.autoAlign)!==false?'grid-template-columns:minmax(0,1fr);flex-direction:column;':''}${layoutCss(layout.mobile)}}}`;
 }
 return css;
}
export function sectionHtml(s:Section,locale?:string):string{
 const val=(id:string)=>{const f=s.fields.find(f=>f.id===id);return f?locale&&f.translations?.[locale]||f.value:'';};
 let body=`<h2>${escape(val('heading'))}</h2><div>${val('body')}</div>`;
 if(s.kind==='image')body+=`<img src="${escape(val('image'))}" alt="${escape(val('alt'))}">`;
 if(s.kind==='cta')body+=`<a href="${escape(val('href'))}">${escape(val('label'))}</a>`;
 if(s.kind==='booking'||s.kind==='gadget')body+='<p role="status">Bu bileşenin canlı sitede çalışması için yayın adresi ve operasyon bağlantısı gereklidir.</p>';
 return `<section data-studio-id="${s.id}" data-studio-section${s.enabled?'':' hidden'}>${body}</section>`;
}
export function sdkHtml(doc:Document,pageId:string):string{
 const p=doc.pages.find(p=>p.id===pageId)||doc.pages[0];
 return `<!doctype html><html lang="${doc.locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(p.title)}</title><meta name="description" content="${escape(p.description)}"><style>body{margin:0;font:18px/1.6 system-ui;background:var(--studio-bg);color:var(--studio-fg)}main{padding:32px;max-width:1200px;margin:auto}section{padding:28px;background:var(--studio-surface);margin-bottom:24px}h1,h2{line-height:1.15}h2{font-size:clamp(28px,5vw,56px)}a{color:inherit}img{max-width:100%}${designCss(doc)}</style></head><body><main data-studio-page="${p.id}">${p.sections.map(s=>sectionHtml(s,doc.locale)).join('')}</main></body></html>`;
}
export function inertPreview(html:string,source:Source,file:string):string{
 const tree:any=parse(html);const base=file.split('/').slice(0,-1);
 const resolve=(value:string)=>{if(/^https?:|^\/\/|^data:|^blob:|^[a-z]+:/i.test(value))return '';const parts=value.startsWith('/')?[]:[...base];for(const part of value.split(/[?#]/)[0].split('/')){if(part==='..')parts.pop();else if(part&&part!=='.')parts.push(part);}return parts.join('/');};
 const blocked=new Set(['script','iframe','object','embed','base','form','input','button','textarea','select','audio','video','source','template','svg','math','noscript']);
 const cssSafe=(css:string)=>css.replace(/@import[^;]*(?:;|$)/gi,'').replace(/url\s*\([^)]*\)/gi,'none').replace(/<\/style/gi,'');
 const walk=(node:any)=>{node.childNodes=(node.childNodes||[]).filter((child:any)=>!blocked.has(child.tagName)&&!(child.tagName==='meta'&&attr(child,'http-equiv')));for(const child of node.childNodes){
  if(child.tagName==='link'){const rel=attr(child,'rel'),href=resolve(attr(child,'href')||'');if(rel==='stylesheet'&&source.files[href]){child.tagName='style';child.nodeName='style';child.attrs=[];child.childNodes=[{nodeName:'#text',value:cssSafe(source.files[href]),parentNode:child}];}else{child.tagName='span';child.nodeName='span';child.attrs=[];}}
  if(child.attrs){child.attrs=child.attrs.filter((a:any)=>!/^on/i.test(a.name)&&!['href','srcset','action','formaction','contenteditable','autofocus','ping','download','target','http-equiv'].includes(a.name));for(const a of child.attrs){if(a.name==='src'){const asset=source.assets[resolve(a.value)];a.value=asset?`data:${asset.mime};base64,${asset.base64}`:'';}if(a.name==='style')a.value=cssSafe(a.value);}}
  if(child.tagName==='style')for(const t of child.childNodes||[])if(t.nodeName==='#text')t.value=cssSafe(t.value);
  walk(child);
 }};walk(tree);let result=serialize(tree);
 const csp="<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src 'none'; connect-src 'none'; form-action 'none'; base-uri 'none'\">";
 result=result.replace('<head>','<head>'+csp);return result;
}
