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
- Preview has no scripts, forms or same-origin privilege; it cannot obtain administrator cookies. Unknown scripts survive in source exports but are not executed by Studio.
- Expected revisions and source fingerprints; atomic local transactions; remote conditional writes where supported.
- Release snapshots are revalidated before preview/export/publication; restoring incompatible schema/field/binding state is rejected with issues and no active-data mutation. Historical inactive dictionary values remain readable.
- Operational tables are excluded from content restore but currently share the same SQLite/process. Audit records do not yet have independent tamper evidence. Neither is claimed as hosted isolation.

No blanket claims of WCAG compliance, penetration-test certification, arbitrary website support or sandboxed arbitrary builds are made without corresponding evidence. Remaining limitations belong in the verification report and capability UI.

The full boundary/actor/control matrix is in [the threat model](../security/threat-model.md). Scripts remain disabled in V2 previews. The legacy preview route must be evaluated separately before hosted deployment. Original source scripts/styles are preserved in source artifacts; field sanitation is not a blanket source-code rewrite. The legacy client actorType label is not a restricted AI identity; verified agent credentials are identified by dedicated credential/proposal audit events.
