import { createHash, createHmac, createPublicKey, createPrivateKey, sign, verify } from 'node:crypto';
import { token } from './auth.mjs';
import { isIP } from 'node:net';
import { hash, fail } from './util.mjs';
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const definitions = [
  { id: 'google', name: 'Google', issuer: 'https://accounts.google.com', authorize: 'https://accounts.google.com/o/oauth2/v2/auth', token: 'https://oauth2.googleapis.com/token', jwks: 'https://www.googleapis.com/oauth2/v3/certs', scope: 'openid', pkce: true },
  { id: 'microsoft', name: 'Microsoft', scope: 'openid', pkce: true },
  { id: 'apple', name: 'Apple', issuer: 'https://appleid.apple.com', authorize: 'https://appleid.apple.com/auth/authorize', token: 'https://appleid.apple.com/auth/token', jwks: 'https://appleid.apple.com/auth/keys', scope: '', pkce: false },
  { id: 'facebook', name: 'Facebook', scope: 'public_profile', pkce: false }
];
export function providerConfig(env = process.env) {
  return definitions.map(base => {
    const prefix = base.id.toUpperCase(), clientId = env[`${prefix}_CLIENT_ID`] || '', clientSecret = env[`${prefix}_CLIENT_SECRET`] || '';
    const config = { ...base, clientId, clientSecret, enabled: false };
    if (base.id === 'microsoft') {
      const tenant = env.MICROSOFT_TENANT_ID || 'common';
      if (!['common', 'organizations', 'consumers'].includes(tenant) && !uuid.test(tenant)) throw Error('MICROSOFT_TENANT_ID geçersiz.');
      Object.assign(config, { tenant, authorize: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`, token: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, jwks: `https://login.microsoftonline.com/${tenant}/discovery/v2.0/keys` });
    }
    if (base.id === 'facebook') {
      const version = env.FACEBOOK_GRAPH_VERSION;
      if (clientId && !/^v\d+\.0$/.test(version || '')) throw Error('Meta uygulamanızın desteklediği FACEBOOK_GRAPH_VERSION gerekli.');
      Object.assign(config, { graph: `https://graph.facebook.com/${version}`, authorize: `https://www.facebook.com/${version}/dialog/oauth`, token: `https://graph.facebook.com/${version}/oauth/access_token` });
    }
    if (base.id === 'apple') {
      Object.assign(config, { teamId: env.APPLE_TEAM_ID, keyId: env.APPLE_KEY_ID, privateKey: env.APPLE_PRIVATE_KEY?.replaceAll('\\n', '\n') });
      config.enabled = !!(clientId && config.teamId && config.keyId && config.privateKey);
      if (config.enabled) createPrivateKey(config.privateKey);
      if (clientId && !config.enabled) throw Error('Apple Services ID, Team ID, Key ID ve özel anahtar birlikte gerekli.');
    } else {
      if (!!clientId !== !!clientSecret) throw Error(`${prefix}_CLIENT_ID ve ${prefix}_CLIENT_SECRET birlikte gerekli.`);
      config.enabled = !!clientId;
    }
    return config;
  });
}
function b64(value) { return Buffer.from(JSON.stringify(value)).toString('base64url'); }
export function appleClientSecret(provider, now = Math.floor(Date.now() / 1000)) {
  const content = `${b64({ alg: 'ES256', kid: provider.keyId })}.${b64({ iss: provider.teamId, iat: now, exp: now + 300, aud: 'https://appleid.apple.com', sub: provider.clientId })}`;
  const signature = sign('sha256', Buffer.from(content), { key: provider.privateKey, dsaEncoding: 'ieee-p1363' });
  return `${content}.${signature.toString('base64url')}`;
}
export function verifyIdentityToken(jwt, keys, provider, nonce, now = Math.floor(Date.now() / 1000)) {
  try {
    if (typeof jwt !== 'string' || jwt.length > 20000) throw Error();
    const parts = jwt.split('.'); if (parts.length !== 3 || parts.some(p => !/^[A-Za-z0-9_-]+$/.test(p))) throw Error();
    const header = JSON.parse(Buffer.from(parts[0], 'base64url')), claims = JSON.parse(Buffer.from(parts[1], 'base64url'));
    if (header.alg !== 'RS256' || typeof header.kid !== 'string' || header.crit || header.jku || header.jwk || header.x5u) throw Error();
    const matches = keys.filter(k => k.kid === header.kid && k.kty === 'RSA' && (!k.use || k.use === 'sig') && (!k.alg || k.alg === 'RS256'));
    if (matches.length !== 1) throw Error(); const key = matches[0];
    if (!verify('RSA-SHA256', Buffer.from(parts.slice(0, 2).join('.')), createPublicKey({ key, format: 'jwk' }), Buffer.from(parts[2], 'base64url'))) throw Error();
    const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!audience.includes(provider.clientId) || (audience.length > 1 && claims.azp !== provider.clientId) || (claims.azp !== undefined && claims.azp !== provider.clientId)) throw Error();
    if (!Number.isFinite(claims.exp) || claims.exp <= now || !Number.isFinite(claims.iat) || claims.iat > now + 60 || claims.iat < now - 3600 || (claims.nbf !== undefined && (!Number.isFinite(claims.nbf) || claims.nbf > now + 60))) throw Error();
    if (claims.nonce !== nonce || typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 255) throw Error();
    if (provider.id === 'microsoft') {
      if (!uuid.test(claims.tid || '') || claims.iss !== `https://login.microsoftonline.com/${claims.tid}/v2.0`) throw Error();
      if (uuid.test(provider.tenant) && claims.tid.toLowerCase() !== provider.tenant.toLowerCase()) throw Error();
      if (key.issuer && key.issuer.replace('{tenantid}', claims.tid) !== claims.iss) throw Error();
    } else if (claims.iss !== provider.issuer) throw Error();
    return { issuer: claims.iss, subject: claims.sub };
  } catch { fail(403, 'Kimlik sağlayıcısının yanıtı doğrulanamadı.'); }
}

export class Federation {
  constructor({ store, origin, providers = providerConfig(), fetcher = fetch }) { this.store = store; this.origin = origin; this.providers = providers; this.fetcher = fetcher; this.keyCache = new Map(); }
  publicConfig() { return this.providers.map(p => ({ id: p.id, name: p.name, enabled: p.enabled })); }
  provider(id) { const p = this.providers.find(p => p.id === id && p.enabled); if (!p) fail(503, 'Bu giriş sağlayıcısı henüz yapılandırılmadı.'); return p; }
  start(id, link = null) {
    const p = this.provider(id);
    const origin = new URL(this.origin);
    if (id === 'apple' && (origin.protocol !== 'https:' || origin.hostname === 'localhost' || !origin.hostname.includes('.') || isIP(origin.hostname.replace(/^\[|\]$/g, '')))) fail(503, 'Apple web girişi gerçek bir HTTPS alan adı kurulumu gerektirir.');
    const state = token(), binding = token(), verifier = token(), nonce = token(), callback = `${this.origin}/auth/${id}/callback`;
    this.store.run('DELETE FROM oauth_transactions WHERE expires<=?', Date.now());
    this.store.run('INSERT INTO oauth_transactions VALUES (?,?,?,?,?,?,?,?,?)', hash(state), id, hash(binding), verifier, nonce, link?.userId || null, link?.sessionHash || null, Date.now() + 600_000, callback);
    const url = new URL(p.authorize); url.search = new URLSearchParams({ client_id: p.clientId, redirect_uri: callback, response_type: 'code', response_mode: 'query', state,
      ...(p.scope ? { scope: p.scope } : {}), ...(p.id !== 'facebook' ? { nonce } : {}),
      ...(p.pkce ? { code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' } : {}) });
    return { url: url.href, binding };
  }
  consume(id, state, binding) {
    if (typeof state !== 'string' || typeof binding !== 'string' || state.length > 200 || binding.length > 200) fail(403, 'Giriş işlemi doğrulanamadı.');
    return this.store.transaction(() => {
      const row = this.store.get('SELECT * FROM oauth_transactions WHERE state_hash=? AND provider=? AND binding_hash=? AND expires>?', hash(state), id, hash(binding), Date.now());
      if (!row) fail(403, 'Giriş işlemi geçersiz, süresi dolmuş veya kullanılmış.');
      this.store.run('DELETE FROM oauth_transactions WHERE state_hash=?', row.state_hash);
      if (row.user_id && !this.store.get('SELECT user_id FROM sessions WHERE token_hash=? AND user_id=? AND expires>?', row.session_hash, row.user_id, Date.now())) fail(403, 'Hesap bağlama oturumu sona erdi.');
      return row;
    });
  }
  async request(url, options = {}) {
    try {
      const response = await this.fetcher(url, { redirect: 'error', signal: AbortSignal.timeout(10_000), ...options });
      if (!response.ok) throw Error(); return await response.json();
    } catch { fail(502, 'Kimlik sağlayıcısına ulaşılamadı veya işlem reddedildi.'); }
  }
  async exchange(id, code, transaction) {
    const p = this.provider(id);
    if (typeof code !== 'string' || !code || code.length > 8192) fail(403, 'Geçerli bir giriş kodu alınamadı.');
    const tokens = await this.request(p.token, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({
      grant_type: 'authorization_code', code, redirect_uri: transaction.callback, client_id: p.clientId,
      client_secret: p.id === 'apple' ? appleClientSecret(p) : p.clientSecret, ...(p.pkce ? { code_verifier: transaction.verifier } : {})
    }) });
    if (p.id === 'facebook') {
      if (typeof tokens.access_token !== 'string') fail(403, 'Facebook erişim belirteci alınamadı.');
      const debug = new URL(`${p.graph}/debug_token`); debug.searchParams.set('input_token', tokens.access_token);
      const checked = (await this.request(debug.href, { headers: { Authorization: `Bearer ${p.clientId}|${p.clientSecret}` } })).data;
      const now = Date.now() / 1000;
      if (checked?.is_valid !== true || String(checked.app_id) !== p.clientId || !checked.user_id || !Number.isFinite(checked.expires_at) || checked.expires_at <= now || (checked.data_access_expires_at && checked.data_access_expires_at <= now)) fail(403, 'Facebook kimliği doğrulanamadı.');
      const profile = new URL(`${p.graph}/me`); profile.searchParams.set('fields', 'id'); profile.searchParams.set('appsecret_proof', createHmac('sha256', p.clientSecret).update(tokens.access_token).digest('hex'));
      const user = await this.request(profile.href, { headers: { Authorization: `Bearer ${tokens.access_token}` } });
      if (user.id !== checked.user_id) fail(403, 'Facebook kimliği eşleşmiyor.');
      return { issuer: `https://www.facebook.com/${p.clientId}`, subject: user.id };
    }
    const cache = this.keyCache.get(id);
    let keys = cache?.expires > Date.now() ? cache.keys : null;
    if (!keys) { keys = (await this.request(p.jwks)).keys; if (!Array.isArray(keys)) fail(502, 'Kimlik anahtarları alınamadı.'); this.keyCache.set(id, { keys, expires: Date.now() + 300_000 }); }
    try { return verifyIdentityToken(tokens.id_token, keys, p, transaction.nonce); }
    catch (error) {
      // A rotated key can legitimately be missing from a cached JWKS.
      if (!cache) throw error;
      const fresh = (await this.request(p.jwks)).keys; if (!Array.isArray(fresh)) throw error;
      this.keyCache.set(id, { keys: fresh, expires: Date.now() + 300_000 });
      return verifyIdentityToken(tokens.id_token, fresh, p, transaction.nonce);
    }
  }
  finish(id, identity, transaction) {
    return this.store.transaction(() => {
      const existing = this.store.get('SELECT user_id FROM external_identities WHERE provider=? AND issuer=? AND subject=?', id, identity.issuer, identity.subject);
      if (transaction.user_id) {
        if (!this.store.get('SELECT user_id FROM sessions WHERE token_hash=? AND user_id=? AND expires>?', transaction.session_hash, transaction.user_id, Date.now())) fail(403, 'Hesap bağlama oturumu sona erdi.');
        if (existing && existing.user_id !== transaction.user_id) fail(409, 'Bu dış hesap başka bir konsol hesabına bağlı.');
        if (!existing) this.store.run('INSERT INTO external_identities VALUES (?,?,?,?,?)', id, identity.issuer, identity.subject, transaction.user_id, new Date().toISOString());
        this.store.event(null, transaction.user_id, 'identity_linked', { provider: id });
      } else if (!existing) fail(403, 'Bu dış hesap henüz konsola bağlı değil. Önce yerel hesabınızla giriş yapıp Hesabım bölümünden bağlayın.');
      const userId = transaction.user_id || existing.user_id;
      const user = this.store.get('SELECT id,email FROM users WHERE id=?', userId);
      if (!user) fail(403, 'Konsol hesabı bulunamadı.');
      this.store.event(null, user.email, 'federated_login', { provider: id });
      return user;
    });
  }
}
