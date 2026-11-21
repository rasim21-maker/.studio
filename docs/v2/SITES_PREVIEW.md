# Sites preview — 2026-11-21

Private deployed preview:
https://loft-studio-v2-preview.turka-ara-mu-0204.chatgpt.site

The user explicitly selected an interactive preview with sample data. This is
a simplified standalone browser-local panel, not the production CMS deployment.
Sites hosts static assets or Cloudflare Workers; the current Node 24 application,
local SQLite databases, filesystem operations and background workers cannot be
deployed there unchanged. A production integration needs a separate backend or
a separately designed runtime port.

## Source and publication

- Source checkout: sibling directory `../sites-preview` relative to this repository.
- Sites project: `appgprj_6b00cdcdff48819189d0b40631d415e2`.
- Sites source commit: `b0cb90f6df8fbd24f9ea823a91749021ead2eaae`.
- Successful deployment: `appgdep_6b01423e51c08191862572fc2be0998d`.
- Version: `appgprj_6b00cdcdff48819189d0b40631d415e2~appgver_66c62ed5d1e48191b0fe852fcb85d658`.
- Hosting manifest: `.openai/hosting.json`, static directory `dist` in that checkout.
- Sites source is versioned in its own managed repository, independently of GitHub v2.
- Preserve project identity and private audience when updating. Refresh short-lived
  source credentials with the Sites tool; never save tokens in files or commands.
- Follow the installed Sites skill's source helper and private deployment workflow.
  The Windows system Node executable crashed during the packaging subprocess;
  Codex's bundled Node completed the same helper successfully. No production
  application runtime or dependencies were changed for this workaround.

## Demonstrated functionality

Three fictional sites; content/spacing/alignment editing; 12 sample themes;
section ordering and accessible up/down controls; undo/redo; browser-local
persistence and JSON export; sample overnight/timed bookings with single-resource
overlap rejection; month-filtered agenda; CRM relationships hidden when booking
is disabled; module toggles; before/after demo audit and JSON export. Commerce is
a read-only sample catalog. Each browser has independent fictional data.

No live payments, source imports, real authentication, customer data, server audit
provenance, production availability rules or live publishing are connected.
Do not enter credentials or real customer records. HTML source editing is not
included in the simplified preview. Demo audit retains up to 150 events and is
not an immutable compliance log.

## Verification and task status

- [x] Async reservation/payment storage: GitHub v2 commit `eaf8dc4`.
- [x] Full 210 application tests with real PostgreSQL enabled.
- [x] Explicit PostgreSQL acceptance command: 36/36 passed.
- [x] Additional paired-database/WAL backup regression: 2/2 file tests passed.
- [x] Demo JavaScript syntax check and localhost HTTP 200.
- [x] Browser: edit/save, undo, disabled-booking CRM visibility, overlap rejection,
  successful new booking; narrow panel layout visually inspected.
- [x] Owner-private Sites publication returned `succeeded` with the URL above.
- [x] Open-in-Codex handoff requested; the app returned `queued`.
- [ ] Full production CMS hosting on Sites: not part of the selected demo scope.

Browser checks are not a complete WCAG audit or full device matrix. Live provider
acceptance and production deployment remain separate work. Development stops at
this delivery before moving to the remaining product backlog, as requested.
