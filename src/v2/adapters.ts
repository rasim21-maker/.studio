import {parse} from 'parse5';
import {fail} from '../util.mjs';
import {digest,safePath} from './import.ts';
import {attr,findNodes,escape,designCss,sectionHtml,sdkHtml,inertPreview} from './render.ts';
import {emptyLayout,defaultDictionaries,newSection} from '../../shared/v2/model.ts';
import {validateDocument,validRich,fieldPolicy} from '../../shared/v2/validation.ts';
import type {Adapter,Document,Source,Binding,Capabilities,Section,Field,Files,Manifest} from '../../shared/v2/model.ts';
const cap=(state:'supported'|'partial'|'unsupported',reason:string)=>({state,reason});
const common:Capabilities={content:cap('supported','Alan şemasına uygun düzenleme ve sürüm kontrollü kayıt.'),layout:cap('supported','Bölümler, boşluklar ve cihaz ayarları kaynak modele yazılır.'),preview:cap('partial','İzole, JavaScript çalıştırmayan önizleme. Etkileşimli uygulama davranışı gösterilmez.'),publish:cap('partial','Sürüm ZIP olarak dışa aktarılır. Canlı sunucuya dağıtım bağlı değil.'),rollback:cap('supported','İçerik ve tasarım sürümünü geri yükleme; operasyon kayıtları kapsam dışı.'),build:cap('unsupported','İçe alınan kurulum veya derleme betikleri çalıştırılmaz.'),operations:cap('unsupported','Bu siteye rezervasyon/ödeme sağlayıcısı henüz bağlanmadı.')};
const fresh=(name:string):Document=>({schemaVersion:2,name,locale:'tr',locales:['tr'],theme:{preset:'original',font:'system',radius:16},pages:[],dictionaries:defaultDictionaries()});
const stable=(value:string)=>'n'+digest(value).slice(0,20);
const parseSource=(html:string)=>parse(html,{sourceCodeLocationInfo:true}) as any;
const inner=(html:string,node:any)=>{const loc=node.sourceCodeLocation;return loc?.startTag&&loc?.endTag?html.slice(loc.startTag.endOffset,loc.endTag.startOffset):'';};
const plain=(node:any):string=>node.nodeName==='#text'?node.value:(node.childNodes||[]).map(plain).join('');
type Patch={start:number;end:number;text:string};
function patch(html:string,patches:Patch[]):string{let boundary=html.length;for(const p of patches.sort((a,b)=>b.start-a.start)){if(p.end>boundary||p.start<0||p.end<p.start)fail(422,'Kaynak eşleştirmeleri çakışıyor.');html=html.slice(0,p.start)+p.text+html.slice(p.end);boundary=p.start;}return html;}
function tagAttribute(html:string,node:any,key:string,value:string){const tag=node.sourceCodeLocation.startTag,raw=html.slice(tag.startOffset,tag.endOffset),pattern=new RegExp('\\s'+key+'(?:\\s*=\\s*(?:"[^"]*"|\'[^\']*\'|[^\\s>]+))?','gi');return raw.replace(pattern,'').replace(/\s*\/?>$/,m=>' '+key+'="'+escape(value)+'"'+m);}
function checkManifest(manifest:Manifest){
 const keys=(value:any,allowed:string[])=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(k=>allowed.includes(k));
 if(!keys(manifest,['manifestVersion','adapter','name','contentPath','locales','connections','editableFields','preview','publish'])||!keys(manifest.adapter,['id','version'])||!keys(manifest.preview,['mode'])||!keys(manifest.publish,['mode'])||!['inert','sdk'].includes(manifest.preview.mode)||!['export','conditional-api'].includes(manifest.publish.mode))fail(422,'Manifest alanları veya yetenek bildirimi desteklenmiyor.');
 if(!manifest||manifest.manifestVersion!==2||!manifest.adapter||manifest.adapter.version!==1||!/^[a-z][a-z0-9-]{0,79}$/.test(manifest.adapter.id)||typeof manifest.name!=='string'||manifest.name.length<1||manifest.name.length>120||!Array.isArray(manifest.locales)||!manifest.locales.length||manifest.locales.length>30||manifest.locales.some(l=>!/^([a-z]{2,3})(-[A-Z]{2})?$/.test(l))||!Array.isArray(manifest.connections)||manifest.connections.length>8||!manifest.preview||!manifest.publish)fail(422,'studio.manifest.json sürümü veya sözleşmesi geçersiz.');
 const ids=new Set<string>(),owners=new Set<string>();for(const c of manifest.connections){if(!keys(c,['id','kind','authority'])||!/^[a-z][\w-]{0,79}$/.test(c.id)||ids.has(c.id)||!['files','github','wordpress','studio'].includes(c.kind)||!Array.isArray(c.authority)||c.authority.length>4)fail(422,'Kaynak bağlantısı geçersiz.');ids.add(c.id);for(const a of c.authority){if(!['code','content','media','design'].includes(a)||owners.has(a))fail(422,'Her veri türünün tek yetkili kaynağı olmalı; operasyon verileri import kapsamı dışındadır.');owners.add(a);}}
 if(manifest.editableFields&&(!Array.isArray(manifest.editableFields)||manifest.editableFields.length>2000||manifest.editableFields.some(f=>typeof f!=='string'||f.length>80)))fail(422,'Düzenlenebilir alan bildirimi geçersiz.');
 if(manifest.contentPath&&!safePath(manifest.contentPath))fail(422,'İçerik yolu geçersiz.');
}
function policy(before:Document,after:Document,source:Source){
 const errors=validateDocument(after,before);
 if(errors.length)return errors;
 for(const p of before.pages){const next=after.pages.find(x=>x.id===p.id);if(!next){errors.push({path:'/pages',message:'Kaynak sayfaları silme desteklenmiyor.'});continue;}if(next.path!==p.path)errors.push({path:'/pages',message:'Kaynak dosya yolu değiştirilemez.'});
  for(const s of p.sections.filter(s=>s.kind==='source')){const target=next.sections.find(x=>x.id===s.id);if(!target||target.kind!=='source'){errors.push({path:'/pages',message:'Kaynak bölümünü silmek yerine gizleyin.'});continue;}if(target.fields.length!==s.fields.length||s.fields.some(f=>!target.fields.some(g=>g.id===f.id&&fieldPolicy(g)===fieldPolicy(f))))errors.push({path:'/pages',message:'Kaynak alan şeması düzenlenemez.'});}}
 const previousIds=new Set(before.pages.flatMap(p=>p.sections.map(s=>s.id)));
 for(const p of after.pages)for(const s of p.sections){if(s.kind==='source'&&!previousIds.has(s.id))errors.push({path:'/pages',message:'Bilinmeyen kaynak bölüm kimliği.'});if(s.kind!=='source'){const template=newSection(s.kind,s.id);if(s.fields.length!==template.fields.length||s.fields.some(f=>!template.fields.some(g=>g.id===f.id&&fieldPolicy(g)===fieldPolicy(f))))errors.push({path:'/pages',message:'Bileşen alanları kayıt defteriyle uyuşmuyor.'});}for(const f of s.fields)if(f.type==='image'&&f.value&&!source.assets[String(f.value)])errors.push({path:'/pages',message:'Görsel bu sitenin medya kütüphanesinde bulunamadı.'});}
 if(after.pages.some(p=>!before.pages.some(x=>x.id===p.id)))errors.push({path:'/pages',message:'Bu adaptör mevcut sayfaları düzenler; yeni sayfa import edin.'});
 return errors;
}
// The sidecar is untrusted input. Validate both its schema and every permanent binding.
// Hashes detect stale exports; they are consistency checks, not authenticity signatures.
function rememberSourceState(document:Document,source:Source){
 source.manifest.name=document.name;source.manifest.locales=document.locales;
 source.files['studio.manifest.json']=JSON.stringify(source.manifest,null,2);
 source.files['studio/source-state.json']=JSON.stringify({version:1,document,hashes:Object.fromEntries(document.pages.map(p=>[p.path,digest(source.files[p.path])]))},null,2);
}
function restoreSourceState(input:Source){
 const source=structuredClone(input);checkManifest(source.manifest);let state:any;
 try{state=JSON.parse(source.files['studio/source-state.json']);}catch{fail(422,'Kaynak eşleştirme dosyası geçersiz.');}
 if(state?.version!==1||validateDocument(state.document).length||!state.hashes||typeof state.hashes!=='object')fail(422,'Kaynak eşleştirme şeması geçersiz.');
 const doc=state.document as Document;source.bindings=[];
 for(const page of doc.pages){
  const html=source.files[page.path];if(typeof html!=='string'||state.hashes[page.path]!==digest(html))fail(409,'HTML dışarıda değişmiş; studio/source-state.json eşleştirmesi eski. Dosyayı kaldırıp yeni eşleştirme raporunu inceleyin.');
  const tree=parseSource(html),roots=findNodes(tree,n=>attr(n,'data-studio-page')===page.id);if(roots.length!==1)fail(422,'Sayfa eşleştirmesi belirsiz.');
  for(const section of page.sections){
   const nodes=(roots[0].childNodes||[]).filter((n:any)=>attr(n,'data-studio-id')===section.id);
   if(nodes.length!==1)fail(422,'Bölüm eşleştirmesi belirsiz.');
   source.bindings.push({id:section.id,page:page.id,section:section.id,file:page.path,tag:nodes[0].tagName});
   if(section.kind==='source')for(const field of section.fields){
    if(source.manifest.editableFields&&!source.manifest.editableFields.includes(field.id))fail(422,'Alan manifest düzenleme kapsamı dışında.');
    const fields=findNodes(nodes[0],n=>attr(n,'data-studio-field')===field.id);if(fields.length!==1||!fields[0].sourceCodeLocation?.endTag)fail(422,'Alan eşleştirmesi belirsiz.');
    source.bindings.push({id:field.id,page:page.id,section:section.id,field:field.id,file:page.path,tag:fields[0].tagName});
   }
  }
 }
 if(policy(doc,doc,source).length)fail(422,'Eşleştirme bileşen sözleşmesine uymuyor.');
 return{document:doc,source,warnings:[]};
}
class StaticAdapter implements Adapter{
 id='static';version=1 as const;
 capabilities(){return common;}
 discover(input:Source){
  if(input.files['studio/source-state.json'])return restoreSourceState(input);
  const source=structuredClone(input);checkManifest(source.manifest);const doc=fresh(source.manifest.name);doc.locales=source.manifest.locales;doc.locale=doc.locales[0];source.bindings=[];const warnings:string[]=[];
  for(const [file,original]of Object.entries(source.files).filter(([p])=>/\.html$/.test(p)).slice(0,40)){
   if(!/^(?:[a-z0-9][a-z0-9_-]*\/)*[a-z0-9][a-z0-9_-]*\.html$/.test(file)){warnings.push('Bir HTML dosyası desteklenen sayfa yolu biçimine uymuyor.');continue;}
   const tree=parseSource(original),main=findNodes(tree,n=>n.tagName==='main')[0]||findNodes(tree,n=>n.tagName==='body')[0],pageId=stable(file),patches:Patch[]=[];
   if(!main?.sourceCodeLocation?.startTag){warnings.push(file+': Düzenlenebilir ana alan bulunamadı.');continue;}
   patches.push({start:main.sourceCodeLocation.startTag.startOffset,end:main.sourceCodeLocation.startTag.endOffset,text:tagAttribute(original,main,'data-studio-page',pageId)});
   const sections:Section[]=[],fieldIds=new Set<string>();const candidates=(main.childNodes||[]).filter((n:any)=>['section','article','div','header','footer'].includes(n.tagName)&&n.sourceCodeLocation?.endTag);
   for(const [si,node]of candidates.entries()){
    const id=attr(node,'data-studio-id')||stable(file+':section:'+si);if(!/^[a-zA-Z][\w-]{0,79}$/.test(id))fail(422,'Kaynak bölüm kimliği geçersiz.');
    patches.push({start:node.sourceCodeLocation.startTag.startOffset,end:node.sourceCodeLocation.startTag.endOffset,text:tagAttribute(original,node,'data-studio-id',id)});
    source.bindings.push({id,page:pageId,section:id,file,tag:node.tagName});const fields:Field[]=[];
    const nodes=findNodes(node,n=>/^h[1-6]$/.test(n.tagName)||n.tagName==='p'||n.tagName==='img').filter(n=>n.sourceCodeLocation?.startTag).slice(0,40);
    for(const [fi,n]of nodes.entries()){
     if(n.tagName==='img')continue; // Arbitrary legacy image paths remain untouched; new media has canonical identifiers.
     const fieldId=attr(n,'data-studio-field')||stable(id+':field:'+fi),value=inner(original,n),type=validRich(value)?'rich':'text';if(!/^[a-zA-Z][\w-]{0,79}$/.test(fieldId))fail(422,'Alan kimliği geçersiz.');
     if(source.manifest.editableFields&&!source.manifest.editableFields.includes(fieldId))continue;
     if(fieldIds.has(fieldId))fail(422,'Aynı dosyada yinelenen alan eşleştirmesi.');fieldIds.add(fieldId);
     fields.push({id:fieldId,label:plain(n).trim().slice(0,70)||'Metin',type,value:type==='rich'?value:plain(n),maxLength:12000});
     source.bindings.push({id:fieldId,page:pageId,section:id,field:fieldId,file,tag:n.tagName});
     patches.push({start:n.sourceCodeLocation.startTag.startOffset,end:n.sourceCodeLocation.startTag.endOffset,text:tagAttribute(original,n,'data-studio-field',fieldId)});
    }
    sections.push({id,name:plain(findNodes(node,n=>/^h[1-6]$/.test(n.tagName))[0]||node).trim().slice(0,100)||'Bölüm '+(si+1),kind:'source',enabled:!node.attrs.some((a:any)=>a.name==='hidden'),fields,layout:emptyLayout()});
   }
   if(!sections.length)warnings.push(file+': Doğrudan ana alan altındaki bölüm eşleştirmesi yok; kaynak korunur.');
   source.files[file]=patch(original,patches);
   doc.pages.push({id:pageId,name:plain(findNodes(tree,n=>n.tagName==='title')[0]||{}).trim().slice(0,120)||file,path:file,title:plain(findNodes(tree,n=>n.tagName==='title')[0]||{}).trim().slice(0,160),description:attr(findNodes(tree,n=>n.tagName==='meta'&&attr(n,'name')==='description')[0]||{},'content')?.slice(0,400)||'',sections,layout:emptyLayout()});
  }
  if(!doc.pages.length)fail(422,'Eşlenebilir HTML sayfası bulunamadı. React projelerinde Studio manifest ve içerik dosyası gerekir.');
  const errors=validateDocument(doc);if(errors.length)fail(422,'İçe aktarılan içerik şemaya uymuyor.',errors);
  source.files['studio.manifest.json']=JSON.stringify(source.manifest,null,2);
  rememberSourceState(doc,source);return{document:doc,source,warnings};
 }
 validate(before:Document,after:Document,source:Source){return policy(before,after,source);}
 write(before:Document,after:Document,input:Source){
  const errors=this.validate(before,after,input);if(errors.length)fail(422,'Alanları kontrol edin.',errors);const source=structuredClone(input);
  for(const p of after.pages){
   let html=source.files[p.path],tree=parseSource(html);const patches:Patch[]=[];
   for(const s of p.sections.filter(s=>s.kind==='source'))for(const f of s.fields){
    const old=before.pages.find(b=>b.id===p.id)?.sections.find(b=>b.id===s.id)?.fields.find(b=>b.id===f.id);
    const value=f.translations?.[after.locale]??f.value,oldValue=old?.translations?.[before.locale]??old?.value;
    if(value===oldValue)continue;
    const nodes=findNodes(tree,n=>attr(n,'data-studio-field')===f.id),node=nodes[0];
    if(nodes.length!==1||!node?.sourceCodeLocation?.endTag)fail(409,'Kaynak alanı değişmiş; yeniden eşleme gerekli.');
    const loc=node.sourceCodeLocation;let content=f.type==='rich'?String(value):escape(value);
    if(f.type==='rich'&&/<(?:p|h[1-6]|ul|ol|blockquote|pre)(?:\s|>)/.test(content)){
     const wrapper=content.match(/^<p(?: style="(text-align: (?:left|center|right|justify);?)")?>([\s\S]*)<\/p>$/);
     if(/^h[1-6]$/.test(node.tagName)){
      if(!wrapper||/<\/?(?:p|h[1-6]|ul|ol|blockquote|pre)(?:\s|>)/.test(wrapper[2]))fail(422,'Kaynağa bağlı başlık tek satırlık metin biçiminde kalmalı. Liste için yeni metin bölümü ekleyin.');
      let tag=html.slice(loc.startTag.startOffset,loc.startTag.endOffset);
      if(wrapper![1])tag=tagAttribute(html,node,'style',wrapper![1]);
      patches.push({start:loc.startOffset,end:loc.endOffset,text:tag+wrapper![2]+'</'+node.tagName+'>'});continue;
     }
     if(node.tagName==='p'){
      // A paragraph cannot contain another paragraph/list. Preserve its attributes on a
      // neutral container and keep the permanent field binding for subsequent edits.
      const tag=html.slice(loc.startTag.startOffset,loc.startTag.endOffset).replace(/^<p\b/,'<div');
      patches.push({start:loc.startOffset,end:loc.endOffset,text:tag+content+'</div>'});continue;
     }
    }
    patches.push({start:loc.startTag.endOffset,end:loc.endTag.startOffset,text:content});
   }
   const title=findNodes(tree,n=>n.tagName==='title')[0];if(title?.sourceCodeLocation?.endTag)patches.push({start:title.sourceCodeLocation.startTag.endOffset,end:title.sourceCodeLocation.endTag.startOffset,text:escape(p.title)});
   const desc=findNodes(tree,n=>n.tagName==='meta'&&attr(n,'name')==='description')[0];if(desc?.sourceCodeLocation)patches.push({start:desc.sourceCodeLocation.startTag.startOffset,end:desc.sourceCodeLocation.startTag.endOffset,text:tagAttribute(html,desc,'content',p.description)});
   html=patch(html,patches);tree=parseSource(html);const main=findNodes(tree,n=>attr(n,'data-studio-page')===p.id)[0];if(!main?.sourceCodeLocation?.endTag)fail(409,'Ana alan eşleştirmesi bulunamadı.');
   const managed=(main.childNodes||[]).filter((n:any)=>attr(n,'data-studio-id')&&n.sourceCodeLocation?.endTag),sourceNodes=new Map(managed.map((n:any)=>[attr(n,'data-studio-id'),n]));
   const chunks=p.sections.map(s=>{if(s.kind!=='source')return sectionHtml(s,after.locale);const node:any=sourceNodes.get(s.id);if(!node)fail(409,'Bölüm kaynağı değişmiş.');const loc=node.sourceCodeLocation;let raw=html.slice(loc.startOffset,loc.endOffset),tag=html.slice(loc.startTag.startOffset,loc.startTag.endOffset).replace(/\s+hidden(?:=(?:"[^"]*"|'[^']*'|[^\s>]*))?/gi,'');if(!s.enabled)tag=tag.replace(/>$/,' hidden>');return tag+raw.slice(loc.startTag.endOffset-loc.startOffset);});
   const changes:Patch[]=managed.map((node:any,index:number)=>({start:node.sourceCodeLocation.startOffset,end:node.sourceCodeLocation.endOffset,text:chunks[index]||''}));
   if(chunks.length>managed.length)changes.push({start:main.sourceCodeLocation.endTag.startOffset,end:main.sourceCodeLocation.endTag.startOffset,text:chunks.slice(managed.length).join('\n')});
   html=patch(html,changes);
   html=html.replace(/<style data-studio-design>[\s\S]*?<\/style>/g,'');const css='<style data-studio-design>'+designCss(after)+'</style>';html=html.includes('</head>')?html.replace('</head>',css+'</head>'):css+html;
   source.files[p.path]=html;
  }rememberSourceState(after,source);return source;
 }
 preview(doc:Document,source:Source,page:string){const p=doc.pages.find(p=>p.id===page)||doc.pages[0];return inertPreview(source.files[p.path],source,p.path);}
 export(_doc:Document,source:Source):Files{return source.files;}
}
class ReactSdkAdapter implements Adapter{
 id='react-sdk';version=1 as const;
 capabilities(){return{...common,preview:cap('partial','Studio SDK bileşenlerinin şema önizlemesi. İçe alınan JSX çalıştırılmaz.')}};
 discover(input:Source){const source=structuredClone(input);checkManifest(source.manifest);const file=source.manifest.contentPath||'studio/content.json';if(!source.files[file])fail(422,'Manifest içerik dosyası bulunamadı.');let doc;try{doc=JSON.parse(source.files[file]);}catch{fail(422,'SDK içerik JSON biçimi geçersiz.');}const errors=validateDocument(doc);if(errors.length)fail(422,'SDK belgesi doğrulanamadı.',errors);return{document:doc as Document,source,warnings:['Özel React bileşenleri bu önizlemede çalıştırılmaz. Kaynak kod değişmeden korunur.']};}
 validate=policy;
 write(before:Document,after:Document,input:Source){const errors=this.validate(before,after,input);if(errors.length)fail(422,'Alanları kontrol edin.',errors);const source=structuredClone(input);source.files[source.manifest.contentPath||'studio/content.json']=JSON.stringify(after,null,2);source.files['studio/design.css']='body{margin:0;font:18px/1.6 system-ui}main{padding:32px}section{padding:28px;background:var(--studio-surface)}h2{font-size:clamp(28px,5vw,56px)}a{color:inherit}'+designCss(after);source.manifest.name=after.name;source.manifest.locales=after.locales;source.files['studio.manifest.json']=JSON.stringify(source.manifest,null,2);return source;}
 preview(doc:Document,source:Source,page:string){return inertPreview(sdkHtml(doc,page),source,doc.pages.find(p=>p.id===page)?.path||'index.html');}
 export(doc:Document,source:Source){return{...source.files,...Object.fromEntries(doc.pages.map(p=>['studio-preview/'+p.path,sdkHtml(doc,p.id)]))};}
}
class WordpressAdapter extends StaticAdapter{
 id='wordpress';
 capabilities(source?:Source){return{...common,layout:cap('partial','Studio köprüsündeki bağlı HTML bölümleri; Gutenberg blokları dışarıda tutulur.'),publish:source?.manifest.publish.mode==='conditional-api'?cap('supported','Studio köprüsüyle sürüm önkoşullu tek sayfa yayınlama.'):cap('unsupported','Atomik sürüm kontrolü sağlayan WordPress Studio köprüsü gerekli.')}};
 validate(before:Document,after:Document,source:Source){const issues=policy(before,after,source);if(after.pages.length!==1)issues.push({path:'/pages',message:'WordPress bağlantısı bir sayfayı atomik olarak yönetir.'});return issues;}
 async publish(document:Document,source:Source,connection:Parameters<NonNullable<Adapter['publish']>>[2]){
  if(connection.kind!=='wordpress')fail(422,'WordPress Studio köprüsü yapılandırılmamış.');
  const {config,secrets,request}=connection,response=await request(config.endpoint,{method:'PUT',headers:{Authorization:'Basic '+Buffer.from(secrets.username+':'+secrets.password).toString('base64'),'Content-Type':'application/json','If-Match':config.remoteRevision},body:JSON.stringify({html:source.files[document.pages[0].path]})});
  if(response.status===409||response.status===412)fail(409,'Kaynak içeriği dışarıda değişmiş. Yeniden bağlayıp farkları inceleyin.');
  if(response.status!==200)fail(502,'Kaynak yayını doğrulanamadı.');const result=JSON.parse(Buffer.from(response.body).toString());if(typeof result.revision!=='string'||result.revision.length>500)fail(502,'Yayın sürüm yanıtı geçersiz.');
  return{remoteRevision:result.revision};
 }
}
export class AdapterRegistry {
 private adapters=new Map<string,Adapter>();
 register(adapter:Adapter){if(adapter.version!==1||this.adapters.has(adapter.id))throw Error('Adaptör sürümü/kimliği geçersiz.');this.adapters.set(adapter.id,adapter);return this;}
 get(id:string){const adapter=this.adapters.get(id);if(!adapter)fail(422,'Adaptör kurulu değil veya sözleşme sürümü desteklenmiyor.');return adapter!;}
 list(){return [...this.adapters.values()].map(a=>({id:a.id,version:a.version}));}
}
export const createRegistry=()=>new AdapterRegistry().register(new StaticAdapter()).register(new ReactSdkAdapter()).register(new WordpressAdapter());
export function discover(source:Source,registry:AdapterRegistry){checkManifest(source.manifest);return registry.get(source.manifest.adapter.id).discover(source);}
