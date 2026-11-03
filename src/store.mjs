import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { fail } from './util.mjs';
export class Store {
  constructor(filename, { recoverBuilds = true } = {}) {
    this.db = new DatabaseSync(filename);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, created TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sites(id TEXT PRIMARY KEY, metadata TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS memberships(user_id TEXT REFERENCES users(id), site_id TEXT REFERENCES sites(id), role TEXT CHECK(role IN ('admin','editor')) NOT NULL, PRIMARY KEY(user_id,site_id));
      CREATE TABLE IF NOT EXISTS drafts(site_id TEXT REFERENCES sites(id), locale TEXT, revision INTEGER NOT NULL, content TEXT NOT NULL, PRIMARY KEY(site_id,locale));
      CREATE TABLE IF NOT EXISTS structures(site_id TEXT PRIMARY KEY REFERENCES sites(id), revision INTEGER NOT NULL, content TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS history(id TEXT PRIMARY KEY, site_id TEXT REFERENCES sites(id), locale TEXT, revision INTEGER, actor TEXT NOT NULL, created TEXT NOT NULL, note TEXT NOT NULL, changes TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), csrf TEXT NOT NULL, expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS attempts(key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS builds(id TEXT PRIMARY KEY, site_id TEXT REFERENCES sites(id), kind TEXT NOT NULL, actor TEXT NOT NULL, created TEXT NOT NULL, status TEXT NOT NULL, snapshot TEXT NOT NULL, result TEXT, error TEXT);
      CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY, site_id TEXT, actor TEXT, action TEXT NOT NULL, created TEXT NOT NULL, detail TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS external_identities(provider TEXT, issuer TEXT, subject TEXT, user_id TEXT NOT NULL REFERENCES users(id), created TEXT NOT NULL, PRIMARY KEY(provider,issuer,subject));
      CREATE TABLE IF NOT EXISTS oauth_transactions(state_hash TEXT PRIMARY KEY, provider TEXT NOT NULL, binding_hash TEXT NOT NULL, verifier TEXT NOT NULL, nonce TEXT NOT NULL, user_id TEXT, session_hash TEXT, expires INTEGER NOT NULL, callback TEXT NOT NULL);
      PRAGMA user_version=4;`);
    if (recoverBuilds) this.db.prepare("UPDATE builds SET status='failed', error='Sunucu yeniden başladı; tekrar oluşturun.' WHERE status='building'").run();
  }
  get(sql, ...args) { return this.db.prepare(sql).get(...args); }
  all(sql, ...args) { return this.db.prepare(sql).all(...args); }
  run(sql, ...args) { return this.db.prepare(sql).run(...args); }
  transaction(fn) { this.db.exec('BEGIN IMMEDIATE'); try { const result = fn(); this.db.exec('COMMIT'); return result; } catch (e) { this.db.exec('ROLLBACK'); throw e; } }
  seed(adapter) {
    const site = adapter.metadata();
    this.run('INSERT OR IGNORE INTO sites VALUES (?,?)', site.id, JSON.stringify(site));
    for (const lang of site.languages) this.run('INSERT OR IGNORE INTO drafts VALUES (?,?,0,?)', site.id, lang.code, JSON.stringify(adapter.seeds[lang.code]));
    if (adapter.structureSeed) this.run('INSERT OR IGNORE INTO structures VALUES (?,0,?)', site.id, JSON.stringify(adapter.structureSeed));
  }
  membership(userId, siteId, required = 'editor') {
    const row = this.get('SELECT role FROM memberships WHERE user_id=? AND site_id=?', userId, siteId);
    if (!row) fail(404, 'Site bulunamadı veya bu siteye erişiminiz yok.');
    if (required === 'admin' && row.role !== 'admin') fail(403, 'Bu işlem için site yöneticisi yetkisi gerekli.');
    return row.role;
  }
  document(siteId, locale) {
    const row = this.get('SELECT revision,content FROM drafts WHERE site_id=? AND locale=?', siteId, locale);
    if (!row) fail(404, 'Dil bulunamadı.');
    return { revision: row.revision, values: JSON.parse(row.content) };
  }
  snapshot(siteId) {
    return { ...Object.fromEntries(this.all('SELECT locale,revision,content FROM drafts WHERE site_id=? ORDER BY locale', siteId).map(row => [row.locale, { revision: row.revision, values: JSON.parse(row.content) }])), $structure: this.structure(siteId), ...(this.get('SELECT name FROM sqlite_master WHERE name=?','booking_settings') && this.get('SELECT content FROM booking_settings WHERE site_id=?',siteId) ? {$runtime:{revision:0,values:{url:JSON.parse(this.get('SELECT content FROM booking_settings WHERE site_id=?',siteId).content).runtimeUrl||'',siteId}}} : {}) };
  }
  structure(siteId) { const row = this.get('SELECT * FROM structures WHERE site_id=?', siteId); if (!row) fail(404, 'Site yapısı bulunamadı.'); return { revision: row.revision, values: JSON.parse(row.content) }; }
  saveStructure(siteId, expected, value, actor, note) {
    return this.transaction(() => {
      const old = this.structure(siteId); if (!Number.isInteger(expected) || old.revision !== expected) fail(409, 'Site yapısı başka bir oturumda değişti. Yeniden yükleyin.');
      const changes = ['pages', 'menu', 'theme'].filter(key => JSON.stringify(old.values[key]) !== JSON.stringify(value[key])).map(key => ({ field: `structure:${key}`, before: JSON.stringify(old.values[key], null, 2), after: JSON.stringify(value[key], null, 2) }));
      if (!changes.length) return old;
      const revision = old.revision + 1;
      this.run('UPDATE structures SET revision=?,content=? WHERE site_id=?', revision, JSON.stringify(value), siteId);
      this.run('INSERT INTO history VALUES (?,?,?,?,?,?,?,?)', randomUUID(), siteId, 'yapı', revision, actor, new Date().toISOString(), note, JSON.stringify(changes));
      return { revision, values: value };
    });
  }
  save(siteId, locale, expected, values, actor, note) {
    return this.transaction(() => {
      const before = this.document(siteId, locale);
      if (!Number.isInteger(expected) || before.revision !== expected) fail(409, 'Bu taslak başka bir oturumda değişti. Metninizi kopyalayıp güncel taslağı yeniden yükleyin.');
      const changes = Object.entries(values).filter(([key, value]) => before.values[key] !== value).map(([field, after]) => ({ field, before: before.values[field], after }));
      if (!changes.length) return { ...before, changes: 0 };
      const revision = before.revision + 1;
      this.run('UPDATE drafts SET content=?,revision=? WHERE site_id=? AND locale=?', JSON.stringify(values), revision, siteId, locale);
      this.run('INSERT INTO history VALUES (?,?,?,?,?,?,?,?)', randomUUID(), siteId, locale, revision, actor, new Date().toISOString(), note, JSON.stringify(changes));
      return { revision, values, changes: changes.length };
    });
  }
  event(site, actor, action, detail = {}) { this.run('INSERT INTO events VALUES (?,?,?,?,?,?)', randomUUID(), site, actor, action, new Date().toISOString(), JSON.stringify(detail)); }
  close() { this.db.close(); }
}
