import fs from 'node:fs/promises';
import {richHtml,validRich,plainText,escapeHtml} from '../../public/rich-core.js';
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { pathToFileURL } from 'node:url';
import { hash, walk, fail } from '../util.mjs';
import { seedStructure, validateStructure, applyStructure, structurePageCount } from '../structure.mjs';
async function runBuild(entry) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./build-worker.mjs', import.meta.url), { workerData: { entry: pathToFileURL(entry).href },
      stdout: true, stderr: true, env: {}, resourceLimits: { maxOldGenerationSizeMb: 128 } });
    let log = '', stderr = '', completed = false;
    worker.stdout.on('data', chunk => { log = (log + chunk).slice(-100_000); });
    worker.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-100_000); });
    worker.on('message', message => { completed = message.ok === true; });
    const timeout = setTimeout(() => { worker.terminate(); reject(Error('Üretim 60 saniyede tamamlanamadı.')); }, 60_000);
    worker.on('error', error => { clearTimeout(timeout); reject(error); });
    worker.on('exit', code => { clearTimeout(timeout); if (code === 0 && completed) resolve(log); else reject(Error(`Üretim başarısız: ${stderr}`)); });
  });
}
export const languages = [
  ['tr', 'Türkçe'], ['en', 'English'], ['zh', '中文'], ['hi', 'हिन्दी'], ['es', 'Español'],
  ['ar', 'العربية'], ['fr', 'Français'], ['bn', 'বাংলা'], ['pt', 'Português'], ['id', 'Bahasa Indonesia'], ['ru', 'Русский']
].map(([code, name]) => ({ code, name, dir: code === 'ar' ? 'rtl' : 'ltr' }));
export const pages = [
  ['home', 'Ana sayfa', 'index.html', 't109'], ['about', 'Hakkımızda', 'hakkimizda/index.html', 't055'],
  ['services', 'Hizmetlerimiz', 'hizmetlerimiz/index.html', 't064'], ['gallery', 'Galeri', 'galeri/index.html', 't000'],
  ['faq', 'Sıkça sorulan sorular', 'sikca-sorulan-sorular/index.html', 't170'], ['contact', 'İletişim', 'iletisim/index.html', 't080'],
  ['reservation', 'Rezervasyon', 'rezervasyon/index.html', 't159'], ['hotel', 'Pet Hotel', 'tr/hizmetlerimiz/1/pet-hotel/index.html', 't187'],
  ['grooming', 'Bakım & Kuaför', 'tr/hizmetlerimiz/4/pet-bakim-kuafor-hizmetleri/index.html', 't199'],
  ['shop', 'Pet Shop', 'tr/hizmetlerimiz/3/pet-shop/index.html', 't197'],
  ['vet', 'Veteriner desteği', 'tr/hizmetlerimiz/2/pet-veteriner-hekim-destegi/index.html', 't194'],
  ['training', 'Eğitim', 'tr/hizmetlerimiz/5/hayvan-egitimi/index.html', 't203'],
  ['adoption', 'Sahiplendirme', 'tr/hizmetlerimiz/6/ucretsiz-sahiplendirme/index.html', 't210']
].map(([id, name, route, titleKey]) => ({ id, name, route, titleKey }));
export const localizedRoute = (route, code) => code === 'tr' ? route : `${code}/${route.replace(/^tr\//, '')}`;

