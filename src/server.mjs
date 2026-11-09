import http from 'node:http';
import { createFeatures } from './features.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { Store } from './store.mjs';
import { LoftAdapter } from './adapters/loft.mjs';
import { writeZip } from './zip.mjs';
import { hash, fail, within } from './util.mjs';
import { token, passwordHash, passwordMatches, passwordPolicy, normalizeEmail } from './auth.mjs';
import { Recaptcha } from './captcha.mjs';
import { Federation, providerConfig } from './federation.mjs';
import { createPlatform } from './v2/platform.ts';
import studioModules from '../studio.config.mjs';

const publicRoot = path.resolve(import.meta.dirname, '../public');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
const ttl = 8 * 60 * 60 * 1000;
function json(res, status, body) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); }
async function body(req, maxBytes = 2 * 1024 * 1024) {
  if (req.headers['content-type']?.split(';')[0] !== 'application/json') fail(415, 'JSON içerik gerekli.');
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > maxBytes) fail(413, 'İstek çok büyük.'); chunks.push(chunk); }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail(400, 'Geçersiz JSON nesnesi.');
    return value;
  } catch (e) { if (e.status) throw e; fail(400, 'Geçersiz JSON.'); }
}
function safeEqual(a, b) { return typeof a === 'string' && typeof b === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b)); }

