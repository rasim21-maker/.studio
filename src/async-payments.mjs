import fs from 'node:fs/promises';
import path from 'node:path';
import {randomBytes,randomUUID,createCipheriv,createDecipheriv,createHmac,timingSafeEqual} from 'node:crypto';
import {fail} from './util.mjs';

const defaultOptions={latitude:41.0082,longitude:29.032,query:'pets',symbol:'IBM',language:'en'};
const decimal=n=>(n/100).toFixed(2);
const constant=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
const allowedCheckout=(value,provider)=>{try{const u=new URL(value);return u.protocol==='https:'&&({stripe:['checkout.stripe.com'],paypal:['www.paypal.com','www.sandbox.paypal.com'],iyzico:['sandbox-cpp.iyzipay.com','cpp.iyzipay.com','sandbox-api.iyzipay.com','api.iyzipay.com']}[provider]||[]).includes(u.hostname);}catch{return false;}};

import {Integrations,providerCatalog} from './integrations.mjs';
export class AsyncPayments extends Integrations {
 constructor(repository,key,{fetcher=fetch,assertWritable=async()=>{}}={}){
  super(repository,key,{fetcher,initialize:false});this.assertWritable=assertWritable;
  for(const name of ["config","ready","list","save","hasPaymentLock","paymentRows","checkout","verify","stripeWebhook","gadget"]){const method=this[name].bind(this);this[name]=(site,...args)=>repository.bind(site,()=>['save','list','config','ready','hasPaymentLock','paymentRows'].includes(name)?repository.transaction(()=>method(site,...args)):method(site,...args));}
 }

