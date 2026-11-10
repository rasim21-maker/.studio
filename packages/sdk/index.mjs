// Browser-safe public contract. Server and generated forms share these rules.
export const API_VERSION = 1;
export function fail(status, message, details) {
  throw Object.assign(new Error(message), {status, details});
}
export const field = (label, type = 'text', options = {}) => ({label, type, ...options});
export const currencyField = () => field('Para birimi', 'enum', {required: true, values: ['TRY', 'EUR', 'USD', 'GBP'], default: 'TRY'});
const identifier = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/;
const key = /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/;
const kinds = new Set(['text', 'textarea', 'email', 'url', 'path', 'number', 'boolean', 'enum', 'date', 'datetime', 'reference', 'items']);
export function checkFields(fields, depth = 0) {
  if (!fields || typeof fields !== 'object' || Array.isArray(fields) || depth > 3) fail(422, 'Alan şeması geçersiz.');
  for (const [name, f] of Object.entries(fields)) {
    if (!key.test(name) || ['constructor', 'prototype', '__proto__'].includes(name) || !kinds.has(f.type) || typeof f.label !== 'string') fail(422, 'Alan tanımı geçersiz: ' + name);
    for(const bound of ['min','max','step','minLength','maxLength','minItems','maxItems'])if(f[bound]!==undefined&&(!Number.isFinite(f[bound])||(['minLength','maxLength','minItems','maxItems'].includes(bound)&&(!Number.isSafeInteger(f[bound])||f[bound]<0))))fail(422,'Alan sınırı geçersiz: '+name);
    if(f.step!==undefined&&f.step<=0||f.minLength!==undefined&&f.maxLength!==undefined&&f.minLength>f.maxLength||f.minItems!==undefined&&f.maxItems!==undefined&&f.minItems>f.maxItems)fail(422,'Alan aralığı geçersiz: '+name);
    if (f.min !== undefined && f.max !== undefined && f.min > f.max) fail(422, 'Minimum maksimumdan büyük: ' + name);
    if (f.type === 'enum' && (!Array.isArray(f.values) || !f.values.length || f.values.some(v => typeof v !== 'string'))) fail(422, 'Sözlük gerekli: ' + name);
    if (f.type === 'reference' && !key.test(f.collection || '')) fail(422, 'İlişki koleksiyonu gerekli.');
    if (f.type === 'items') checkFields(f.fields, depth + 1);
  }
}
export function validateFields(fields, input) {
  const errors = [], value = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {value, errors: [{path: '', message: 'Bir alan nesnesi gerekli.'}]};
  for (const name of Object.keys(input)) if (!Object.hasOwn(fields, name)) errors.push({path: name, message: 'Tanımsız alan.'});
  for (const [name, f] of Object.entries(fields)) {
    let v = Object.hasOwn(input, name) ? input[name] : f.default;
    const error = message => errors.push({path: name, message});
    if (v === undefined || v === null || v === '') {
      if (f.required) error('Bu alan gerekli.');
      continue;
    }
    if (f.type === 'number') {
      if (typeof v !== 'number' || !Number.isFinite(v) || (f.integer !== false && !Number.isSafeInteger(v)) || (f.min !== undefined && v < f.min) || (f.max !== undefined && v > f.max) || (f.step && Math.abs((v - (f.min || 0)) / f.step - Math.round((v - (f.min || 0)) / f.step)) > 1e-8)) error('Sayı, sınır veya adım geçersiz.');
    } else if (f.type === 'boolean') {
      if (typeof v !== 'boolean') error('Evet/hayır değeri gerekli.');
    } else if (f.type === 'items') {
      if (!Array.isArray(v) || v.length < (f.minItems ?? 0) || v.length > (f.maxItems ?? 100)) error('Liste uzunluğu geçersiz.');
      else v = v.map((item, i) => {const result = validateFields(f.fields, item); errors.push(...result.errors.map(e => ({path: `${name}.${i}.${e.path}`, message: e.message}))); return result.value;});
    } else if (typeof v !== 'string') error('Metin gerekli.');
    else {
      v = v.normalize('NFC').trim();
      if (f.normalize === 'lowercase') v = v.toLowerCase();
      if ((f.required && !v.length) || v.length < (f.minLength ?? 0) || v.length > (f.maxLength ?? 4000) || /[<>\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v)) error('Metin uzunluğu veya karakterleri geçersiz.');
      if (f.type === 'enum' && !f.values.includes(v)) error('Sözlükten bir değer seçin.');
      if (f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) error('Geçerli bir e-posta girin.');
      if (f.type === 'reference' && !/^[a-zA-Z0-9_-]{1,80}$/.test(v)) error('Kayıt kimliği geçersiz.');
      if (f.type === 'path' && (!/^\/(?!\/)[a-zA-Z0-9_/.~-]*$/.test(v) || v.split('/').includes('..'))) error('Site içi / ile başlayan yol girin.');
      if (f.type === 'url') {try {const u = new URL(v); if (u.protocol !== 'https:' || u.username || u.password || /[\s\\]/.test(v)) throw Error();} catch {error('Kimlik bilgisi içermeyen HTTPS adresi girin.');}}
      if (f.type === 'date' && (!/^\d{4}-\d{2}-\d{2}$/.test(v) || !Number.isFinite(Date.parse(v)) || new Date(v).toISOString().slice(0, 10) !== v)) error('Geçerli tarih girin.');
      if (f.type === 'datetime' && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(Z|[+-]\d{2}:\d{2})$/.test(v) || !Number.isFinite(Date.parse(v)) || !Number.isFinite(Date.parse(v.slice(0,10))) || new Date(v.slice(0,10)).toISOString().slice(0,10)!==v.slice(0,10))) error('Saat dilimi içeren ISO tarih/saat girin.');
    }
    value[name] = v;
  }
  return {value, errors};
}
export function parseFields(fields, input) {
  const result = validateFields(fields, input);
  if (result.errors.length) fail(422, 'Alanları kontrol edin.', result.errors);
  return result.value;
}
export function defineModule(definition) {
  const m = definition.manifest;
  if (!m || !identifier.test(m.id) || !/^\d+\.\d+\.\d+$/.test(m.version) || m.apiVersion !== API_VERSION || !Number.isSafeInteger(m.schemaVersion) || m.schemaVersion < 1 || typeof m.name !== 'string') fail(422, 'Modül bildirimi veya SDK sürümü geçersiz.');
  if (!Array.isArray(m.permissions) || !m.permissions.length || m.permissions.some(p=>typeof p!=='string'||!/^\w[\w.-]*$/.test(p)) || new Set(m.permissions).size!==m.permissions.length) fail(422, 'Modül izinleri gerekli.');
  if(m.services&&(!Array.isArray(m.services)||m.services.some(s=>typeof s!=='string'||!identifier.test(s))))fail(422,'Servis izinleri geçersiz.');
  if(m.dependencies!==undefined&&(!m.dependencies||typeof m.dependencies!=='object'||Array.isArray(m.dependencies)||Object.entries(m.dependencies).some(([id,major])=>!identifier.test(id)||!Number.isSafeInteger(major)||major<0)))fail(422,'Modül bağımlılıkları geçersiz.');
  for (const [id, c] of Object.entries(definition.collections || {})) {if (!key.test(id)) fail(422, 'Koleksiyon kimliği geçersiz.'); checkFields(c.fields);}
  for (const [id, command] of Object.entries(definition.commands || {})) {
    if (!key.test(id) || typeof command.run !== 'function' || !m.permissions.includes(command.permission)) fail(422, 'Komut tanımı geçersiz.');
    checkFields(command.fields || {});
  }
  for (const c of Object.values(definition.collections || {})) if (!m.permissions.includes(c.permission)) fail(422, 'Koleksiyon izni bildirilmemiş.');
  for (const [type, event] of Object.entries(definition.events || {})) {
    if (!/^[a-z][a-zA-Z0-9_.-]{0,99}$/.test(type) || !Number.isSafeInteger(event.version) || event.version < 1) fail(422, 'Olay sözleşmesi geçersiz.');
    checkFields(event.fields);
  }
  if (definition.eventSource && typeof definition.eventSource.read !== 'function') fail(422, 'Olay kaynağı geçersiz.');
  const migrations = definition.migrations || [];
  if (migrations.length !== m.schemaVersion || migrations.some((v, i) => v.version !== i + 1 || typeof v.up !== 'function')) fail(422, 'Sıralı veri geçişleri gerekli.');
  return definition;
}

