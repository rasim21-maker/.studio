import React,{useEffect,useState} from 'react';
import {validateFields} from '@loft-studio/sdk';
import type {Field} from '@loft-studio/sdk';
import {Modal} from './editors.tsx';
import {IntegrationPanel} from './integration-panel.tsx';
import './modules.css';
type Fields=Record<string,Field>;
type Request=(url:string,method?:string,input?:unknown)=>Promise<any>;
const defaults=(fields:Fields)=>Object.fromEntries(Object.entries(fields).filter(([,f])=>f.default!==undefined||f.type==='boolean'||f.type==='items'||(f as any).generate==='uuid').map(([key,f])=>[key,(f as any).generate==='uuid'?crypto.randomUUID():f.default??(f.type==='boolean'?false:[])]));
const recordLabel=(r:any)=>r.data.name||r.data.title||r.data.customerName||r.data.pageId||r.id;
function download(name:string,content:string,mime='application/json'){
 const url=URL.createObjectURL(new Blob([content],{type:mime})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function FieldsForm({fields,value,onChange,refs,errors,prefix=''}:{fields:Fields;value:any;onChange:(value:any)=>void;refs:any;errors:any[];prefix?:string}){
 return <>{Object.entries(fields).map(([name,f])=>{
  const path=prefix+name,v=value[name],set=(next:any)=>onChange({...value,[name]:next}),error=errors.find(e=>e.path===path)?.message,id='module-field-'+path;
  if(f.type==='items')return <fieldset key={name} className="module-items"><legend>{f.label}{f.required?' *':''}</legend>{(v||[]).map((item:any,i:number)=><div className="module-item" key={i}><FieldsForm fields={f.fields!} value={item} refs={refs} errors={errors} prefix={path+'.'+i+'.'} onChange={next=>set(v.map((old:any,index:number)=>index===i?next:old))}/><button type="button" className="quiet" onClick={()=>set(v.filter((_:any,index:number)=>index!==i))}>Satırı kaldır</button></div>)}<button type="button" disabled={(v||[]).length>=(f.maxItems??100)} onClick={()=>set([...(v||[]),defaults(f.fields!)])}>＋ Satır ekle</button>{error&&<span role="alert" className="field-error">{error}</span>}</fieldset>;
  return <label key={name} htmlFor={id} className={f.type==='boolean'?'check':''}>{f.type!=='boolean'&&<span>{f.label}{f.required?' *':''}</span>}
   {f.type==='boolean'?<><input id={id} type="checkbox" checked={!!v} onChange={e=>set(e.target.checked)}/>{f.label}</>:
    f.type==='enum'||f.type==='reference'?<select id={id} required={f.required} value={v??''} onChange={e=>set(e.target.value)}><option value="">Seçin…</option>{f.type==='enum'?f.values?.map(item=><option key={item} value={item}>{item}</option>):refs[f.collection||'']?.map((r:any)=><option key={r.id} value={r.id}>{recordLabel(r)}</option>)}</select>:
    f.type==='textarea'?<textarea id={id} required={f.required} rows={3} maxLength={f.maxLength??4000} value={v??''} onChange={e=>set(e.target.value)}/>:
    <input id={id} type={['number','email','url','date'].includes(f.type)?f.type:'text'} required={f.required} min={f.min} max={f.max} step={f.step||(f.type==='number'?1:undefined)} minLength={f.minLength} maxLength={f.maxLength??4000} value={v??''} onChange={e=>set(f.type==='number'&&e.target.value!==''?Number(e.target.value):e.target.value)}/>}
   {f.help&&<small>{f.help}</small>}{error&&<span role="alert" className="field-error">{error}</span>}
  </label>;
 })}</>;
}
export function ModulePanel({base,site,request,onClose}:{base:string;site:any;request:Request;onClose:()=>void}){
 const [packages,setPackages]=useState<any[]>([]),[selected,setSelected]=useState(''),[collection,setCollection]=useState(''),[command,setCommand]=useState(''),[records,setRecords]=useState<any>({items:[],total:0}),[refs,setRefs]=useState<any>({}),[editing,setEditing]=useState<any>(null),[form,setForm]=useState<any>({}),[original,setOriginal]=useState('{}'),[errors,setErrors]=useState<any[]>([]),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[result,setResult]=useState<any>(null),[search,setSearch]=useState(''),[offset,setOffset]=useState(0);
 const pkg=packages.find(p=>p.id===selected),url=base+'/extensions/'+selected,dirty=JSON.stringify(form)!==original;
 const load=async()=>{const data=await request(base+'/extensions');setPackages(data.packages);setSelected(previous=>previous||data.packages[0]?.id||'');};
 const run=async(fn:()=>Promise<void>)=>{setBusy(true);setError('');setMessage('');try{await fn();}catch(e:any){setError(e.message);setErrors(Array.isArray(e.details)?e.details:[]);}finally{setBusy(false);}};
 useEffect(()=>{void run(load);},[]);
 const reset=()=>{setEditing(null);setForm({});setOriginal('{}');setErrors([]);setResult(null);};
 const leave=(fn:()=>void)=>{if(busy)return;if(dirty&&!window.confirm('Kaydedilmemiş alanlar var. Yine de ayrılmak istiyor musunuz?'))return;reset();fn();};
 const loadRecords=async()=>{if(!pkg?.installed||!collection)return;setRecords(await request(url+'/collections/'+collection+'?limit=25&offset='+offset+'&search='+encodeURIComponent(search)));};
 const loadRefs=async()=>{if(!pkg?.installed)return;const entries=await Promise.all(Object.keys(pkg.collections).map(async id=>[id,(await request(url+'/collections/'+id+'?limit=500')).items]));setRefs(Object.fromEntries(entries));};
 useEffect(()=>{if(pkg?.installed)void run(async()=>{await loadRefs();await loadRecords();});},[selected,pkg?.installed?.revision,collection,offset,search]);
 const begin=(row?:any)=>{const value=row?.data||defaults(pkg.collections[collection].fields);setEditing(row||{});setForm(value);setOriginal(JSON.stringify(value));setErrors([]);setResult(null);};
 const chooseCommand=(id:string)=>leave(()=>{setCollection('');setCommand(id);const value=defaults(pkg.commands[id].fields);setForm(value);setOriginal(JSON.stringify(value));});
 const fields:Fields=command?pkg?.commands[command]?.fields||{}:pkg?.collections[collection]?.fields||{};
 const writable=pkg?.installed?.state==='enabled'&&pkg.installed.version===pkg.version;
 const save=async()=>{
  const checked=validateFields(fields,form);if(checked.errors.length){setErrors(checked.errors);setError('İşaretli alanları düzeltin.');return;}
  await run(async()=>{
   if(command){const reply=await request(url+'/commands/'+command,'POST',checked.value);setResult(reply);setMessage('İşlem tamamlandı.');await loadRefs();}
   else{const reply=await request(url+'/collections/'+collection,'PUT',{...(editing.id?{id:editing.id,revision:editing.revision}:{}),data:checked.value});setEditing(reply);setForm(reply.data);setOriginal(JSON.stringify(reply.data));await loadRefs();await loadRecords();setMessage('Kayıt kaydedildi.');return;}
   setOriginal(JSON.stringify(form));setErrors([]);
  });
 };
 const life=async(action:string)=>{if(['disable','uninstall'].includes(action)&&!window.confirm('Modül kapatılacak; geçmiş kayıtlar korunacak. Devam edilsin mi?'))return;await run(async()=>{await request(url+'/'+action,'POST',{revision:pkg.installed?.revision??-1});await load();setMessage('Modül durumu güncellendi.');});};
 return <Modal title="Modül merkezi" onClose={()=>leave(onClose)} wide><div className="module-hub">
  <aside className="module-catalog" aria-label="Paketler">{packages.map(p=><button key={p.id} aria-pressed={selected===p.id} className={selected===p.id?'active':''} disabled={busy} onClick={()=>leave(()=>{setSelected(p.id);setCollection('');setCommand('');setOffset(0);setSearch('');})}><strong>{p.name}</strong><span>{!p.installed?'Kurulum gerekli':p.installed.state==='enabled'?'Etkin':'Kapalı'} · {p.version}</span></button>)}</aside>
  <section className="module-detail">{error&&<p role="alert" className="error-banner">{error}</p>}{message&&<p role="status" className="notice">{message}</p>}
   {!pkg?<p>Modüller yükleniyor…</p>:<><header><h2>{pkg.name}</h2><p>{pkg.description}</p></header>
   <div className="module-actions">{site.permissions.includes('members')&&<>
    {!pkg.installed||pkg.installed.state==='uninstalled'?<button disabled={busy} className="primary" onClick={()=>void life('install')}>Paketi kur</button>:<><button disabled={busy} onClick={()=>void life(pkg.installed.state==='enabled'?'disable':'enable')}>{pkg.installed.state==='enabled'?'Devre dışı bırak':'Etkinleştir'}</button>{pkg.installed.version!==pkg.version&&<button disabled={busy} onClick={()=>void life('upgrade')}>Paketi güncelle</button>}<button disabled={busy} onClick={()=>void life('uninstall')}>Kaldır · verileri koru</button></>}
   </>}{pkg.installed&&<button disabled={busy} onClick={()=>void run(async()=>{const data=await request(url+'/export');download(pkg.id+'-veriler.json',JSON.stringify(data,null,2));})}>Verileri dışa aktar</button>}</div>
   {pkg.installed&&<><nav className="module-tabs" aria-label="Modül işlemleri">{Object.entries(pkg.collections).map(([id,c]:any)=><button key={id} className={collection===id?'primary':''} disabled={busy} onClick={()=>leave(()=>{setCollection(id);setCommand('');setOffset(0);setSearch('');})}>{c.label}</button>)}{Object.entries(pkg.commands).map(([id,c]:any)=><button key={id} className={command===id?'primary':''} disabled={busy} onClick={()=>chooseCommand(id)}>{c.label}</button>)}</nav>
   {!writable&&<p className="notice">Geçmiş kayıtlar okunabilir ve dışa aktarılabilir. Yeni işlemler için paketi etkinleştirin veya güncelleyin.</p>}
   {collection&&<><div className="module-list-tools"><label>Kayıtlarda ara<input type="search" value={search} onChange={e=>{setSearch(e.target.value);setOffset(0);}}/></label>{!pkg.collections[collection].readOnly&&writable&&<button disabled={busy||pkg.collections[collection].singleton&&records.total>0} onClick={()=>leave(()=>begin())}>＋ Yeni kayıt</button>}</div>
    <div className="module-records">{records.items.map((row:any)=><button key={row.id} disabled={busy} onClick={()=>leave(()=>begin(row))}><strong>{recordLabel(row)}</strong><span>{row.data.stage||row.data.status||row.data.email||row.data.sku||''}</span><small>Sürüm {row.revision}</small></button>)}{!records.total&&<p>Henüz kayıt yok.</p>}</div>
    <div className="module-pagination"><button disabled={busy||offset===0} onClick={()=>setOffset(Math.max(0,offset-25))}>Önceki</button><span>{records.total} kayıt</span><button disabled={busy||offset+25>=records.total} onClick={()=>setOffset(offset+25)}>Sonraki</button></div>
   </>}
   {(command||editing)&&<form className="module-form" onSubmit={e=>{e.preventDefault();void save();}}><h3>{command?pkg.commands[command].label:editing.id?'Kaydı düzenle':'Yeni kayıt'}</h3>{command&&pkg.commands[command].help&&<p>{pkg.commands[command].help}</p>}{editing?.id&&<p className="hint">Kimlik: {editing.id} · Sürüm: {editing.revision}</p>}
    <fieldset disabled={busy||(!command&&(!writable||pkg.collections[collection].readOnly))||!!command&&pkg.commands[command].write&&!writable}><FieldsForm fields={fields} value={form} onChange={setForm} refs={refs} errors={errors}/>
     {(command||!pkg.collections[collection].readOnly)&&<button type="submit" className="primary">{busy?'İşleniyor…':command?'İşlemi çalıştır':'Kaydet'}</button>}
    </fieldset>
    {!command&&editing.id&&writable&&!pkg.collections[collection].readOnly&&<button type="button" disabled={busy} onClick={()=>{if(window.confirm('Kayıt kalıcı olarak silinsin mi? İlişkili kayıtlar varsa işlem engellenir.'))void run(async()=>{await request(url+'/collections/'+collection,'DELETE',{id:editing.id,revision:editing.revision});reset();await loadRefs();await loadRecords();setMessage('Kayıt silindi.');});}}>Kaydı sil</button>}
   </form>}
   {!command&&editing?.id&&pkg.views?.filter((v:any)=>v.collection===collection).map((view:any)=><IntegrationPanel key={view.integrationId+':'+view.id+':'+editing.id} view={view} recordId={editing.id} base={base} request={request} canManage={site.permissions.includes('members')}/>)}
   {result&&<div className="module-result"><h3>İşlem sonucu</h3>{result.files?.map((file:any)=><button key={file.path} onClick={()=>download(file.path,file.content,file.mime)}>{file.path} indir</button>)}<pre tabIndex={0}>{JSON.stringify(result,null,2)}</pre></div>}
   {!collection&&!command&&<p className="hint">Kayıtları yönetmek veya işlem çalıştırmak için üstteki seçeneklerden birini seçin.</p>}
   </>}
   </>}
  </section></div></Modal>;
}
