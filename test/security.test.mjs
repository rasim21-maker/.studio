import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign, createPublicKey, verify, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import { Recaptcha } from '../src/captcha.mjs';
import { Federation, providerConfig, verifyIdentityToken, appleClientSecret } from '../src/federation.mjs';
import { Store } from '../src/store.mjs';
import { createApp } from '../src/server.mjs';
const now = Math.floor(Date.now() / 1000);
const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...rsa.publicKey.export({ format: 'jwk' }), kid: 'test-key', use: 'sig', alg: 'RS256' };
const google = { ...providerConfig({ GOOGLE_CLIENT_ID: 'test-client', GOOGLE_CLIENT_SECRET: 'test-secret' })[0] };
const claims = { iss: google.issuer, sub: 'stable-user-subject', aud: google.clientId, nonce: 'test-nonce', iat: now, exp: now + 300 };
const enc = v => Buffer.from(JSON.stringify(v)).toString('base64url');
function jwt(payload = {}, header = {}, key = rsa.privateKey) { const content = `${enc({ alg: 'RS256', kid: 'test-key', ...header })}.${enc({ ...claims, ...payload })}`; return `${content}.${sign('RSA-SHA256', Buffer.from(content), key).toString('base64url')}`; }
const reply = data => ({ ok: true, json: async () => data });
const throwsStatus = (fn, status) => assert.throws(fn, e => e.status === status);
const rejectsStatus = (fn, status) => assert.rejects(fn, e => e.status === status);

describe('Google CAPTCHA doğrulaması', () => {
  const config = { siteKey: 'test-site-key', secret: 'server-only-secret', hostname: '127.0.0.1' };
  test('Eksik anahtar yapılandırması ve zorunlu CAPTCHA eksikliği kapalı kalıyor', () => {
    assert.throws(() => new Recaptcha({ siteKey: 'one-key' }));
    assert.throws(() => new Recaptcha({ required: true }));
    assert.equal(new Recaptcha().publicConfig().enabled, false);
    assert.ok(!JSON.stringify(new Recaptcha(config).publicConfig()).includes(config.secret));
  });
  test('Başarılı yanıt alan adı/zaman kontrolünden geçiyor; sır yalnızca Google doğrulama uç noktasına gidiyor', async () => {
    const captcha = new Recaptcha({ ...config, fetcher: async (url, options) => {
      assert.equal(url, 'https://www.google.com/recaptcha/api/siteverify'); assert.equal(options.method, 'POST'); assert.equal(options.redirect, 'error');
      assert.equal(options.body.get('secret'), config.secret); assert.equal(options.body.get('response'), 'valid-response-token');
      return reply({ success: true, hostname: config.hostname, challenge_ts: new Date().toISOString() });
    } });
    await captcha.verify('valid-response-token');
    await rejectsStatus(() => captcha.verify('valid-response-token'), 403);
  });
  test('Yanlış alan adı, başarısız/eskimiş/gelecek yanıt ve ağ kesintisi girişi açmıyor', async () => {
    for (const result of [
      { success: false }, { success: true, hostname: 'evil.invalid', challenge_ts: new Date().toISOString() },
      { success: true, hostname: config.hostname, challenge_ts: new Date(Date.now() - 180000).toISOString() },
      { success: true, hostname: config.hostname, challenge_ts: new Date(Date.now() + 90000).toISOString() }
    ]) await rejectsStatus(() => new Recaptcha({ ...config, fetcher: async () => reply(result) }).verify('some-response-token'), 403);
    await rejectsStatus(() => new Recaptcha({ ...config, fetcher: async () => { throw Error('offline'); } }).verify('some-response-token'), 503);
    await rejectsStatus(() => new Recaptcha(config).verify(''), 422);
  });
});

