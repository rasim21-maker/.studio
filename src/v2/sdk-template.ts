// This example runtime is our own trusted source, not code executed during import.
export const sdkApp = `import React, {useEffect} from 'react';
import content from '../studio/content.json';
import '../studio/design.css';
export default function App(){
 const path=location.pathname.replace(/^\\//,'')||'index.html';
 const page=content.pages.find(p=>p.path===path)||content.pages[0];
 useEffect(()=>{document.title=page.title;document.documentElement.lang=content.locale;document.querySelector('meta[name="description"]')?.setAttribute('content',page.description);},[page]);
 return <main data-studio-page={page.id}>{page.sections.filter(s=>s.enabled).map(s=>{
  const value=(key)=>{const field=s.fields.find(f=>f.id===key);return String(field?.translations?.[content.locale]??field?.value??'');};
  return <section key={s.id} data-studio-id={s.id} data-studio-section="">
   <h2>{value('heading')}</h2><div dangerouslySetInnerHTML={{__html:value('body')}} />
   {s.kind==='image'&&<img src={'/'+value('image')} alt={value('alt')}/>}
   {s.kind==='cta'&&<a href={value('href')}>{value('label')}</a>}
   {['booking','gadget'].includes(s.kind)&&<p role="status">Bu bileşenin canlı sitede çalışması için yayın adresi ve operasyon bağlantısı gereklidir.</p>}
  </section>;
 })}</main>;
}
`;
export const sdkBuild = `import {build} from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
await build({entryPoints:['src/main.tsx'],bundle:true,minify:true,outfile:'dist/assets/app.js',loader:{'.tsx':'tsx'},jsx:'automatic'});
const content=JSON.parse(await fs.readFile('studio/content.json','utf8'));
const html=await fs.readFile('index.html','utf8');
for(const page of content.pages){const file=path.join('dist',page.path);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,html);}
try{await fs.cp('media','dist/media',{recursive:true});}catch(e){if(e.code!=='ENOENT')throw e;}
`;