// Optional integrations activate only when every required module is enabled.
export function defineIntegration(d) {
  if (!d || !identifier.test(d.id) || !/^\d+\.\d+\.\d+$/.test(d.version) || typeof d.name !== 'string' || !d.requires || Object.keys(d.requires).length < 2) fail(422, 'Entegrasyon bildirimi geçersiz.');
  for (const [id, major] of Object.entries(d.requires)) if (!identifier.test(id) || !Number.isSafeInteger(major) || major < 0) fail(422, 'Entegrasyon bağımlılığı geçersiz.');
  if (!Array.isArray(d.permissions) || !d.permissions.length || d.permissions.some(p => typeof p !== 'string' || !/^\w[\w.-]*$/.test(p))) fail(422, 'Entegrasyon izinleri gerekli.');
  if (!Array.isArray(d.subscriptions)) fail(422, 'Olay abonelikleri gerekli.');
  const subscriptions = new Set();
  for (const s of d.subscriptions) {
    const id = s.module + ':' + s.type;
    if (!Object.hasOwn(d.requires, s.module) || !/^[a-z][a-zA-Z0-9_.-]{0,99}$/.test(s.type) || !Number.isSafeInteger(s.version) || s.version < 1 || typeof s.run !== 'function' || subscriptions.has(id)) fail(422, 'Olay aboneliği geçersiz.');
    subscriptions.add(id);
  }
  for (const [id, c] of Object.entries(d.collections || {})) {
    if (!key.test(id)) fail(422, 'Entegrasyon koleksiyonu geçersiz.'); checkFields(c.fields);
    const references=(fields,depth=0)=>{for(const f of Object.values(fields)){if(f.type==='reference'&&(depth>0||!Object.hasOwn(d.requires,f.module)))fail(422,'Entegrasyon ilişkisi üst düzeyde ve bildirilen modüle ait olmalı.');if(f.type==='items')references(f.fields,depth+1);}};
    references(c.fields);
  }
  for (const [id, c] of Object.entries(d.commands || {})) {if (!key.test(id) || typeof c.run !== 'function') fail(422, 'Entegrasyon komutu geçersiz.');checkFields(c.fields || {});}
  for (const v of d.views || []) {
    if (!key.test(v.id) || !Object.hasOwn(d.requires, v.module) || !key.test(v.collection) || v.kind !== 'relatedTimeline' || typeof v.label !== 'string' || !d.commands?.[v.command] || d.commands[v.command].write !== false || !Object.hasOwn(d.commands[v.command].fields || {}, v.contextField)) fail(422, 'Entegrasyon görünümü geçersiz.');
    for (const action of ['linkCommand','unlinkCommand']) if (v[action] && (!d.commands[v[action]] || !Object.hasOwn(d.commands[v[action]].fields || {}, v.contextField) || !Object.hasOwn(d.commands[v[action]].fields || {}, v.linkField))) fail(422, 'Görünüm işlemi geçersiz.');
  }
  return d;
}
