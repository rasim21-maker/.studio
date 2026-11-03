import { fail, hash } from './util.mjs';
export class Recaptcha {
  constructor({ siteKey = '', secret = '', required = false, hostname, fetcher = fetch } = {}) {
    if (!!siteKey !== !!secret) throw Error('RECAPTCHA_SITE_KEY ve RECAPTCHA_SECRET birlikte tanımlanmalı.');
    if (required && !siteKey) throw Error('CAPTCHA zorunlu; gerçek reCAPTCHA v2 anahtarları gerekli.');
    this.siteKey = siteKey; this.secret = secret; this.hostname = hostname; this.fetcher = fetcher; this.used = new Map();
  }
  publicConfig() { return { enabled: !!this.siteKey, siteKey: this.siteKey || null, type: 'recaptcha-v2' }; }
  async verify(response) {
    if (!this.siteKey) return;
    if (typeof response !== 'string' || response.length < 10 || response.length > 8192) fail(422, 'Google doğrulamasını tamamlayın.');
    const now = Date.now(); for (const [id, expiry] of this.used) if (expiry <= now) this.used.delete(id);
    const id = hash(response); if (this.used.has(id)) fail(403, 'Google doğrulaması kullanılmış. Yeniden doğrulayın.');
    // Reserve before awaiting Google to reject parallel replay attempts too.
    this.used.set(id, now + 180_000);
    let result;
    try {
      const reply = await this.fetcher('https://www.google.com/recaptcha/api/siteverify', { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(8000), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ secret: this.secret, response }) });
      if (!reply.ok) throw Error('unavailable'); result = await reply.json();
    } catch { fail(503, 'Google doğrulama servisine ulaşılamadı. Giriş tamamlanmadı; yeniden deneyin.'); }
    const challenge = Date.parse(result.challenge_ts);
    if (result.success !== true || result.hostname !== this.hostname || !Number.isFinite(challenge) || challenge < now - 120_000 || challenge > now + 30_000) fail(403, 'Google doğrulaması geçersiz veya süresi dolmuş. Yeniden doğrulayın.');
  }
}