describe('Dış kimlik belirteçleri ve sağlayıcı ayarları', () => {
  test('Dört sağlayıcı anahtarsız kapalı; kısmi/uygunsuz ayarlar reddediliyor', () => {
    assert.deepEqual(providerConfig({}).map(p => [p.id, p.enabled]), [['google', false], ['microsoft', false], ['apple', false], ['facebook', false]]);
    assert.throws(() => providerConfig({ GOOGLE_CLIENT_ID: 'one-key' }));
    assert.throws(() => providerConfig({ MICROSOFT_TENANT_ID: 'https://evil.invalid' }));
    assert.throws(() => providerConfig({ FACEBOOK_CLIENT_ID: 'app', FACEBOOK_CLIENT_SECRET: 'secret' }));
    assert.throws(() => providerConfig({ APPLE_CLIENT_ID: 'service' }));
  });
  test('RS256 imza, issuer, audience, nonce, süre, azp ve anahtar amaçları denetleniyor', () => {
    assert.deepEqual(verifyIdentityToken(jwt(), [jwk], google, 'test-nonce', now), { issuer: google.issuer, subject: claims.sub });
    for (const payload of [{ iss: 'https://evil.invalid' }, { aud: 'different-app' }, { nonce: 'different-flow' }, { exp: now }, { iat: now + 120 }, { nbf: now + 120 }, { sub: '' }, { aud: ['test-client', 'other'] }, { azp: 'other' }]) throwsStatus(() => verifyIdentityToken(jwt(payload), [jwk], google, 'test-nonce', now), 403);
    for (const header of [{ alg: 'none' }, { alg: 'HS256' }, { kid: 'missing' }, { crit: ['x'] }, { jku: 'https://evil.invalid/key' }]) throwsStatus(() => verifyIdentityToken(jwt({}, header), [jwk], google, 'test-nonce', now), 403);
    throwsStatus(() => verifyIdentityToken(jwt(), [{ ...jwk, use: 'enc' }], google, 'test-nonce', now), 403);
    const other = generateKeyPairSync('rsa', { modulusLength: 2048 });
    throwsStatus(() => verifyIdentityToken(jwt({}, {}, other.privateKey), [jwk], google, 'test-nonce', now), 403);
  });
  test('Microsoft tenant ve imzalayan anahtar issuer sınırları uygulanıyor', () => {
    const tenant = '11111111-2222-3333-4444-555555555555';
    const provider = providerConfig({ MICROSOFT_CLIENT_ID: 'test-client', MICROSOFT_CLIENT_SECRET: 'secret', MICROSOFT_TENANT_ID: tenant })[1];
    const payload = { tid: tenant, iss: `https://login.microsoftonline.com/${tenant}/v2.0` };
    assert.equal(verifyIdentityToken(jwt(payload), [{ ...jwk, issuer: 'https://login.microsoftonline.com/{tenantid}/v2.0' }], provider, 'test-nonce', now).subject, claims.sub);
    throwsStatus(() => verifyIdentityToken(jwt({ ...payload, tid: randomUUID() }), [jwk], provider, 'test-nonce', now), 403);
    throwsStatus(() => verifyIdentityToken(jwt(payload), [{ ...jwk, issuer: 'https://evil.invalid' }], provider, 'test-nonce', now), 403);
  });
  test('Apple client secret ES256 ile imzalanıyor, kısa ömürlü ve Services ID ile sınırlı', () => {
    const ec = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const provider = { keyId: 'test-kid', teamId: 'test-team', clientId: 'test-service', privateKey: ec.privateKey.export({ type: 'pkcs8', format: 'pem' }) };
    const parts = appleClientSecret(provider, now).split('.');
    assert.ok(verify('sha256', Buffer.from(parts.slice(0, 2).join('.')), { key: ec.publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(parts[2], 'base64url')));
    assert.deepEqual(JSON.parse(Buffer.from(parts[1], 'base64url')), { iss: provider.teamId, iat: now, exp: now + 300, aud: 'https://appleid.apple.com', sub: provider.clientId });
  });
  test('Apple web dönüş adresi HTTP, localhost veya IP olamıyor', () => {
    const store = new Store(':memory:');
    try {
      const provider = { id: 'apple', enabled: true, authorize: 'https://appleid.apple.com/auth/authorize', clientId: 'test' };
      for (const origin of ['http://console.example.com', 'https://localhost', 'https://127.0.0.1', 'https://[::1]']) throwsStatus(() => new Federation({ store, origin, providers: [provider] }).start('apple'), 503);
      assert.match(new Federation({ store, origin: 'https://console.example.com', providers: [provider] }).start('apple').url, /appleid.apple.com/);
    } finally { store.close(); }
  });
});

test('HTTP dış hesap bağlama ve sonraki giriş: çerez, parola, CSRF, imza ve site yetkisi birlikte çalışıyor', async () => {
  const reserve = net.createServer(); await new Promise(r => reserve.listen(0, '127.0.0.1', r)); const port = reserve.address().port; await new Promise(r => reserve.close(r));
  const origin = `http://127.0.0.1:${port}`, password = 'Only-for-integration-test123!';
  let nonce = '', cookie = '', csrf = '';
  const app = await createApp({ dataDir: path.resolve(import.meta.dirname, '../test-results/oauth-' + Date.now()), origin, security: { providers: [google], fetcher: async url => {
    if (url === google.token) return reply({ id_token: jwt({ nonce }), access_token: 'never-stored' });
    if (url === google.jwks) return reply({ keys: [jwk] });
    throw Error('Unexpected external endpoint');
  } } });
  await new Promise(r => app.server.listen(port, '127.0.0.1', r));
  const post = (route, data, headers = {}) => fetch(origin + route, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: cookie, 'X-CSRF-Token': csrf, ...headers }, body: JSON.stringify(data), redirect: 'manual' });
  const sessionCookie = response => response.headers.getSetCookie().find(c => c.startsWith('console='))?.split(';')[0];
  const callback = async response => {
    const { url } = await response.json(), auth = new URL(url); nonce = auth.searchParams.get('nonce');
    const binding = response.headers.getSetCookie().find(c => c.startsWith('console_oauth=')).split(';')[0];
    return fetch(origin + '/auth/google/callback?' + new URLSearchParams({ state: auth.searchParams.get('state'), code: 'test-code' }), { headers: { Cookie: binding }, redirect: 'manual' });
  };
  try {
    const setup = await post('/api/setup', { token: app.setupToken, email: 'linked@example.com', password });
    assert.equal(setup.status, 201); cookie = sessionCookie(setup); csrf = (await setup.json()).csrf;
    assert.equal((await post('/api/identities/google/link', { password }, { 'X-CSRF-Token': 'forged' })).status, 403);
    assert.equal((await post('/api/identities/google/link', { password: 'wrong' })).status, 403);
    const link = await post('/api/identities/google/link', { password }); assert.equal(link.status, 200);
    const linked = await callback(link); assert.equal(linked.status, 303); assert.equal(linked.headers.get('location'), '/#authSuccess=1'); cookie = sessionCookie(linked);
    const me = await (await fetch(origin + '/api/me', { headers: { Cookie: cookie } })).json(); csrf = me.csrf; assert.equal(me.user.email, 'linked@example.com');
    assert.equal(app.store.get('SELECT COUNT(*) AS n FROM users').n, 1);
    assert.equal((await post('/api/logout', {})).status, 200); cookie = ''; csrf = '';
    const login = await callback(await post('/api/auth/google/start', {})); assert.equal(login.headers.get('location'), '/#authSuccess=1'); cookie = sessionCookie(login);
    const sites = await (await fetch(origin + '/api/sites', { headers: { Cookie: cookie } })).json(); assert.equal(sites.sites[0].role, 'admin');
    assert.equal(app.store.get('SELECT COUNT(*) AS n FROM users').n, 1);
    const current = await (await fetch(origin + '/api/me', { headers: { Cookie: cookie } })).json(); csrf = current.csrf;
    assert.equal((await post('/api/identities/google/unlink', { password })).status, 200);
    const denied = await callback(await post('/api/auth/google/start', {})); assert.match(denied.headers.get('location'), /^\/#authError=/); assert.equal(sessionCookie(denied), undefined);
  } finally { await app.close(); }
});