export async function createApp({ projectRoot = path.resolve(import.meta.dirname, '..'), dataDir = path.join(projectRoot, 'data'), origin = 'http://127.0.0.1:4317', security = {}, moduleFactory = studioModules } = {}) {
  const urlOrigin = new URL(origin);
  if (urlOrigin.origin !== origin) throw Error('APP_ORIGIN yalnızca köken içermeli (sonunda / olmadan).');
  if (urlOrigin.protocol !== 'https:' && !['127.0.0.1', 'localhost', '[::1]'].includes(urlOrigin.hostname)) throw Error('Yerel ağ dışındaki köken HTTPS gerektirir.');
  await fs.mkdir(dataDir, { recursive: true, mode: 0o700 });
  await fs.mkdir(path.join(dataDir, 'builds'), { recursive: true });
  const adapter = await new LoftAdapter(projectRoot).init();
  const adapters = new Map([[adapter.id, adapter]]);
  const store = new Store(path.join(dataDir, 'console.sqlite'));
  store.seed(adapter);
  const features = await createFeatures({store,dataDir,origin,security});
  const platform = await createPlatform({store,dataDir,legacyAdapter:adapter,features,modules:moduleFactory({store,features}),transport:security.studioTransport,secretProvider:security.studioSecretProvider});
  const captcha = new Recaptcha({ hostname: urlOrigin.hostname, siteKey: process.env.RECAPTCHA_SITE_KEY, secret: process.env.RECAPTCHA_SECRET, required: process.env.AUTH_REQUIRE_CAPTCHA === '1' || !['127.0.0.1', 'localhost', '[::1]'].includes(urlOrigin.hostname), ...security.captcha });
  const federation = new Federation({ store, origin, providers: security.providers || providerConfig(), ...(security.fetcher ? { fetcher: security.fetcher } : {}) });
  const setupToken = store.get('SELECT COUNT(*) AS count FROM users').count === 0 ? token() : null;
  const setupHash = setupToken ? hash(setupToken) : null;
  const setupExpires = Date.now() + 30 * 60 * 1000;
  const dummyHash = await passwordHash(token());
  const cookieName = urlOrigin.protocol === 'https:' ? '__Host-console' : 'console';
  const cookieFlags = `Path=/; HttpOnly; SameSite=Strict${urlOrigin.protocol === 'https:' ? '; Secure' : ''}`;
  let authInFlight = 0, buildInFlight = false;

  function session(req) {
    const raw = req.headers.cookie?.split(';').map(c => c.trim()).find(c => c.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
    const row = raw && store.get('SELECT s.*,u.email FROM sessions s JOIN users u ON u.id=s.user_id WHERE token_hash=? AND expires>?', hash(raw), Date.now());
    if (!row) fail(401, 'Devam etmek için giriş yapın.');
    return row;
  }
  function csrf(req, user) { if (!safeEqual(req.headers['x-csrf-token'], user.csrf)) fail(403, 'İstek doğrulanamadı. Sayfayı yenileyin.'); }
  function createSession(res, user) {
    const value = token(), csrfToken = token();
    store.run('DELETE FROM sessions WHERE expires<=?', Date.now());
    store.run('INSERT INTO sessions VALUES (?,?,?,?)', hash(value), user.id, csrfToken, Date.now() + ttl);
    res.setHeader('Set-Cookie', `${cookieName}=${value}; ${cookieFlags}; Max-Age=${ttl / 1000}`);
    return { user: { id: user.id, email: user.email }, csrf: csrfToken };
  }
  function rateLimit(key, max = 8) {
    store.run('DELETE FROM attempts WHERE expires<=?', Date.now());
    const id = hash(key), row = store.get('SELECT count FROM attempts WHERE key=?', id);
    if (row?.count >= max) fail(429, 'Çok fazla deneme. 15 dakika sonra tekrar deneyin.');
    store.run('INSERT INTO attempts VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1', id, Date.now() + 15 * 60 * 1000);
  }
  async function authWork(fn) {
    if (authInFlight >= 2) fail(429, 'Giriş işlemi yoğun. Kısa süre sonra tekrar deneyin.');
    authInFlight++; try { return await fn(); } finally { authInFlight--; }
  }
  function siteAdapter(siteId) {
    const row = store.get('SELECT metadata FROM sites WHERE id=?', siteId);
    if (!row) fail(404, 'Site bulunamadı.');
    const metadata = JSON.parse(row.metadata), selected = adapters.get(metadata.adapter);
    if (!selected) fail(501, 'Bu sitenin üretim adaptörü henüz kurulu değil.');
    return { metadata, selected };
  }
  function buildInfo(row) {
    const snapshot = JSON.parse(row.snapshot), result = row.result ? JSON.parse(row.result) : null;
    return { id: row.id, kind: row.kind, status: row.status, actor: row.actor, created: row.created, error: row.error,
      versions: Object.fromEntries(Object.entries(snapshot).map(([locale, doc]) => [locale, doc.revision])),
      pages: snapshot.$structure?.values.pages.filter(p => p.status === 'active').map(p => ({ id: p.id, name: p.name, route: p.route, languages: p.languages })),
      pageCount: result?.pageCount, fileCount: result?.fileCount, sha256: result?.sha256,
      previewUrl: row.status === 'ready' ? `/preview/${row.site_id}/${row.id}/index.html` : null,
      downloadUrl: row.status === 'ready' && row.kind === 'package' ? `/api/sites/${row.site_id}/builds/${row.id}/download` : null };
  }
  async function staticFile(res, root, relative, preview = false) {
    const filename = within(root, relative);
    const type = mime[path.extname(filename)];
    if (!type) fail(404, 'Dosya bulunamadı.');
    let data;
    try { data = await fs.readFile(filename); } catch (e) { if (['ENOENT', 'EISDIR'].includes(e.code)) fail(404, 'Dosya bulunamadı.'); throw e; }
    if (preview) res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'; form-action mailto:; sandbox allow-scripts allow-same-origin allow-forms allow-popups");
    res.writeHead(200, { 'Content-Type': type }); res.end(data);
  }

  const server = http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    const googleScripts = captcha.siteKey ? ' https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/' : '';
    const googleFrames = captcha.siteKey ? ' https://www.google.com/recaptcha/ https://recaptcha.google.com/recaptcha/' : '';
    res.setHeader('Content-Security-Policy', `default-src 'self'; script-src 'self'${googleScripts}; style-src 'self'; img-src 'self' data:; connect-src 'self'${googleScripts}; frame-src 'self'${googleFrames}; object-src 'none'; base-uri 'none'; frame-ancestors 'self'; form-action 'self'`);
    if (urlOrigin.protocol === 'https:') res.setHeader('Strict-Transport-Security', 'max-age=31536000');
    try {
      if (req.headers.host !== urlOrigin.host) fail(403, 'İstek kökeni geçersiz.');
      const url = new URL(req.url, origin), method = req.method;
      if (!['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'].includes(method)) fail(405, 'Yöntem desteklenmiyor.');
      if ((url.pathname.startsWith('/api/') && req.headers.authorization) || url.pathname.startsWith('/api/v2/agent/')) {
        if (req.headers.origin && req.headers.origin !== origin || req.headers['sec-fetch-site'] === 'cross-site') fail(403, 'İstek kökeni geçersiz.');
        return await platform.agentRoute({req,res,url,method,body,json});
      }
      if (method !== 'GET' && !url.pathname.startsWith('/public/') && !url.pathname.startsWith('/payments/') && (req.headers.origin !== origin || req.headers['sec-fetch-site'] === 'cross-site')) fail(403, 'İstek kökeni geçersiz.');
      const route = url.pathname;
      if (await features.publicRoute({req,res,url,method,body,rateLimit})) return;
      if (route === '/api/status' && method === 'GET') return json(res, 200, { setupRequired: store.get('SELECT COUNT(*) AS count FROM users').count === 0, mode: 'local-pilot' });
      if (route === '/api/auth/options' && method === 'GET') return json(res, 200, { captcha: captcha.publicConfig(), providers: federation.publicConfig(), rateLimit: { accountAttempts: 8, ipAttempts: 25, windowMinutes: 15 } });
      const authStart = route.match(/^\/api\/auth\/(google|microsoft|apple|facebook)\/start$/);
      if (authStart && method === 'POST') {
        rateLimit(`oauth:${req.socket.remoteAddress}`, 25);
        await captcha.verify((await body(req)).captcha);
        const result = federation.start(authStart[1]);
        res.setHeader('Set-Cookie', `console_oauth=${result.binding}; Path=/auth; HttpOnly; SameSite=Lax; Max-Age=600${urlOrigin.protocol === 'https:' ? '; Secure' : ''}`);
        return json(res, 200, { url: result.url });
      }
      const callback = route.match(/^\/auth\/(google|microsoft|apple|facebook)\/callback$/);
      if (callback && method === 'GET') {
        try {
          rateLimit(`oauth-callback:${req.socket.remoteAddress}`, 30);
          const binding = req.headers.cookie?.split(';').map(c => c.trim()).find(c => c.startsWith('console_oauth='))?.slice('console_oauth='.length);
          const transaction = federation.consume(callback[1], url.searchParams.get('state'), binding);
          if (url.searchParams.has('error')) fail(403, 'Dış giriş iptal edildi veya sağlayıcı tarafından reddedildi.');
          const identity = await federation.exchange(callback[1], url.searchParams.get('code'), transaction);
          const user = federation.finish(callback[1], identity, transaction);
          createSession(res, user);
          res.setHeader('Set-Cookie', [res.getHeader('Set-Cookie'), `console_oauth=; Path=/auth; HttpOnly; SameSite=Lax; Max-Age=0${urlOrigin.protocol === 'https:' ? '; Secure' : ''}`]);
          res.writeHead(303, { Location: '/#authSuccess=1' }); res.end(); return;
        } catch (error) {
          res.setHeader('Set-Cookie', `console_oauth=; Path=/auth; HttpOnly; SameSite=Lax; Max-Age=0${urlOrigin.protocol === 'https:' ? '; Secure' : ''}`);
          res.writeHead(303, { Location: `/#authError=${encodeURIComponent(error.status ? error.message : 'Dış giriş tamamlanamadı.')}` }); res.end(); return;
        }
      }
      if (route === '/api/setup' && method === 'POST') {
        rateLimit(`setup:${req.socket.remoteAddress}`);
        const input = await body(req);
        await captcha.verify(input.captcha);
        if (!setupHash || Date.now() > setupExpires || typeof input.token !== 'string' || !safeEqual(hash(input.token), setupHash) || store.get('SELECT COUNT(*) AS count FROM users').count !== 0) fail(403, 'Kurulum bağlantısı geçersiz, süresi dolmuş veya kullanılmış.');
        const email = normalizeEmail(input.email), encoded = await authWork(() => passwordHash(input.password));
        const user = { id: randomUUID(), email };
        store.transaction(() => {
          if (store.get('SELECT COUNT(*) AS count FROM users').count !== 0) fail(409, 'Kurulum tamamlanmış.');
          store.run('INSERT INTO users VALUES (?,?,?,?)', user.id, email, encoded, new Date().toISOString());
          store.run('INSERT INTO memberships VALUES (?,?,?)', user.id, 'loft', 'admin');
          store.event('loft', email, 'setup');
        });
        return json(res, 201, createSession(res, user));
      }
      if (route === '/api/login' && method === 'POST') {
        rateLimit(`login-ip:${req.socket.remoteAddress}`, 25);
        const input = await body(req), email = normalizeEmail(input.email);
        rateLimit(`login-email:${email}`);
        await captcha.verify(input.captcha);
        if (typeof input.password !== 'string' || input.password.length > 256) fail(401, 'E-posta veya parola hatalı.');
        const user = store.get('SELECT * FROM users WHERE email=?', email);
        const valid = await authWork(() => passwordMatches(input.password, user?.password || dummyHash));
        if (!valid || !user) { store.event(null, email, 'login_failed'); fail(401, 'E-posta veya parola hatalı.'); }
        store.run('DELETE FROM attempts WHERE key=?', hash(`login-email:${email}`));
        store.event(null, email, 'login');
        return json(res, 200, createSession(res, user));
      }
      if (route.startsWith('/api/')) {
        const user = session(req);
        if (method !== 'GET') csrf(req, user);
        if (await platform.route({req,res,url,method,user,body,json})) return;
        if (route === '/api/me' && method === 'GET') return json(res, 200, { user: { id: user.user_id, email: user.email }, csrf: user.csrf });
        if (route === '/api/identities' && method === 'GET') return json(res, 200, { providers: federation.publicConfig(), linked: store.all('SELECT DISTINCT provider FROM external_identities WHERE user_id=?', user.user_id).map(p => p.provider) });
        const identityAction = route.match(/^\/api\/identities\/(google|microsoft|apple|facebook)\/(link|unlink)$/);
        if (identityAction && method === 'POST') {
          rateLimit(`identity:${user.user_id}`);
          const input = await body(req), current = store.get('SELECT password FROM users WHERE id=?', user.user_id);
          if (typeof input.password !== 'string' || input.password.length > 256) fail(422, 'Hesabınızı bağlamak veya ayırmak için mevcut yerel parolanızı girin.');
          if (!await authWork(() => passwordMatches(input.password, current.password))) fail(403, 'Mevcut parola hatalı.');
          if (identityAction[2] === 'unlink') {
            store.transaction(() => {
              store.run('DELETE FROM external_identities WHERE provider=? AND user_id=?', identityAction[1], user.user_id);
              store.run('DELETE FROM sessions WHERE user_id=? AND token_hash<>?', user.user_id, user.token_hash);
              store.run('DELETE FROM oauth_transactions WHERE user_id=?', user.user_id);
              store.event(null, user.email, 'identity_unlinked', { provider: identityAction[1] });
            });
            return json(res, 200, { ok: true });
          }
          const result = federation.start(identityAction[1], { userId: user.user_id, sessionHash: user.token_hash });
          res.setHeader('Set-Cookie', `console_oauth=${result.binding}; Path=/auth; HttpOnly; SameSite=Lax; Max-Age=600${urlOrigin.protocol === 'https:' ? '; Secure' : ''}`);
          return json(res, 200, { url: result.url });
        }
        if (route === '/api/logout' && method === 'POST') {
          store.run('DELETE FROM sessions WHERE token_hash=?', user.token_hash);
          res.setHeader('Set-Cookie', `${cookieName}=; ${cookieFlags}; Max-Age=0`);
          return json(res, 200, { ok: true });
        }
        if (route === '/api/password' && method === 'POST') {
          rateLimit(`password:${user.user_id}`);
          const input = await body(req), current = store.get('SELECT password FROM users WHERE id=?', user.user_id);
          passwordPolicy(input.password);
          if (typeof input.currentPassword !== 'string' || input.currentPassword.length > 256) fail(422, 'Mevcut parola gerekli.');
          const encoded = await authWork(async () => { if (!await passwordMatches(input.currentPassword, current.password)) fail(403, 'Mevcut parola hatalı.'); return passwordHash(input.password); });
          store.transaction(() => { store.run('UPDATE users SET password=? WHERE id=?', encoded, user.user_id); store.run('DELETE FROM sessions WHERE user_id=?', user.user_id); store.event(null, user.email, 'password_changed'); });
          return json(res, 200, createSession(res, { id: user.user_id, email: user.email }));
        }
        if (route === '/api/sites' && method === 'GET') return json(res, 200, { sites: store.all('SELECT s.metadata,m.role FROM sites s JOIN memberships m ON m.site_id=s.id WHERE m.user_id=?', user.user_id).map(r => ({ ...JSON.parse(r.metadata), role: r.role })) });
        const match = route.match(/^\/api\/sites\/([a-z0-9-]+)(?:\/(.*))?$/);
        if (!match) fail(404, 'İşlem bulunamadı.');
        const [, siteId, tail = ''] = match;
        const role = store.membership(user.user_id, siteId);
        const { metadata, selected } = siteAdapter(siteId);
        if(await features.adminRoute({req,res,siteId,tail,method,body,user})) return;
        if (!tail && method === 'GET') return json(res, 200, { ...metadata, role, fields: selected.fields, previewPages: store.structure(siteId).values.pages.filter(p => p.status === 'active').map(p => ({ id: p.id, name: p.name, route: p.route, languages: p.languages })) });
        if (tail === 'structure' && method === 'GET') return json(res, 200, { ...store.structure(siteId), assets: selected.assets });
        if (tail === 'structure' && method === 'PUT') {
          store.membership(user.user_id, siteId, 'admin');
          const input = await body(req), validation = selected.validateStructure(input.values);
          if (!validation.valid) fail(422, 'Site yapısı doğrulanamadı.', validation);
          if (typeof input.note !== 'string' || input.note.trim().length < 3 || input.note.length > 500) fail(422, '3–500 karakterlik değişiklik notu yazın.');
          return json(res, 200, store.saveStructure(siteId, input.revision, input.values, user.email, input.note.trim()));
        }
        const docMatch = tail.match(/^documents\/([a-z]{2})(?:\/(validate))?$/);
        if (docMatch) {
          const [, locale, validate] = docMatch;
          if (method === 'GET' && !validate) return json(res, 200, { ...store.document(siteId, locale), baseline: selected.seeds[locale] });
          if ((method === 'PUT' && !validate) || (method === 'POST' && validate)) {
            const input = await body(req), result = selected.validate(locale, input.values);
            if (validate) return json(res, 200, result);
            if (!result.valid) fail(422, 'Taslak doğrulanamadı.', result);
            if (typeof input.note !== 'string' || input.note.trim().length < 3 || input.note.length > 500) fail(422, '3–500 karakterlik değişiklik notu yazın.');
            return json(res, 200, { ...store.save(siteId, locale, input.revision, input.values, user.email, input.note.trim()), warnings: result.warnings });
          }
        }
        if (tail === 'history' && method === 'GET') return json(res, 200, { history: store.all('SELECT * FROM history WHERE site_id=? ORDER BY created DESC LIMIT 100', siteId).map(h => ({ ...h, changes: JSON.parse(h.changes) })) });
        if (tail === 'members' && method === 'GET') {
          store.membership(user.user_id, siteId, 'admin');
          return json(res, 200, { members: store.all('SELECT u.id,u.email,m.role FROM users u JOIN memberships m ON m.user_id=u.id WHERE m.site_id=? ORDER BY u.email', siteId) });
        }
        if (tail === 'members' && method === 'POST') {
          store.membership(user.user_id, siteId, 'admin');
          rateLimit(`member:${user.user_id}`, 20);
          const input = await body(req), email = normalizeEmail(input.email);
          if (!['admin', 'editor'].includes(input.role)) fail(422, 'Geçersiz rol.');
          const existing = store.get('SELECT id,email FROM users WHERE email=?', email);
          if (existing && store.get('SELECT role FROM memberships WHERE user_id=? AND site_id=?', existing.id, siteId)) fail(409, 'Kullanıcı zaten bu sitenin üyesi.');
          const encoded = existing ? null : await authWork(() => passwordHash(input.password));
          store.transaction(() => {
            // Recheck after asynchronous password derivation; role may have been revoked.
            store.membership(user.user_id, siteId, 'admin');
            const latest = store.get('SELECT id FROM users WHERE email=?', email);
            const id = latest?.id || randomUUID();
            if (!latest) store.run('INSERT INTO users VALUES (?,?,?,?)', id, email, encoded, new Date().toISOString());
            if (store.get('SELECT role FROM memberships WHERE user_id=? AND site_id=?', id, siteId)) fail(409, 'Kullanıcı zaten üye.');
            store.run('INSERT INTO memberships VALUES (?,?,?)', id, siteId, input.role);
            store.event(siteId, user.email, 'member_added', { email, role: input.role });
          });
          return json(res, 201, { ok: true });
        }
        const memberMatch = tail.match(/^members\/([a-f0-9-]{36})$/);
        if (memberMatch && method === 'DELETE') {
          store.membership(user.user_id, siteId, 'admin');
          if (memberMatch[1] === user.user_id) fail(422, 'Kendi erişiminizi bu ekrandan kaldıramazsınız.');
          store.run('DELETE FROM memberships WHERE user_id=? AND site_id=?', memberMatch[1], siteId);
          store.event(siteId, user.email, 'member_removed', { userId: memberMatch[1] });
          return json(res, 200, { ok: true });
        }
        if (tail === 'builds' && method === 'GET') return json(res, 200, { builds: store.all('SELECT * FROM builds WHERE site_id=? ORDER BY created DESC LIMIT 25', siteId).map(buildInfo) });
        if (tail === 'builds' && method === 'POST') {
          const input = await body(req);
          if (!['preview', 'package'].includes(input.kind)) fail(422, 'Üretim türü geçersiz.');
          if (input.kind === 'package') store.membership(user.user_id, siteId, 'admin');
          if (buildInFlight) fail(409, 'Bir üretim sürüyor. Tamamlanınca yeniden deneyin.');
          rateLimit(`build:${user.user_id}`, 30);
          const snapshot = store.snapshot(siteId), id = randomUUID();
          // Snapshot is captured synchronously before any asynchronous build work.
          store.run('INSERT INTO builds VALUES (?,?,?,?,?,?,?,?,?)', id, siteId, input.kind, user.email, new Date().toISOString(), 'building', JSON.stringify(snapshot), null, null);
          buildInFlight = true;
          try {
            const buildRoot = within(path.join(dataDir, 'builds'), id);
            const result = await selected.build(snapshot, path.join(buildRoot, 'workspace'));
            if (input.kind === 'package') {
              await writeZip(result.dist, path.join(buildRoot, 'natro.zip'));
              result.sha256 = hash(await fs.readFile(path.join(buildRoot, 'natro.zip')));
            }
            delete result.dist;
            await fs.writeFile(path.join(buildRoot, 'manifest.json'), JSON.stringify({ id, siteId, adapter: selected.id, sourceCommit: metadata.sourceCommit, revisions: Object.fromEntries(Object.entries(snapshot).map(([l, d]) => [l, d.revision])), ...result }, null, 2));
            store.run("UPDATE builds SET status='ready',result=? WHERE id=?", JSON.stringify(result), id);
            store.event(siteId, user.email, `${input.kind}_built`, { id });
          } catch (error) {
            store.run("UPDATE builds SET status='failed',error=? WHERE id=?", 'Üretim tamamlanamadı. Kaynak bütünlüğünü ve taslağı kontrol edin.', id);
            console.error(`Build ${id}: ${error.message}`);
          } finally { buildInFlight = false; }
          const row = store.get('SELECT * FROM builds WHERE id=?', id);
          return json(res, row.status === 'ready' ? 201 : 422, { build: buildInfo(row), error: row.error || undefined });
        }
        const downloadMatch = tail.match(/^builds\/([a-f0-9-]{36})\/download$/);
        if (downloadMatch && method === 'GET') {
          store.membership(user.user_id, siteId, 'admin');
          const row = store.get("SELECT * FROM builds WHERE id=? AND site_id=? AND kind='package' AND status='ready'", downloadMatch[1], siteId);
          if (!row) fail(404, 'Paket bulunamadı.');
          const data = await fs.readFile(within(path.join(dataDir, 'builds'), `${row.id}/natro.zip`));
          if (hash(data) !== JSON.parse(row.result).sha256) fail(409, 'Paket bütünlüğü doğrulanamadı. Yeniden oluşturun.');
          res.writeHead(200, { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="${siteId}-natro-${row.id.slice(0, 8)}.zip"` }); res.end(data); return;
        }
        fail(404, 'İşlem bulunamadı.');
      }
      const preview = route.match(/^\/preview\/([a-z0-9-]+)\/([a-f0-9-]{36})\/(.*)$/);
      if (preview && method === 'GET') {
        const user = session(req), [, siteId, id, relative] = preview;
        store.membership(user.user_id, siteId);
        if (!store.get("SELECT id FROM builds WHERE id=? AND site_id=? AND status='ready'", id, siteId)) fail(404, 'Önizleme bulunamadı.');
        const rel = decodeURIComponent(relative || 'index.html');
        if (/[\\\u0000]/.test(rel) || rel.split('/').some(s => s === '..' || s.startsWith('.'))) fail(404, 'Dosya bulunamadı.');
        return await staticFile(res, path.join(dataDir, 'builds', id, 'workspace/dist'), rel.endsWith('/') ? `${rel}index.html` : rel, true);
      }
      const asset = route.match(/^\/assets\/([a-z0-9-]+)\/(assets\/[a-z0-9.-]+)$/);
      if (asset && method === 'GET') { const user = session(req); store.membership(user.user_id, asset[1]); const { selected } = siteAdapter(asset[1]); return await staticFile(res, path.join(selected.root, 'dist'), asset[2]); }
      if (method === 'GET' && /^\/book\/[a-z0-9-]+\/?$/.test(route)) return await staticFile(res, publicRoot, 'booking.html');
      if (method === 'GET' && ['/v2','/v2/','/v2/app.js','/v2/app.css'].includes(route)) {
        res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'; form-action 'self'");
        return await staticFile(res, publicRoot, ['/v2','/v2/'].includes(route) ? 'v2/index.html' : route.slice(1));
      }
      if (method === 'GET' && ['/', '/app.js', '/structure.js', '/style.css', '/structure.css','/rich-core.js','/rich-editor.js','/features-ui.js','/features.css','/booking.js','/gadgets.js'].includes(route)) return await staticFile(res, publicRoot, route === '/' ? 'index.html' : route.slice(1));
      fail(404, 'Sayfa bulunamadı.');
    } catch (error) {
      if (error.status === 429) res.setHeader('Retry-After', '900');
      if (!error.status) console.error(error);
      if (!res.headersSent) json(res, error.status || 500, { error: error.status ? error.message : 'Beklenmeyen bir hata oluştu.', details: error.details });
      else res.end();
    }
  });
  server.requestTimeout = 30_000;
  server.headersTimeout = 15_000;
  server.keepAliveTimeout = 5000;
  return { server, store, adapter, features, platform, origin, setupToken, dataDir, close: async () => { await platform.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); store.close(); } };
}
