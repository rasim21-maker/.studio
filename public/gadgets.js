(() => {
 const escape=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
 const titles={weather:'Hava durumu',news:'Haberler',stocks:'Hisse',index:'Endeks',traffic:'Trafik'};
 document.querySelectorAll('[data-gadget]').forEach(async el=>{
  const runtime=el.dataset.runtime?.replace(/\/$/,'');if(!runtime){el.textContent='Canlı veri sunucusu henüz yapılandırılmadı.';return;}
  try{const response=await fetch(`${runtime}/public/${encodeURIComponent(el.dataset.site)}/gadgets/${encodeURIComponent(el.dataset.gadget)}`,{credentials:'omit',signal:AbortSignal.timeout(15000)});const data=await response.json();if(!response.ok)throw Error('Veri alınamadı.');if(!data.items?.length){el.textContent=data.message||'Veri şu anda mevcut değil.';return;}
   el.innerHTML=`${data.status==='stale'?'<p>Son alınan veri · Güncelleme bekleniyor</p>':''}${data.items.map(i=>`<article><h3>${i.url&&/^https:\/\//.test(i.url)?`<a href="${escape(i.url)}" target="_blank" rel="noopener">${escape(i.title)}</a>`:escape(i.title||titles[data.provider])}</h3>${i.value?`<strong>${escape(i.value)}</strong>`:''}<p>${escape(i.detail||'')}</p><small>${escape(i.asOf||'')}</small></article>`).join('')}<p><small>Kaynak: <a href="${escape(data.attribution?.url||'#')}" rel="noopener" target="_blank">${escape(data.attribution?.name||data.provider)}</a> · ${escape(data.fetchedAt)}</small></p>`;
  }catch{el.textContent='Canlı veri şu anda alınamıyor. Daha sonra yeniden deneyin.';}
 });
})();
