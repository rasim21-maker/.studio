import React,{useEffect,useRef,useState} from 'react';
const labels:Record<string,string>={queued:'Sırada',leased:'Çalıştırıcı aldı',running:'Çalışıyor',review:'İnceleme bekliyor',failed:'Başarısız',cancelled:'İptal edildi',rejected:'Arşivlendi'};
export function AiJobsPanel({base,request,revision,canStart}:{base:string;request:(url:string,method?:string,input?:unknown)=>Promise<any>;revision:number;canStart:boolean}){
 const [jobs,setJobs]=useState<any[]>([]),[runner,setRunner]=useState<any>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[offset,setOffset]=useState(0);
 const key=useRef<{revision:number;value:string}|null>(null);
 async function refresh(){const data=await request(base+'/ai-jobs?limit=20&offset='+offset);setJobs(data.jobs);setRunner(data.runner);}
 async function run(task:()=>Promise<void>){setBusy(true);setError('');try{await task();}catch(e:any){setError(e.message);}finally{setBusy(false);}}
 useEffect(()=>{let active=true;const load=()=>request(base+'/ai-jobs?limit=20&offset='+offset).then(data=>{if(active){setJobs(data.jobs);setRunner(data.runner);}}).catch(e=>{if(active)setError(e.message);});void load();const timer=setInterval(()=>void load(),5000);return()=>{active=false;clearInterval(timer);};},[base,offset]);
 return <section aria-label="Kalıcı AI işleri">
  <h3>AI iş kuyruğu</h3><p role="status">{runner?.reason||'Çalıştırıcı durumu kontrol ediliyor…'}</p>
  <p>Yayın öncesi içerik incelemesi rapor üretir. Siteyi değiştirmez veya yayına almaz. Kesilen işler, çalışma süresi dolunca yeniden alınabilir.</p>
  {runner?.lastError&&<p className="notice">Son çalıştırma tamamlanamadı. İş durumunu kontrol edin; hata ayrıntıları içerik veya sır sızdırmamak için gösterilmez.</p>}
  {error&&<p role="alert" className="error-banner">{error}</p>}
  <div className="modal-actions"><button disabled={busy||!runner?.available||!canStart} onClick={()=>void run(async()=>{if(key.current?.revision!==revision)key.current={revision,value:crypto.randomUUID()};await request(base+'/ai-jobs','POST',{revision,idempotencyKey:key.current!.value});key.current=null;await refresh();})}>Yayın öncesi inceleme başlat</button><button disabled={busy} onClick={()=>void run(refresh)}>İşleri yenile</button></div>
  {!jobs.length&&<p>Bu sayfada AI işi yok.</p>}
  {jobs.map(row=><article key={row.job.id} className="notice"><h4>{labels[row.state.status]||row.state.status}</h4><p>Sürüm {row.job.baseRevision} · Deneme {row.state.attempt}{row.job.baseRevision!==revision?' · Kaynak sürümü değişmiş':''}</p>
   {row.result&&<div><p>Model: {row.result.model} · {row.result.modelRevision}</p><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{row.result.output.summary||row.result.output.reason||'Sonuç yalnızca ayrıntılı incelemeye açıktır.'}</pre></div>}
   {['queued','leased','running','review'].includes(row.state.status)&&<button disabled={busy} onClick={()=>void run(async()=>{await request(base+'/ai-jobs/'+row.job.id+'/'+(row.state.status==='review'?'reject':'cancel'),'POST',{revision:row.state.revision});await refresh();})}>{row.state.status==='review'?'İncelemeyi kapat':'İşi iptal et'}</button>}
  </article>)}
  <div className="modal-actions"><button disabled={busy||offset===0} onClick={()=>setOffset(Math.max(0,offset-20))}>Önceki işler</button><button disabled={busy||jobs.length<20} onClick={()=>setOffset(offset+20)}>Sonraki işler</button></div>
 </section>;
}