describe('Dış hesap bağlama, state/PKCE ve oturum yetkileri', () => {
  let store, federation, userId, sessionHash;
  before(() => {
    store = new Store(':memory:'); userId = randomUUID(); sessionHash = 'hashed-session';
    store.run('INSERT INTO users VALUES (?,?,?,?)', userId, 'local@example.com', 'not-used-in-this-test', new Date().toISOString());
    store.run('INSERT INTO sessions VALUES (?,?,?,?)', sessionHash, userId, 'csrf', Date.now() + 600000);
    federation = new Federation({ store, origin: 'https://console.example.com', providers: [google] });
  });
  after(() => store.close());
  function start(link = null) { const result = federation.start('google', link); return { ...result, state: new URL(result.url).searchParams.get('state') }; }
  test('State tarayıcıya bağlı ve tek kullanımlık; PKCE S256 ve nonce üretiliyor', () => {
    const result = start(); const url = new URL(result.url);
    assert.equal(url.searchParams.get('code_challenge_method'), 'S256'); assert.ok(url.searchParams.get('nonce')); assert.ok(!url.searchParams.has('client_secret'));
    throwsStatus(() => federation.consume('google', result.state, 'other-browser'), 403);
    const transaction = federation.consume('google', result.state, result.binding); assert.ok(transaction.verifier); assert.equal(transaction.callback, 'https://console.example.com/auth/google/callback');
    throwsStatus(() => federation.consume('google', result.state, result.binding), 403);
  });
  test('E-posta eşleşse bile bağlı olmayan dış kimliğe oturum/yetki verilmiyor', () => {
    const result = start(), transaction = federation.consume('google', result.state, result.binding);
    throwsStatus(() => federation.finish('google', { issuer: google.issuer, subject: 'unbound', email: 'local@example.com' }, transaction), 403);
    assert.equal(store.get('SELECT COUNT(*) AS count FROM users').count, 1);
  });
  test('Açık yerel oturum bağlanabiliyor; başka hesaba ait kimlik alınamıyor; sonraki giriş aynı kullanıcı', () => {
    const result = start({ userId, sessionHash }), transaction = federation.consume('google', result.state, result.binding);
    const identity = { issuer: google.issuer, subject: 'bound-subject' };
    assert.equal(federation.finish('google', identity, transaction).id, userId);
    const login = start(); assert.equal(federation.finish('google', identity, federation.consume('google', login.state, login.binding)).id, userId);
    const otherId = randomUUID(); store.run('INSERT INTO users VALUES (?,?,?,?)', otherId, 'other@example.com', 'unused', new Date().toISOString());
    store.run('INSERT INTO sessions VALUES (?,?,?,?)', 'other-session', otherId, 'csrf', Date.now() + 600000);
    const other = start({ userId: otherId, sessionHash: 'other-session' });
    throwsStatus(() => federation.finish('google', identity, federation.consume('google', other.state, other.binding)), 409);
    assert.equal(store.get('SELECT COUNT(*) AS count FROM memberships').count, 0);
  });
  test('Süresi dolan state ve bağlama sırasında kapatılan oturum reddediliyor', () => {
    const expired = start(); store.run('UPDATE oauth_transactions SET expires=0'); throwsStatus(() => federation.consume('google', expired.state, expired.binding), 403);
    const linked = start({ userId, sessionHash }); const tx = federation.consume('google', linked.state, linked.binding);
    store.run('DELETE FROM sessions WHERE token_hash=?', sessionHash);
    throwsStatus(() => federation.finish('google', { issuer: google.issuer, subject: 'new-subject' }, tx), 403);
  });
  test('Kod değişimi PKCE ve tam redirect_uri kullanıyor; hatalı dış yanıt kabul edilmiyor', async () => {
    const result = start(), tx = federation.consume('google', result.state, result.binding);
    const f = new Federation({ store, origin: federation.origin, providers: [google], fetcher: async (url, opts) => {
      if (url === google.token) { assert.equal(opts.body.get('code_verifier'), tx.verifier); assert.equal(opts.body.get('redirect_uri'), tx.callback); assert.equal(opts.body.get('grant_type'), 'authorization_code'); return reply({ id_token: jwt({ nonce: tx.nonce }) }); }
      assert.equal(url, google.jwks); return reply({ keys: [jwk] });
    } });
    assert.equal((await f.exchange('google', 'test-code', tx)).subject, claims.sub);
    await rejectsStatus(() => f.exchange('google', '', tx), 403);
  });
  test('Facebook debug_token uygulama/süre denetimi ve /me kimlik eşleşmesi', async () => {
    const p = providerConfig({ FACEBOOK_CLIENT_ID: 'app-id', FACEBOOK_CLIENT_SECRET: 'app-secret', FACEBOOK_GRAPH_VERSION: 'v24.0' })[3];
    let wrongApp = false;
    const f = new Federation({ store, origin: federation.origin, providers: [p], fetcher: async (url, opts) => {
      if (url === p.token) return reply({ access_token: 'test-access-token' });
      if (url.includes('/debug_token')) { assert.equal(opts.headers.Authorization, 'Bearer app-id|app-secret'); return reply({ data: { is_valid: true, app_id: wrongApp ? 'other-app' : p.clientId, user_id: 'fb-sub', expires_at: now + 3600 } }); }
      assert.match(url, /appsecret_proof=/); assert.equal(opts.headers.Authorization, 'Bearer test-access-token'); return reply({ id: 'fb-sub' });
    } });
    assert.deepEqual(await f.exchange('facebook', 'code', { callback: `${f.origin}/auth/facebook/callback` }), { issuer: 'https://www.facebook.com/app-id', subject: 'fb-sub' });
    wrongApp = true; await rejectsStatus(() => f.exchange('facebook', 'code', { callback: `${f.origin}/auth/facebook/callback` }), 403);
  });
});

