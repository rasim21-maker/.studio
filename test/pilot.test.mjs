import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';
import { createApp } from '../src/server.mjs';
import { hash, walk } from '../src/util.mjs';
import { languages, localizedRoute, pages } from '../src/adapters/loft.mjs';
const root = path.resolve(import.meta.dirname, '..');
const testRoot = path.join(root, 'test-results', `run-${Date.now()}`);
const password = 'Test-only-strong-password-2026!';
async function freePort() { const s = net.createServer(); await new Promise(r => s.listen(0, '127.0.0.1', r)); const p = s.address().port; await new Promise(r => s.close(r)); return p; }
function client(origin) {
  const state = { cookie: '', csrf: '' };
  return { state, async call(route, method = 'GET', input, override = {}) {
    const response = await fetch(origin + route, { method, headers: { Origin: origin, Cookie: state.cookie, 'X-CSRF-Token': state.csrf, 'Content-Type': 'application/json', ...override }, ...(input === undefined ? {} : { body: JSON.stringify(input) }) });
    const cookie = response.headers.get('set-cookie'); if (cookie) state.cookie = cookie.split(';')[0];
    const bytes = Buffer.from(await response.arrayBuffer());
    let data; try { data = JSON.parse(bytes); } catch { data = bytes.toString(); }
    if (data.csrf) state.csrf = data.csrf;
    return { status: response.status, headers: response.headers, data, bytes };
  } };
}
function zipEntries(bytes) {
  const entries = new Map(); let offset = 0;
  while (bytes.readUInt32LE(offset) === 0x04034b50) {
    const length = bytes.readUInt32LE(offset + 18), nameLength = bytes.readUInt16LE(offset + 26), extra = bytes.readUInt16LE(offset + 28);
    const name = bytes.subarray(offset + 30, offset + 30 + nameLength).toString('utf8'), start = offset + 30 + nameLength + extra;
    entries.set(name, inflateRawSync(bytes.subarray(start, start + length))); offset = start + length;
  }
  assert.equal(bytes.readUInt32LE(offset), 0x02014b50);
  assert.equal(bytes.readUInt32LE(bytes.length - 22), 0x06054b50);
  assert.equal(entries.size, bytes.readUInt16LE(bytes.length - 12));
  return entries;
}

