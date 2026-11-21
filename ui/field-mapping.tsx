import React from 'react';
export function FieldMapping({candidates,selected,onChange}:{candidates:any[];selected:string[];onChange:(keys:string[])=>void}){
 return <details open><summary>Düzenlenebilir alanları seç · {selected.length}/{candidates.length}</summary>
  <p>Önerileri inceleyin. Seçilmeyen metinler sitede korunur, editörde açılmaz. Bu seçim yalnızca içerik alanlarını kapsar; bölüm yerleşimi ve sayfa SEO alanları ayrı yönetilir.</p>
  <p>Dinamik uygulama içeriği, görseller, bağlantı hedefleri ve ana alan dışındaki içerikler bu keşfin kapsamı dışındadır.</p>
  <div className="modal-actions"><button type="button" onClick={()=>onChange(candidates.map(c=>c.key))}>Tümünü seç</button><button type="button" onClick={()=>onChange([])}>Seçimi temizle</button></div>
  {!candidates.length&&<p>Güvenli metin alanı bulunamadı. Kaynak korunur; özel bileşenler için SDK veya kaynak eşleştirmesi gerekir.</p>}
  <div className="import-files">{candidates.map(c=><div key={c.key} style={{display:'block'}}><label className="check"><input type="checkbox" checked={selected.includes(c.key)} onChange={e=>onChange(e.target.checked?[...selected,c.key]:selected.filter(k=>k!==c.key))}/>{c.label}</label><small><code>{c.file}</code> · {c.section} · {c.tag} · {c.type}</small><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{c.sample}</pre></div>)}</div>
 </details>;
}
