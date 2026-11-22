# V2 import and preview boundaries

Threats: cross-tenant access, confused-deputy connector requests, archive traversal and expansion, symlinks, executable uploads, source secrets, stored XSS, unsafe styles/URLs, source prompt injection, revision races and unsafe rollback.

Controls must be enforced at the server boundary:

- Exact project/action authorization on every resource, including assets, jobs, imports and snapshots. Recheck worker authorization at execution and around each remote request; removing import permission aborts active requests and clears queued/staged results in this process.
- Bounded JSON and archives; relative paths; shared NFC/case collision detection for ZIP, direct files and Git trees. Preserve original source spelling so references do not change. Enforce entry count, individual and total decoded sizes, compression ratio, no nested archives or link entries.
- Quarantine and dry-run before commit. Source bytes remain untrusted. No install scripts or imported code are executed.
- Common secret path/content detection. Rejected entries and warnings are reported without logging their contents. Scanning is heuristic, not a malware or secret-free certificate.
- HTTPS only for live remote connectors. Check every resolved address, pin the connection to a checked address, reject unsafe ports/private/link-local/metadata targets and do not forward authorization through redirects.
- Scoped encrypted credentials, bounded response streams, explicit timeouts and cancellation.
- New V2 credentials use per-secret AES-GCM data keys wrapped through an async provider contract and authenticated tenant/type context. The default provider is a local versioned key file, not a hosted KMS. Old records remain readable. Separate encrypted key backup and verified restore are available through secure-backup-v2; the data backup is not encrypted by that tool.
- Expiring, revocable site-scoped AI bearer tokens permit only read/propose operations. Proposals must pass human acceptance, current membership/revision and the normal save validation. Bearer authentication cannot fall through to an administrator cookie on unrelated API routes. No automatic LLM provider access is enabled.
- JSON schema validation plus semantic constraints, strict component properties, safe rich markup and bounded responsive layout values.
- Normal preview has no scripts, forms or same-origin privilege. The visual selection
  preview is a separate, narrow exception: after inert sanitization it adds one
  nonce-authorized first-party controller, in an allow-scripts-only opaque iframe.
  No imported scripts execute. Exact frame source, null origin, channel, message
  schema and candidate key checks guard parent messages; clicks never commit data.
- Expected revisions and source fingerprints; atomic local transactions; remote conditional writes where supported.
- Release snapshots are revalidated before preview/export/publication; restoring incompatible schema/field/binding state is rejected with issues and no active-data mutation. Historical inactive dictionary values remain readable.
- Operational tables are excluded from content restore and now use a separate async
  storage authority (SQLite/PostgreSQL). The local process is still shared. Audit
  records do not have independent tamper evidence. Neither is hosted isolation.

No blanket claims of WCAG compliance, penetration-test certification, arbitrary website support or sandboxed arbitrary builds are made without corresponding evidence. Remaining limitations belong in the verification report and capability UI.

The repository-wide human/AI contract is [root SECURITY.md](../../SECURITY.md).
The boundary/actor/control matrix is in [the threat model](../security/threat-model.md).
Imported scripts remain disabled in all V2 preview modes. The legacy preview route
must be evaluated separately before hosted deployment. Original source scripts/styles
are preserved in exports. The legacy client actorType label is not a restricted AI
identity; verified agent credentials use dedicated credential/proposal audit events.
