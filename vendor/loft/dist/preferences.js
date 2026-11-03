/* Preferences never store form fields or other personal information. */
(() => {
 const root=document.documentElement;
 const themeKey='loft-theme';
 const languageKey='loft-language';
 const allowedThemes=['light','dark','system'];
 const read=key=>{try{return localStorage.getItem(key)}catch{return null}};
 const write=(key,value)=>{try{localStorage.setItem(key,value)}catch{/* Private browsing can block storage. */}};
 const media=window.matchMedia('(prefers-color-scheme: dark)');
 let mode=read(themeKey);
 if(!allowedThemes.includes(mode))mode='light';
 function render(){
  root.dataset.themeMode=mode;
  root.dataset.theme=mode==='system'?(media.matches?'dark':'light'):mode;
  const meta=document.querySelector('meta[name="theme-color"]');
  if(meta)meta.content=root.dataset.theme==='dark'?'#151515':'#ffffff';
  document.querySelectorAll('[data-theme-choice]').forEach(button=>{
   const active=button.dataset.themeChoice===mode;
   button.setAttribute('aria-pressed',String(active));
   if(active){const label=document.querySelector('[data-theme-label]');if(label)label.textContent=button.querySelector('span').textContent;}
  });
 }
 render();
 media.addEventListener('change',()=>{if(mode==='system')render()});
 window.addEventListener('storage',event=>{
  if(event.key!==themeKey)return;
  mode=allowedThemes.includes(event.newValue)?event.newValue:'light';render();
 });
 document.addEventListener('DOMContentLoaded',()=>{
  render();
  document.querySelectorAll('[data-theme-choice]').forEach(button=>button.addEventListener('click',()=>{
   const chosen=button.dataset.themeChoice;
   if(!allowedThemes.includes(chosen))return;
   mode=chosen;write(themeKey,mode);render();
   const details=button.closest('details');if(details){details.open=false;details.querySelector('summary').focus();}
  }));
  document.querySelectorAll('a[data-language]').forEach(link=>link.addEventListener('click',()=>write(languageKey,link.dataset.language)));
  document.querySelectorAll('.settings-menu').forEach(details=>details.addEventListener('toggle',()=>{
   if(details.open)document.querySelectorAll('.settings-menu').forEach(other=>{if(other!==details)other.open=false});
  }));
  document.addEventListener('click',event=>document.querySelectorAll('.settings-menu[open]').forEach(details=>{if(!details.contains(event.target))details.open=false}));
  document.addEventListener('keydown',event=>{
   if(event.key!=='Escape')return;
   document.querySelectorAll('.settings-menu[open]').forEach(details=>{details.open=false;details.querySelector('summary').focus()});
  });
 });
 // A fresh visit starts in Turkish. Only the home entry remembers a prior choice;
 // explicit links to an individual translated page always keep their own language.
 const language=read(languageKey);
 if(root.dataset.locale==='tr'&&root.dataset.page==='index.html'&&language&&language!=='tr'){
  const link=Array.from(document.querySelectorAll('link[rel="alternate"][data-language]')).find(item=>item.dataset.language===language);
  if(link?.dataset.localHref)window.location.replace(link.dataset.localHref);
 }
})();