export class LoftAdapter {
  constructor(projectRoot) {
    this.root = path.join(projectRoot, 'vendor/loft');
    this.manifestPath = path.join(projectRoot, 'vendor/loft-manifest.json');
    this.id = 'loft-static-v1';
  }
  async init() {
    this.manifest = JSON.parse(await fs.readFile(this.manifestPath, 'utf8'));
    await this.verifySource();
    this.seeds = {};
    for (const locale of languages) {
      const translations = JSON.parse(await fs.readFile(path.join(this.root, `content/locales/${locale.code}.json`), 'utf8'));
      const seo = JSON.parse(await fs.readFile(path.join(this.root, `content/seo/${locale.code}.json`), 'utf8'));
      this.seeds[locale.code] = {
        ...Object.fromEntries(Object.entries(translations).map(([k, v]) => [`text:${k}`, v])),
        ...Object.fromEntries(Object.entries(seo).map(([k, v]) => [`seo:${k}`, v])),
        ...Object.fromEntries(pages.map(p => [`title:${p.id}`, `${translations[p.titleKey].split('|')[0].trim()} | Loft Pet House, Koşuyolu`]))
      };
    }
    this.fields = Object.keys(this.seeds.tr).map(id => {
      const key = id.split(':')[1];
      const page = pages.find(p => id === `title:${p.id}` || ['desc', 'heading', 'body'].some(type => key === `${type}.${p.id}`));
      const type = id.startsWith('title:') ? 'title' : key.startsWith('desc.') ? 'description' : key.startsWith('alt.') ? 'alt' : 'text';
      const group = type === 'title' || type === 'description' ? 'seo' : type === 'alt' ? 'images' : 'content';
      const names = { title: 'Sayfa başlığı', description: 'Arama açıklaması', alt: 'Görsel alt metni', text: key.startsWith('heading.') ? 'Ek içerik başlığı' : key.startsWith('body.') ? 'Ek içerik' : key };
      return { id, key, type, group, page: page?.id || 'shared', label: names[type], max: type === 'title' ? 160 : type === 'description' ? 400 : type === 'alt' ? 500 : 6000,
        rich: type === 'text',
        asset: type === 'alt' ? `assets/${key.slice(4) === 'logo' ? 'loft-pet-house-logo.jpg' : `${key.slice(4)}.webp`}` : null };
    });
    this.structureSeed = await seedStructure(this.root, this.metadata());
    this.assets = Object.keys(this.manifest.files).filter(f => /^dist\/assets\/.*\.(?:webp|jpg|png)$/.test(f)).map(f => f.slice(5));
    return this;
  }
  metadata() {
    return { id: 'loft', name: 'Loft Pet House', domain: 'loftpethouse.com', adapter: this.id, defaultLocale: 'tr', languages, pages,
      sourceCommit: this.manifest.reportedCommit, integrations: { searchConsole: 'not_connected', ga4: 'not_connected', gtm: 'not_connected' } };
  }
  validate(locale, values) {
    if (!this.seeds[locale]) fail(404, 'Dil bulunamadı.');
    if (!values || Array.isArray(values) || typeof values !== 'object') fail(422, 'İçerik nesnesi gerekli.');
    const errors = [], warnings = [];
    if (Object.keys(values).length !== this.fields.length || Object.keys(values).some(k => !Object.hasOwn(this.seeds[locale], k))) errors.push('Alan şeması değiştirilemez.');
    for (const f of this.fields) {
      const value = values[f.id];
      if (f.rich ? !validRich(value,f.max,true) : (typeof value !== 'string' || !value.trim() || value.length > f.max || /[<>\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))) errors.push(`${f.id}: Boş olmayan düz metin kullanın (en çok ${f.max} karakter).`);
      else if ((f.type === 'title' && value.length > 65) || (f.type === 'description' && value.length > 160)) warnings.push(`${f.id}: Arama sonucunda kesilebilir (${value.length} karakter).`);
    }
    const titles = pages.map(p => values[`title:${p.id}`]);
    const descriptions = pages.map(p => values[`seo:desc.${p.id}`]);
    if (new Set(titles).size !== titles.length) errors.push('Sayfa başlıkları dil içinde benzersiz olmalı.');
    if (new Set(descriptions).size !== descriptions.length) errors.push('Sayfa açıklamaları dil içinde benzersiz olmalı.');
    return { valid: errors.length === 0, errors, warnings };
  }
  validateStructure(value) {
    try { return validateStructure(value, this.structureSeed, this.metadata(), this.assets); }
    catch { return { valid: false, errors: ['Sayfa, bölüm veya menü yapısı geçersiz.'] }; }
  }
  async verifySource() {
    const files = await walk(this.root);
    if (files.length !== Object.keys(this.manifest.files).length) throw Error('Loft kaynak dosya sayısı değişmiş.');
    for (const rel of files) if (hash(await fs.readFile(path.join(this.root, rel))) !== this.manifest.files[rel]) throw Error(`Loft kaynak bütünlüğü başarısız: ${rel}`);
  }
  async build(snapshot, destination) {
    await this.verifySource();
    const structure = snapshot.$structure?.values || this.structureSeed;
    const layoutValidation = this.validateStructure(structure);
    if (!layoutValidation.valid) fail(422, 'Site yapısı doğrulanamadı.', layoutValidation);
    for (const locale of languages) {
      const result = this.validate(locale.code, snapshot[locale.code]?.values);
      if (!result.valid) fail(422, 'Taslak doğrulanamadı.', result);
    }
    await fs.cp(this.root, destination, { recursive: true, errorOnExist: true, force: false });
    // The original Turkish dictionary is a lookup table into hard-coded templates.
    // Keep that lookup immutable while allowing the output Turkish dictionary to change.
    await fs.copyFile(path.join(this.root, 'content/locales/tr.json'), path.join(destination, 'content/source-tr.json'));
    const localizeFile = path.join(destination, 'localize.mjs');
    const localize = await fs.readFile(localizeFile, 'utf8');
    const anchor = "const base=JSON.parse(await fs.readFile('content/locales/tr.json','utf8'));";
    if (localize.split(anchor).length !== 2) throw Error('Yerelleştirme adaptörü kaynak sürümüyle uyuşmuyor.');
    await fs.writeFile(localizeFile, localize.replace(anchor, "const base=JSON.parse(await fs.readFile('content/source-tr.json','utf8'));"));
    const seoFile = path.join(destination, 'seo.mjs');
    const seo = await fs.readFile(seoFile, 'utf8');
    const titleAnchor = 'const title=`${pageName} | Loft Pet House, Koşuyolu`;';
    if (seo.split(titleAnchor).length !== 2) throw Error('SEO adaptörü kaynak sürümüyle uyuşmuyor.');
    await fs.writeFile(seoFile, seo.replace(titleAnchor, "const titles=JSON.parse(await fs.readFile('content/admin-titles.json','utf8'));\n const title=titles[locale.code][key];"));
    const titles = {}, richValues = new Map();
    for (const { code } of languages) {
      const values = {...snapshot[code].values};
      for(const f of this.fields) if(f.rich && /<\/?[a-z]/i.test(values[f.id])){const marker='STUDIORICH'+hash(code+f.id).slice(0,24);richValues.set(marker,{html:richHtml(values[f.id]),plain:plainText(values[f.id])});values[f.id]=marker;}
      for (const [prefix, file] of [['text:', `locales/${code}`], ['seo:', `seo/${code}`]]) {
        await fs.writeFile(path.join(destination, `content/${file}.json`), JSON.stringify(Object.fromEntries(Object.entries(values).filter(([k]) => k.startsWith(prefix)).map(([k, v]) => [k.slice(prefix.length), v])), null, 2));
      }
      titles[code] = Object.fromEntries(pages.map(p => [p.id, values[`title:${p.id}`]]));
    }
    await fs.writeFile(path.join(destination, 'content/admin-titles.json'), JSON.stringify(titles));
    // Workers cannot change process.cwd(). Resolve legacy relative filesystem calls
    // against this isolated build copy without changing the original production logic.
    await fs.writeFile(path.join(destination, 'admin-fs.mjs'), `import fs from 'node:fs/promises';\nimport path from 'node:path';\nconst root=import.meta.dirname;\nexport default new Proxy(fs,{get(target,key){const count={readFile:1,writeFile:1,mkdir:1,copyFile:2}[key];if(!count)return target[key];return (...args)=>{for(let i=0;i<count;i++)args[i]=path.resolve(root,args[i]);return target[key](...args);};}});\n`);
    for (const name of ['build.mjs', 'localize.mjs', 'seo.mjs']) {
      const filename = path.join(destination, name), source = await fs.readFile(filename, 'utf8');
      const anchor = "import fs from 'node:fs/promises';";
      if (source.split(anchor).length !== 2) throw Error('Üretim dosya erişim adaptörü kaynak sürümüyle uyuşmuyor.');
      await fs.writeFile(filename, source.replace(anchor, "import fs from './admin-fs.mjs';"));
    }
    const stdout = await runBuild(path.join(destination, 'build.mjs'));
    const dist = path.join(destination, 'dist');
    if(richValues.size) for(const file of (await walk(dist)).filter(f=>f.endsWith('.html'))){const filename=path.join(dist,file);let html=await fs.readFile(filename,'utf8');html=html.replace(/<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>|<[^>]+>|[^<]+/gi,part=>{for(const [marker,v]of richValues){const replacement=/^<script/i.test(part)?JSON.stringify(v.plain).slice(1,-1).replaceAll('<','\\u003c'):part.startsWith('<')?escapeHtml(v.plain):v.html;part=part.replaceAll(marker,replacement);}return part;});html=html.replace('</head>','<link rel="stylesheet" href="'+path.posix.relative(path.posix.dirname(file),'studio-rich.css')+'"></head>');await fs.writeFile(filename,html);}if(richValues.size) await fs.writeFile(path.join(dist,'studio-rich.css'),'.rt-align-left,.rt-align-center,.rt-align-right,.rt-align-justify{display:block}.rt-align-left{text-align:left}.rt-align-center{text-align:center}.rt-align-right{text-align:right}.rt-align-justify{text-align:justify}');
    await applyStructure(dist, structure, this.structureSeed, this.metadata(), snapshot);
    const output = await walk(dist);
    const htmlFiles = output.filter(f => f.endsWith('.html'));
    const expectedCount = structurePageCount(structure, this.metadata());
    if (htmlFiles.length !== expectedCount) throw Error(`Beklenen ${expectedCount} sayfa, üretilen ${htmlFiles.length}.`);
    for (const file of htmlFiles) {
      const html = await fs.readFile(path.join(dist, file), 'utf8');
      const page = structure.pages.find(p => p.languages.some(code => localizedRoute(p.route, code) === file));
      if (!html.includes('rel="canonical"') || (html.match(/rel="alternate"/g) || []).length !== page.languages.length + 1 || /"@type":"(?:Review|AggregateRating)"/.test(html)) throw Error(`SEO kontrolü başarısız: ${file}`);
      for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) JSON.parse(match[1]);
    }
    const manifest = {};
    for (const file of output) manifest[file] = hash(await fs.readFile(path.join(dist, file)));
    return { dist, pageCount: htmlFiles.length, fileCount: output.length, files: manifest, log: stdout.trim() };
  }
}
