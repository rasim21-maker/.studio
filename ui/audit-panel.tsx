import React,{useEffect,useRef,useState} from 'react';
import {Modal} from './editors.tsx';
import './audit.css';
type Api=(url:string,method?:string,input?:unknown)=>Promise<any>;
const text=(v:unknown)=>v===null||v===undefined?'—':typeof v==='string'?v:JSON.stringify(v,null,2);
const endpoint=(route:string,params:Record<string,string>)=>'/api/audit/'+route+'?'+new URLSearchParams(params);
const actors:Record<string,string>={human:'Kullanıcı',ai:'Yapay zekâ',system:'Sistem',anonymous:'Kimliği doğrulanmadı'};
const devices:Record<string,string>={mobile:'Mobil', 'unknown-or-desktop':'Masaüstü / bilinmiyor'};
const ipSources:Record<string,string>={socket:'Doğrudan bağlantı','trusted-proxy':'Güvenilen proxy'};
export function AuditPanel({api,onClose}:{api:Api;onClose:()=>void}) {
  const [scopes,setScopes]=useState<any[]>([]),[draft,setDraft]=useState<Record<string,string>>({scope:'',kind:'',from:'',to:'',actor:'',ip:'',action:'',requestId:'',status:'',method:''});
  const [applied,setApplied]=useState<Record<string,string>>({}),[page,setPage]=useState<any>(null),[cursor,setCursor]=useState<Record<string,string>>({}),[previous,setPrevious]=useState<Record<string,string>[]>([]);
  const [busy,setBusy]=useState(false),[exporting,setExporting]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const version=useRef(0),download=useRef<AbortController|null>(null);
  useEffect(()=>{let live=true;api('/api/audit/scopes').then(r=>{if(live){setScopes(r.scopes);setDraft(d=>({...d,scope:r.scopes[0]?.id||''}));}}).catch(e=>live&&setError(e.message));return()=>{live=false;version.current++;download.current?.abort();};},[]);
  const change=(key:string,value:string)=>setDraft(d=>({...d,[key]:value}));
  async function load(params:Record<string,string>,next:Record<string,string>={},history:Record<string,string>[]=[]){
    const current=++version.current;setBusy(true);setError('');setMessage('');setPage(null);
    try{const data=await api(endpoint('events',{...params,...next}));if(version.current===current){setApplied(params);setCursor(next);setPrevious(history);setPage(data);}}
    catch(e:any){if(version.current===current)setError(e.message);}finally{if(version.current===current)setBusy(false);}
  }
  async function submit(event:React.FormEvent){
    event.preventDefault();const params=Object.fromEntries(Object.entries(draft).filter(([,v])=>v));
    for(const key of ['from','to'])if(params[key])params[key]=new Date(params[key]).toISOString();
    if(params.from&&params.to&&params.from>params.to){setError('Başlangıç zamanı bitişten sonra olamaz.');return;}
    await load(params);
  }
  async function exportFile(format:string){
    if(!page)return;setExporting(true);setError('');setMessage('');const controller=new AbortController();download.current=controller;
    try{
      const response=await fetch(endpoint('export',{...applied,asOf:String(page.asOf),format}),{credentials:'same-origin',signal:controller.signal});
      if(!response.ok){const result=await response.json();throw Error(result.error||'Dışa aktarım başlatılamadı.');}
      const blob=await response.blob();if(controller.signal.aborted)return;
      const url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download='studio-audit.'+format;
      document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
      setMessage('Seçili filtrelerle eşleşen tüm kayıtlar indirildi.');
    }catch(e:any){if(!controller.signal.aborted)setError('Dışa aktarım tamamlanamadı. Yetkinizi kontrol edin veya tarih aralığını daraltın. '+e.message);}
    finally{if(download.current===controller){download.current=null;setExporting(false);}}
  }
  const canExport=scopes.find(s=>s.id===applied.scope)?.canExport;
  return <Modal title="İstek ve değişiklik kayıtları" onClose={onClose} wide><div className="audit-panel">
    <p>Zaman, kullanıcı, IP ve istemci bilgileriyle işlem geçmişi. Gizli değerler maskelenir. Tarayıcı/cihaz bilgisi istemci beyanıdır.</p>
    <form className="audit-filters" onSubmit={submit}>
      <label>Kapsam<select required value={draft.scope} onChange={e=>change('scope',e.target.value)}>{scopes.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
      <label>Kayıt türü<select value={draft.kind} onChange={e=>change('kind',e.target.value)}><option value="">Tümü</option><option value="request">İstek</option><option value="change">Değişiklik</option><option value="event">Olay</option></select></label>
      <label>Başlangıç · yerel saat<input type="datetime-local" value={draft.from} max={draft.to||undefined} onChange={e=>change('from',e.target.value)}/></label>
      <label>Bitiş · yerel saat<input type="datetime-local" value={draft.to} min={draft.from||undefined} onChange={e=>change('to',e.target.value)}/></label>
      <label>Kullanıcı kimliği / e-posta<input maxLength={200} value={draft.actor} onChange={e=>change('actor',e.target.value)} placeholder="Tam kimlik veya e-posta"/></label>
      <label>IP adresi<input maxLength={45} value={draft.ip} onChange={e=>change('ip',e.target.value)} placeholder="IPv4 veya IPv6"/></label>
      <label>İşlem<input maxLength={160} value={draft.action} onChange={e=>change('action',e.target.value)} placeholder="Örn. reservations.update"/></label>
      <label>İstek kimliği<input maxLength={80} value={draft.requestId} onChange={e=>change('requestId',e.target.value)}/></label>
      <label>HTTP durumu<input type="number" min={100} max={599} step={1} value={draft.status} onChange={e=>change('status',e.target.value)}/></label>
      <label>Yöntem<select value={draft.method} onChange={e=>change('method',e.target.value)}><option value="">Tümü</option>{['GET','POST','PUT','DELETE','OPTIONS'].map(m=><option key={m}>{m}</option>)}</select></label>
      <button className="primary" disabled={busy||!draft.scope}>{busy?'Yükleniyor…':'Kayıtları getir'}</button>
    </form>
    {error&&<p role="alert" className="error-banner">{error}</p>}{message&&<p role="status" className="notice">{message}</p>}
    {page&&<><div className="audit-toolbar"><span role="status">{page.entries.length} kayıt · {scopes.find(s=>s.id===applied.scope)?.label}</span><div><button disabled={!canExport||exporting} onClick={()=>exportFile('json')}>JSON indir</button><button disabled={!canExport||exporting} onClick={()=>exportFile('csv')}>CSV indir</button>{exporting&&<button onClick={()=>download.current?.abort()}>İndirmeyi iptal et</button>}</div></div>
      {!canExport&&<p>Bu kapsam için dışa aktarma yetkiniz yok.</p>}
      <p className="muted">Dışa aktarma tüm eşleşen kayıtları kapsar; ekran 50 kayıtlık sayfalar gösterir. Değişiklikleri istek kimliğiyle ilişkilendirebilirsiniz.</p>
      {!page.entries.length&&<p>Kayıt bulunamadı.</p>}
      <div className="audit-entries">{page.entries.map((e:any)=><details key={e.id} className="audit-entry">
        <summary><time dateTime={e.occurredAt}>{new Date(e.occurredAt).toLocaleString()}</time><strong>{e.action}</strong><span>{e.actorLabel||actors[e.actorType]||e.actorType}</span><span>{e.status?String(e.status):e.kind==='request'?'Başladı':e.kind==='change'?'Değişiklik':'Olay'}</span></summary>
        <dl className="audit-meta"><dt>UTC zamanı</dt><dd>{e.occurredAt}</dd><dt>Kullanıcı</dt><dd>{e.actorId||'Kimliği doğrulanmadı'} · {actors[e.actorType]||e.actorType}</dd><dt>Kapsam</dt><dd>{e.scope}</dd><dt>Hedef kayıt</dt><dd>{e.resource||"—"}</dd><dt>İstek</dt><dd>{e.method} {e.path} · {e.durationMs??'—'} ms</dd><dt>İstek kimliği</dt><dd><code>{e.requestId||'Arka plan işlemi'}</code></dd><dt>IP / bağlantı IP’si</dt><dd>{e.ip||'—'} / {e.peerIp||'—'} · {ipSources[e.ipSource]||e.ipSource||'—'}</dd><dt>İstemci</dt><dd>{e.device.browser} · {e.device.os} · {devices[e.device.type]||e.device.type}<br/>{e.device.userAgent||'Bilgi gönderilmedi'}<br/>{e.device.platform} {e.device.language}</dd></dl>
        {!!e.values?.changes?.length&&<div className="audit-table-scroll"><table><caption>Eski ve yeni değerler</caption><thead><tr><th>Alan</th><th>Eski değer</th><th>Yeni değer</th></tr></thead><tbody>{e.values.changes.map((v:any,i:number)=><tr key={i}><th scope="row">{v.path}</th><td><pre>{text(v.before)}</pre></td><td><pre>{text(v.after)}</pre></td></tr>)}</tbody></table></div>}
        {e.values?.truncated&&<p role="note">Büyük içerik nedeniyle {e.values.omitted} değişiklik kesiti kayda alınamadı. Bu kayıt tam içerik kopyası değildir.</p>}
        {!e.values?.changes?.length&&e.kind==='request'&&<p>Bu kayıt istek bilgisidir. Kalıcı değişiklikler aynı istek kimliği altında ayrı kayıtlarda görünür.</p>}
        {Object.keys(e.detail||{}).length>0&&<pre className="audit-detail">{text(e.detail)}</pre>}
      </details>)}</div>
      <nav aria-label="Log sayfaları" className="audit-toolbar"><button disabled={!previous.length||busy} onClick={()=>load(applied,previous.at(-1),previous.slice(0,-1))}>Önceki</button><button disabled={!page.nextCursor||busy} onClick={()=>load(applied,{before:String(page.nextCursor),asOf:String(page.asOf)},[...previous,cursor])}>Sonraki</button></nav>
    </>}
  </div></Modal>;
}
