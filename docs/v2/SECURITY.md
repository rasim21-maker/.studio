# V2 import and preview boundaries

Threats: cross-tenant access, confused-deputy connector requests, archive traversal and expansion, symlinks, executable uploads, source secrets, stored XSS, unsafe styles/URLs, source prompt injection, revision races and unsafe rollback.

Controls must be enforced at the server boundary:

- Exact project/action authorization on every resource, including assets, jobs, imports and snapshots.
- Bounded JSON and archives; normalized relative paths; duplicate/case collisions; entry count, individual and total decoded sizes; compression ratio; no nested archives or link entries.
- Quarantine and dry-run before commit. Source bytes remain untrusted. No install scripts or imported code are executed.
- Common secret path/content detection. Rejected entries and warnings are reported without logging their contents. Scanning is heuristic, not a malware or secret-free certificate.
- HTTPS only for live remote connectors. Check every resolved address, pin the connection to a checked address, reject unsafe ports/private/link-local/metadata targets and do not forward authorization through redirects.
- Scoped encrypted credentials, bounded response streams, explicit timeouts and cancellation.
- JSON schema validation plus semantic constraints, strict component properties, safe rich markup and bounded responsive layout values.
- Preview has no scripts, forms or same-origin privilege; it cannot obtain administrator cookies. Unknown scripts survive in source exports but are not executed by Studio.
- Expected revisions and source fingerprints; atomic local transactions; remote conditional writes where supported.
- Immutable release artifacts, audit metadata and independent operational storage.

No blanket claims of WCAG compliance, penetration-test certification, arbitrary website support or sandboxed arbitrary builds are made without corresponding evidence. Remaining limitations belong in the verification report and capability UI.
