import React,{useState} from 'react';
export function FrameworkReport({report}:{report:any}){
 if(!report)return null;
 return <details open><summary>Teknoloji keşfi · {report.names.join(', ')||'Statik veya bilinmiyor'}</summary><p>{report.message}</p><p>Kod çalıştırılmadı. Paket bildirimi veya HTML işareti, çalışan framework doğrulaması değildir.</p>{report.evidence.map((e:any,i:number)=><p key={i}><strong>{e.name}</strong> · <code>{e.file}</code> · {e.signal}</p>)}</details>;
}
export function ComponentReport({manifest}:{manifest:any}){
 if(!manifest)return null;
 return <details open><summary>SDK bileşen bağları · {manifest.components.length}</summary><p>Bu bileşenler içerik alanlarını React uygulamasında özellik olarak kullanır. Studio özel bileşen kodunu çalıştırmaz; kaynak dosyası ve export adı geliştirici beyanıdır.</p>{manifest.components.map((c:any)=><p key={c.id}><strong>{c.id}</strong> · <code>{c.sourceFile} / {c.exportName}</code><br/>{Object.entries(c.props).map(([prop,field])=>prop+' ← '+field).join(', ')}</p>)}</details>;
}
export function ManualMapping({candidates,selected,onChange}:{candidates:any[];selected:string[];onChange:(keys:string[])=>void}){
 const [query,setQuery]=useState('');
 const shown=candidates.filter(c=>(c.file+' '+c.path+' '+c.sample).toLocaleLowerCase('tr').includes(query.toLocaleLowerCase('tr')));
 return <details><summary>Manuel DOM seçimi · {selected.length} seçili</summary><p>Kaynak DOM yollarından desteklenen ek metin öğelerini seçin. Bu liste yalnızca mevcut bölümlerdeki düz metin yapraklarını gösterir; canlı sayfa üzerinde görsel tıklama değildir. Seçimler başlangıçta kapalıdır.</p><label>DOM yolunda veya metinde ara<input value={query} onChange={e=>setQuery(e.target.value)} maxLength={150}/></label>
  <button type="button" onClick={()=>onChange([])}>Manuel seçimleri temizle</button>
  {!shown.length&&<p>Seçilebilir ek öğe bulunamadı. Framework kaynakları SDK/adaptör gerektirir; en fazla 200 desteklenen öğe gösterilir.</p>}
  {[...new Set(shown.map(c=>c.file))].map(file=><details open key={file}><summary>{file}</summary>{shown.filter(c=>c.file===file).map(c=><div key={c.key} style={{padding:12,overflowWrap:'anywhere'}}><label className="check"><input type="checkbox" checked={selected.includes(c.key)} onChange={e=>onChange(e.target.checked?[...selected,c.key]:selected.filter(k=>k!==c.key))}/>{c.sample}</label><small>{c.section} · <code>{c.path}</code></small></div>)}</details>)}
 </details>;
}
