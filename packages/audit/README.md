# @loft-studio/audit

Independent server-side audit infrastructure for Node 24.13.x and node:sqlite.
No dependency on Loft application code or its business modules. This package is
composed once per database connection; it is not a tenant-disableable business module.

```js
import {DatabaseSync} from 'node:sqlite';
import {AuditLog} from '@loft-studio/audit';
const db = new DatabaseSync(':memory:');
db.exec('CREATE TABLE notes(id TEXT PRIMARY KEY, site_id TEXT, content TEXT)');
const audit = new AuditLog({db});
audit.track({table:'notes', scope:row => "'site:'||" + row + '.site_id'});
audit.withContext({actorId:'trusted-user-id', actorType:'human'}, () => {
  db.prepare('INSERT INTO notes VALUES (?,?,?)').run('1','site-1','Hello');
});
const page = audit.query('site:site-1');
```

`track` accepts **trusted deployment code**, not user-defined SQL. TEMP triggers
record committed insert/update/delete changes in the same transaction. Reattach
them on every writer connection after source schema initialization. Changes
through an uninstrumented external database writer are outside this contract.
`record`, `identify`, `setScope`, `withContext` are trusted server APIs; the HTTP
adapter must resolve identities/permissions, never accept them from request bodies.

`handle` records accepted HTTP request start/completion/abort, with a server UUID,
UTC time, authenticated actor (if known), socket and optional trusted proxy IP,
unverified client-reported device metadata, status and duration. Bodies, cookies,
authorization headers and URL query strings are not stored. Default IP trust is
the socket; only explicitly listed proxy IPs enable right-to-left XFF traversal.

`query` uses snapshot/keyset pagination. The caller must authorize the scope on
each query; `*` means operator-wide access and is not safe for public clients.
The Loft adapter enforces account/site/org/operator scope and distinct export
permission. JSON and formula-escaped CSV exports are implemented by that adapter.

Password/key fields are masked before persistence. Large strings, source/binary
material and deep/large collections have explicit omission markers. Logs are
append-only through ordinary SQL, but a database/file administrator can alter
the database or remove protections: this is not a cryptographic/WORM guarantee.
Raw request payload capture and historical backfill are intentionally absent.
Schema version 1 is recorded in `studio_log_migrations`; newer database schemas
are rejected instead of silently opening with older package code.
No automatic retention deletion is enabled. Plan protected storage, backup,
capacity and approved retention in the deployment.
