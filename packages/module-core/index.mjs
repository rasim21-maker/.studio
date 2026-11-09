import {randomUUID} from 'node:crypto';
import {defineModule, fail, parseFields} from '@loft-studio/sdk';

const json = JSON.stringify;
const now = () => new Date().toISOString();
const validId = v => typeof v === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(v);
const unpack = row => row && ({id: row.id, revision: row.revision, data: JSON.parse(row.data), created: row.created, updated: row.updated});
const sync = result => {if (result && typeof result.then === 'function') fail(500, 'Veri geçişleri ve işlemler senkron olmalı.'); return result;};

/** Trusted server packages only. This host is not an arbitrary-code sandbox. */
export class ModuleHost {
  constructor({store, modules, authorize, services = {}}) {
    this.store = store;
    this.authorize = authorize;
    this.services = services;
    this.registry = new Map();
    for (const candidate of modules) {
      const definition = defineModule(candidate), id = definition.manifest.id;
      if (this.registry.has(id)) fail(422, 'Tekrarlanan modül: ' + id);
      this.registry.set(id, definition);
    }
    const visit = (id, stack = new Set()) => {
      if (stack.has(id)) fail(422, 'Döngüsel modül bağımlılığı.');
      const definition = this.registry.get(id); if (!definition) fail(422, 'Eksik modül bağımlılığı: ' + id);
      for (const [dependency, major] of Object.entries(definition.manifest.dependencies || {})) {
        if (Number(this.registry.get(dependency)?.manifest.version.split('.')[0]) !== major) fail(422, 'Bağımlılık sürümü uyumsuz: ' + dependency);
        visit(dependency, new Set([...stack, id]));
      }
    };
    for (const id of this.registry.keys()) visit(id);
    store.db.exec(`
      CREATE TABLE IF NOT EXISTS studio_module_installations(site_id TEXT NOT NULL REFERENCES studio_sites(id),module_id TEXT NOT NULL,version TEXT NOT NULL,schema_version INTEGER NOT NULL,state TEXT NOT NULL CHECK(state IN ('enabled','disabled','uninstalled')),revision INTEGER NOT NULL,updated TEXT NOT NULL,PRIMARY KEY(site_id,module_id));
      CREATE TABLE IF NOT EXISTS studio_module_records(site_id TEXT NOT NULL REFERENCES studio_sites(id),module_id TEXT NOT NULL,collection TEXT NOT NULL,id TEXT NOT NULL,revision INTEGER NOT NULL,data TEXT NOT NULL,created TEXT NOT NULL,updated TEXT NOT NULL,PRIMARY KEY(site_id,module_id,collection,id));
      CREATE TABLE IF NOT EXISTS studio_module_events(id TEXT PRIMARY KEY,site_id TEXT NOT NULL REFERENCES studio_sites(id),module_id TEXT NOT NULL,actor TEXT NOT NULL,type TEXT NOT NULL,data TEXT NOT NULL,created TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS studio_module_record_list ON studio_module_records(site_id,module_id,collection,updated);
    `);
  }
  definition(id) {const d = this.registry.get(id); if (!d) fail(404, 'Modül bulunamadı.'); return d;}
  installation(siteId, id) {return this.store.get('SELECT * FROM studio_module_installations WHERE site_id=? AND module_id=?', siteId, id);}
  requireInstalled(siteId, id, write = false) {
    const d = this.definition(id), row = this.installation(siteId, id);
    if (!row) fail(409, 'Önce modülü kurun.');
    if (write && (row.state !== 'enabled' || row.version !== d.manifest.version || row.schema_version !== d.manifest.schemaVersion)) fail(409, 'Yazmak için modülü etkinleştirin veya güncelleyin.');
    return row;
  }
  catalog(actor, siteId) {
    const site = this.authorize(actor, siteId);
    return [...this.registry.values()].filter(d => d.manifest.permissions.some(p => site.allowed.includes(p))).map(d => {
      const installed = this.installation(siteId, d.manifest.id);
      return {...d.manifest, installed: installed ? {version: installed.version, state: installed.state, revision: installed.revision, schemaVersion: installed.schema_version} : null,
        collections: Object.fromEntries(Object.entries(d.collections || {}).filter(([,c]) => site.allowed.includes(c.permission)).map(([id,c]) => [id, {label:c.label, fields:c.fields, singleton:!!c.singleton, readOnly:!!c.readOnly}])),
        commands: Object.fromEntries(Object.entries(d.commands || {}).filter(([,c]) => site.allowed.includes(c.permission)).map(([id,c]) => [id, {label:c.label, fields:c.fields || {}, write:c.write !== false, help:c.help}]))};
    });
  }
  context(actor, siteId, moduleId, writable = true, migrating = false) {
    const definition = this.definition(moduleId), store = this.store;
    const site = this.authorize(actor, siteId);
    const collection = name => {const c = definition.collections?.[name]; if (!c) fail(404, 'Koleksiyon bulunamadı.'); this.authorize(actor, siteId, c.permission); return c;};
    const get = (name, id) => {
      collection(name); if (!validId(id)) fail(422, 'Kayıt kimliği geçersiz.');
      const row = store.get('SELECT * FROM studio_module_records WHERE site_id=? AND module_id=? AND collection=? AND id=?', siteId, moduleId, name, id);
      if (!row) fail(404, 'Kayıt bulunamadı.'); return unpack(row);
    };
    const list = (name, {offset = 0, limit = 100, search = ''} = {}) => {
      collection(name);
      if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 500 || typeof search !== 'string' || search.length > 200) fail(422, 'Liste parametreleri geçersiz.');
      const pattern = '%' + search.replace(/[\\%_]/g, '\\$&') + '%';
      const where = "site_id=? AND module_id=? AND collection=? AND data LIKE ? ESCAPE '\\'";
      const params = [siteId, moduleId, name, pattern];
      return {total: store.get('SELECT COUNT(*) AS n FROM studio_module_records WHERE ' + where, ...params).n,
        items: store.all('SELECT * FROM studio_module_records WHERE ' + where + ' ORDER BY updated DESC,id LIMIT ? OFFSET ?', ...params, limit, offset).map(unpack)};
    };
    const references = (fields, data) => {
      for (const [key, field] of Object.entries(fields)) {
        if (field.type === 'reference' && data[key]) get(field.collection, data[key]);
        if (field.type === 'items' && data[key]) data[key].forEach(item => references(field.fields, item));
      }
    };
    const find = (name, key, value) => {
      const c=collection(name);if(!Object.hasOwn(c.fields,key)||!c.fields[key].unique)fail(422,'Tekil alan gerekli.');
      return unpack(store.get('SELECT * FROM studio_module_records WHERE site_id=? AND module_id=? AND collection=? AND json_extract(data,?)=?',siteId,moduleId,name,'$.'+key,value));
    };
    const context = {site, actor, records: {list, get, find},
      transaction: fn => store.transaction(() => sync(fn())),
      emit: (type, data) => {
        if (!/^[a-z][a-zA-Z0-9_.-]{0,99}$/.test(type) || Buffer.byteLength(json(data)) > 16000) fail(422, 'Olay biçimi geçersiz.');
        store.run('INSERT INTO studio_module_events VALUES (?,?,?,?,?,?,?)', randomUUID(), siteId, moduleId, actor.user_id, type, json(data), now());
      },
      services: Object.fromEntries(Object.entries(this.services).filter(([name])=>definition.manifest.services?.includes(name)).map(([name, service]) => [name, (...args) => {if(!writable)fail(403,'Salt okunur komut servis yazamaz.');if(!migrating)this.requireInstalled(siteId,moduleId,true);return service({actor, siteId, moduleId}, ...args);}]))};
    context.records.put = (name, input) => {
      if(!writable)fail(403,'Salt okunur işlem kayıt yazamaz.');
      if(!migrating)this.requireInstalled(siteId,moduleId,true);
      const c = collection(name), id = c.singleton ? 'settings' : input.id || randomUUID();
      if (!validId(id) || (c.singleton && input.id && input.id !== id)) fail(422, 'Kayıt kimliği geçersiz.');
      const row = store.get('SELECT * FROM studio_module_records WHERE site_id=? AND module_id=? AND collection=? AND id=?', siteId, moduleId, name, id);
      if (row ? input.revision !== row.revision : input.revision !== undefined && input.revision !== -1) fail(409, 'Kayıt başka bir oturumda değişti. Girdiniz korunuyor; güncel kaydı inceleyin.');
      let data = parseFields(c.fields, input.data);
      references(c.fields, data);
      if (c.beforeSave) sync(c.beforeSave(context, data, unpack(row)));
      data=parseFields(c.fields,data);references(c.fields,data);
      for (const [key, f] of Object.entries(c.fields)) {
        if (f.unique && data[key] !== undefined && store.get('SELECT id FROM studio_module_records WHERE site_id=? AND module_id=? AND collection=? AND id<>? AND json_extract(data,?)=?', siteId, moduleId, name, id, '$.' + key, data[key])) fail(409, f.label + ' zaten kullanılıyor.');
      }
      const revision = row ? row.revision + 1 : 0, created = row?.created || now(), updated = now();
      store.run('INSERT INTO studio_module_records VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(site_id,module_id,collection,id) DO UPDATE SET revision=excluded.revision,data=excluded.data,updated=excluded.updated', siteId, moduleId, name, id, revision, json(data), created, updated);
      context.emit('record.saved', {collection:name, id, revision});
      return {id, revision, data, created, updated};
    };
    context.records.remove = (name, id, revision) => {
      if(!writable)fail(403,'Salt okunur işlem kayıt silemez.');
      if(!migrating)this.requireInstalled(siteId,moduleId,true);
      const c = collection(name), old = get(name, id);
      if (revision !== old.revision) fail(409, 'Kayıt sürümü değişti.');
      if (c.beforeDelete) sync(c.beforeDelete(context, old));
      // Referential integrity covers every declared collection, including nested items.
      const pointsAt = (fields, data) => Object.entries(fields).some(([key,f]) => f.type === 'reference' && f.collection === name && data[key] === id || f.type === 'items' && data[key]?.some(item => pointsAt(f.fields,item)));
      for (const [other, schema] of Object.entries(definition.collections || {})) {
        const rows = store.all('SELECT data FROM studio_module_records WHERE site_id=? AND module_id=? AND collection=?', siteId, moduleId, other);
        if (rows.some(row => pointsAt(schema.fields, JSON.parse(row.data)))) fail(409, 'Bu kayıt başka kayıtlarda kullanılıyor; silmek yerine arşivleyin.');
      }
      store.run('DELETE FROM studio_module_records WHERE site_id=? AND module_id=? AND collection=? AND id=?', siteId, moduleId, name, id);
      context.emit('record.deleted', {collection:name, id});
    };
    return context;
  }
  lifecycle(actor, siteId, id, action, expected) {
    this.authorize(actor, siteId, 'members');
    const d = this.definition(id);
    for (const permission of d.manifest.permissions) this.authorize(actor, siteId, permission);
    if (!['install','enable','disable','uninstall','upgrade'].includes(action)) fail(404, 'Modül işlemi bulunamadı.');
    return this.store.transaction(() => {
      const previous = this.installation(siteId, id);
      if (previous ? expected !== previous.revision : expected !== -1) fail(409, 'Modül durumu değişti.');
      if (!previous && action !== 'install') fail(409, 'Modül kurulu değil.');
      if (previous && action === 'install' && previous.state !== 'uninstalled') fail(409, 'Modül zaten kurulu.');
      const disabling = action === 'disable' || action === 'uninstall';
      if (disabling) {
        for (const other of this.registry.values()) if (Object.hasOwn(other.manifest.dependencies || {}, id) && this.installation(siteId, other.manifest.id)?.state === 'enabled') fail(409, 'Önce bağımlı modülü kapatın: ' + other.manifest.name);
      } else {
        for (const dependency of Object.keys(d.manifest.dependencies || {})) this.requireInstalled(siteId, dependency, true);
        if (previous && (previous.schema_version > d.manifest.schemaVersion || previous.version.localeCompare(d.manifest.version, 'en', {numeric:true})>0)) fail(409, 'Eski paket sürümüne veri geri alınamaz.');
      }
      const context = this.context(actor, siteId, id, true, true);
      if (!disabling) {
        for (const migration of d.migrations) if (migration.version > (previous?.schema_version || 0)) sync(migration.up(context));
        if (!previous && d.onInstall) sync(d.onInstall(context));
      }
      const state = action === 'uninstall' ? 'uninstalled' : disabling ? 'disabled' : 'enabled';
      const version = disabling ? previous.version : d.manifest.version, schemaVersion = disabling ? previous.schema_version : d.manifest.schemaVersion;
      this.store.run('INSERT INTO studio_module_installations VALUES (?,?,?,?,?,?,?) ON CONFLICT(site_id,module_id) DO UPDATE SET version=excluded.version,schema_version=excluded.schema_version,state=excluded.state,revision=excluded.revision,updated=excluded.updated', siteId, id, version, schemaVersion, state, (previous?.revision ?? -1) + 1, now());
      context.emit('module.' + action, {version, schemaVersion, state});
      return this.installation(siteId, id);
    });
  }
  collection(actor, siteId, id, name, method, input = {}) {
    this.authorize(actor, siteId);
    this.requireInstalled(siteId, id, method !== 'GET');
    const d = this.definition(id).collections?.[name]; if (!d) fail(404, 'Koleksiyon bulunamadı.');
    const ctx = this.context(actor, siteId, id);
    if (method === 'GET') return input.id ? ctx.records.get(name, input.id) : ctx.records.list(name, input);
    if (d.readOnly) fail(403, 'Bu kayıt yalnızca modül işlemleriyle değiştirilebilir.');
    if (method === 'PUT') return ctx.transaction(() => ctx.records.put(name, input));
    if (method === 'DELETE') return ctx.transaction(() => {ctx.records.remove(name, input.id, input.revision); return {ok:true};});
    fail(405, 'Yöntem desteklenmiyor.');
  }
  async execute(actor, siteId, id, commandId, input) {
    this.authorize(actor, siteId);
    const d = this.definition(id), command = d.commands?.[commandId]; if (!command) fail(404, 'Komut bulunamadı.');
    this.authorize(actor, siteId, command.permission);
    this.requireInstalled(siteId, id, command.write !== false);
    return await command.run(this.context(actor, siteId, id, command.write !== false), parseFields(command.fields || {}, input));
  }
  export(actor, siteId, id) {
    const d = this.definition(id); this.authorize(actor, siteId); this.requireInstalled(siteId, id);
    for (const permission of d.manifest.permissions) this.authorize(actor, siteId, permission);
    const records = this.store.all('SELECT * FROM studio_module_records WHERE site_id=? AND module_id=? ORDER BY collection,id', siteId, id).map(r => ({collection:r.collection, ...unpack(r)}));
    return {format:'studio-module-data', version:1, module:d.manifest, installation:this.installation(siteId,id), siteId, records,...(d.exportData?{operational:sync(d.exportData(this.context(actor,siteId,id,false)))}:{})};
  }
}
