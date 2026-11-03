import {mountRich} from './rich-editor.js';
import {mountFeatures} from './features-ui.js';
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const icons = { grid: '▦', content: '▤', history: '◷', preview: '↗', members: '♙', connect: '⌘', bookings: '▣', calendar: '▦', bookingSettings: '⚙' };
const state = { user: null, csrf: null, sites: [], site: null, locale: 'tr', page: 'home', group: 'seo', view: 'content', search: '', offset: 0, doc: null, working: null, busy: false, builds: [], history: [], members: [] };
let setupToken = new URLSearchParams(location.hash.slice(1)).get('setup');
let authFeedback = new URLSearchParams(location.hash.slice(1)).get('authError');
if (location.hash) history.replaceState(null, '', '/');
state.auth = { captcha: { enabled: false }, providers: [] };
state.identities = { providers: [], linked: [] };
let captchaWidget = null;
let toastTimer;
function toast(message, error = false) { const el = $('#toast'); el.textContent = message; el.hidden = false; el.className = error ? 'error' : ''; clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, error ? 12000 : 6000); }
async function api(url, options = {}) {
  const response = await fetch(url, { credentials: 'same-origin', ...options, headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': state.csrf || '', ...options.headers } });
  const data = await response.json();
  if (!response.ok) { if (response.status === 401 && state.user) { state.user = null; loginScreen(false); } const error = new Error(data.error || 'İşlem tamamlanamadı.'); error.details = data.details; throw error; }
  return data;
}
const siteUrl = suffix => `/api/sites/${state.site.id}/${suffix}`;
const date = value => new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
const changed = () => state.doc && state.working ? Object.keys(state.working).filter(k => state.working[k] !== state.doc.values[k]) : [];
const dirty = () => window.studioFeatureDirty?.() || (state.view === 'structure' ? state.structureEditor?.isDirty() || false : changed().length > 0);
function leaveDraft() { return !dirty() || confirm('Kaydedilmemiş değişiklikleriniz var. Bu değişiklikleri bırakmak istiyor musunuz?'); }
window.addEventListener('beforeunload', event => { if (dirty()) { event.preventDefault(); event.returnValue = ''; } });

function loginScreen(setup) {
  $('#app').innerHTML = `<main id="main" class="auth"><section class="auth-story"><a class="wordmark" href="/"><span class="brand-icon">s.</span> studio<span class="wordmark-dot">●</span></a><div><div class="eyebrow">SİTELERİNİZ İÇİN BİR ÇALIŞMA ALANI</div><h1>Her ayrıntı,<br>yerli yerinde.</h1><p>İçeriği düzenleyin. Değişiklikleri gözden geçirin.<br>Hazır olduğunda bir sonraki adımı atın.</p><div class="auth-site"><span class="loft-icon">L</span><div><strong>Loft Pet House</strong><small>İlk çalışma alanınız</small></div><span class="pill dark">11 dil</span></div></div><span class="auth-foot">STUDIO / YEREL PİLOT <span>01</span></span></section><section class="auth-form"><div class="auth-card"><span class="pill"><i></i> Yalnızca bu bilgisayarda</span><h2>${setup ? 'Çalışma alanını açın.' : 'Tekrar hoş geldiniz.'}</h2><p>${setup ? 'İlk yönetici hesabınız için e-posta ve parola belirleyin.' : 'Devam etmek için hesabınızla giriş yapın.'}</p>${setup && !setupToken ? '<div class="notice">İlk kurulum için sunucunun terminalde gösterdiği tek kullanımlık bağlantıyı açın. Süresi dolduysa sunucuyu yeniden başlatın.</div>' : ''}<form id="login-form"><label>E-posta<input id="email" name="email" type="email" autocomplete="username" required placeholder="siz@ornek.com" maxlength="254"></label><label>Parola<input id="password" name="password" type="password" autocomplete="${setup ? 'new-password' : 'current-password'}" ${setup ? 'minlength="14"' : ''} maxlength="256" required placeholder="${setup ? 'En az 14 karakter' : 'Parolanız'}"></label>${setup ? '<label>Parolayı tekrar yazın<input id="password-confirm" type="password" autocomplete="new-password" minlength="14" maxlength="256" required></label>' : ''}<div id="auth-error" class="form-error" role="alert"></div><button class="button primary full" ${setup && !setupToken ? 'disabled' : ''}>${setup ? 'Yönetici hesabını oluştur' : 'Giriş yap'} <span>↗</span></button></form><p class="fine">${setup ? 'Bu hesap yalnızca yerel konsol içindir.' : 'Hesap erişimi site yöneticiniz tarafından tanımlanır.'} Canlı siteyle bağlantı kurulmaz.</p></div></section></main>`;
  mountAuthExtras(setup);
  $('#login-form').addEventListener('submit', async event => {
    event.preventDefault(); const button = event.submitter; button.disabled = true; $('#auth-error').textContent = '';
    try {
      const password = $('#password').value;
      if (setup && password !== $('#password-confirm').value) throw Error('Parolalar eşleşmiyor.');
      const result = await api(setup ? '/api/setup' : '/api/login', { method: 'POST', body: JSON.stringify({ email: $('#email').value, password, token: setupToken, captcha: captchaResponse() }) });
      setupToken = null; Object.assign(state, result); await loadApp();
    } catch (error) { $('#auth-error').textContent = error.message; button.disabled = false; resetCaptcha(); }
  });
}
function captchaResponse() { return state.auth.captcha.enabled ? window.grecaptcha?.getResponse(captchaWidget) || '' : undefined; }
function resetCaptcha() { if (captchaWidget !== null && window.grecaptcha) window.grecaptcha.reset(captchaWidget); }
function mountAuthExtras(setup) {
  if (state.auth.captcha.enabled) {
    $('#auth-error').insertAdjacentHTML('beforebegin', '<div id="captcha-widget" class="captcha-widget" aria-label="Google CAPTCHA doğrulaması"></div>');
    captchaWidget = null;
    window.onStudioCaptchaReady = () => {
      if ($('#captcha-widget') && captchaWidget === null) captchaWidget = window.grecaptcha.render('captcha-widget', { sitekey: state.auth.captcha.siteKey, 'expired-callback': () => toast('Google doğrulamasının süresi doldu. Yeniden doğrulayın.', true), 'error-callback': () => toast('Google doğrulaması yüklenemedi. Giriş tamamlanmadı.', true) });
    };
    if (window.grecaptcha?.render) window.onStudioCaptchaReady();
    else if (!$('#captcha-script')) { const script = document.createElement('script'); script.id = 'captcha-script'; script.src = 'https://www.google.com/recaptcha/api.js?onload=onStudioCaptchaReady&render=explicit&hl=tr'; script.async = true; script.defer = true; document.head.append(script); }
  }
  $('#login-form').insertAdjacentHTML('afterend', `<p class="security-hint">Hatalı girişler hesap ve IP bazında sınırlandırılır.${state.auth.captcha.enabled ? ' Google CAPTCHA etkin.' : ' Google CAPTCHA anahtarları henüz tanımlanmadı.'}</p>${!setup ? `<div class="social-divider">veya bağlı hesabınızla devam edin</div><div class="social-buttons">${state.auth.providers.map(p => `<button type="button" class="button" data-social-provider="${p.id}" ${p.enabled ? '' : 'disabled'}>${esc(p.name)} <span>${p.enabled ? '↗' : 'Kurulum bekliyor'}</span></button>`).join('')}</div><p class="fine">Dış hesabınızı önce yerel hesabınıza giriş yaparak Hesabım bölümünden bağlayın.</p>` : ''}`);
  document.querySelectorAll('[data-social-provider]').forEach(button => button.onclick = async () => {
    button.disabled = true;
    try { const result = await api(`/api/auth/${button.dataset.socialProvider}/start`, { method: 'POST', body: JSON.stringify({ captcha: captchaResponse() }) }); location.assign(result.url); }
    catch (e) { toast(e.message, true); button.disabled = false; resetCaptcha(); }
  });
  if (authFeedback) { $('#auth-error').textContent = authFeedback; authFeedback = null; }
}
async function loadApp() {
  state.sites = (await api('/api/sites')).sites;
  if (!state.sites.length) { $('#app').innerHTML = '<main id="main" class="empty"><h1>Henüz site erişiminiz yok.</h1><p>Yöneticinizden site üyeliği isteyin.</p><button id="logout" class="button">Çıkış yap</button></main>'; $('#logout').onclick = logout; return; }
  state.site = await api(`/api/sites/${state.sites[0].id}`);
  state.locale = state.site.defaultLocale; await loadDoc(); render();
}
async function loadDoc() { state.doc = await api(siteUrl(`documents/${state.locale}`)); state.working = { ...state.doc.values }; state.search = ''; state.offset = 0; }
async function logout() { if (state.busy || !leaveDraft()) return; await api('/api/logout', { method: 'POST', body: '{}' }); state.user = null; state.working = null; loginScreen(false); }
function render() {
  window.studioFeatureDirty=null;
  const site = state.site;
  $('#app').innerHTML = `<div class="shell"><aside class="sidebar"><a class="wordmark" href="/"><span class="brand-icon">s.</span> studio<span class="wordmark-dot">●</span></a><div class="workspace-label">ÇALIŞMA ALANI</div><label class="site-select"><span class="loft-icon">L</span><select id="site-select" aria-label="Site seçin">${state.sites.map(s => `<option value="${s.id}" ${s.id === site.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label><nav aria-label="Yönetim menüsü">${[['content', 'İçerik stüdyosu'], ['history', 'Değişiklik geçmişi'], ['preview', 'Önizleme & paket'], ...(site.role === 'admin' ? [['bookings','Rezervasyonlar'],['calendar','Takvim'],['bookingSettings','Rezervasyon ayarları'],['members', 'Erişim yönetimi']] : []), ['connect', 'Bağlantılar']].map(([view, label]) => `<button data-view="${view}" class="nav-item ${state.view === view ? 'active' : ''}" ${state.view === view ? 'aria-current="page"' : ''}><span>${icons[view]}</span>${label}${view === state.view ? '<b>•</b>' : ''}</button>`).join('')}</nav><div class="sidebar-bottom"><div class="local-note"><span class="local-light"></span><strong>Yerel çalışma alanı</strong><p>Değişiklikler taslakta kalır.<br>Canlı yayın yapılmaz.</p></div><button id="account" class="user-row"><span class="avatar">${esc(state.user.email[0].toUpperCase())}</span><span><strong>${site.role === 'admin' ? 'Site yöneticisi' : 'Editör'}</strong><small>${esc(state.user.email)}</small></span><span>⌄</span></button><button id="logout" class="logout">Güvenli çıkış ↗</button></div></aside><div class="workspace"><header class="topbar"><div><span>Siteler</span><span class="slash">/</span><strong>${esc(site.name)}</strong></div><div class="topbar-right"><span class="pill"><i></i> Yerel pilot</span><span class="avatar small">${esc(state.user.email[0].toUpperCase())}</span></div></header><main id="main" class="main">${state.view === 'content' ? contentView() : state.view === 'history' ? historyView() : state.view === 'preview' ? previewView() : state.view === 'members' ? membersView() : state.view === 'account' ? accountView() : connectionsView()}</main><footer class="workspace-footer"><span>STUDIO <b>·</b> LOFT PİLOTU</span><span>İyi içerik, özenle başlar.</span></footer></div></div>`;
  bindShell();
  if (state.view === 'content') bindContent();
  if (['bookings','calendar','bookingSettings','connect'].includes(state.view)) mountFeatures({container:$('#main'),view:state.view,site:state.site,api,toast,navigate});
  if (state.view === 'preview') bindPreview();
  if (state.view === 'members') bindMembers();
  if (state.view === 'account') { bindAccount(); mountIdentityPanel(); }
  if (state.view === 'structure') state.structureEditor = window.createStructureEditor({ container: '#main', document: state.layoutDoc, site: state.site, design:state.design, save: async input => { state.busy = true; try { return await api(siteUrl('structure'), { method: 'PUT', body: JSON.stringify(input) }); } finally { state.busy = false; } }, notify: toast, onSaved: result => { state.layoutDoc = { ...state.layoutDoc, ...result }; } });
}
function titleBlock(kicker, title, subtitle, action = '') { return `<div class="page-heading"><div><div class="eyebrow">${kicker}</div><h1>${title}</h1><p>${subtitle}</p></div>${action}</div>`; }
function languagesSelect(id = 'locale') { return `<label class="language-label">İçerik dili<select id="${id}">${state.site.languages.map(l => `<option value="${l.code}" ${state.locale === l.code ? 'selected' : ''}>${esc(l.name)}${l.code === 'tr' ? ' · Varsayılan' : ''}</option>`).join('')}</select></label>`; }
function contentView() {
  const selected = state.site.pages.find(p => p.id === state.page);
  return `${titleBlock('İÇERİK STÜDYOSU', 'İçeriğe son dokunuş.', 'Loft’un sesini her dilde özenle koruyun.', `<button class="button" id="go-preview">Önizlemeye geç <span>↗</span></button>`)}<div class="stats-strip"><div><span class="stat-icon">▤</span><strong>${state.site.pages.length}</strong><span>sayfa</span></div><div><span class="stat-icon">◎</span><strong>${state.site.languages.length}</strong><span>dil</span></div><div><span class="stat-icon">◷</span><strong id="revision-label">r${state.doc.revision}</strong><span>${state.site.languages.find(l => l.code === state.locale).name} taslağı</span></div><span class="draft-chip">● Taslak çalışma</span></div><div class="editor-layout"><aside class="page-list"><div class="small-heading">SAYFALAR <span>${state.site.pages.length.toString().padStart(2, '0')}</span></div>${state.site.pages.map((p, i) => `<button class="page-link ${p.id === state.page ? 'selected' : ''}" data-page="${p.id}"><span>${(i + 1).toString().padStart(2, '0')}</span>${esc(p.name)}${p.id === state.page ? '<b>↗</b>' : ''}</button>`).join('')}<div class="page-note">Ortak metinler ve görsel alt metinleri birden fazla sayfada kullanılabilir.</div></aside><section class="editor"><div class="editor-head"><div><div class="eyebrow">${state.page === 'home' ? 'ANA SAYFA' : 'SAYFA'}</div><h2>${esc(selected.name)}</h2></div>${languagesSelect()}</div><div class="tabs" role="tablist" aria-label="İçerik türü">${[['seo', 'Arama görünümü'], ['content', 'İçerik metinleri'], ['images', 'Görsel alt metinleri']].map(([id, name]) => `<button role="tab" aria-selected="${id === state.group}" data-group="${id}" class="${id === state.group ? 'selected' : ''}">${name}</button>`).join('')}</div><div class="editor-body"><div class="editor-description">${state.group === 'seo' ? 'Arama sonuçlarında görünecek başlık ve açıklamayı düzenleyin.' : state.group === 'content' ? 'Sayfa ek metinleri ve sitede ortak kullanılan metinler. Bir anahtarın değişmesi, kullanıldığı tüm alanları günceller.' : 'Fotoğrafın içeriğini anlatan kısa ve anlaşılır metinler yazın. Alt metinler bu dilde site genelinde kullanılır.'}</div>${state.group !== 'seo' ? '<label class="search-label"><span>⌕</span><input id="field-search" type="search" placeholder="Metin veya anahtarda ara…" aria-label="Metin ara"></label>' : ''}<div id="fields">${fieldsView()}</div></div></section><aside class="inspector"><div class="small-heading">ARAMA ÖNİZLEMESİ <span>↗</span></div><div class="serp"><div class="serp-brand"><span class="serp-logo">L</span><div><b>Loft Pet House</b><small>https://loftpethouse.com</small></div></div><div id="serp-title" class="serp-title">${esc(state.working[`title:${state.page}`])}</div><p id="serp-description">${esc(state.working[`seo:desc.${state.page}`])}</p></div><p class="hint">Arama motorları başlık ve açıklamayı farklı gösterebilir.</p><div class="inspector-divider"></div><div class="small-heading">ÇALIŞMA DURUMU</div><div class="state-line"><span>Kayıtlı sürüm</span><strong id="saved-revision">r${state.doc.revision}</strong></div><div class="state-line"><span>Kaydedilmemiş alan</span><strong id="dirty-count">${changed().length}</strong></div><div class="notice"><b>Önce taslak, sonra önizleme.</b><p>Kaydettiğiniz içerik yalnızca konsolda tutulur. Paketi üretmek ayrı bir adımdır.</p></div><div id="validation" class="validation" aria-live="polite"></div></aside></div><form id="save-form" class="savebar"><label>Değişiklik notu<input id="change-note" placeholder="Örn. Ana sayfa açıklamasını güncelledim" minlength="3" maxlength="500" required></label><span id="save-status" class="save-status">${dirty() ? `${changed().length} alan kaydedilmedi` : 'Tüm değişiklikler kayıtlı'}</span><button type="button" id="validate" class="button subtle">Kontrol et</button><button type="submit" id="save" class="button primary" ${!dirty() ? 'disabled' : ''}>Taslağı kaydet <span>↗</span></button></form>`;
}
function visibleFields() {
  const needle = state.search.toLocaleLowerCase('tr');
  return state.site.fields.filter(f => f.group === state.group && (state.group !== 'seo' || f.page === state.page) && (state.group !== 'content' || f.page === state.page || f.page === 'shared') && (!needle || `${f.label} ${f.id} ${state.working[f.id]}`.toLocaleLowerCase('tr').includes(needle))).sort((a,b) => Number(b.type === 'title') - Number(a.type === 'title'));
}
function fieldsView() {
  const fields = visibleFields(), paged = state.group === 'seo' ? fields : fields.slice(state.offset, state.offset + 12);
  return `${paged.map(f => `<div class="field ${f.type === 'alt' ? 'image-field' : ''}">${f.asset ? `<img src="/assets/${state.site.id}/${f.asset}" alt="${esc(state.doc.baseline[f.id])}" loading="lazy">` : ''}<div class="field-body"><label for="f-${f.id}"><span>${esc(f.label)}</span><small>${f.type === 'text' ? esc(f.id) : f.type === 'alt' ? esc(f.key) : 'SEO'}</small></label><textarea id="f-${f.id}" data-field="${f.id}" ${f.rich ? 'data-rich="true"' : ''} maxlength="${f.max}" rows="${f.type === 'title' ? 2 : f.type === 'description' || f.type === 'alt' ? 4 : 3}" dir="${state.site.languages.find(l => l.code === state.locale).dir}" ${f.type === 'title' ? 'class="title-input"' : ''}>${esc(state.working[f.id])}</textarea><div class="field-footer"><span>${f.type === 'title' ? 'Öneri: yaklaşık 30–65 karakter' : f.type === 'description' ? 'Öneri: yaklaşık 120–160 karakter' : f.rich ? 'Güvenli HTML · Hizalama ve biçimlendirme' : 'SEO / erişilebilirlik alanı · Düz metin'}</span><span data-count="${f.id}">${state.working[f.id].length} / ${f.max}</span></div></div></div>`).join('') || '<div class="empty compact">Aramanıza uygun metin bulunamadı.</div>'}${state.group !== 'seo' ? `<div class="pagination"><span>${fields.length} alan · ${fields.length ? state.offset + 1 : 0}–${Math.min(state.offset + 12, fields.length)}</span><div><button class="button small-button" type="button" id="prev-fields" ${state.offset === 0 ? 'disabled' : ''}>← Önceki</button><button class="button small-button" type="button" id="next-fields" ${state.offset + 12 >= fields.length ? 'disabled' : ''}>Sonraki →</button></div></div>` : ''}`;
}
function updateStatus() {
  $('#dirty-count').textContent = changed().length; $('#save-status').textContent = dirty() ? `${changed().length} alan kaydedilmedi` : 'Tüm değişiklikler kayıtlı'; $('#save').disabled = !dirty() || state.busy;
  $('#serp-title').textContent = state.working[`title:${state.page}`]; $('#serp-description').textContent = state.working[`seo:desc.${state.page}`];
}
function bindFields() {
  mountRich($('#fields'));
  document.querySelectorAll('[data-field]').forEach(el => el.addEventListener('input', () => { state.working[el.dataset.field] = el.value; document.querySelector(`[data-count="${el.dataset.field}"]`).textContent = `${el.value.length} / ${el.maxLength}`; updateStatus(); }));
  if ($('#prev-fields')) $('#prev-fields').onclick = () => { state.offset -= 12; $('#fields').innerHTML = fieldsView(); bindFields(); };
  if ($('#next-fields')) $('#next-fields').onclick = () => { state.offset += 12; $('#fields').innerHTML = fieldsView(); bindFields(); };
}
function bindContent() {
  $('#go-preview').onclick = () => navigate('preview');
  document.querySelectorAll('[data-page]').forEach(el => el.onclick = () => { state.page = el.dataset.page; state.offset = 0; renderPreservingNote(); });
  document.querySelectorAll('[data-group]').forEach(el => el.onclick = () => { state.group = el.dataset.group; state.search = ''; state.offset = 0; renderPreservingNote(); });
  $('#locale').onchange = async event => { const code = event.target.value; if (state.busy || !leaveDraft()) { event.target.value = state.locale; return; } try { state.locale = code; await loadDoc(); render(); } catch (e) { toast(e.message, true); } };
  if ($('#field-search')) $('#field-search').oninput = event => { state.search = event.target.value; state.offset = 0; $('#fields').innerHTML = fieldsView(); bindFields(); };
  bindFields();
  $('#validate').onclick = async () => {
    try { const result = await api(siteUrl(`documents/${state.locale}/validate`), { method: 'POST', body: JSON.stringify({ values: state.working }) }); $('#validation').innerHTML = `<strong>${result.valid ? '✓ Taslak doğrulandı' : 'Taslakta hata var'}</strong><p>${esc([...result.errors, ...result.warnings].join('\n') || 'Alanlar ve sayfa başlıkları uygun.')}</p>`; } catch (e) { toast(e.message, true); }
  };
  $('#save-form').onsubmit = async event => {
    event.preventDefault(); if (state.busy) return; state.busy = true; updateStatus();
    try {
      const submitted = { ...state.working };
      const result = await api(siteUrl(`documents/${state.locale}`), { method: 'PUT', body: JSON.stringify({ revision: state.doc.revision, values: submitted, note: $('#change-note').value }) });
      state.doc = { ...state.doc, values: result.values, revision: result.revision };
      $('#revision-label').textContent = `r${result.revision}`; $('#saved-revision').textContent = `r${result.revision}`; $('#change-note').value = '';
      toast(`Taslak kaydedildi · r${result.revision}. Canlı site değişmedi.`);
    } catch (e) { toast(`${e.message}${e.details?.errors ? ' ' + e.details.errors[0] : ''}`, true); }
    finally { state.busy = false; if ($('#save')) updateStatus(); }
  };
}
function renderPreservingNote() { const note = $('#change-note')?.value || ''; render(); if ($('#change-note')) $('#change-note').value = note; }
function historyView() {
  return `${titleBlock('DEĞİŞİKLİK GEÇMİŞİ', 'Her değişikliğin bir izi var.', 'Son 100 kayıt. Kim, hangi dilde, neyi değiştirdi?')}<section class="panel">${state.history.length ? state.history.map(h => `<details class="history-item"><summary><span class="history-dot"></span><div><strong>${esc(h.note)}</strong><span>${esc(h.actor)} · ${esc(h.locale.toUpperCase())} · r${h.revision} · ${h.changes.length} alan</span></div><time>${date(h.created)}</time><b>⌄</b></summary><div class="diff-list">${h.changes.map(c => `<div class="diff"><code>${esc(c.field)}</code><div class="before"><small>ÖNCE</small>${esc(c.before)}</div><div class="after"><small>SONRA</small>${esc(c.after)}</div></div>`).join('')}</div></details>`).join('') : '<div class="empty"><span>◷</span><h2>Henüz bir değişiklik yok.</h2><p>İlk taslağınızı kaydettiğinizde, önceki ve yeni metinler burada görünecek.</p></div>'}</section>`;
}
function previewView() {
  const build = state.builds.find(b => b.status === 'ready');
  const previewPages = (build ? build.pages || state.site.pages : state.site.previewPages || state.site.pages).filter(p => !p.languages || p.languages.includes(state.locale));
  const selectedPage = previewPages.find(p => p.id === state.page) || previewPages[0];
  state.page = selectedPage.id;
  const route = selectedPage.route;
  const previewPath = state.locale === 'tr' ? route : `${state.locale}/${route.replace(/^tr\//, '')}`;
  return `${titleBlock('ÖNİZLEME & PAKET', 'Yayından önce görün.', 'Aktif sayfaları ve kaydedilmiş çevirileri siteye dönüştürün.')}<div class="build-actions"><div><span class="step">01</span><h3>İnceleyin</h3><p>Seçtiğiniz dil ve sayfayı gerçek site görünümünde kontrol edin.</p><button id="build-preview" class="button primary" ${state.busy ? 'disabled' : ''}>${state.busy ? 'Sayfalar hazırlanıyor…' : 'Yeni önizleme oluştur'} <span>↗</span></button></div><div><span class="step">02</span><h3>Paketi hazırlayın</h3><p>Üretim kontrollerinden geçen statik dosyaları ZIP olarak alın.</p><button id="build-package" class="button" ${state.busy || state.site.role !== 'admin' ? 'disabled' : ''}>Natro paketi oluştur <span>↓</span></button>${state.site.role !== 'admin' ? '<small>Yalnızca site yöneticisi paket oluşturabilir ve indirebilir.</small>' : ''}</div><aside><span class="pill">Yayın yapılmaz</span><p>Paket üretmek canlı siteyi değiştirmez. Natro’ya yükleme, paketi inceledikten sonra ayrıca yapılır.</p></aside></div>${state.busy ? '<div class="notice build-progress" role="status">Üretim sürüyor. Kaydedilmiş taslaklar doğrulanıyor ve aktif sayfalar hazırlanıyor…</div>' : ''}${build ? `<section class="panel preview-panel"><div class="preview-toolbar"><div><strong>Son hazır önizleme</strong><small>${date(build.created)} · ${build.pageCount} sayfa · ${esc(build.kind === 'package' ? 'Paket' : 'Önizleme')}</small></div><div>${languagesSelect('preview-locale')}<label>Sayfa<select id="preview-page">${previewPages.map(p => `<option value="${p.id}" ${p.id === state.page ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label><a class="button small-button" href="/preview/${state.site.id}/${build.id}/${previewPath}" target="_blank" rel="noopener">Ayrı aç ↗</a></div></div><div class="snapshot-note">Bu önizleme ${state.locale.toUpperCase()} r${build.versions[state.locale]} sürümünden üretildi. Sonraki kayıtlar için yeniden oluşturun.</div><iframe title="Loft Pet House taslak önizlemesi" src="/preview/${state.site.id}/${build.id}/${previewPath}" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe></section>` : '<section class="panel empty"><span>↗</span><h2>İlk bakışa hazır mısınız?</h2><p>Önizleme oluşturduğunuzda siteniz burada görünecek.</p></section>'}<section class="panel build-list"><div class="section-label">SON ÜRETİMLER <span>${state.builds.length}</span></div>${state.builds.map(b => `<div class="build-row"><span class="build-symbol">${b.kind === 'package' ? '▣' : '↗'}</span><div><strong>${b.kind === 'package' ? 'Natro statik paketi' : 'Site önizlemesi'}</strong><small>${date(b.created)} · ${esc(b.actor)}</small>${b.sha256 ? `<code title="SHA-256">SHA-256 ${b.sha256.slice(0, 20)}…</code>` : ''}${b.error ? `<small class="form-error">${esc(b.error)}</small>` : ''}</div><span class="pill ${b.status === 'failed' ? 'danger' : ''}">${b.status === 'ready' ? `${b.pageCount} sayfa · Hazır` : b.status === 'building' ? 'Üretiliyor' : 'Başarısız'}</span>${b.downloadUrl && state.site.role === 'admin' ? `<a class="button small-button" href="${b.downloadUrl}">ZIP indir ↓</a>` : ''}</div>`).join('') || '<p class="hint">Henüz bir üretim yapılmadı.</p>'}</section>`;
}
function bindPreview() {
  for (const kind of ['preview', 'package']) $(`#build-${kind}`).onclick = async () => {
    if (state.busy) return; state.busy = true; render();
    try { await api(siteUrl('builds'), { method: 'POST', body: JSON.stringify({ kind }) }); toast(kind === 'package' ? 'Natro paketi hazır. ZIP dosyasını indirebilirsiniz.' : 'Önizleme hazır.'); }
    catch (e) { toast(e.message, true); }
    finally { state.busy = false; state.builds = (await api(siteUrl('builds'))).builds; render(); }
  };
  if ($('#preview-locale')) $('#preview-locale').onchange = event => { state.locale = event.target.value; render(); };
  if ($('#preview-page')) $('#preview-page').onchange = event => { state.page = event.target.value; render(); };
}
function membersView() {
  return `${titleBlock('ERİŞİM YÖNETİMİ', 'Doğru kişiye, doğru yetki.', 'Bu sitedeki erişimler sunucu tarafından denetlenir.')}<div class="two-columns"><section class="panel"><div class="section-label">SİTE ÜYELERİ <span>${state.members.length}</span></div>${state.members.map(m => `<div class="member-row"><span class="avatar">${esc(m.email[0].toUpperCase())}</span><div><strong>${esc(m.email)}</strong><small>${m.role === 'admin' ? 'Yönetici · Düzenleme, paket ve üyelik' : 'Editör · Düzenleme ve önizleme'}</small></div>${m.id !== state.user.id ? `<button data-remove-member="${m.id}" class="button small-button">Erişimi kaldır</button>` : '<span class="pill">Siz</span>'}</div>`).join('')}<div class="notice">Üyelik yalnızca bu site için geçerlidir. Yönetici paketi indirir ve üyeleri yönetir; editör taslak düzenler ve önizleme oluşturur.</div></section><section class="panel padded"><h2>Siteye üye ekleyin</h2><form id="member-form"><label>E-posta<input id="member-email" type="email" required autocomplete="off"></label><label>Rol<select id="member-role"><option value="editor">Editör</option><option value="admin">Yönetici</option></select></label><label>İlk parola<input id="member-password" type="password" minlength="14" maxlength="256" autocomplete="new-password" placeholder="Yeni hesap için en az 14 karakter"></label><p class="hint">Konsolda zaten hesabı olan kişilerin parolası değişmez. Davet e-postası gönderilmez. Yeni kullanıcı parolasını Hesabım bölümünden değiştirebilir.</p><button class="button primary full">Site erişimi ver ↗</button></form></section></div>`;
}
function bindMembers() {
  $('#member-form').onsubmit = async event => { event.preventDefault(); const button = event.submitter; button.disabled = true;
    try { await api(siteUrl('members'), { method: 'POST', body: JSON.stringify({ email: $('#member-email').value, password: $('#member-password').value, role: $('#member-role').value }) }); state.members = (await api(siteUrl('members'))).members; render(); toast('Site erişimi tanımlandı.'); } catch (e) { toast(e.message, true); button.disabled = false; } };
  document.querySelectorAll('[data-remove-member]').forEach(el => el.onclick = async () => { if (!confirm('Bu kişinin bu siteye erişimi kaldırılsın mı?')) return; try { await api(siteUrl(`members/${el.dataset.removeMember}`), { method: 'DELETE', body: '{}' }); state.members = (await api(siteUrl('members'))).members; render(); toast('Site erişimi kaldırıldı.'); } catch (e) { toast(e.message, true); } });
}
function accountView() { return `${titleBlock('HESABIM', 'Hesabınızın kontrolü sizde.', esc(state.user.email))}<section class="panel padded account-panel"><h2>Parolanızı değiştirin</h2><form id="password-form"><label>Mevcut parola<input id="current-password" type="password" autocomplete="current-password" required maxlength="256"></label><label>Yeni parola<input id="new-password" type="password" autocomplete="new-password" minlength="14" maxlength="256" required></label><label>Yeni parolayı tekrarlayın<input id="repeat-password" type="password" autocomplete="new-password" minlength="14" maxlength="256" required></label><p class="hint">En az 14 karakter kullanın. Parola değişikliği diğer oturumlarınızı kapatır.</p><button class="button primary">Parolayı değiştir ↗</button></form></section>`; }
function bindAccount() { $('#password-form').onsubmit = async event => { event.preventDefault(); const button = event.submitter; button.disabled = true; try { if ($('#new-password').value !== $('#repeat-password').value) throw Error('Parolalar eşleşmiyor.'); const result = await api('/api/password', { method: 'POST', body: JSON.stringify({ currentPassword: $('#current-password').value, password: $('#new-password').value }) }); Object.assign(state, result); render(); toast('Parolanız değiştirildi. Diğer oturumlar kapatıldı.'); } catch (e) { toast(e.message, true); button.disabled = false; } }; }
function mountIdentityPanel() {
  $('#main').insertAdjacentHTML('beforeend', `<section class="panel padded account-panel identity-panel"><h2>Bağlı giriş hesapları</h2><p class="hint">Dış hesap bağlamak site yetkilerinizi değiştirmez. E-posta adresine göre otomatik birleştirme yapılmaz.</p><label>Bağlama / ayırma için mevcut yerel parolanız<input id="identity-password" type="password" autocomplete="current-password" maxlength="256"></label><div class="identity-list">${state.identities.providers.map(p => `<div class="identity-row"><div><strong>${esc(p.name)}</strong><small>${state.identities.linked.includes(p.id) ? 'Hesabınıza bağlı' : p.enabled ? 'Yapılandırılmış · Bağlanabilir' : 'Sağlayıcı kurulumu bekliyor'}</small></div><button class="button small-button" data-identity="${p.id}" data-action="${state.identities.linked.includes(p.id) ? 'unlink' : 'link'}" ${!p.enabled && !state.identities.linked.includes(p.id) ? 'disabled' : ''}>${state.identities.linked.includes(p.id) ? 'Bağlantıyı kaldır' : 'Hesabı bağla ↗'}</button></div>`).join('')}</div><p class="hint">Yerel parola girişi kullanılmaya devam eder. Sağlayıcıların gerçek anahtarları tanımlanmadan dış bağlantı kurulmaz.</p></section>`);
  document.querySelectorAll('[data-identity]').forEach(button => button.onclick = async () => {
    button.disabled = true;
    try {
      const result = await api(`/api/identities/${button.dataset.identity}/${button.dataset.action}`, { method: 'POST', body: JSON.stringify({ password: $('#identity-password').value }) });
      if (result.url) location.assign(result.url); else { state.identities = await api('/api/identities'); render(); toast('Dış hesap bağlantısı kaldırıldı. Diğer oturumlar kapatıldı.'); }
    } catch (e) { toast(e.message, true); button.disabled = false; }
  });
}
function connectionsView() { return `${titleBlock('BAĞLANTILAR', 'Bir sonraki adım için yer var.', 'İçerik yönetiminden ölçümlemeye, adım adım.')}<div class="integration-grid">${[['G', 'Search Console', 'Arama performansı ve indeksleme'], ['◴', 'Google Analytics 4', 'Ziyaret ve davranış raporları'], ['◇', 'Google Tag Manager', 'Etiket ve ölçüm bağlantıları']].map(([icon, title, desc]) => `<section class="panel integration"><span class="integration-icon">${icon}</span><h2>${title}</h2><p>${desc}</p><span class="pill">Bağlı değil</span><div class="integration-note">Bu pilotta entegrasyon uygulanmadı. Gerçek hesap yetkilendirmesi ve Google erişimi gerekir.</div></section>`).join('')}</div><div class="notice roadmap"><b>Sonraki aşamalar</b><p>MFA, yayın onayı ve geri alma, kapsamlı denetim kaydı ve ikinci site doğrulaması ayrı geliştirme adımlarıdır.</p></div>`; }
async function navigate(view) {
  if (state.busy) { toast('Süren işlem tamamlandıktan sonra devam edin.'); return; }
  if (!leaveDraft()) return;
  try {
    if (view === 'content') await loadDoc();
    if (view === 'content' && !state.site.pages.some(p => p.id === state.page)) state.page = 'home';
    if (view === 'structure') {state.layoutDoc = await api(siteUrl('structure'));state.design=await api(siteUrl('design'));}
    if (view === 'history') state.history = (await api(siteUrl('history'))).history;
    if (view === 'preview') { state.builds = (await api(siteUrl('builds'))).builds; state.site = await api(`/api/sites/${state.site.id}`); }
    if (view === 'members') state.members = (await api(siteUrl('members'))).members;
    if (view === 'account') state.identities = await api('/api/identities');
    state.working = state.view === 'content' && view !== 'content' ? { ...state.doc.values } : state.working;
    state.view = view; render(); window.scrollTo(0, 0);
  } catch (e) { toast(e.message, true); }
}
function bindShell() {
  if (state.site.role === 'admin') document.querySelector('[data-view="content"]').insertAdjacentHTML('afterend', `<button data-view="structure" class="nav-item ${state.view === 'structure' ? 'active' : ''}"><span>▧</span>Sayfalar & tasarım</button>`);
  document.querySelectorAll('[data-view]').forEach(el => el.onclick = () => navigate(el.dataset.view));
  $('#logout').onclick = logout; $('#account').onclick = () => navigate('account');
  const avatar = $('.topbar-right .avatar'), accountButton = document.createElement('button'); accountButton.className = 'avatar small account-trigger'; accountButton.textContent = avatar.textContent; accountButton.setAttribute('aria-label', 'Hesabım'); avatar.replaceWith(accountButton); accountButton.onclick = () => navigate('account');
  $('#site-select').onchange = async event => { if (state.busy || !leaveDraft()) { event.target.value = state.site.id; return; } try { state.site = await api(`/api/sites/${event.target.value}`); state.locale = state.site.defaultLocale; state.page = state.site.pages[0].id; state.view = 'content'; await loadDoc(); render(); } catch (e) { toast(e.message, true); } };
}
async function start() {
  try { const status = await api('/api/status'); state.auth = await api('/api/auth/options'); if (status.setupRequired) return loginScreen(true);
    try { Object.assign(state, await api('/api/me')); await loadApp(); if (authFeedback) { toast(authFeedback, true); authFeedback = null; } } catch { loginScreen(false); }
  } catch (e) { $('#app').innerHTML = `<main id="main" class="empty"><h1>Konsola ulaşılamadı.</h1><p>${esc(e.message)}</p><a href="/" class="button">Tekrar dene</a></main>`; }
}
start();
