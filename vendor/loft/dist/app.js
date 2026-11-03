const messages=JSON.parse(document.querySelector('#site-messages')?.textContent||'{}');
const t=(key,fallback)=>messages[key]||fallback;
const toggle=document.querySelector('.menu-toggle');
const nav=document.querySelector('.nav');
toggle?.addEventListener('click',()=>{const open=toggle.getAttribute('aria-expanded')!=='true';toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?t('t213','Menüyü kapat'):t('t006','Menüyü aç'));nav.classList.toggle('open',open)});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&nav?.classList.contains('open')){nav.classList.remove('open');toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label',t('t006','Menüyü aç'));toggle.focus()}});
const form=document.querySelector('#contact-form');
const viewer=document.querySelector('.lightbox');
let photoTrigger;
document.querySelectorAll('.gallery-photo').forEach(button=>button.addEventListener('click',()=>{photoTrigger=button;viewer.querySelector('img').src=button.dataset.photo;viewer.querySelector('img').alt=button.querySelector('img').alt;viewer.querySelector('p').textContent=button.dataset.caption;viewer.showModal();document.body.classList.add('locked');}));
viewer?.querySelector('.lightbox-close').addEventListener('click',()=>viewer.close());
viewer?.addEventListener('click',e=>{if(e.target===viewer)viewer.close()});
viewer?.addEventListener('close',()=>{document.body.classList.remove('locked');photoTrigger?.focus()});
if(form){
 const date=form.querySelector('[type=date]');
 if(date){const d=new Date();date.min=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
 form.addEventListener('submit',e=>{
  e.preventDefault();if(!form.reportValidity())return;
  const values=new FormData(form);
  const labels={'Ad soyad':t('t218','Ad soyad'),'Telefon':t('t083','Telefon'),'E-posta':t('t089','E-posta'),'Hizmet':t('t219','Hizmet'),'Tarih':t('t220','Tarih'),'Konu':t('t101','Konu'),'Mesaj':t('t221','Mesaj')};
  const lines=[t('t214','Merhaba Loft Pet House,'),'',...Array.from(values,([k,v])=>`${labels[k]||k}: ${String(v).trim()}`),'',t('t215','Müsaitlik ve hizmetleriniz hakkında bilgi almak istiyorum.')];
  const message=lines.join('\n');
  const result=form.querySelector('.draft-result');
  result.hidden=false;
  result.querySelector('a').href=`mailto:info@loftpethouse.com?subject=${encodeURIComponent('Loft Pet House — '+(values.get('Hizmet')||values.get('Konu')||t('t012','İletişim')))}&body=${encodeURIComponent(message)}`;
  result.querySelector('.draft-copy').onclick=async()=>{const status=result.querySelector('.form-status');try{await navigator.clipboard.writeText(message);status.textContent=t('t216','Mesaj kopyalandı. info@loftpethouse.com adresine gönderebilirsiniz.');}catch{status.textContent=t('t217','Kopyalama kullanılamıyor. E-posta uygulamanızla devam edebilirsiniz.');}};
  result.setAttribute('tabindex','-1');result.focus();result.scrollIntoView({block:'nearest',behavior:'smooth'});
 });
 form.addEventListener('input',()=>{form.querySelector('.draft-result').hidden=true});
 // Keep native submission unavailable until all form handlers are installed.
 const fields=form.querySelector('.form-fields');
 if(fields){
  fields.disabled=false;
  form.querySelector('.form-unavailable')?.setAttribute('hidden','');
 }
}
