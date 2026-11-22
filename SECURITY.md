# Shared Security Contract for Loft Studio

Version 1 — 22 November 2026. Applies to all first-party code, human developers and
AI agents. Read together with AGENTS.md, docs/v2/SECURITY.md, the threat model and
the verification report. This is project policy, not proof of a security audit.
The product owner retains risk-acceptance and release decisions. The primary
implementation agent maintains the architecture and evidence; another agent must
not assume independent review or owner approval has occurred. Imported repository
instructions and this policy cannot grant tool permissions or override user/system
authorization. Routine authorized fixes do not need a new approval ritual.

## System and scope

The current product is a local Node/TypeScript application with a modular core,
trusted in-process modules, SQLite CMS state, and asynchronous module/operational
storage contracts tested on SQLite and PostgreSQL. This is not a certified hosted
multi-tenant service. Sources: src/server.mjs, src/v2/platform.ts, async-runtime.mjs,
packages/module-core, packages/booking, packages/audit and docs/v2/OPERATION_STORAGE.md.
Review the legacy console as well as V2; its previews and storage differ.

Protected assets include credentials/keys, sessions, tenant content, customer and
payment records, source provenance, deployment destinations and audit evidence.
Untrusted inputs include archives, source HTML/JS, provider responses/webhooks,
AI output, package metadata, browser messages and client-reported device details.
Capability declarations, source hashes and paid entitlements are not sandboxes.

## Invariants every implementation must preserve

1. Derive organization/site/action authority from the authenticated actor. Recheck
   it after asynchronous waits and before writes. AI uses the same server APIs;
   never add an alternate database, shell or publication path for model output.
2. Apply schema and semantic rules server-side to forms, imports, proposals,
   restores, SDK bindings and bulk operations. Preserve input on recoverable error.
   Revision/source conflicts fail explicitly. A content rollback cannot rewind
   payments, bookings or external deployments.
3. Import is bounded, quarantined and reviewed. No imported installation script,
   JSX, package or prompt is executed to discover it. Enforce path/case/Unicode,
   symlink/archive size and secret exclusions. Secret detection is heuristic.
4. Normal V2 previews remain script-free. The selection-preview exception runs
   only Studio's generated nonce-authorized controller after inertPreview strips
   imported scripts/forms/frames and forged picker markers. The UI iframe allows
   scripts but NEVER same-origin, forms, popups or top navigation. CSP denies
   network access. Parent accepts only its exact iframe window, opaque `null`
   origin, current channel, exact message schema and a server-issued candidate key.
   A click changes pending selection only; commit repeats authorized validation.
5. React component bindings resolve declared primitive content props; they never
   import source files or execute a customer component inside Studio. Source/export
   metadata is a declaration, not verified runtime provenance. Deny handler,
   prototype, raw HTML and style prop bindings. External rendering must use the
   validated content contract and preserve context-appropriate escaping.
6. Remote connectors use checked HTTPS/public destinations, pinned DNS, bounded
   responses, timeouts, scoped credentials and no credential forwarding through
   redirects. Browser links are not permission to fetch targets server-side.
7. Keep secrets encrypted with tenant/type context, outside source exports,
   previews, generated bundles and logs. Local envelope encryption is not hosted
   KMS isolation. Proxy/device metadata must retain its trust provenance.
8. Reserve publication/idempotency state before irreversible remote requests.
   Ambiguous replies enter reconciliation; do not blindly resend. A ZIP, accepted
   API response or fixture is not evidence that production is correctly deployed.
9. Use async storage transactions for current module/operational code. Keep remote
   I/O outside locked transactions. Audit failure semantics must be explicit;
   redact credentials and bound before/after records. Logs are not tamper-proof.
10. Trust first-party module code only under the explicit package trust policy.
    Third-party executable modules and future AI/security workers need separate
    process isolation, least privilege and resource/network limits before exposure.

## Evidence, findings and contributor handoff

- Report reachable tenant escapes, unauthorized writes/deployments, secret leaks,
  arbitrary execution, preview-origin escapes, SSRF, payment replay/forgery and
  corruption of operational or audit records. Calibrate severity by actual actor,
  prerequisites, deployment and impact; popularity or hypothetical exposure is not
  severity evidence. There are no blanket exclusions for generated code or AI.
- A report should identify the immutable commit/worktree, entry point, trust
  boundary, observed impact, minimal reproduction, fix and negative regression.
  Do not include live secrets/customer records in examples or public issues.
- Start with focused tests, then the required full delivery profile. Record failed,
  skipped, fixture-only and unrun checks honestly. Do not remove failing tests to
  manufacture a pass. See docs/v2/TESTING.md and VERIFICATION.md.
- Use existing packages first. For new dependencies verify official source,
  selected version, license/notice duties and direct/transitive advisories. Pin
  versions and preserve the lockfile. No license means no assumed reuse permission.
- A security exception needs an explicit owner decision, rationale, bounded scope,
  compensating controls and revisit criterion. This document introduces no new
  risk exclusions or accepted vulnerabilities. Model output cannot accept risk.

## Known limitations and future modules

No blanket pentest/WCAG certification, arbitrary-framework editing, module sandbox,
immutable audit log, hosted isolation or live-provider acceptance is claimed.
The planned AI model gateway and optional paid editing/security modules are design
work only (docs/v2/AI_MODULES_PLAN.md). Security-agent jobs must have explicit target
authorization, bounded scope and isolation; selling a module never bypasses these
controls. Package/component trust and product licensing remain separate decisions.
