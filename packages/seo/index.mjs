import {defineModule,field,fail} from '@loft-studio/sdk';
const xml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export default defineModule({
  manifest:{id:'studio.seo',name:'SEO',description:'Sayfa başlığı, açıklama, SEO denetimi ve sitemap/robots dosyaları. Üretilen dosyalar ayrıca yayın paketine eklenmelidir.',version:'1.0.0',apiVersion:1,schemaVersion:1,permissions:['content'],services:['site.document.save']},
  collections:{
    settings:{label:'Site adresi',permission:'content',singleton:true,fields:{baseUrl:field('Canlı site adresi','url',{required:true,maxLength:2000,help:'Sitemap için gerçek HTTPS site adresi.'})}},
    pages:{label:'Sayfa metadata',permission:'content',fields:{pageId:field('Kaynak sayfa kimliği','text',{required:true,maxLength:80,unique:true}),title:field('SEO başlığı','text',{required:true,maxLength:160}),description:field('SEO açıklaması','textarea',{maxLength:400}),noindex:field('Sitemap dışında bırak','boolean',{default:false})},beforeSave(ctx,data){if(!ctx.site.document.pages.some(p=>p.id===data.pageId))fail(422,'Kaynak sayfa bulunamadı.');}}
  },
  migrations:[{version:1,up(ctx){for(const page of ctx.site.document.pages)ctx.records.put('pages',{id:page.id,data:{pageId:page.id,title:page.title||page.name,description:page.description,noindex:false}});}}],
  commands:{
    audit:{label:'SEO denetimini çalıştır',permission:'content',write:false,run(ctx){const titles=new Set(),issues=[];for(const page of ctx.site.document.pages){if(!page.title)issues.push({page:page.name,issue:'Başlık eksik.'});if(titles.has(page.title.toLowerCase()))issues.push({page:page.name,issue:'Tekrarlanan başlık.'});titles.add(page.title.toLowerCase());if(page.title.length>60)issues.push({page:page.name,issue:'Başlık uzun; arama sonucunda kısalabilir.'});if(!page.description)issues.push({page:page.name,issue:'Açıklama eksik.'});if(page.description.length>160)issues.push({page:page.name,issue:'Açıklama uzun; arama sonucunda kısalabilir.'});}return {siteRevision:ctx.site.revision,pages:ctx.site.document.pages.map(p=>({id:p.id,path:p.path,title:p.title})),issues,note:'Uzunluklar öneridir; sıralama veya arama motoru görünümü garantisi değildir.'};}},
    applyPage:{label:'Metadata taslağını sayfaya uygula',help:'Önce metadata kaydını düzenleyip kaydedin. Site sürümünü SEO denetiminden alın.',permission:'content',fields:{recordId:field('Metadata kaydı','reference',{required:true,collection:'pages'}),siteRevision:field('Beklenen site sürümü','number',{required:true,min:0})},run(ctx,input){const record=ctx.records.get('pages',input.recordId),document=structuredClone(ctx.site.document),page=document.pages.find(p=>p.id===record.data.pageId);if(!page)fail(409,'Sayfa artık bulunmuyor.');page.title=record.data.title;page.description=record.data.description||'';return ctx.services['site.document.save']({revision:input.siteRevision,document,note:'SEO modülü metadata uygulaması'});}},
    sitemap:{label:'Sitemap ve robots dosyalarını üret',help:'Dosyaları indirip sitenizde yayınlayın. Sitemap dışında bırakmak tek başına noindex meta etiketi oluşturmaz.',permission:'content',write:false,run(ctx){
      const settings=ctx.records.get('settings','settings').data,base=settings.baseUrl.replace(/\/?$/,'/'),records=ctx.records.list('pages',{limit:500}).items;
      const excluded=new Set(records.filter(r=>r.data.noindex).map(r=>r.data.pageId));
      const urls=ctx.site.document.pages.filter(p=>!excluded.has(p.id)).map(p=>'<url><loc>'+xml(new URL(p.path.replace(/index\.html$/,''),base).href)+'</loc></url>');
      return {files:[{path:'sitemap.xml',mime:'application/xml',content:'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+urls.join('')+'</urlset>'},{path:'robots.txt',mime:'text/plain',content:'User-agent: *\nAllow: /\nSitemap: '+new URL('sitemap.xml',base).href+'\n'}]};
    }}
  }
});
