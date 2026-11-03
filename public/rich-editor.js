import {richHtml, escapeHtml, plainText} from './rich-core.js';
export function mountRich(root=document) {
  root.querySelectorAll('textarea[data-rich]').forEach(input => {
    if(input.dataset.mounted) return; input.dataset.mounted='1';
    if(!input.hasAttribute('aria-label')) input.setAttribute('aria-label',input.closest('label')?.firstChild?.textContent?.trim()||'HTML metni');
    const box=document.createElement('div'); box.className='rich-editor'; input.before(box); box.append(input);
    const bar=document.createElement('div'); bar.className='rich-toolbar'; bar.setAttribute('role','toolbar'); bar.setAttribute('aria-label','HTML metin biçimlendirme');
    bar.innerHTML=[['strong','Kalın','B'],['em','İtalik','I'],['u','Altı çizili','U'],['br','Satır sonu','↵'],['left','Sola hizala','⇤'],['center','Ortala','↔'],['right','Sağa hizala','⇥'],['justify','İki yana yasla','☰'],['a','Bağlantı','↗'],['clear','Biçimi kaldır','Tx']].map(([id,title,label])=>`<button type="button" data-rich-action="${id}" title="${title}" aria-label="${title}">${label}</button>`).join('')+'<button type="button" data-rich-action="preview">Önizleme</button><span>HTML</span>';
    box.prepend(bar); const preview=document.createElement('div'); preview.className='rich-preview'; preview.hidden=true; box.append(preview);
    const update=()=>{try {preview.innerHTML=richHtml(input.value); preview.classList.remove('invalid');}catch(e){preview.textContent=e.message; preview.classList.add('invalid');}};
    input.addEventListener('input',update);
    bar.querySelectorAll('button').forEach(button=>button.onclick=()=>{
      const action=button.dataset.richAction;
      if(action==='preview'){preview.hidden=!preview.hidden;button.setAttribute('aria-pressed',String(!preview.hidden));update();return;}
      const start=input.selectionStart,end=input.selectionEnd, selected=input.value.slice(start,end); let next;
      if(action==='clear') next=escapeHtml(plainText(selected||input.value));
      else if(action==='br') next='<br>';
      else if(['left','center','right','justify'].includes(action)) next=`<span class="rt-align-${action}">${selected||input.value}</span>`;
      else if(action==='a'){const href=prompt('HTTPS, e-posta veya telefon bağlantısı:','https://');if(!href)return;next=`<a href="${escapeHtml(href)}">${selected||'Bağlantı'}</a>`;try{richHtml(next);}catch(e){alert(e.message);return;}}
      else next=`<${action}>${selected||'metin'}</${action}>`;
      const whole=!selected&&['left','center','right','justify','clear'].includes(action);
      input.setRangeText(next,whole?0:start,whole?input.value.length:end,'select'); input.dispatchEvent(new Event('input',{bubbles:true}));input.focus();
    });
  });
}
window.mountStudioRich=mountRich;