    static async open(store, dataDir, opts) { const file = path.join(dataDir, 'integration-key'); let key; try {
        key = await fs.readFile(file);
    }
    catch (e) {
        if (e.code !== 'ENOENT')
            throw e;
        key = randomBytes(32);
        await fs.writeFile(file, key, { flag: 'wx', mode: 0o600 });
    } if (key.length !== 32)
        throw Error('Integration encryption key is invalid.'); return new AsyncPayments(store, key, opts); }
    async config(site, id) { const p = providerCatalog.find(p => p.id === id); if (!p)
        fail(404, 'Sağlayıcı bulunamadı.'); const r = (await this.store.get('SELECT * FROM integrations WHERE site_id=? AND provider=?', site, id)); return r ? { revision: r.revision, enabled: !!r.enabled, mode: r.mode, options: JSON.parse(r.options), secrets: this.decrypt(r.secrets) } : { revision: 0, enabled: false, mode: 'sandbox', options: { ...defaultOptions, ...(id === 'index' ? { symbol: 'SPX' } : {}) }, secrets: {} }; }
    async ready(site, id) { const c = (await this.config(site, id)), p = providerCatalog.find(p => p.id === id), required = p.keys.filter(k => k !== 'webhookSecret' && !(id === 'weather' && c.mode === 'sandbox')); return c.enabled && required.every(k => c.secrets[k]); }
    async list(site) { return (await Promise.all(providerCatalog.map(async (p) => { const c = (await this.config(site, p.id)); return { ...p, ...c, secrets: undefined, configured: Object.fromEntries(p.keys.map(k => [k, !!c.secrets[k]])), ready: (await this.ready(site, p.id)) }; }))); }
    async save(site, id, input, actor) {
        const c = (await this.config(site, id)), p = providerCatalog.find(p => p.id === id);
        if (c.revision !== input.revision)
            fail(409, 'Bağlantı ayarları değişti. Yeniden yükleyin.');
        if (typeof input.enabled !== 'boolean' || !['sandbox', 'live'].includes(input.mode))
            fail(422, 'Bağlantı ayarları geçersiz.');
        const o = { ...defaultOptions, ...input.options };
        if (!Number.isFinite(o.latitude) || o.latitude < -90 || o.latitude > 90 || !Number.isFinite(o.longitude) || o.longitude < -180 || o.longitude > 180 || typeof o.query !== 'string' || o.query.length > 120 || !/^[A-Za-z0-9.^:-]{1,30}$/.test(o.symbol) || !['en', 'tr', 'de', 'fr', 'es', 'it', 'pt', 'ru', 'ar', 'zh'].includes(o.language))
            fail(422, 'Gadget konum, sembol veya haber ayarı geçersiz.');
        const secrets = { ...c.secrets };
        for (const [k, v] of Object.entries(input.secrets || {})) {
            if (!p.keys.includes(k) || typeof v !== 'string' || v.length > 8000 || /[\r\n\u0000]/.test(v))
                fail(422, 'Anahtar geçersiz.');
            if (v)
                secrets[k] = v;
        }
        for (const k of input.clearKeys || []) {
            if (!p.keys.includes(k))
                fail(422, 'Anahtar adı geçersiz.');
            delete secrets[k];
        }
        if (input.enabled && p.keys.filter(k => k !== 'webhookSecret' && !(id === 'weather' && input.mode === 'sandbox')).some(k => !secrets[k]))
            fail(422, 'Etkinleştirmek için gerekli anahtarları girin.');
        (await this.store.run('INSERT INTO integrations VALUES (?,?,?,?,?,?,?) ON CONFLICT(site_id,provider) DO UPDATE SET revision=excluded.revision,enabled=excluded.enabled,mode=excluded.mode,options=excluded.options,secrets=excluded.secrets', site, id, c.revision + 1, Number(input.enabled), input.mode, JSON.stringify(o), this.encrypt(secrets)));
        this.cache.delete(site + ':' + id);
        (await this.store.event(site, actor, 'integration_saved', { provider: id }));
        return (await this.list(site)).find(p => p.id === id);
    }
    async gadget(site, id, { refresh = false } = {}) {
        if (!['weather', 'news', 'stocks', 'index', 'traffic'].includes(id))
            fail(404, 'Gadget bulunamadı.');
        if (!(await this.ready(site, id)))
            return { status: 'not_configured', provider: id, items: [], message: 'Sağlayıcı bağlantısını yapılandırın.' };
        const key = site + ':' + id, cached = this.cache.get(key);
        if (!refresh && cached && Date.now() - cached.at < 300000)
            return cached.value;
        const c = (await this.config(site, id)), o = c.options, k = c.secrets.apiKey;
        let data, items, attribution;
        try {
            if (id === 'weather') {
                const u = new URL(c.mode === 'live' ? 'https://customer-api.open-meteo.com/v1/forecast' : 'https://api.open-meteo.com/v1/forecast');
                u.search = new URLSearchParams({ latitude: String(o.latitude), longitude: String(o.longitude), current: 'temperature_2m,weather_code,wind_speed_10m', timezone: 'Europe/Istanbul', ...(c.mode === 'live' ? { apikey: k } : {}) });
                data = await this.request(u);
                if (!data.current || !Number.isFinite(data.current.temperature_2m))
                    throw Error();
                items = [{ title: 'Hava durumu', value: `${data.current.temperature_2m} °C`, detail: `Rüzgâr ${data.current.wind_speed_10m} km/sa · WMO ${data.current.weather_code}`, asOf: data.current.time }];
                attribution = { name: 'Open-Meteo', url: 'https://open-meteo.com/' };
            }
            if (id === 'news') {
                const u = new URL('https://newsapi.org/v2/everything');
                u.search = new URLSearchParams({ q: o.query, language: o.language, pageSize: '6', sortBy: 'publishedAt' });
                data = await this.request(u, { headers: { 'X-Api-Key': k } });
                if (data.status !== 'ok' || !Array.isArray(data.articles))
                    throw Error();
                items = data.articles.map(a => ({ title: String(a.title || '').slice(0, 300), detail: String(a.source?.name || ''), url: /^https:\/\//.test(a.url) ? a.url : null, asOf: a.publishedAt }));
                attribution = { name: 'NewsAPI', url: 'https://newsapi.org/' };
            }
            if (id === 'stocks' || id === 'index') {
                const u = new URL('https://www.alphavantage.co/query');
                u.search = new URLSearchParams({ function: id === 'stocks' ? 'GLOBAL_QUOTE' : 'INDEX_DATA', symbol: o.symbol, apikey: k, ...(id === 'index' ? { interval: 'daily' } : {}) });
                data = await this.request(u);
                if (data.Note || data.Information || data['Error Message'])
                    fail(502, 'Veri planı, sembol veya sağlayıcı kotası uygun değil.');
                if (id === 'stocks') {
                    const q = data['Global Quote'];
                    if (!q?.['05. price'])
                        throw Error();
                    items = [{ title: q['01. symbol'], value: q['05. price'], detail: q['10. change percent'] + ' · gün sonu', asOf: q['07. latest trading day'] }];
                }
                else {
                    const series = data['Time Series (Daily)'] || data['Time Series (1day)'] || data['data'];
                    if (!series || typeof series !== 'object')
                        throw Error();
                    const [date, q] = Object.entries(series).sort(([a], [b]) => b.localeCompare(a))[0] || [];
                    if (!q || !(q['4. close'] ?? q.close))
                        throw Error();
                    items = [{ title: o.symbol, value: String(q['4. close'] ?? q.close), detail: 'Endeks · gün sonu', asOf: date }];
                }
                attribution = { name: 'Alpha Vantage', url: 'https://www.alphavantage.co/' };
            }
            if (id === 'traffic') {
                const u = new URL('https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json');
                u.search = new URLSearchParams({ point: `${o.latitude},${o.longitude}`, unit: 'kmph', key: k });
                data = await this.request(u);
                const f = data.flowSegmentData;
                if (!f || !Number.isFinite(f.currentSpeed))
                    throw Error();
                items = [{ title: 'Yakındaki yol kesimi', value: f.roadClosure ? 'Yol kapalı' : `${f.currentSpeed} km/sa`, detail: `Serbest akış ${f.freeFlowSpeed} km/sa · güven ${Math.round(f.confidence * 100)}%`, asOf: new Date().toISOString() }];
                attribution = { name: 'TomTom', url: 'https://www.tomtom.com/' };
            }
            const value = { status: 'ready', provider: id, items, attribution, fetchedAt: new Date().toISOString(), mode: c.mode };
            this.cache.set(key, { at: Date.now(), value });
            return value;
        }
        catch (e) {
            if (cached)
                return { ...cached.value, status: 'stale', message: 'Güncelleme alınamadı; son veri gösteriliyor.' };
            return { status: 'error', provider: id, items: [], message: e.status ? e.message : 'Sağlayıcıdan beklenen veri alınamadı.' };
        }
    }
    async hasPaymentLock(site, bookingId) { return !!(await this.store.get("SELECT id FROM payment_transactions WHERE site_id=? AND booking_id=? AND status IN ('created','paid','review','processing')", site, bookingId)); }
    async paymentRows(site) { return (await this.store.all('SELECT id,booking_id,provider,amount,currency,status,created,updated FROM payment_transactions WHERE site_id=? ORDER BY created DESC LIMIT 1000', site)); }
    async checkout(site, r, provider, billing, origin, ip, {publicRequest=false}={}) {
        if (!['iyzico', 'stripe', 'paypal'].includes(provider) || !(await this.ready(site, provider)))
            fail(422, 'Ödeme sağlayıcısı hazır değil.');
        if (!['pending', 'confirmed'].includes(r.status) || r.start <= Date.now() || r.hold_until && r.hold_until <= Date.now())
            fail(409, 'Bu rezervasyon için ödeme başlatılamaz.');
        if (r.price_minor <= 0)
            fail(422, 'Hizmet için önce bir ücret tanımlayın.');
        if (provider === 'paypal' && r.currency === 'TRY')
            fail(422, 'PayPal TRY desteklemez. Fiyat para birimini otomatik dönüştürmüyoruz.');
        const key = site + ':' + r.id;
        if (this.inFlight.has(key))
            fail(409, 'Ödeme işlemi devam ediyor.');
        this.inFlight.add(key);
        try {
            const reserved=await this.store.transaction(async()=>{
            await this.assertWritable(site);
            if(publicRequest){const settings=await this.store.get('SELECT content FROM booking_settings WHERE site_id=?',site);if(!settings||!JSON.parse(settings.content).publicEnabled)fail(403,'Çevrimiçi rezervasyon henüz açılmadı.');}
            const current=await this.store.get('SELECT * FROM reservations WHERE id=? AND site_id=?',r.id,site);if(!current)fail(404,'Rezervasyon bulunamadı.');r=current;
            if(!['pending','confirmed'].includes(r.status)||r.start<=Date.now()||r.hold_until&&r.hold_until<=Date.now())fail(409,'Bu rezervasyon için ödeme başlatılamaz.');
            if(r.price_minor<=0||provider==='paypal'&&r.currency==='TRY')fail(422,'Ödeme tutarı veya para birimi uygun değil.');
            if(!await this.ready(site,provider))fail(422,'Ödeme sağlayıcısı hazır değil.');
            let tx = (await this.store.get("SELECT * FROM payment_transactions WHERE site_id=? AND booking_id=? AND status IN ('processing','created','paid','review') ORDER BY created DESC LIMIT 1", site,r.id));
            if (tx?.status === 'paid' || tx?.status === 'review')
                fail(409, 'Bu rezervasyon için ödeme kaydı mevcut.');
            if (tx && tx.provider !== provider)
                fail(409, 'Başlatılmış ödeme başka sağlayıcıya ait. Önce durumunu doğrulayın.');
            const c = (await this.config(site, provider));
            if (c.mode === 'live' && !origin.startsWith('https://'))
                fail(422, 'Canlı ödeme için HTTPS sunucu adresi gerekli.');
            if (!tx) {
                const id = randomUUID(), now = new Date().toISOString();
                (await this.store.run('INSERT INTO payment_transactions VALUES (?,?,?,?,NULL,NULL,?,?,?, ?,?,?)', id, site, r.id, provider, r.price_minor, r.currency, 'processing', now, now, '{}'));
                tx = (await this.store.get('SELECT * FROM payment_transactions WHERE id=?', id));
            }
            return {tx,c};});
            const {tx,c}=reserved;
            if(tx.url)return{id:tx.id,url:tx.url,status:tx.status};
            const returnUrl = `${origin}/book/${site}/?id=${r.id}`, customer = JSON.parse(r.customer);
            let data, reference, url;
            if (provider === 'stripe') {
                const form = new URLSearchParams({ mode: 'payment', client_reference_id: r.id, success_url: returnUrl, cancel_url: returnUrl, 'metadata[studio_payment_id]': tx.id, 'line_items[0][price_data][currency]': r.currency.toLowerCase(), 'line_items[0][price_data][unit_amount]': String(r.price_minor), 'line_items[0][price_data][product_data][name]': r.reference, 'line_items[0][quantity]': '1', 'customer_email': customer.email });
                data = await this.request('https://api.stripe.com/v1/checkout/sessions', { method: 'POST', headers: { Authorization: 'Bearer ' + c.secrets.secretKey, 'Content-Type': 'application/x-www-form-urlencoded', 'Idempotency-Key': tx.id, 'Stripe-Version': '2026-10-28.endive' }, body: form.toString() });
                reference = data.id;
                url = data.url;
            }
            if (provider === 'paypal') {
                data = await this.paypal(c, '/v2/checkout/orders', { intent: 'CAPTURE', purchase_units: [{ reference_id: r.id, custom_id: r.id, amount: { currency_code: r.currency, value: decimal(r.price_minor) } }], payment_source: { paypal: { experience_context: { shipping_preference: 'NO_SHIPPING', user_action: 'PAY_NOW', return_url: returnUrl, cancel_url: returnUrl } } } }, tx.id);
                reference = data.id;
                url = data.links?.find(l => ['payer-action', 'approve'].includes(l.rel))?.href;
            }
            if (provider === 'iyzico') {
                if (!billing || ['surname', 'identityNumber', 'address', 'city', 'country'].some(k => typeof billing[k] !== 'string' || !billing[k].trim() || billing[k].length > 300 || /[<>\u0000-\u001f]/.test(billing[k])))
                    fail(422, 'iyzico için soyad, kimlik, adres, şehir ve ülke bilgilerini doldurun.');
                // iyzico has no documented initialize idempotency guarantee; never blindly retry an uncertain request.
                await this.store.transaction(async()=>{
                 const current=await this.store.get('SELECT * FROM payment_transactions WHERE id=? AND site_id=?',tx.id,site);
                 if(JSON.parse(current.detail).attempted)fail(409,'iyzico başlatma sonucu belirsiz. Sağlayıcı panelinde kontrol edilmeden yeniden ödeme başlatılamaz.');
                 await this.store.run('UPDATE payment_transactions SET detail=? WHERE id=?',JSON.stringify({attempted:true}),tx.id);
                });
                data = await this.iyzico(c, '/payment/iyzipos/checkoutform/initialize/auth/ecom', { locale: 'tr', conversationId: tx.id, price: decimal(r.price_minor), paidPrice: decimal(r.price_minor), currency: r.currency, basketId: r.id, paymentGroup: 'PRODUCT', callbackUrl: `${origin}/payments/${site}/iyzico/callback`, buyer: { id: r.id, name: customer.name, surname: billing.surname, gsmNumber: customer.phone, email: customer.email, identityNumber: billing.identityNumber, registrationAddress: billing.address, city: billing.city, country: billing.country, ip }, billingAddress: { contactName: customer.name, address: billing.address, city: billing.city, country: billing.country }, basketItems: [{ id: r.id, name: r.reference, category1: 'Pet care', itemType: 'VIRTUAL', price: decimal(r.price_minor) }] });
                if (data.status !== 'success')
                    fail(502, 'iyzico ödeme başlatmayı reddetti. Sağlayıcı ayarlarını kontrol edin.');
                reference = data.token;
                url = data.paymentPageUrl;
                const expected = createHmac('sha256', c.secrets.secretKey).update([tx.id, reference].join(':')).digest('hex');
                if (!constant(expected, data.signature))
                    fail(502, 'iyzico yanıt imzası doğrulanamadı.');
            }
            if (typeof reference !== 'string' || reference.length > 300 || !allowedCheckout(url, provider))
                fail(502, 'Sağlayıcının ödeme bağlantısı doğrulanamadı.');
            return await this.store.transaction(async()=>{
             const current=await this.store.get('SELECT * FROM payment_transactions WHERE id=? AND site_id=?',tx.id,site);
             if(['paid','review'].includes(current.status))return{id:tx.id,url:current.url,status:current.status};
             if(current.reference&&current.reference!==reference)fail(409,'Sağlayıcı referansı değişti; mutabakat gerekli.');
             await this.store.run("UPDATE payment_transactions SET reference=?,url=?,status='created',updated=? WHERE id=?",reference,url,new Date().toISOString(),tx.id);
             return{id:tx.id,url,status:'created'};
            });
        }
        finally {
            this.inFlight.delete(key);
        }
    }
    async verify(site, id) {
        const tx = (await this.store.get('SELECT * FROM payment_transactions WHERE id=? AND site_id=?', id, site));
        if (!tx)
            fail(404, 'Ödeme kaydı bulunamadı.');
        if (['paid', 'review'].includes(tx.status))
            return { status: tx.status, id };
        if (!tx.reference)
            fail(409, 'Sağlayıcı referansı yok. Ödeme panelinden mutabakat gerekli.');
        const c = (await this.config(site, tx.provider));
        let data, paid = false, pending = false, amount, currency, booking, detail = {};
        const key = site + ':' + tx.booking_id;
        if (this.inFlight.has(key))
            fail(409, 'Ödeme kontrolü devam ediyor.');
        this.inFlight.add(key);
        try {
            if (tx.provider === 'stripe') {
                data = await this.request('https://api.stripe.com/v1/checkout/sessions/' + encodeURIComponent(tx.reference), { headers: { Authorization: 'Bearer ' + c.secrets.secretKey } });
                paid = data.payment_status === 'paid';
                pending = data.status !== 'expired';
                amount = data.amount_total;
                currency = data.currency?.toUpperCase();
                booking = data.client_reference_id;
                detail = { paymentIntent: data.payment_intent };
            }
            if (tx.provider === 'paypal') {
                data = await this.paypal(c, '/v2/checkout/orders/' + encodeURIComponent(tx.reference));
                if (data.status === 'APPROVED')
                    data = await this.paypal(c, `/v2/checkout/orders/${encodeURIComponent(tx.reference)}/capture`, {}, tx.id + '-capture');
                const unit = data.purchase_units?.[0], capture = unit?.payments?.captures?.[0];
                paid = data.status === 'COMPLETED' && capture?.status === 'COMPLETED';
                pending = !['VOIDED'].includes(data.status);
                amount = Math.round(Number((capture?.amount || unit?.amount)?.value) * 100);
                currency = (capture?.amount || unit?.amount)?.currency_code;
                booking = unit?.custom_id || unit?.reference_id;
                detail = { captureId: capture?.id };
            }
            if (tx.provider === 'iyzico') {
                data = await this.iyzico(c, '/payment/iyzipos/checkoutform/auth/ecom/detail', { locale: 'tr', conversationId: tx.id, token: tx.reference });
                if (data.status !== 'success')
                    fail(502, 'iyzico ödeme sorgusu başarısız.');
                const norm = v => String(v).includes('.') ? String(v).replace(/0+$/, '').replace(/\.$/, '') : String(v);
                const expected = createHmac('sha256', c.secrets.secretKey).update([data.paymentStatus, data.paymentId, data.currency, data.basketId, data.conversationId, norm(data.paidPrice), norm(data.price), data.token].join(':')).digest('hex');
                if (!constant(expected, data.signature) || data.token !== tx.reference || data.conversationId !== tx.id)
                    fail(502, 'iyzico ödeme imzası doğrulanamadı.');
                paid = data.paymentStatus === 'SUCCESS' && data.fraudStatus === 1;
                pending = data.paymentStatus === 'INIT_THREEDS' || data.fraudStatus === 0;
                amount = Math.round(Number(data.paidPrice) * 100);
                currency = data.currency;
                booking = data.basketId;
                detail = { paymentId: data.paymentId };
            }
            if (amount !== tx.amount || currency !== tx.currency || booking !== tx.booking_id)
                fail(502, 'Ödeme tutarı, para birimi veya rezervasyon referansı eşleşmiyor.');
            return (await this.store.transaction(async () => { const current=await this.store.get('SELECT * FROM payment_transactions WHERE id=? AND site_id=?',id,site);if(['paid','review'].includes(current.status))return{id,status:current.status};if(current.reference!==tx.reference||current.amount!==tx.amount||current.currency!==tx.currency)fail(409,'Ödeme kaydı değişti.');const r = (await this.store.get('SELECT * FROM reservations WHERE id=? AND site_id=?', tx.booking_id,site)); const late = paid && (!['pending', 'confirmed'].includes(r.status) || r.hold_until && r.hold_until <= Date.now()); const status = paid ? (late ? 'review' : 'paid') : pending ? 'created' : 'failed'; (await this.store.run('UPDATE payment_transactions SET status=?,updated=?,detail=? WHERE id=?', status, new Date().toISOString(), JSON.stringify(detail), id)); if (paid && !late)
                (await this.store.run("UPDATE reservations SET status='confirmed',hold_until=NULL,revision=revision+1,updated=? WHERE id=?", new Date().toISOString(), r.id)); (await this.store.event(site, 'provider', 'payment_verified', { id, status })); return { id, status }; }));
        }
        finally {
            this.inFlight.delete(key);
        }
    }
    async stripeWebhook(site, raw, header) { const c = (await this.config(site, 'stripe')); if (!c.secrets.webhookSecret)
        fail(503, 'Webhook imza anahtarı yapılandırılmadı.'); const parts = String(header).split(',').map(s => s.split('=')), t = parts.find(([k]) => k === 't')?.[1], signatures = parts.filter(([k]) => k === 'v1').map(([, v]) => v); if (!/^\d+$/.test(t || '') || Math.abs(Date.now() / 1000 - Number(t)) > 300)
        fail(400, 'Webhook süresi geçersiz.'); const expected = createHmac('sha256', c.secrets.webhookSecret).update(t + '.').update(raw).digest('hex'); if (!signatures.some(s => constant(s, expected)))
        fail(400, 'Webhook imzası geçersiz.'); let event; try {
        event = JSON.parse(raw);
    }
    catch {
        fail(400, 'Webhook JSON geçersiz.');
    } if (typeof event.id !== 'string'||event.id.length>200)
        fail(400, 'Webhook kimliği gerekli.'); const eventKey=site+':stripe:'+event.id;if ((await this.store.get('SELECT id FROM payment_events WHERE id=?', eventKey)))
        return { ok: true }; const ref = event.data?.object?.id, tx = (await this.store.get('SELECT id FROM payment_transactions WHERE site_id=? AND provider=? AND reference=?', site, 'stripe', ref)); if (tx)
        await this.verify(site, tx.id); (await this.store.run('INSERT OR IGNORE INTO payment_events VALUES (?,?)', eventKey, new Date().toISOString())); return { ok: true }; }
}
