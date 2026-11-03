import fs from 'node:fs/promises';
import {richHtml,validRich} from '../public/rich-core.js';
import {themes,validateDesign,designCss,themeCss} from './design.mjs';
import path from 'node:path';
import { fail } from './util.mjs';
const escape = s => String(s ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const plain = s => s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().replaceAll('&amp;', '&').replaceAll('&quot;', '"');
const outputPath = (page, locale) => locale === 'tr' ? page.route : `${locale}/${page.route.replace(/^tr\//, '')}`;
const relative = (from, to) => path.posix.relative(path.posix.dirname(from), to) || path.posix.basename(to);
const voids = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
// The input is the hash-verified Loft renderer's HTML, never user-supplied markup.
export function mainBlocks(html) {
  const body = html.match(/<main id="main">([\s\S]*?)<\/main>/)?.[1];
  if (body === undefined) throw Error('Sayfa gövdesi bulunamadı.');
  const blocks = []; let depth = 0, start = 0;
  for (const match of body.matchAll(/<\/?([a-z][a-z0-9-]*)\b[^>]*>/gi)) {
    const name = match[1].toLowerCase(), close = match[0].startsWith('</');
    if (!close && depth === 0) start = match.index;
    if (close) depth--; else if (!voids.has(name) && !match[0].endsWith('/>')) depth++;
    if (depth < 0) throw Error('Bölüm yapısı çözümlenemedi.');
    if (depth === 0) blocks.push(body.slice(start, match.index + match[0].length));
  }
  if (depth !== 0 || !blocks.length) throw Error('Bölüm yapısı çözümlenemedi.');
  return blocks;
}
export async function seedStructure(root, metadata) {
  const pages = [];
  for (const p of metadata.pages) {
    const blocks = mainBlocks(await fs.readFile(path.join(root, 'dist', p.route), 'utf8'));
    pages.push({ id: p.id, name: p.name, route: p.route, source: true, status: 'active', languages: metadata.languages.map(l => l.code), localized: {},
      sections: blocks.map((html, index) => ({ id: `original-${index}`, kind: 'existing', index, label: plain(html.match(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/)?.[1] || `Bölüm ${index + 1}`).slice(0, 150), enabled: true, content: {} })) });
  }
  return { version: 1, pages, menu: { mode: 'original', items: ['about', 'services', 'gallery', 'faq', 'contact'].map(pageId => ({ id: `menu-${pageId}`, pageId, labels: {}, children: [] })) }, theme: { preset: 'original', defaultMode: 'original', radius: 'original' } };
}
function isText(s, max, required = false) { return typeof s === 'string' && s.length <= max && (!required || s.trim()) && !/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(s); }
export function validateStructure(value, seed, metadata, assets) {
  const errors = [], codes = metadata.languages.map(l => l.code);
  if (!value || value.version !== 1 || !Array.isArray(value.pages) || value.pages.length < seed.pages.length || value.pages.length > 40) return { valid: false, errors: ['Sayfa yapısı geçersiz (en çok 40 sayfa).'] };
  const ids = new Set(), routes = new Set();
  for (const page of value.pages) {
    const original = seed.pages.find(p => p.id === page.id);
    if(!validateDesign(page.layout))errors.push('Sayfa düzeni veya boşluk değerleri geçersiz.');
    if (!/^[a-z0-9-]{1,60}$/.test(page.id || '') || ids.has(page.id)) errors.push('Sayfa kimliği geçersiz veya tekrar ediyor.');
    ids.add(page.id);
    if (!isText(page.name, 100, true) || !['active', 'inactive', 'deleted'].includes(page.status)) errors.push('Sayfa adı/durumu geçersiz.');
    if (original) { if (page.route !== original.route || page.source !== true) errors.push('Kaynak sayfanın adresi değiştirilemez.'); }
    else if (page.source !== false || !/^[a-z0-9]+(?:-[a-z0-9]+)*\/index\.html$/.test(page.route || '') || [...codes, 'assets', 'api', 'auth', 'preview'].includes(page.route?.split('/')[0])) errors.push('Yeni sayfa için benzersiz bir slug kullanın.');
    if (routes.has(page.route)) errors.push('İki sayfa aynı adresi kullanamaz.'); routes.add(page.route);
    if (!Array.isArray(page.languages) || !page.languages.length || new Set(page.languages).size !== page.languages.length || page.languages.some(c => !codes.includes(c)) || !page.languages.includes('tr') || (original && JSON.stringify(page.languages) !== JSON.stringify(original.languages))) errors.push('Sayfa dilleri geçersiz; Türkçe gerekli.');
    if (!page.localized || typeof page.localized !== 'object' || Object.keys(page.localized).some(c => !codes.includes(c))) errors.push('Sayfa çevirileri geçersiz.');
    if (!original && Array.isArray(page.languages)) for (const code of page.languages) {
      const text = page.localized?.[code];
      if (!text || !isText(text.title, 160, page.status === 'active') || !isText(text.description, 400, page.status === 'active')) errors.push(`${page.name}: ${code} başlık/açıklama gerekli.`);
    }
    if (!Array.isArray(page.sections) || page.sections.length > 30) { errors.push('Sayfada en çok 30 bölüm olabilir.'); continue; }
    const sectionIds = new Set();
    for (const section of page.sections) {
      if (!/^[a-z0-9-]{1,80}$/.test(section.id || '') || sectionIds.has(section.id) || !['existing', 'text', 'hero', 'cta', 'image', 'gadget', 'booking'].includes(section.kind) || typeof section.enabled !== 'boolean' || !isText(section.label, 150)) errors.push('Bölüm şeması geçersiz.');
      sectionIds.add(section.id);
      if(!validateDesign(section.layout,true))errors.push('Bölüm düzeni geçersiz.');
      if(section.kind==='gadget'&&!['weather','news','stocks','index','traffic'].includes(section.gadget))errors.push('Gadget türü geçersiz.');
      if (section.kind === 'existing' && !original?.sections.some(s => s.id === section.id && s.index === section.index)) errors.push('Kaynak bölüm eşleşmesi geçersiz.');
      if (!section.content || typeof section.content !== 'object' || Array.isArray(section.content)) { errors.push('Bölüm metinleri geçersiz.'); continue; }
      for (const [code, text] of Object.entries(section.content)) {
        if (!codes.includes(code) || !text || typeof text !== 'object') { errors.push('Bölüm dili geçersiz.'); continue; }
        for (const [key, val] of Object.entries(text)) {
          if (!['heading', 'body', 'buttonLabel', 'targetPageId', 'imageAsset', 'alt'].includes(key) || !(['heading','body','buttonLabel'].includes(key)?validRich(val,key==='body'?6000:500):isText(val,500))) errors.push('Bölüm düz metin alanları geçersiz.');
        }
        if (text.imageAsset && !assets.includes(`assets/${text.imageAsset}`)) errors.push('Görsel mevcut kütüphaneden seçilmeli.');
        if (text.targetPageId && !value.pages.some(p => p.id === text.targetPageId)) errors.push('Bölüm bağlantısı geçersiz.');
        if (section.kind === 'image' && section.enabled && page.status === 'active' && (!text.imageAsset || !text.alt?.trim())) errors.push('Görsel bölümü için görsel ve alt metni gerekli.');
      }
      if (page.status === 'active' && section.enabled && section.kind !== 'existing') for (const code of (page.source ? ['tr'] : page.languages || [])) if (!section.content[code]?.heading?.trim()) errors.push(`${page.name}: yeni bölümün ${code} başlığı gerekli.`);
    }
    if (original && original.sections.some(s => !sectionIds.has(s.id))) errors.push('Kaynak bölümü kaldırmak için görünürlüğünü kapatın.');
  }
  if (seed.pages.some(p => !ids.has(p.id))) errors.push('Kaynak sayfaları silmek yerine Kaldırıldı durumuna alın.');
  if (value.pages.find(p => p.id === 'home')?.status !== 'active') errors.push('Ana sayfa aktif kalmalı.');
  if (!value.menu || !['original', 'simple', 'mega'].includes(value.menu.mode) || !Array.isArray(value.menu.items) || value.menu.items.length > 8) errors.push('Menü şeması geçersiz (en çok 8 ana öğe).');
  else {
    const menuIds = new Set();
    const checkMenu = (items, child = false) => { for (const item of items) {
      if (!/^[a-z0-9-]{1,80}$/.test(item.id || '') || menuIds.has(item.id) || !ids.has(item.pageId)) errors.push('Menü öğesi geçersiz.');
      menuIds.add(item.id);
      if (!item.labels || typeof item.labels !== 'object' || Object.entries(item.labels).some(([code, label]) => !codes.includes(code) || !isText(label, 80))) errors.push('Menü etiketi geçersiz.');
      if (!Array.isArray(item.children) || item.children.length > (child ? 0 : 16)) errors.push('Menü iki düzeyi ve 16 alt öğeyi aşamaz.');
      else if (!child) checkMenu(item.children, true);
    } }; checkMenu(value.menu.items);
  }
  if (!value.theme || !Object.hasOwn(themes,value.theme.preset) || !['original', 'light', 'dark', 'system'].includes(value.theme.defaultMode) || !['original', 'soft', 'square'].includes(value.theme.radius)) errors.push('Tema seçimi geçersiz.');
  return { valid: !errors.length, errors: [...new Set(errors)] };
}
export function structurePageCount(value, metadata) { return value.pages.filter(p => p.status === 'active').reduce((sum, p) => sum + (p.source ? metadata.languages.length : p.languages.length), 0); }

export async function applyStructure(dist, structure, seed, metadata, snapshot) {
  if (JSON.stringify(structure) === JSON.stringify(seed)) return;
  const active = structure.pages.filter(p => p.status === 'active'), origin = `https://${metadata.domain}/`, allOriginal = new Map();
  for (const page of seed.pages) for (const lang of metadata.languages) allOriginal.set(outputPath(page, lang.code), await fs.readFile(path.join(dist, outputPath(page, lang.code)), 'utf8'));
  const existingPaths = new Set(active.flatMap(p => p.languages.map(l => outputPath(p, l))));
  const originalPaths = new Set(allOriginal.keys());
  const canonical = target => new URL(target.replace(/index\.html$/, ''), origin).href;
  const titleFor = (p, lang) => p.source ? snapshot[lang].values[`title:${p.id}`] : p.localized[lang].title;
  const labelFor = (item, lang) => item.labels[lang] || titleFor(active.find(p => p.id === item.pageId), lang).split('|')[0].trim();
  function menuHtml(target, lang, items, mega = false) {
    const usable = items.filter(i => active.some(p => p.id === i.pageId && p.languages.includes(lang)));
    return usable.map(item => {
      const p = active.find(p => p.id === item.pageId), href = relative(target, outputPath(p, lang));
      const anchor = `<a href="${escape(href)}"${target === outputPath(p, lang) ? ' aria-current="page"' : ''}>${escape(labelFor(item, lang))}</a>`;
      const children = menuHtml(target, lang, item.children || []);
      return children ? `<details class="studio-menu-group${mega ? ' studio-mega' : ''}"><summary>${escape(labelFor(item, lang))}</summary><div class="studio-submenu">${anchor}${children}</div></details>` : anchor;
    }).join('');
  }
  function sectionHtml(section, page, lang, target, originalBlocks) {
    if (!section.enabled) return '';
    if (section.kind !== 'existing' && !section.content[lang]?.heading) return '';
    const text = section.content[lang] || {};
    if (section.kind === 'existing') {
      let html = originalBlocks[section.index]; if (!html) throw Error('Kaynak bölüm sırası değişmiş.');
      if (text.heading) html = html.replace(/(<h[12][^>]*>)[\s\S]*?(<\/h[12]>)/, (_, a, b) => a + richHtml(text.heading) + b);
      if (text.body) html = html.replace(/(<p\b[^>]*>)[\s\S]*?(<\/p>)/, (_, a, b) => a + richHtml(text.body) + b);
      return html.replace(/^(<[a-z][a-z0-9-]*)/i, `$1 data-studio-section="${section.id}"`);
    }
    if(section.kind==='gadget') return '<section class="section wrap studio-section" data-studio-section="'+section.id+'"><h2>'+richHtml(text.heading)+'</h2><div class="studio-gadget" data-gadget="'+section.gadget+'" data-runtime="'+escape(snapshot.$runtime?.values.url||'')+'" data-site="'+escape(snapshot.$runtime?.values.siteId||metadata.id)+'"><p>Veriler yükleniyor…</p></div></section>';
    if(section.kind==='booking'){const runtime=snapshot.$runtime?.values.url;return '<section class="section wrap studio-section" data-studio-section="'+section.id+'"><h2>'+richHtml(text.heading)+'</h2><p>'+richHtml(text.body||'')+'</p>'+(runtime?'<a class="button" href="'+escape(runtime.replace(/\/$/,'')+'/book/'+metadata.id+'/')+'">Rezervasyon yap ↗</a>':'<p>Çevrimiçi rezervasyon adresi henüz yapılandırılmadı.</p>')+'</section>';}
    const targetPage = active.find(p => p.id === text.targetPageId && p.languages.includes(lang));
    const action = text.buttonLabel && targetPage ? `<a class="button" href="${escape(relative(target, outputPath(targetPage, lang)))}">${richHtml(text.buttonLabel)}</a>` : '';
    const image = text.imageAsset ? `<img src="${escape(relative(target, `assets/${text.imageAsset}`))}" alt="${escape(text.alt || '')}" loading="lazy">` : '';
    return `<section class="section wrap studio-section studio-${section.kind}" data-studio-section="${section.id}"><div${section.kind === 'cta' ? ' class="cta"' : ''}><div><${section.kind === 'hero' ? 'h1' : 'h2'}>${richHtml(text.heading)}</${section.kind === 'hero' ? 'h1' : 'h2'}>${(text.body || '').split(/\n\s*\n/).filter(Boolean).map(p => `<p>${richHtml(p)}</p>`).join('')}${action}</div>${image}</div></section>`;
  }
  for (const page of active) for (const lang of page.languages) {
    const target = outputPath(page, lang), description = page.source ? snapshot[lang].values[`seo:desc.${page.id}`] : page.localized[lang].description;
    let html = allOriginal.get(page.source ? target : outputPath(seed.pages.find(p => p.id === 'about'), lang));
    if (!page.source) {
      const template = outputPath(seed.pages.find(p => p.id === 'about'), lang);
      html = html.replace(/(<a\b[^>]*?href=")([^"#][^"]*)(")/g, (all, open, href, close) => {
        if (/^(?:[a-z]+:|\/\/)/i.test(href)) return all;
        const [, pathname, suffix] = href.match(/^([^?#]*)(.*)$/);
        return open + relative(target, path.posix.normalize(path.posix.join(path.posix.dirname(template), pathname))) + suffix + close;
      });
    }
    const blocks = page.source ? mainBlocks(html) : [];
    let content = page.sections.map(s => sectionHtml(s, page, lang, target, blocks)).join('');
    if (!page.source && !/<h1\b/.test(content)) content = `<section class="section wrap studio-hero"><h1>${escape(titleFor(page, lang))}</h1></section>` + content;
    html = html.replace(/<main id="main">[\s\S]*?<\/main>/, `<main id="main" data-studio-page="${page.id}">${content}</main>`);
    if (!page.source) {
      html = html.replace(/(<nav id="main-nav"[^>]*>)([\s\S]*?)(<\/nav>)/, (_, open, links, close) => open + links.replaceAll(' aria-current="page"', '') + close);
      const title = titleFor(page, lang), url = canonical(target);
      html = html.replace(/data-page="[^"]*"/, `data-page="${page.route}"`).replace(/<title>[\s\S]*?<\/title>/, `<title>${escape(title)}</title>`)
        .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${escape(description)}">`).replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${url}">`);
      for (const [property, content] of [['og:title', title], ['og:description', description], ['og:url', url], ['twitter:title', title], ['twitter:description', description]]) html = html.replace(new RegExp(`(<meta (?:property|name)="${property}" content=")[^"]*(")`), (_, a, b) => a + escape(content) + b);
      html = html.replace(/<link rel="alternate"[^>]*>/g, '');
      const links = page.languages.map(code => { const locale = metadata.languages.find(l => l.code === code); const language = code === 'zh' ? 'zh-Hans' : code; return `<link rel="alternate" hreflang="${language}" data-language="${code}" data-local-href="${relative(target, outputPath(page, code))}" href="${canonical(outputPath(page, code))}">`; }).join('') + `<link rel="alternate" hreflang="x-default" href="${canonical(page.route)}">`;
      html = html.replace('</head>', links + '</head>');
      html = html.replace(/(<div class="settings-panel language-options"[^>]*>)[\s\S]*?<\/div>/, (_, open) => open + page.languages.map(code => `<a href="${relative(target, outputPath(page, code))}" data-language="${code}"${code === lang ? ' aria-current="true"' : ''}>${escape(metadata.languages.find(l => l.code === code).name)}</a>`).join('') + '</div>');
      html = html.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/, (_, text) => {
        const schema = JSON.parse(text); schema['@graph'] = schema['@graph'].filter(n => n['@type'] !== 'BreadcrumbList');
        const node = schema['@graph'].find(n => n['@type'] === 'WebPage'); Object.assign(node, { '@id': url + '#webpage', url, name: title, description }); delete node.breadcrumb;
        return `<script type="application/ld+json">${JSON.stringify(schema).replaceAll('<', '\\u003c')}</script>`;
      });
    }
    if (structure.menu.mode !== 'original') html = html.replace(/(<nav id="main-nav"[^>]*>)[\s\S]*?<\/nav>/, (_, open) => open + menuHtml(target, lang, structure.menu.items, structure.menu.mode === 'mega') + '</nav>');
    // Disabled source pages must not survive in cards, CTAs, footer links or language links.
    html = html.replace(/<a\b([^>]*?)href="([^"]*)"([^>]*)>([\s\S]*?)<\/a>/g, (all, before, href, after, text) => {
      if (/^(?:[a-z]+:|\/\/|#)/i.test(href)) return all;
      const destination = path.posix.normalize(path.posix.join(path.posix.dirname(target), href.split(/[?#]/)[0]));
      if (originalPaths.has(destination) && !existingPaths.has(destination)) return /class="service-card/.test(before + after) ? '' : `<span>${text}</span>`;
      return all;
    });
    html = html.replace('</head>', `<link rel="stylesheet" href="${relative(target, 'studio-layout.css')}"></head>`);
    await fs.mkdir(path.dirname(path.join(dist, target)), { recursive: true }); await fs.writeFile(path.join(dist, target), html);
  }
  for (const original of originalPaths) if (!existingPaths.has(original)) await fs.unlink(path.join(dist, original));
  const entries = active.flatMap(p => p.languages.map(code => `<url><loc>${canonical(outputPath(p, code))}</loc>${p.languages.map(l => `<xhtml:link rel="alternate" hreflang="${l === 'zh' ? 'zh-Hans' : l}" href="${canonical(outputPath(p, l))}"/>`).join('')}<xhtml:link rel="alternate" hreflang="x-default" href="${canonical(p.route)}"/></url>`));
  await fs.writeFile(path.join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries.join('\n')}\n</urlset>\n`);
  const palettes = { original: '', warm: ':root:not([data-theme=dark]){--paper:#fff9ef;--ink:#382d22;--green:#382d22;--lime:#e8bd64;--surface:#f5ead9;--card:#fffdf7;--header-bg:#fff9effa}', forest: ':root:not([data-theme=dark]){--paper:#f3f7ed;--ink:#244338;--green:#244338;--lime:#c1d986;--surface:#e4edde;--card:#fbfdf7;--header-bg:#f3f7edfa}', midnight: ':root:not([data-theme=dark]){--paper:#f4f6fb;--ink:#252b48;--green:#252b48;--lime:#aeb9ee;--surface:#e7eaf4;--card:#fbfcff;--header-bg:#f4f6fbfa}' };
  const css = `${palettes[structure.theme.preset]||''}\n.studio-section p{max-width:800px;white-space:pre-line}.studio-section img{max-height:550px;object-fit:cover;width:100%;border-radius:8px;margin-top:25px}.studio-hero h1{font:400 clamp(38px,5vw,66px)/1.15 var(--serif)}.studio-menu-group{position:relative;border:0;padding:0}.studio-menu-group>summary{padding:8px 18px 8px 0;font-size:13px;white-space:nowrap}.studio-menu-group>summary:after{font:14px Arial;right:0;top:9px}.studio-submenu{position:absolute;top:100%;inset-inline-start:0;min-width:220px;padding:18px;background:var(--paper);border:1px solid var(--line);border-radius:8px;box-shadow:0 10px 30px #0002;display:grid;gap:10px;z-index:50}.studio-mega .studio-submenu{grid-template-columns:repeat(2,minmax(130px,1fr));min-width:380px}.studio-submenu a{display:block}.studio-section .cta{align-items:start}.studio-section .cta p{color:inherit}@media(max-width:1120px){.studio-submenu,.studio-mega .studio-submenu{position:static;min-width:0;box-shadow:none;margin:8px 0;grid-template-columns:1fr}.studio-menu-group>summary{padding:12px 22px 12px 0}}${structure.theme.radius === 'original' ? '' : `.button,.service-card,.cta,.form-panel,.studio-section img{border-radius:${structure.theme.radius === 'soft' ? '20px' : '0'}!important}`}`;
  await fs.writeFile(path.join(dist, 'studio-layout.css'), css+themeCss(structure.theme)+designCss(structure));
  if(structure.pages.some(p=>p.sections.some(s=>s.kind==='gadget'))){await fs.copyFile(path.resolve(import.meta.dirname,'../public/gadgets.js'),path.join(dist,'studio-gadgets.js'));for(const p of active)for(const lang of p.languages){const target=outputPath(p,lang),f=path.join(dist,target);let html=await fs.readFile(f,'utf8');html=html.replace('</body>','<script src="'+relative(target,'studio-gadgets.js')+'" defer></script></body>');await fs.writeFile(f,html);}}
  if (structure.theme.defaultMode !== 'original') {
    const file = path.join(dist, 'preferences.js'); let script = await fs.readFile(file, 'utf8');
    script = script.replace("if(!allowedThemes.includes(mode))mode='light';", `if(!allowedThemes.includes(mode))mode='${structure.theme.defaultMode}';`);
    await fs.writeFile(file, script);
  }
}
