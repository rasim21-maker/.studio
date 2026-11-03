import fs from 'node:fs/promises';
import path from 'node:path';

const config=JSON.parse(await fs.readFile('content/site.json','utf8'));
const origin=new URL(config.canonicalOrigin);
if(origin.protocol!=='https:'||origin.pathname!=='/'||origin.search||origin.hash)throw Error('canonicalOrigin must be an HTTPS origin');
const dimensions=JSON.parse(await fs.readFile('content/image-dimensions.json','utf8'));
const base=JSON.parse(await fs.readFile('content/seo/tr.json','utf8'));
const catalogs=new Map();
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export const canonical=target=>new URL(target.replace(/index\.html$/,''),origin).href;
const pageMeta={
 'index.html':['home','t109'],
 'hakkimizda/index.html':['about','t055'],
 'hizmetlerimiz/index.html':['services','t064'],
 'galeri/index.html':['gallery','t000'],
 'sikca-sorulan-sorular/index.html':['faq','t170'],
 'iletisim/index.html':['contact','t080'],
 'rezervasyon/index.html':['reservation','t159'],
 'tr/hizmetlerimiz/1/pet-hotel/index.html':['hotel','t187'],
 'tr/hizmetlerimiz/4/pet-bakim-kuafor-hizmetleri/index.html':['grooming','t199'],
 'tr/hizmetlerimiz/3/pet-shop/index.html':['shop','t197'],
 'tr/hizmetlerimiz/2/pet-veteriner-hekim-destegi/index.html':['vet','t194'],
 'tr/hizmetlerimiz/5/hayvan-egitimi/index.html':['training','t203'],
 'tr/hizmetlerimiz/6/ucretsiz-sahiplendirme/index.html':['adoption','t210'],
};
const langOg={tr:'tr_TR',en:'en_US',zh:'zh_CN',hi:'hi_IN',es:'es_ES',ar:'ar_AR',fr:'fr_FR',bn:'bn_BD',pt:'pt_PT',id:'id_ID',ru:'ru_RU'};
export async function enhancePage(html,{original,target,locale,dict,locales,outputPath}){
 if(!catalogs.has(locale.code)){
  const data=JSON.parse(await fs.readFile(`content/seo/${locale.code}.json`,'utf8'));
  if(Object.keys(data).length!==Object.keys(base).length||Object.keys(base).some(k=>typeof data[k]!=='string'||!data[k].trim()))throw Error(`Incomplete SEO catalog: ${locale.code}`);
  catalogs.set(locale.code,data);
 }
 const text=catalogs.get(locale.code),[key,titleKey]=pageMeta[original]||[];
 if(!key)throw Error(`Unmapped SEO page: ${original}`);
 const pageName=dict[titleKey].split('|')[0].trim();
 const title=`${pageName} | Loft Pet House, Koşuyolu`;
 const description=text[`desc.${key}`],url=canonical(target),imageUrl=new URL('assets/maps-1.webp',origin).href;
 html=html.replace(/<title>[\s\S]*?<\/title>/,`<title>${escape(title)}</title>`)
  .replace(/<meta name="description"[^>]*>/,`<meta name="description" content="${escape(description)}">`);
 // Keep the original Turkish paragraphs intact; new guidance has its own translation catalog.
 if(text[`heading.${key}`]){
  const supplement=`<section class="section wrap planning-note" data-content-addition="${key}"><div class="planning-inner"><h2>${escape(text[`heading.${key}`])}</h2><p>${escape(text[`body.${key}`])}</p></div></section>`;
  html=html.replace('</main>',supplement+'</main>');
 }
 html=html.replace(/<img\b[^>]*>/g,tag=>{
  const src=tag.match(/\bsrc="([^"]+)"/)?.[1];if(!src)return tag; // Empty, hidden lightbox gets its alt when opened.
  const asset=path.posix.normalize(path.posix.join(path.posix.dirname(target),src));
  const size=dimensions[asset];if(!size)throw Error(`Missing image dimensions: ${asset}`);
  const name=path.posix.basename(asset,path.posix.extname(asset));
  const alt=text[`alt.${name==='loft-pet-house-logo'?'logo':name}`];
  if(!alt)throw Error(`Missing image alt: ${asset}`);
  return tag.replace(/\balt="[^"]*"/,`alt="${escape(alt)}"`).replace(/\bwidth="\d+"/,`width="${size.width}"`).replace(/\bheight="\d+"/,`height="${size.height}"`).replace(/>$/,' decoding="async">');
 });
 html=html.replace(/<button\b[^>]*class="gallery-photo"[^>]*>[\s\S]*?<\/button>/g,button=>{
  const alt=button.match(/<img\b[^>]*\balt="([^"]*)"/)?.[1];
  return button.replace(/\baria-label="[^"]*"/,`aria-label="${escape(text.enlarge)}: ${alt}"`);
 });
 html=html.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/,(_,json)=>{
  const business=JSON.parse(json);delete business['@context'];
  Object.assign(business,{'@id':new URL('#business',origin).href,url:origin.href,image:imageUrl,logo:new URL('assets/loft-pet-house-logo.jpg',origin).href});
  const website={'@type':'WebSite','@id':new URL('#website',origin).href,url:origin.href,name:'Loft Pet House',inLanguage:locales.map(l=>l.lang),publisher:{'@id':business['@id']}};
  const webpage={'@type':'WebPage','@id':url+'#webpage',url,name:title,description,inLanguage:locale.lang,isPartOf:{'@id':website['@id']},about:{'@id':business['@id']},primaryImageOfPage:{'@type':'ImageObject',url:imageUrl,width:dimensions['assets/maps-1.webp'].width,height:dimensions['assets/maps-1.webp'].height,caption:text['alt.maps-1']}};
  const graph=[business,website,webpage];
  if(original!=='index.html'){
   webpage.breadcrumb={'@id':url+'#breadcrumb'};
   graph.push({'@type':'BreadcrumbList','@id':url+'#breadcrumb',itemListElement:[{'@type':'ListItem',position:1,name:dict.t015,item:canonical(outputPath('index.html',locale.code))},{'@type':'ListItem',position:2,name:pageName,item:url}]});
  }
  return `<script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@graph':graph}).replaceAll('<','\\u003c')}</script>`;
 });
 const social=`<link rel="canonical" href="${url}"><meta property="og:type" content="website"><meta property="og:site_name" content="Loft Pet House"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:url" content="${url}"><meta property="og:locale" content="${langOg[locale.code]}"><meta property="og:image" content="${imageUrl}"><meta property="og:image:width" content="1243"><meta property="og:image:height" content="700"><meta property="og:image:alt" content="${escape(text['alt.maps-1'])}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escape(title)}"><meta name="twitter:description" content="${escape(description)}"><meta name="twitter:image" content="${imageUrl}"><meta name="twitter:image:alt" content="${escape(text['alt.maps-1'])}">`;
 return html.replace('</head>',social+'</head>');
}
export async function writeDiscovery(pages,locales,outputPath,directory){
 const entries=[];
 for(const original of pages.keys()){
  const alternates=locales.map(l=>`<xhtml:link rel="alternate" hreflang="${l.lang}" href="${canonical(outputPath(original,l.code))}"/>`).join('')+`<xhtml:link rel="alternate" hreflang="x-default" href="${canonical(original)}"/>`;
  for(const locale of locales)entries.push(`<url><loc>${canonical(outputPath(original,locale.code))}</loc>${alternates}</url>`);
 }
 await fs.writeFile(path.join(directory,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries.join('\n')}\n</urlset>\n`);
 await fs.writeFile(path.join(directory,'robots.txt'),`User-agent: *\nAllow: /\n\nSitemap: ${new URL('sitemap.xml',origin).href}\n`);
}
