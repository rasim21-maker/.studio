import {defineAsyncModule,fail} from '@loft-studio/sdk';
import legacy from './index.mjs';
const xml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const {services,...manifest}=legacy.manifest;
export default defineAsyncModule({
 ...legacy,manifest:{...manifest,apiVersion:2},ports:['site.document.save'],
 migrations:[{version:1,async up(ctx){for(const page of ctx.site.document.pages)await ctx.records.put('pages',{id:page.id,data:{pageId:page.id,title:page.title||page.name,description:page.description,noindex:false}});}}],
 commands:{...legacy.commands,
  applyPage:{...legacy.commands.applyPage,port:'site.document.save',async run(ctx,input){
   const record=await ctx.records.get('pages',input.recordId),document=structuredClone(ctx.site.document),page=document.pages.find(p=>p.id===record.data.pageId);
   if(!page)fail(409,'Sayfa artık bulunmuyor.');page.title=record.data.title;page.description=record.data.description||'';
   return {revision:input.siteRevision,document,note:'SEO modülü metadata uygulaması'};
  }},
  sitemap:{...legacy.commands.sitemap,async run(ctx){
   const settings=(await ctx.records.get('settings','settings')).data,base=settings.baseUrl.replace(/\/?$/,'/');
   const records=(await ctx.records.list('pages',{limit:500})).items,excluded=new Set(records.filter(r=>r.data.noindex).map(r=>r.data.pageId));
   const urls=ctx.site.document.pages.filter(p=>!excluded.has(p.id)).map(p=>'<url><loc>'+xml(new URL(p.path.replace(/index\.html$/,''),base).href)+'</loc></url>');
   return {files:[{path:'sitemap.xml',mime:'application/xml',content:'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+urls.join('')+'</urlset>'},{path:'robots.txt',mime:'text/plain',content:'User-agent: *\nAllow: /\nSitemap: '+new URL('sitemap.xml',base).href+'\n'}]};
  }}
 }
});
