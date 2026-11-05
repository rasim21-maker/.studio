import validateShape from './schema-validator.js';
import type {Document,Field} from './model.ts';
export interface Issue {path:string;message:string}
export function safeUrl(value:string,image=false):boolean {
 if(!value)return true;
 if(image)return /^media\/[a-f0-9]{64}\.(png|jpe?g|webp|gif)$/.test(value);
 if(/^(#[a-zA-Z][\w-]*|\/(?!\/)[a-zA-Z0-9_/.?#=&%-]*)$/.test(value))return !/%(0[0-9a-f]|1[0-9a-f]|7f)/i.test(value);
 try {const u=new URL(value);return ['https:','mailto:','tel:'].includes(u.protocol)&&!u.username&&!u.password&&!/[\s\u0000-\u001f\u007f]/.test(value);}catch{return false;}
}
// Rich input has a deliberately small grammar, shared on every write path. Entities are
// permitted in text; attributes are parsed as literal quoted values and never decoded into HTML.
export function validRich(value:string):boolean {
 if(value.length>12000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))return false;
 const stack:string[]=[];let end=0;
 for(const m of value.matchAll(/<[^>]*>/g)){
  if(value.slice(end,m.index).includes('<'))return false;end=m.index!+m[0].length;
  const tag=m[0].match(/^<(\/?)(p|br|strong|em|s|u|ul|ol|li|h[1-6]|blockquote|code|pre|a|span)(?=[\s/>])([^>]*)>$/);
  if(!tag)return false;const [,close,name,attrs]=tag;
  if(close){if(attrs.trim()||name==='br'||stack.pop()!==name)return false;continue;}
  const parent=stack.at(-1),block=/^(p|h[1-6]|ul|ol|blockquote|pre)$/.test(name);
  if(name==='li'&&!['ul','ol'].includes(parent||''))return false;
  if(['ul','ol'].includes(parent||'')&&name!=='li')return false;
  if(block&&stack.some(t=>/^(p|h[1-6]|a|pre)$/.test(t)))return false;
  if(name==='a'&&stack.includes('a'))return false;
  let rest=attrs.trim();if(rest==='/'){if(name!=='br')return false;rest='';}
  const seen=new Set<string>();
  while(rest){const a=rest.match(/^([a-z-]+)="([^"<>]*)"(?:\s+|$)/);if(!a||seen.has(a[1]))return false;seen.add(a[1]);const [full,key,v]=a;
   if(key==='style'){if(!/^(text-align: (left|center|right|justify);?)$/.test(v)||!['p','h1','h2','h3','h4','h5','h6','span'].includes(name))return false;}
   else if(key==='href'&&name==='a'){if(v.replaceAll('&amp;','').includes('&')||!safeUrl(v.replaceAll('&amp;','&')))return false;}
   else if(key==='target'&&name==='a'){if(v!=='_blank'&&v!=='_self')return false;}
   else if(key==='rel'&&name==='a'){if(!/^(noopener|noreferrer|nofollow)( (noopener|noreferrer|nofollow))*$/.test(v))return false;}
   else if(key==='start'&&name==='ol'){if(!/^[1-9][0-9]{0,3}$/.test(v))return false;}
   else return false;rest=rest.slice(full.length);
  }
  if(name!=='br')stack.push(name);if(stack.length>20)return false;
 }return !stack.length&&!value.slice(end).includes('<');
}
export function validateDocument(value:unknown,before?:Document):Issue[]{
 if(!validateShape(value))return (validateShape.errors||[]).map((e:any)=>({path:e.instancePath||'/',message:`Şema kuralı: ${e.keyword} ${JSON.stringify(e.params)}`}));
 const doc=value as Document, errors:Issue[]=[];const add=(path:string,message:string)=>errors.push({path,message});
 if(!doc.locales.includes(doc.locale))add('/locale','Varsayılan dil, site dilleri arasında olmalı.');
 const ids=new Set<string>(),paths=new Set<string>(),dictionaryIds=new Set<string>();
 const oldValues=new Map(before?.pages.flatMap(p=>p.sections.flatMap(s=>s.fields.map(f=>[`${p.id}/${s.id}/${f.id}`,f.value] as const)))||[]);
 for(const [di,d]of doc.dictionaries.entries()){
  if(dictionaryIds.has(d.id))add(`/dictionaries/${di}`,'Sözlük kimliği benzersiz olmalı.');dictionaryIds.add(d.id);
  const seen=new Set<string>(),aliases=new Set<string>();for(const e of d.entries){if(seen.has(e.id))add(`/dictionaries/${di}`,'Değer kimliği tekrar ediyor.');seen.add(e.id);for(const a of [e.id,...e.aliases]){const key=a.normalize('NFC').toLowerCase();if(aliases.has(key))add(`/dictionaries/${di}`,'Eski değer eşleştirmesi belirsiz.');aliases.add(key);}}
  const old=before?.dictionaries.find(x=>x.id===d.id);if(old){if(old.entries.some(e=>!seen.has(e.id)))add(`/dictionaries/${di}`,'Geçmiş değerleri silmeyin; pasif yapın.');const changed=JSON.stringify({...d,version:old.version})!==JSON.stringify(old);if(d.version!==old.version+(changed?1:0))add(`/dictionaries/${di}/version`,'Sözlük değişikliğinde sürümü bir artırın.');}
 }
 for(const [pi,p]of doc.pages.entries()){
  if(ids.has(p.id))add(`/pages/${pi}/id`,'Kimlik tekrar ediyor.');ids.add(p.id);
  if(!/^(?:[a-z0-9][a-z0-9_-]*\/)*[a-z0-9][a-z0-9_-]*\.html$/.test(p.path)||paths.has(p.path.toLowerCase()))add(`/pages/${pi}/path`,'Benzersiz, göreli bir HTML yolu kullanın.');paths.add(p.path.toLowerCase());
  for(const [si,s]of p.sections.entries()){
   const base=`/pages/${pi}/sections/${si}`;if(ids.has(s.id))add(base+'/id','Kimlik tekrar ediyor.');ids.add(s.id);const fieldIds=new Set<string>();
   for(const [fi,f]of s.fields.entries()){
    const at=base+`/fields/${fi}/value`;if(fieldIds.has(f.id))add(at,'Alan kimliği tekrar ediyor.');fieldIds.add(f.id);
    if(f.min!==undefined&&f.max!==undefined&&f.min>f.max)add(at,'Minimum, maksimumdan büyük olamaz.');
    if(f.type==='number'){if(typeof f.value!=='number'||!Number.isFinite(f.value)||(f.min!==undefined&&f.value<f.min)||(f.max!==undefined&&f.value>f.max)||(f.step!==undefined&&Math.abs((f.value-(f.min||0))/f.step-Math.round((f.value-(f.min||0))/f.step))>1e-8))add(at,'Sayısal sınır veya adım geçersiz.');}
    else if(f.type==='boolean'){if(typeof f.value!=='boolean')add(at,'Evet/hayır değeri gerekli.');}
    else if(typeof f.value!=='string')add(at,'Metin değeri gerekli.');
    else{
     if(f.required&&!f.value.trim())add(at,'Bu alan gerekli.');if(f.value.length>(f.maxLength||12000))add(at,`En fazla ${f.maxLength||12000} karakter kullanın.`);
     if(f.type==='rich'&&!validRich(f.value))add(at,'HTML etiketlerini, bağlantıları ve hizalama biçimini kontrol edin.');
     if(f.type!=='rich'&&/[<>\u0000-\u001f\u007f]/.test(f.value))add(at,'Bu alanda HTML veya kontrol karakterleri kullanılamaz.');
     if((f.type==='url'||f.type==='image')&&!safeUrl(f.value,f.type==='image'))add(at,f.type==='image'?'Medya kütüphanesinden bir görsel seçin.':'HTTPS, mailto, tel veya site içi bağlantı kullanın.');
     if(f.type==='enum'){
      const d=doc.dictionaries.find(d=>d.id===f.dictionary),e=d?.entries.find(e=>e.id===f.value),unchanged=oldValues.get(`${p.id}/${s.id}/${f.id}`)===f.value;
      if(!d||(!e||(!e.active&&!unchanged))&&d.mode==='strict')add(at,'Aktif bir sözlük değeri seçin veya import eşleştirmesini düzeltin.');
     }
    }
    for(const [locale,translation]of Object.entries(f.translations||{})){if(!doc.locales.includes(locale))add(at,'Çeviri dili tanımlı değil.');if(!['text','rich'].includes(f.type)||f.type!=='rich'&&/[<>\u0000-\u001f]/.test(translation)||f.type==='rich'&&!validRich(translation)||translation.length>(f.maxLength||12000))add(at,'Çeviri alan türü veya uzunluğu geçersiz.');}
   }
  }
 }if(before?.dictionaries.some(d=>!dictionaryIds.has(d.id)))add('/dictionaries','Geçmiş sözlükleri silmeyin; değerlerini pasif yapın.');return errors;
}
export function fieldPolicy(field:Field){const {value,translations,...policy}=field;return JSON.stringify(policy);}
