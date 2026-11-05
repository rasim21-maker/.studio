import {defaultDictionaries,emptyLayout,newSection} from '../../shared/v2/model.ts';
import type {Source,Document} from '../../shared/v2/model.ts';
import {designCss} from './render.ts';
import {sdkApp,sdkBuild} from './sdk-template.ts';
import sdkLock from './sdk-lock.ts';
export function fixture(kind:string):Source{
 const name=kind==='react-sdk'?'Northstar · React örneği':kind==='wordpress'?'Atölye · WordPress sözleşme örneği':'Harbor · Statik örnek';
 const manifest:Source['manifest']={manifestVersion:2,adapter:{id:kind==='react-sdk'?'react-sdk':kind==='wordpress'?'wordpress':'static',version:1},name,locales:['tr','en'],connections:[{id:'local',kind:'files',authority:['code','content','design']}],preview:{mode:kind==='react-sdk'?'sdk':'inert'},publish:{mode:'export'}};
 const source:Source={manifest,files:{},assets:{},bindings:[]};
 if(kind==='react-sdk'){
  manifest.contentPath='studio/content.json';const hero=newSection('hero','hero');hero.name='Karşılama';hero.fields[0].value='Fikirleriniz için daha fazla alan.';hero.fields[1].value='<p>Northstar, Studio SDK sözleşmesini kullanan bağımsız bir React örneğidir.</p>';hero.layout.desktop={padding:48};
  const second=newSection('cta','contact');second.name='İletişim';second.fields[0].value='Birlikte bir sonraki adımı atalım.';second.fields[1].value='<p>İçerik JSON dosyasında, uygulama kodu kendi deposunda kalır.</p>';
  const doc:Document={schemaVersion:2,name,locale:'tr',locales:['tr','en'],theme:{preset:'midnight',font:'system',radius:24},pages:[{id:'home',name:'Ana sayfa',path:'index.html',title:'Northstar',description:'Bağımsız React SDK örneği',sections:[hero,second],layout:{...emptyLayout(),desktop:{gap:24,maxWidth:1200,padding:32}}}],dictionaries:defaultDictionaries()};
  source.files['studio/content.json']=JSON.stringify(doc,null,2);
  source.files['src/App.tsx']=sdkApp;
  source.files['package-lock.json']=sdkLock;
  source.files['build.mjs']=sdkBuild;
  source.files['studio/design.css']='body{margin:0;font:18px/1.6 system-ui}main{padding:32px}section{padding:28px;background:var(--studio-surface)}h2{font-size:clamp(28px,5vw,56px)}a{color:inherit}'+designCss(doc);
  source.files['package.json']=JSON.stringify({name:'northstar-studio-fixture',private:true,type:'module',scripts:{build:'node build.mjs'},dependencies:{react:'19.3.1','react-dom':'19.3.1'},devDependencies:{esbuild:'0.28.2'}},null,2);
  source.files['src/main.tsx']="import React from 'react';import {createRoot} from 'react-dom/client';import App from './App';createRoot(document.getElementById('root')!).render(<App/>);";
  source.files['index.html']='<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>Northstar</title><meta name="description" content="Northstar"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/assets/app.css"></head><body><div id="root"></div><script type="module" src="/assets/app.js"></script></body></html>';
  source.files['README.md']='# Northstar React example\n\nRequires Node 24. Install the pinned packages with npm ci --ignore-scripts, preserve package-lock.json, then npm run build. Serve dist at the domain root. Studio edits studio/content.json and studio/design.css. Build scripts are never run during Studio import. Rich HTML must pass the Studio document validator before being supplied by a different content source. Booking and data placeholders require an operational service connection before live use.\n';
 }else source.files['index.html']=`<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>${name}</title><meta name="description" content="Bağlı site örneği"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#f3f4ef;color:#213d38;font:18px/1.65 system-ui}main{max-width:1100px;margin:auto;padding:40px}section{padding:40px;margin:24px 0;border:1px solid #d5ddd5;border-radius:22px}h1{font-size:clamp(40px,6vw,76px);line-height:1.08;max-width:800px;letter-spacing:-3px}h2{font-size:32px}p{max-width:680px}small{letter-spacing:3px}</style></head><body><main><section><small>HARBOR / STUDIO</small><h1>Dijital alanınızı, kendi tarzınızda yönetin.</h1><p>İçerik, tasarım ve yayın akışını tek bir çalışma alanında bir araya getirin.</p></section><section><h2>Her şey yerli yerinde.</h2><p>Bu bölümü taşıyın, metnini değiştirin ve kaynak dosyasındaki kalıcı sonucu görün.</p></section><section><h2>Yeni fikirlere yer açın.</h2><p>Mevcut kodunuz korunurken içerik ve yerleşim birlikte gelişir.</p></section></main><script>window.examplePreserved = true;</script></body></html>`;
 source.files['studio.manifest.json']=JSON.stringify(manifest,null,2);return source;
}
