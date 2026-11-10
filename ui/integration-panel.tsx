import React,{useEffect,useRef,useState} from 'react';
type Request=(url:string,method?:string,input?:unknown)=>Promise<any>;

// Declarative slot: this component has no booking/CRM package IDs.
export function IntegrationPanel({view,recordId,base,request,canManage}:{view:any;recordId:string;base:string;request:Request;canManage:boolean}){
 const [data,setData]=useState<any>(null),[status,setStatus]=useState<any>(null),[error,setError]=useState(''),[hidden,setHidden]=useState(false),[busy,setBusy]=useState(false),[selected,setSelected]=useState(''),[search,setSearch]=useState(''),[query,setQuery]=useState(''),[offset,setOffset]=useState(0),[bookingOffset,setBookingOffset]=useState(0),[refresh,setRefresh]=useState(0);
 const alive=useRef(true),requestVersion=useRef(0);
 const endpoint=base+'/extension-links/'+view.integrationId;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;requestVersion.current++;};},[]);
 useEffect(()=>{const timer=setTimeout(()=>{setQuery(search);setSelected('');},250);return()=>clearTimeout(timer);},[search]);
 useEffect(()=>{
  let disposed=false;
  const load=async()=>{
   const version=++requestVersion.current;
   try{
    const [next,diagnostics]=await Promise.all([
     request(endpoint+'/commands/'+view.command,'POST',{[view.contextField]:recordId,search:query,offset,bookingOffset}),
     request(endpoint+'/status')
    ]);
    if(disposed||version!==requestVersion.current)return;
    setData(next);setStatus(diagnostics);setError('');setHidden(false);
   }catch(e:any){
    if(disposed||version!==requestVersion.current)return;
    // A revoked module/permission must also remove already-rendered details.
    setData(null);setStatus(null);
    if([403,404,409].includes(e.status)){setHidden(true);return;}
    setError(e.message);
   }
  };
  void load();const timer=setInterval(()=>void load(),3000);
  return()=>{disposed=true;clearInterval(timer);};
 },[endpoint,recordId,query,offset,bookingOffset,refresh]);
 const act=async(command:string,input:any)=>{
  setBusy(true);setError('');
  try{await request(endpoint+'/commands/'+command,'POST',{[view.contextField]:recordId,...input});if(alive.current){setSelected('');setRefresh(v=>v+1);}}
  catch(e:any){if(alive.current){setError(e.message);if([403,404,409].includes(e.status))setRefresh(v=>v+1);}}
  finally{if(alive.current)setBusy(false);}
 };
 if(hidden)return null;
 const pending=status?.deliveries?.find((x:any)=>x.state==='pending')?.count||0,failed=status?.deliveries?.find((x:any)=>x.state==='failed')?.count||0;
 return <section className="integration-panel" aria-label={view.label}>
  <header><h3>{view.label}</h3><button type="button" disabled={busy} onClick={()=>setRefresh(v=>v+1)}>Yenile</button></header>
  {error&&<p role="alert" className="error-banner">{error}</p>}
  {(pending>0||failed>0||status?.sourceError)&&<p role="status" className="notice">{status?.sourceError?'Hareket aktarımı kesildi. ':''}{pending>0?pending+' hareket aktarılmayı bekliyor. ':''}{failed>0?failed+' hareket aktarılamadı. ':''}
   {failed>0&&canManage&&<button type="button" disabled={busy} onClick={async()=>{setBusy(true);try{await request(endpoint+'/retry','POST',{});setRefresh(v=>v+1);}catch(e:any){setError(e.message);}finally{setBusy(false);}}}>Aktarımı yeniden dene</button>}
  </p>}
  {!data?<p>Hareketler yükleniyor…</p>:<>
   <p className="hint">{data.help}</p>
   <div className="integration-link">
    <label>Bağlanabilir kayıtlarda ara<input type="search" value={search} maxLength={200} onChange={e=>setSearch(e.target.value)}/></label>
    <label>İlgili kayıt<select value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Kayıt seçin…</option>{data.candidates.map((r:any)=><option key={r.id} value={r.id}>{r.label}</option>)}</select></label>
    <button type="button" className="primary" disabled={busy||!selected} onClick={()=>void act(view.linkCommand,{[view.linkField]:selected})}>Bu kişiye bağla</button>
   </div>
   <ul className="integration-links">{data.links.map((r:any)=><li key={r.id}><span>{r.label}</span><button type="button" disabled={busy} aria-label={r.label+' bağlantısını kaldır'} onClick={()=>void act(view.unlinkCommand,{[view.linkField]:r.id,revision:r.revision})}>Bağlantıyı kaldır</button></li>)}</ul>
   {data.linkTotal>100&&<div className="module-pagination"><button type="button" disabled={busy||bookingOffset===0} onClick={()=>{setBookingOffset(v=>Math.max(0,v-100));setOffset(0);}}>Önceki bağlantılar</button><span>{data.linkTotal} bağlantı</span><button type="button" disabled={busy||bookingOffset+100>=data.linkTotal} onClick={()=>{setBookingOffset(v=>v+100);setOffset(0);}}>Sonraki bağlantılar</button></div>}
   {!data.links.length&&<p>Bu kişiye henüz kayıt bağlanmadı.</p>}
   <ol className="integration-timeline">{data.items.map((item:any)=><li key={item.id}><strong>{item.title}</strong><span>{item.detail}</span><time dateTime={item.time}>{new Date(item.time).toLocaleString()}</time><small>Randevu: {new Date(item.start).toLocaleString()} – {new Date(item.end).toLocaleString()}</small></li>)}</ol>
   {data.total>50&&<div className="module-pagination"><button type="button" disabled={busy||offset===0} onClick={()=>setOffset(v=>Math.max(0,v-50))}>Önceki hareketler</button><span>{data.total} hareket</span><button type="button" disabled={busy||offset+50>=data.total} onClick={()=>setOffset(v=>v+50)}>Sonraki hareketler</button></div>}
  </>}
 </section>;
}