test('HTTP katmanında CAPTCHA atlanamıyor; dış giriş başlangıcı Origin kontrolü ve kapalı sağlayıcı durumu', async () => {
  const reserve = net.createServer(); await new Promise(r => reserve.listen(0, '127.0.0.1', r)); const port = reserve.address().port; await new Promise(r => reserve.close(r));
  const origin = `http://127.0.0.1:${port}`;
  const dir = path.resolve(import.meta.dirname, '../test-results/security-' + Date.now());
  const app = await createApp({ dataDir: dir, origin, security: { captcha: { siteKey: 'test-site', secret: 'secret', fetcher: async () => reply({ success: true, hostname: '127.0.0.1', challenge_ts: new Date().toISOString() }) } } });
  await new Promise(r => app.server.listen(port, '127.0.0.1', r));
  const post = (route, data, headers = {}) => fetch(origin + route, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(data) });
  try {
    const options = await (await fetch(origin + '/api/auth/options')).json(); assert.equal(options.captcha.enabled, true); assert.ok(!JSON.stringify(options).includes('secret'));
    assert.equal((await post('/api/setup', { token: app.setupToken, email: 'captcha@example.com', password: 'Long-test-password123!' })).status, 422);
    const setup = await post('/api/setup', { token: app.setupToken, email: 'captcha@example.com', password: 'Long-test-password123!', captcha: 'valid-test-captcha' }); assert.equal(setup.status, 201);
    assert.equal((await post('/api/login', { email: 'captcha@example.com', password: 'Long-test-password123!' })).status, 422);
    assert.equal((await post('/api/auth/google/start', { captcha: 'a-different-captcha' })).status, 503);
    assert.equal((await post('/api/auth/google/start', {}, { Origin: 'https://evil.invalid' })).status, 403);
    const callback = await fetch(origin + '/auth/google/callback?state=forged&code=forged', { redirect: 'manual' }); assert.equal(callback.status, 303); assert.match(callback.headers.get('location'), /^\/#authError=/); assert.ok(!callback.headers.get('set-cookie').includes('console='));
  } finally { await app.close(); }
});
