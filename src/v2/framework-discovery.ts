import type {Source} from '../../shared/v2/model.ts';
/** Evidence only: never import modules, run scripts or change adapter authority. */
export function inspectFramework(source:Source){
 const evidence:{name:string;file:string;signal:string}[]=[];
 const packages:Record<string,string>={react:'React',next:'Next.js',vue:'Vue',nuxt:'Nuxt',svelte:'Svelte','@sveltejs/kit':'SvelteKit',astro:'Astro','@angular/core':'Angular'};
 for(const [file,text]of Object.entries(source.files)){
  if(/(^|\/)package\.json$/.test(file)){
   try{const json=JSON.parse(text);for(const [dependency,name]of Object.entries(packages))if(json?.dependencies?.[dependency]||json?.devDependencies?.[dependency])evidence.push({name,file,signal:'Paket bildirimi: '+dependency});}catch{/* Import remains authoritative for malformed files. */}
  }
  if(/\.html$/.test(file))for(const [name,pattern]of [['Next.js',/_next\/|__NEXT_DATA__/],['Nuxt',/_nuxt\/|__NUXT__/],['React',/data-reactroot|data-reactid/],['Vue',/data-v-app/],['Astro',/<astro-island\b/]] as [string,RegExp][])if(pattern.test(text))evidence.push({name,file,signal:'HTML runtime işareti'});
 }
 const names=[...new Set(evidence.map(e=>e.name))],sdk=source.manifest.adapter.id==='react-sdk';
 return{version:1,names,evidence:evidence.slice(0,80),adapter:source.manifest.adapter.id,
  status:sdk?'sdk':names.length?'integration-required':'static-or-unknown',
  message:sdk?'Studio SDK manifesti mevcut; yalnızca tanımlı içerik modeli düzenlenir.':names.length?'Framework sinyalleri bulundu. Kaynak bileşenleri ve runtime DOM için SDK/adaptör gerekir; HTML anlık görüntüsü bileşen kaynağı değildir.':'Bilinen framework sinyali bulunmadı; bu sonuç saf statik site garantisi değildir.',
  codeExecuted:false};
}
