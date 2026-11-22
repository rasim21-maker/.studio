// Browser-safe bridge. Resolves data only; never imports or evaluates source files.
const key=/^[A-Za-z][A-Za-z0-9_-]{0,79}$/;
const identifier=value=>typeof value==='string'&&key.test(value);
const reject=message=>{throw Object.assign(new Error(message),{status:422});};
const object=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).every(k=>keys.includes(k));
const safeProp=p=>key.test(p)&&!/^on/i.test(p)&&!['constructor','prototype','__proto__','children','key','ref','style','dangerouslySetInnerHTML','innerHTML','outerHTML','srcDoc'].includes(p);
export function validateComponentBindings(document,manifest){
 if(!object(manifest,['version','components'])||manifest.version!==1||!Array.isArray(manifest.components)||manifest.components.length>200)reject('Component bindings version/schema is invalid.');
 const ids=new Set();
 for(const c of manifest.components){
  if(!object(c,['id','page','section','sourceFile','exportName','props'])||!identifier(c.id)||ids.has(c.id)||typeof c.page!=='string'||typeof c.section!=='string'||typeof c.sourceFile!=='string'||c.sourceFile.length>200||! /^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.[cm]?[jt]sx?$/.test(c.sourceFile)||!identifier(c.exportName)||!c.props||typeof c.props!=='object'||Array.isArray(c.props)||Object.keys(c.props).length>40)reject('Component declaration is invalid.');
  ids.add(c.id);const page=document.pages?.find(p=>p.id===c.page),section=page?.sections.find(s=>s.id===c.section);
  if(!section)reject('Component page/section does not exist.');
  for(const [prop,id]of Object.entries(c.props)){
   const field=section.fields.find(f=>f.id===id);
   if(!safeProp(prop)||typeof id!=='string'||!field||!['text','number','boolean','enum','url','image'].includes(field.type))reject('Component prop/field binding is unsupported.');
  }
 }
 return manifest;
}
export function componentProps(document,manifest,id,locale=document.locale){
 validateComponentBindings(document,manifest);
 if(!document.locales?.includes(locale))reject('Unknown component locale.');
 const c=manifest.components.find(c=>c.id===id);if(!c)reject('Unknown component binding.');
 const section=document.pages.find(p=>p.id===c.page).sections.find(s=>s.id===c.section),props=Object.create(null);
 for(const [prop,fieldId]of Object.entries(c.props)){
  const field=section.fields.find(f=>f.id===fieldId),value=field.translations?.[locale]??field.value;
  if(typeof value!==(field.type==='number'?'number':field.type==='boolean'?'boolean':'string'))reject('Component field type is invalid.');
  if(!['string','number','boolean'].includes(typeof value)||typeof value==='number'&&!Number.isFinite(value)||typeof value==='string'&&(value.length>12000||/[<>\u0000-\u001f\u007f]/.test(value)))reject('Component field value is invalid.');
  if(field.type==='image'&&value&&!/^media\/[a-f0-9]{64}\.(png|jpe?g|webp|gif)$/.test(value))reject('Component image must use the media library.');
  if(field.type==='url'&&value){let valid=/^(#[A-Za-z][\w-]*|\/(?!\/)[A-Za-z0-9_/.?#=&%-]*)$/.test(value)&&!/%(0[0-9a-f]|1[0-9a-f]|7f)/i.test(value);if(!valid&&!value.startsWith('/')&&!value.startsWith('#'))try{const u=new URL(value);valid=['https:','mailto:','tel:'].includes(u.protocol)&&!u.username&&!u.password&&!/[\s\u0000-\u001f\u007f]/.test(value);}catch{}if(!valid)reject('Component URL is invalid.');}
  props[prop]=value;
 }
 return Object.freeze(props);
}