describe('Loft yerel pilot — HTTP, yetkiler, üretim ve regresyon', { concurrency: false }, () => {
  let app, origin, admin, editor, stranger, baselineBuild, editedBuild, packageBuild;
  before(async () => {
    const port = await freePort(); origin = `http://127.0.0.1:${port}`;
    app = await createApp({ projectRoot: root, dataDir: path.join(testRoot, 'data'), origin });
    await new Promise(r => app.server.listen(port, '127.0.0.1', r));
    admin = client(origin); editor = client(origin); stranger = client(origin);
  });
  after(async () => { if (app) await app.close(); });

  test('Anonim API, taslak, önizleme ve dosya yolları kapalı; Host ve Origin doğrulanıyor', async () => {
    assert.equal((await stranger.call('/api/sites')).status, 401);
    assert.equal((await stranger.call('/api/sites/loft/documents/tr')).status, 401);
    assert.equal((await stranger.call(`/preview/loft/${randomUUID()}/index.html`)).status, 401);
    assert.equal((await stranger.call('/assets/loft/assets/hero.webp')).status, 401);
    assert.equal((await stranger.call('/data/console.sqlite')).status, 404);
    // fetch normalizes Host; send an actual hostile Host through the HTTP client.
    const hostileHostStatus = await new Promise((resolve, reject) => {
      http.get(origin + '/api/status', { headers: { Host: 'evil.invalid' } }, response => { response.resume(); resolve(response.statusCode); }).on('error', reject);
    });
    assert.equal(hostileHostStatus, 403);
    assert.equal((await stranger.call('/api/login', 'POST', { email: 'admin@example.com', password }, { Origin: 'https://evil.invalid' })).status, 403);
    assert.equal((await stranger.call('/api/login', 'POST', { email: 'admin@example.com', password }, { Origin: '' })).status, 403);
  });

  test('Tek kullanımlık kurulum, güçlü parola, HttpOnly oturum; tekrar kurulum reddediliyor', async () => {
    assert.equal((await admin.call('/api/setup', 'POST', { token: 'bad', email: 'admin@example.com', password })).status, 403);
    assert.equal((await admin.call('/api/setup', 'POST', { token: app.setupToken, email: 'admin@example.com', password: 'weak' })).status, 422);
    const result = await admin.call('/api/setup', 'POST', { token: app.setupToken, email: 'admin@example.com', password });
    assert.equal(result.status, 201); assert.match(result.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
    assert.match(result.headers.get('content-security-policy'), /object-src 'none'/);
    assert.ok(result.data.csrf);
    assert.equal((await admin.call('/api/setup', 'POST', { token: app.setupToken, email: 'other@example.com', password })).status, 403);
    const user = app.store.get('SELECT * FROM users WHERE email=?', 'admin@example.com');
    assert.match(user.password, /^scrypt\$/); assert.ok(!user.password.includes(password));
    assert.notEqual(app.store.get('SELECT token_hash FROM sessions').token_hash, admin.state.cookie.split('=')[1]);
  });

  test('CSRF olmayan yazma reddediliyor; rol yalnızca sunucuda atanıyor', async () => {
    assert.equal((await admin.call('/api/sites/loft/members', 'POST', { email: 'editor@example.com', password, role: 'editor' }, { 'X-CSRF-Token': '' })).status, 403);
    assert.equal((await admin.call('/api/sites/loft/members', 'POST', { email: 'editor@example.com', password, role: 'superadmin' })).status, 422);
    assert.equal((await admin.call('/api/sites/loft/members', 'POST', { email: 'editor@example.com', password, role: 'editor' })).status, 201);
    assert.equal((await editor.call('/api/login', 'POST', { email: 'editor@example.com', password, role: 'admin' })).status, 200);
    assert.equal((await editor.call('/api/sites/loft')).data.role, 'editor');
    assert.equal((await editor.call('/api/sites/loft/members')).status, 403);
    assert.equal((await editor.call('/api/sites/loft/members', 'POST', { email: 'intruder@example.com', password, role: 'admin' })).status, 403);
    assert.equal((await editor.call('/api/sites/loft/builds', 'POST', { kind: 'package', role: 'admin' })).status, 403);
  });

  test('İkinci test sitesinin yöneticisi Loft verisini ve üyelerini göremiyor (site izolasyonu)', async () => {
    assert.equal((await admin.call('/api/sites/loft/members', 'POST', { email: 'outsider@example.com', password, role: 'editor' })).status, 201);
    const user = app.store.get('SELECT id FROM users WHERE email=?', 'outsider@example.com');
    app.store.run('DELETE FROM memberships WHERE user_id=?', user.id);
    app.store.run('INSERT INTO sites VALUES (?,?)', 'other', JSON.stringify({ ...app.adapter.metadata(), id: 'other', name: 'İzolasyon test fikstürü' }));
    app.store.run('INSERT INTO memberships VALUES (?,?,?)', user.id, 'other', 'admin');
    await stranger.call('/api/login', 'POST', { email: 'outsider@example.com', password });
    assert.deepEqual((await stranger.call('/api/sites')).data.sites.map(s => s.id), ['other']);
    for (const suffix of ['', '/documents/tr', '/history', '/members', '/builds']) assert.equal((await stranger.call('/api/sites/loft' + suffix)).status, 404);
    assert.equal((await stranger.call('/api/sites/loft/documents/tr', 'PUT', { role: 'admin' })).status, 404);
    assert.equal((await stranger.call('/api/sites/loft/builds', 'POST', { kind: 'preview' })).status, 404);
    assert.equal((await stranger.call('/assets/loft/assets/hero.webp')).status, 404);
  });

  test('Değişmemiş taslaktan 143 HTML ve tüm statik dosyalar birebir üretiliyor', async () => {
    const response = await admin.call('/api/sites/loft/builds', 'POST', { kind: 'preview' });
    assert.equal(response.status, 201, JSON.stringify(response.data)); baselineBuild = response.data.build;
    assert.equal(baselineBuild.pageCount, 143);
    const dist = path.join(app.dataDir, 'builds', baselineBuild.id, 'workspace/dist');
    const baseline = path.join(app.adapter.root, 'dist');
    const files = await walk(baseline); assert.deepEqual(await walk(dist), files);
    for (const file of files) assert.deepEqual(await fs.readFile(path.join(dist, file)), await fs.readFile(path.join(baseline, file)), `Kaynak farkı: ${file}`);
    assert.equal((await admin.call(baselineBuild.previewUrl)).status, 200);
    assert.equal((await stranger.call(baselineBuild.previewUrl)).status, 404);
    assert.equal((await admin.call(`/preview/loft/${baselineBuild.id}/%2e%2e%5c%2e%2e%5cmanifest.json`)).status, 404);
    assert.equal((await admin.call(`/preview/other/${baselineBuild.id}/index.html`)).status, 404);
  });

  test('Editör içerik kaydediyor; HTML, boşluk, bilinmeyen anahtar, tekrar SEO ve çakışma reddediliyor', async () => {
    const initial = (await editor.call('/api/sites/loft/documents/tr')).data;
    assert.equal(initial.revision, 0);
    assert.equal(initial.values['seo:body.home'], 'Sitemizde yer alan yorumlar gerçek müşterilerimizin kişisel deneyimlerini yansıtır ve farklı görüşler içerir. Kendi dostunuzun ihtiyaçlarını, beklediğiniz bilgilendirmeyi ve bakım tercihlerinizi rezervasyon öncesinde bizimle görüşün.');
    for (const patch of [{ 'text:t003': '<img src=x onerror=alert(1)>' }, { 'seo:alt.hero': ' ' }, { 'unknown': 'value' }, { 'title:home': initial.values['title:about'] }, { 'seo:desc.home': initial.values['seo:desc.about'] }]) {
      assert.equal((await editor.call('/api/sites/loft/documents/tr', 'PUT', { revision: 0, values: { ...initial.values, ...patch }, note: 'Geçersiz içerik testi' })).status, 422);
    }
    const values = { ...initial.values, 'text:t003': 'Türkçe başlık denemesi & güvenli "metin"', 'title:home': 'Pilot önizleme | Loft Pet House', 'seo:desc.home': 'Bu açıklama yalnızca otomatik testin yerel taslağındadır.', 'seo:alt.hero': 'Yerel testte görsel alt metni', 'seo:body.home': 'Sadece yerel test için düzenlenmiş açıklama.' };
    const save = await editor.call('/api/sites/loft/documents/tr', 'PUT', { revision: 0, values, note: 'Türkçe içerik ve SEO testi' });
    assert.equal(save.status, 200); assert.equal(save.data.revision, 1); assert.equal(save.data.changes, 5);
    assert.equal((await editor.call('/api/sites/loft/documents/tr', 'PUT', { revision: 0, values: initial.values, note: 'Eski oturum kaydı' })).status, 409);
    assert.equal((await editor.call('/api/sites/loft/documents/tr', 'PUT', { revision: 1, values, note: 'Değişiklik olmayan kayıt' })).data.revision, 1);
    const history = (await admin.call('/api/sites/loft/history')).data.history;
    assert.equal(history.length, 1); assert.equal(history[0].actor, 'editor@example.com'); assert.equal(history[0].changes.length, 5);
    assert.equal(history[0].changes.find(c => c.field === 'text:t003').before, initial.values['text:t003']);
    assert.equal((await editor.call('/api/sites/loft/documents/xx')).status, 404);
  });

  test('Türkçe düzenleme gerçek HTML/SEO/alt metne yansıyor; diğer 10 dil birebir korunuyor', async () => {
    const response = await editor.call('/api/sites/loft/builds', 'POST', { kind: 'preview' });
    assert.equal(response.status, 201); editedBuild = response.data.build;
    const html = (await editor.call(editedBuild.previewUrl)).data;
    assert.match(html, /Türkçe başlık denemesi &amp; güvenli &quot;metin&quot;/);
    assert.match(html, /<title>Pilot önizleme \| Loft Pet House<\/title>/);
    assert.match(html, /property="og:title" content="Pilot önizleme \| Loft Pet House"/);
    assert.match(html, /alt="Yerel testte görsel alt metni"/);
    assert.match(html, /Sadece yerel test için düzenlenmiş açıklama\./);
    const dist = path.join(app.dataDir, 'builds', editedBuild.id, 'workspace/dist');
    for (const lang of languages.filter(l => l.code !== 'tr')) for (const page of pages) {
      const route = localizedRoute(page.route, lang.code);
      assert.deepEqual(await fs.readFile(path.join(dist, route)), await fs.readFile(path.join(app.adapter.root, 'dist', route)), route);
    }
    const old = (await admin.call(baselineBuild.previewUrl)).data;
    assert.ok(!old.includes('Pilot önizleme | Loft Pet House'));
    assert.match((await editor.call(`/preview/loft/${editedBuild.id}/ar/index.html`)).data, /dir="rtl"/);
    assert.match((await editor.call(`/preview/loft/${editedBuild.id}/en/index.html`)).data, /lang="en"/);
  });

  test('İngilizce düzenleme yalnızca İngilizce çıktıyı değiştiriyor', async () => {
    const initial = (await editor.call('/api/sites/loft/documents/en')).data;
    const values = { ...initial.values, 'text:t003': 'LOCAL ENGLISH TEST CONTENT', 'seo:alt.hero': 'A cat and dog — local test', 'title:home': 'Local English preview | Loft Pet House' };
    assert.equal((await editor.call('/api/sites/loft/documents/en', 'PUT', { revision: 0, values, note: 'İngilizce yerel test' })).status, 200);
    const response = await admin.call('/api/sites/loft/builds', 'POST', { kind: 'package' });
    assert.equal(response.status, 201); packageBuild = response.data.build;
    assert.equal(packageBuild.versions.tr, 1); assert.equal(packageBuild.versions.en, 1);
    const en = (await admin.call(`/preview/loft/${packageBuild.id}/en/index.html`)).data;
    assert.match(en, /LOCAL ENGLISH TEST CONTENT/); assert.match(en, /Local English preview \| Loft Pet House/);
    const tr = (await admin.call(packageBuild.previewUrl)).data;
    assert.ok(!tr.includes('LOCAL ENGLISH TEST CONTENT')); assert.match(tr, /Türkçe başlık denemesi/);
  });

  test('Natro ZIP yalnızca statik çıktıdır; SHA-256, tüm girdiler ve yetki sınırları doğrulanıyor', async () => {
    const response = await admin.call(packageBuild.downloadUrl);
    assert.equal(response.status, 200); assert.equal(hash(response.bytes), packageBuild.sha256);
    assert.match(response.headers.get('content-disposition'), /attachment/);
    const entries = zipEntries(response.bytes); assert.equal(entries.size, packageBuild.fileCount);
    assert.equal([...entries.keys()].filter(k => k.endsWith('.html')).length, 143);
    assert.ok(entries.has('index.html')); assert.ok(entries.has('sitemap.xml')); assert.ok(entries.has('robots.txt'));
    assert.ok(![...entries.keys()].some(k => /sqlite|\.mjs$|^content\/|\.openai|manifest\.json|\.env/.test(k)));
    const dist = path.join(app.dataDir, 'builds', packageBuild.id, 'workspace/dist');
    for (const [file, data] of entries) assert.deepEqual(data, await fs.readFile(path.join(dist, file)), file);
    assert.equal((await editor.call(packageBuild.downloadUrl)).status, 403);
    assert.equal((await stranger.call(packageBuild.downloadUrl)).status, 404);
    assert.equal((await client(origin).call(packageBuild.downloadUrl)).status, 401);
    await fs.writeFile(path.join(testRoot, 'verified-package.zip'), response.bytes);
    await app.adapter.verifySource();
  });

  test('Paket sonrası yeni kayıt mevcut önizleme ve ZIP içeriğini değiştirmiyor', async () => {
    const doc = (await admin.call('/api/sites/loft/documents/tr')).data;
    await admin.call('/api/sites/loft/documents/tr', 'PUT', { revision: doc.revision, values: { ...doc.values, 'title:home': 'Daha sonraki taslak | Loft Pet House' }, note: 'Anlık görüntü izolasyonu' });
    assert.match((await admin.call(packageBuild.previewUrl)).data, /Pilot önizleme \| Loft Pet House/);
    assert.equal(hash((await admin.call(packageBuild.downloadUrl)).bytes), packageBuild.sha256);
  });

  test('Üyelik iptali açık oturumda hemen etkili; kendi yönetici erişimini silmek engelleniyor', async () => {
    const members = (await admin.call('/api/sites/loft/members')).data.members;
    const a = members.find(m => m.email === 'admin@example.com'), e = members.find(m => m.email === 'editor@example.com');
    assert.equal((await admin.call(`/api/sites/loft/members/${a.id}`, 'DELETE', {})).status, 422);
    assert.equal((await editor.call(`/api/sites/loft/members/${a.id}`, 'DELETE', {})).status, 403);
    assert.equal((await admin.call(`/api/sites/loft/members/${e.id}`, 'DELETE', {})).status, 200);
    assert.equal((await editor.call('/api/sites/loft/documents/tr')).status, 404);
    assert.equal((await editor.call(baselineBuild.previewUrl)).status, 404);
  });

  test('Parola değişikliği diğer oturumları iptal ediyor; çıkış ve süre aşımı uygulanıyor', async () => {
    const second = client(origin); await second.call('/api/login', 'POST', { email: 'admin@example.com', password });
    assert.equal((await admin.call('/api/password', 'POST', { currentPassword: 'wrong', password: password + 'new' })).status, 403);
    assert.equal((await admin.call('/api/password', 'POST', { currentPassword: password, password: password + 'new' })).status, 200);
    assert.equal((await second.call('/api/me')).status, 401);
    assert.equal((await admin.call('/api/me')).status, 200);
    await admin.call('/api/logout', 'POST', {}); assert.equal((await admin.call('/api/me')).status, 401);
    await admin.call('/api/login', 'POST', { email: 'admin@example.com', password: password + 'new' });
    app.store.run('UPDATE sessions SET expires=0'); assert.equal((await admin.call('/api/me')).status, 401);
  });

  test('Başarısız giriş denemeleri hız sınırına takılıyor ve kullanıcı varlığını açıklamıyor', async () => {
    const c = client(origin);
    for (let i = 0; i < 8; i++) { const r = await c.call('/api/login', 'POST', { email: 'nobody@example.com', password: 'wrong' }); assert.equal(r.status, 401); assert.equal(r.data.error, 'E-posta veya parola hatalı.'); }
    assert.equal((await c.call('/api/login', 'POST', { email: 'nobody@example.com', password: 'wrong' })).status, 429);
  });

  test('SQLite tekrar açılınca taslak, geçmiş, üyelik ve paket kayıtları kalıcı', async () => {
    const old = app.store.document('loft', 'tr'); const dataDir = app.dataDir;
    await app.close(); app = await createApp({ projectRoot: root, dataDir, origin });
    await new Promise(r => app.server.listen(Number(new URL(origin).port), '127.0.0.1', r));
    assert.equal(app.setupToken, null); assert.deepEqual(app.store.document('loft', 'tr'), old);
    assert.equal(app.store.get('SELECT COUNT(*) AS n FROM history').n, 3);
    assert.equal(app.store.get('SELECT status FROM builds WHERE id=?', packageBuild.id).status, 'ready');
    assert.ok(app.store.get("SELECT * FROM memberships WHERE role='admin' AND site_id='loft'"));
  });

  test('Site yapısı yönetici yetkisi ve sürüm denetimi istiyor; geçersiz adres/HTML/menü reddediliyor', async () => {
    await admin.call('/api/login', 'POST', { email: 'admin@example.com', password: password + 'new' });
    await admin.call('/api/sites/loft/members', 'POST', { email: 'editor@example.com', role: 'editor' });
    await editor.call('/api/login', 'POST', { email: 'editor@example.com', password });
    const structure = (await admin.call('/api/sites/loft/structure')).data;
    assert.equal(structure.revision, 0); assert.equal(structure.values.pages.length, 13);
    assert.equal((await editor.call('/api/sites/loft/structure', 'PUT', { revision: 0, values: structure.values, note: 'Yetkisiz yapı değişikliği' })).status, 403);
    assert.equal((await stranger.call('/api/sites/loft/structure')).status, 401);
    for (const mutate of [v => { v.pages[0].status = 'inactive'; }, v => { v.pages[0].route = '../index.html'; }, v => { v.pages[0].sections[0].content.tr = { heading: '<script>alert(1)</script>' }; }, v => { v.menu.items[0].pageId = 'missing'; }, v => { v.theme.preset = 'evil'; }, v => { v.pages[0].sections = []; }]) {
      const value = structuredClone(structure.values); mutate(value);
      assert.equal((await admin.call('/api/sites/loft/structure', 'PUT', { revision: 0, values: value, note: 'Geçersiz yapı testi' })).status, 422);
    }
  });

  test('Yeni TR sayfa, pasif sayfa, bölüm düzeni, mega menü ve tema gerçek pakete uygulanıyor', async () => {
    const doc = (await admin.call('/api/sites/loft/structure')).data, value = structuredClone(doc.values);
    value.pages.find(p => p.id === 'gallery').status = 'inactive';
    const home = value.pages.find(p => p.id === 'home');
    home.sections[0].content.tr = { heading: 'Yapı testinin yeni ana başlığı', body: 'Yapı testinin yeni paragrafı.' };
    home.sections[1].enabled = false;
    home.sections.unshift({ id: 'test-section', kind: 'text', label: 'Ek bölüm', enabled: true, content: { tr: { heading: 'İlk sıradaki test bölümü', body: 'Sadece Türkçe ek bölüm.' } } });
    value.pages.push({ id: 'new-page', name: 'Yeni test sayfası', route: 'yeni-test/index.html', source: false, status: 'active', languages: ['tr'], localized: { tr: { title: 'Yeni test sayfası | Loft Pet House', description: 'Yeni sayfanın yalnızca yerel testte kullanılan açıklaması.' } }, sections: [{ id: 'new-hero', kind: 'hero', label: 'Karşılama', enabled: true, content: { tr: { heading: 'Yeni sayfa başlığı', body: 'Yeni sayfa gövdesi.' } } }] });
    value.menu = { mode: 'mega', items: [{ id: 'menu-new', pageId: 'home', labels: { tr: 'Yeni mega menü' }, children: [{ id: 'menu-child', pageId: 'new-page', labels: { tr: 'Yeni sayfa' }, children: [] }] }] };
    value.theme = { preset: 'forest', defaultMode: 'dark', radius: 'square' };
    const saved = await admin.call('/api/sites/loft/structure', 'PUT', { revision: doc.revision, values: value, note: 'Sayfa, bölüm, mega menü ve tema testi' });
    assert.equal(saved.status, 200, JSON.stringify(saved.data)); assert.equal(saved.data.revision, 1);
    assert.equal((await admin.call('/api/sites/loft/structure', 'PUT', { revision: 0, values: value, note: 'Eski sürüm' })).status, 409);
    const response = await admin.call('/api/sites/loft/builds', 'POST', { kind: 'package' });
    assert.equal(response.status, 201, JSON.stringify(response.data)); const build = response.data.build;
    assert.equal(build.pageCount, 133); // 143 - gallery's 11 languages + one new Turkish page.
    assert.ok(build.pages.some(p => p.id === 'new-page' && p.languages.length === 1));
    assert.ok(!build.pages.some(p => p.id === 'gallery'));
    const html = (await admin.call(build.previewUrl)).data;
    assert.match(html, /Yapı testinin yeni ana başlığı/); assert.match(html, /Yapı testinin yeni paragrafı/); assert.match(html, /studio-mega/); assert.match(html, /Yeni mega menü/);
    assert.ok(html.indexOf('İlk sıradaki test bölümü') < html.indexOf('Yapı testinin yeni ana başlığı'));
    assert.ok(!/href="[^\"]*galeri\/index.html"/.test(html));
    const en = (await admin.call(`/preview/loft/${build.id}/en/index.html`)).data;
    assert.ok(!en.includes('Sadece Türkçe ek bölüm.')); assert.ok(!en.includes('Yeni sayfa başlığı'));
    assert.equal((await admin.call(`/preview/loft/${build.id}/galeri/index.html`)).status, 404);
    const newPage = (await admin.call(`/preview/loft/${build.id}/yeni-test/index.html`)).data;
    assert.match(newPage, /<title>Yeni test sayfası \| Loft Pet House<\/title>/); assert.match(newPage, /Yeni sayfa gövdesi/);
    assert.match(newPage, /href="\.\.\/hakkimizda\/index.html">Hakkımızda<\/a>/); // The cloned shell's self-link must still lead to About.
    assert.match(newPage, /rel="canonical" href="https:\/\/loftpethouse.com\/yeni-test\/"/);
    assert.equal((newPage.match(/rel="alternate"/g) || []).length, 2);
    assert.equal((await admin.call(`/preview/loft/${build.id}/en/yeni-test/index.html`)).status, 404);
    const sitemap = (await admin.call(`/preview/loft/${build.id}/sitemap.xml`)).data;
    assert.match(sitemap, /yeni-test\//); assert.ok(!sitemap.includes('/galeri/')); assert.equal((sitemap.match(/<url>/g) || []).length, 133);
    assert.match((await admin.call(`/preview/loft/${build.id}/studio-layout.css`)).data, /#244338/);
    assert.match((await admin.call(`/preview/loft/${build.id}/preferences.js`)).data, /mode='dark'/);
    const entries = zipEntries((await admin.call(build.downloadUrl)).bytes); assert.ok(entries.has('yeni-test/index.html')); assert.ok(!entries.has('galeri/index.html'));
    assert.ok((await admin.call('/api/sites/loft/history')).data.history.some(h => h.locale === 'yapı' && h.changes.some(c => c.field === 'structure:menu')));
    await app.adapter.verifySource();
  });

  test('Kaldırılan sayfa kaydı tutuluyor; yeniden etkinleştirilebiliyor', async () => {
    const doc = (await admin.call('/api/sites/loft/structure')).data;
    const page = doc.values.pages.find(p => p.id === 'new-page'); page.status = 'deleted';
    assert.equal((await admin.call('/api/sites/loft/structure', 'PUT', { revision: doc.revision, values: doc.values, note: 'Yeni sayfayı kaldır' })).status, 200);
    const removed = (await admin.call('/api/sites/loft/structure')).data;
    assert.equal(removed.values.pages.find(p => p.id === 'new-page').status, 'deleted');
    assert.ok(!(await admin.call('/api/sites/loft')).data.previewPages.some(p => p.id === 'new-page'));
    const previous = (await admin.call('/api/sites/loft/builds')).data.builds.find(b => b.pageCount === 133);
    assert.ok(previous.pages.some(p => p.id === 'new-page')); // Older builds retain their own page selector.
    removed.values.pages.find(p => p.id === 'new-page').status = 'active';
    assert.equal((await admin.call('/api/sites/loft/structure', 'PUT', { revision: removed.revision, values: removed.values, note: 'Yeni sayfayı geri getir' })).status, 200);
    assert.ok((await admin.call('/api/sites/loft')).data.previewPages.some(p => p.id === 'new-page'));
  });
});
