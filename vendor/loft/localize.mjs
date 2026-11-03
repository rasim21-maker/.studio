import fs from 'node:fs/promises';
import path from 'node:path';
import {canonical,enhancePage,writeDiscovery} from './seo.mjs';

export const locales = [
 {code:'tr',lang:'tr',name:'Türkçe'}, {code:'en',lang:'en',name:'English'},
 {code:'zh',lang:'zh-Hans',name:'中文'}, {code:'hi',lang:'hi',name:'हिन्दी'},
 {code:'es',lang:'es',name:'Español'}, {code:'ar',lang:'ar',name:'العربية',dir:'rtl'},
 {code:'fr',lang:'fr',name:'Français'}, {code:'bn',lang:'bn',name:'বাংলা'},
 {code:'pt',lang:'pt',name:'Português'}, {code:'id',lang:'id',name:'Bahasa Indonesia'},
 {code:'ru',lang:'ru',name:'Русский'},
];
const escape = s => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const decode = s => s.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (_,e) => e[0]==='#' ? String.fromCodePoint(parseInt(e.slice(e[1]?.toLowerCase()==='x'?2:1),e[1]?.toLowerCase()==='x'?16:10)) : ({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:'\u00a0'})[e.toLowerCase()]);
export const outputPath = (page, code) => code==='tr' ? page : `${code}/${page.replace(/^tr\//,'')}`;
const relative = (from,to) => path.posix.relative(path.posix.dirname(from),to) || path.posix.basename(to);
const icon = type => `<svg viewBox="0 0 24 24" aria-hidden="true">${type==='globe'?'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a17 17 0 0 1 0 18 17 17 0 0 1 0-18Z"/>':'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>'}</svg>`;
const runtimeKeys=['t006','t213','t214','t215','t216','t217','t218','t083','t089','t219','t220','t101','t221','t012'];

export async function localizePages(pages, directory='dist') {
 const base=JSON.parse(await fs.readFile('content/locales/tr.json','utf8'));
 const lookup=new Map(Object.entries(base).map(([key,value])=>[value,key]));
 const originalPaths=new Set(pages.keys());
 for(const locale of locales){
  const dict=JSON.parse(await fs.readFile(`content/locales/${locale.code}.json`,'utf8'));
  for(const key of Object.keys(base))if(typeof dict[key]!=='string'||!dict[key].trim())throw Error(`Missing ${locale.code}:${key}`);
  if(Object.keys(dict).length!==Object.keys(base).length)throw Error(`Unexpected keys in ${locale.code}`);
  const translate = value => {
   const key=lookup.get(decode(value).trim());
   return key? value.replace(/\S[\s\S]*\S|\S/,()=>escape(dict[key])) : value;
  };
  for(const [original,html] of pages){
   const target=outputPath(original,locale.code);
   let result=html.replace(/<script\b[\s\S]*?<\/script>|<!--[\s\S]*?-->|<[^>]+>|[^<]+/g,token=>{
    if((token.startsWith('<script')&&!/\bsrc="/.test(token))||token.startsWith('<!--'))return token;
    if(!token.startsWith('<'))return translate(token);
    let tag=token.replace(/\b(alt|aria-label|placeholder|data-caption)="([^"]*)"/g,(_,a,v)=>`${a}="${translate(v)}"`);
    if(/^<meta\b/.test(tag)&&tag.includes('name="description"'))tag=tag.replace(/content="([^"]*)"/,(_,v)=>`content="${translate(v)}"`);
    tag=tag.replace(/\b(href|src|data-photo)="([^"]*)"/g,(_,attribute,url)=>{
     if(/^(?:[a-z]+:|\/\/|#)/i.test(url))return `${attribute}="${url}"`;
     const [pathname,hash]=url.split('#');
     const resolved=path.posix.normalize(path.posix.join(path.posix.dirname(original),decode(pathname)));
     const dest=originalPaths.has(resolved)?outputPath(resolved,locale.code):resolved;
     return `${attribute}="${escape(relative(target,dest))}${/\.(css|js)$/.test(dest)?'?v=4':''}${hash?'#'+escape(hash):''}"`;
    });
    return tag;
   });
   result=result.replace('<html lang="tr">',`<html lang="${locale.lang}" dir="${locale.dir||'ltr'}" data-locale="${locale.code}" data-page="${escape(original)}" data-theme="light" data-theme-mode="light">`);
   const languageLinks=locales.map(l=>`<a href="${escape(relative(target,outputPath(original,l.code)))}" lang="${l.lang}" hreflang="${l.lang}" data-language="${l.code}"${l.code===locale.code?' aria-current="true"':''}><span>${l.name}</span><small>${l.code.toUpperCase()}</small></a>`).join('');
   const themeButtons=[['light','t226'],['dark','t227'],['system','t228']].map(([value,key])=>`<button type="button" data-theme-choice="${value}" aria-pressed="${value==='light'}"><span>${escape(dict[key])}</span><span class="choice-dot" aria-hidden="true"></span></button>`).join('');
   const settings=`<div class="wrap utility-row"><div class="site-settings" aria-label="${escape(dict.t229)}"><details class="settings-menu language-menu"><summary aria-label="${escape(dict.t223)}">${icon('globe')}<span>${locale.name}</span><i aria-hidden="true"></i></summary><div class="settings-panel language-options" aria-label="${escape(dict.t222)}">${languageLinks}</div></details><details class="settings-menu theme-menu"><summary aria-label="${escape(dict.t225)}">${icon('theme')}<span data-theme-label>${escape(dict.t226)}</span><i aria-hidden="true"></i></summary><div class="settings-panel theme-options" aria-label="${escape(dict.t224)}">${themeButtons}</div></details></div></div>`;
   result=result.replace('<header class="header"><div class="wrap">',`<header class="header">${settings}<div class="wrap header-main">`);
   const alternates=locales.map(l=>`<link rel="alternate" hreflang="${l.lang}" data-language="${l.code}" data-local-href="${escape(relative(target,outputPath(original,l.code)))}" href="${canonical(outputPath(original,l.code))}">`).join('')+`<link rel="alternate" hreflang="x-default" href="${canonical(original)}">`;
   const runtime=JSON.stringify(Object.fromEntries(runtimeKeys.map(key=>[key,dict[key]]))).replaceAll('<','\\u003c');
   const resources=`${alternates}<script type="application/json" id="site-messages">${runtime}</script><script src="${escape(relative(target,'preferences.js'))}?v=4"></script>`;
   result=result.replace('<link rel="stylesheet"',resources+'<link rel="stylesheet"');
   result=result.replace('</head>',`<link rel="stylesheet" href="${escape(relative(target,'theme.css'))}?v=4"></head>`);
   result=await enhancePage(result,{original,target,locale,dict,locales,outputPath});
   const dest=path.join(directory,target);await fs.mkdir(path.dirname(dest),{recursive:true});await fs.writeFile(dest,result);
  }
 }
 await writeDiscovery(pages,locales,outputPath,directory);
 console.log(`${pages.size*locales.length} localized pages created (${locales.length} languages).`);
}
