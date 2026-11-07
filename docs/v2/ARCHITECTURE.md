# Studio V2 architecture and migration

Status: implementation in the separate v2 branch. The deployed 0.2 checkout and its database are not modified by development.

## Existing system

The 0.2 application has HTTP authentication and site membership, SQLite versioned drafts, a trusted Loft build adapter, booking/payment modules, and 54 passing baseline tests. Its fixed page/language schema, pet-specific reservation input, and post-build HTML replacement do not describe arbitrary websites.

## Decisions

1. Keep the authenticated Node server and additive SQLite tables for the local edition. New TypeScript modules form a modular monolith, with React providing the visual workspace. Preserve the original editor at its existing URL during transition.
2. Versioned contracts define sites, pages, components, field constraints, dictionaries, capabilities and commands. Both UI and HTTP use the same validation implementation. Provider secrets and operational records never belong to a content snapshot.
3. Register adapters through a registry. The core owns permissions, revision checks, dictionaries, history, import staging and jobs. Adapters own source mapping and rendering/commit behavior. Supported, partial and unavailable capabilities are data, not cosmetic switches.
4. Source manifests identify the authoritative content location. Static HTML uses parsed, stable bindings; the React SDK reads a documented JSON content file; WordPress uses an authenticated REST connector. Unknown source code is retained rather than rewritten.
5. Imports are staged and bounded before adoption. Uploaded files are never executed. Rich content, layout and schema are validated again at every write boundary. Browser previews run in an opaque-origin sandbox without script execution or administrator credentials.
6. V2 source connectors use pinned-address HTTPS requests with destination validation, bounded responses and timeouts. This claim does not cover every legacy provider transport. Import workers recheck current scope/revision before work and before/after each remote request. Build jobs cannot execute arbitrary uploaded package scripts. A separately provisioned isolated runner is required for arbitrary framework builds.
7. Scoped permissions distinguish content, design, import, integration, publication and membership. Separate expiring AI bearer credentials permit only document read and content proposal creation for one site. Human acceptance runs the same validation/save transaction and records both credential and approver. Legacy client-supplied actorType remains a provenance claim, not an authenticated agent identity. No LLM provider is connected.
8. Content releases and revision restoration only change content. Reservation/payment records are in separate tables in the same SQLite process, not isolated database roles. Historical snapshots are revalidated against current content rules and adapter bindings before restore, preview, release creation/download or provider publication. Incompatible restore reports issues and leaves the active document unchanged. External Git updates use commit/ref checks; CMS publishing requires conditional writes or is reported unavailable.

## Data boundaries

Organization -> workspace -> project -> site -> environment. Each imported site currently creates one workspace/project in a development environment. The manifest can describe several authorities, but the local connector store currently retains one remote connection per site. Source files, media bytes and immutable snapshots are stored in SQLite JSON columns; media names are content hashes. API callers cannot choose filesystem paths. This deliberately bounded local storage is not an object-store implementation.

The primary product target is a hosted multi-tenant service; the local edition remains supported. Hosted Phase 1 requires PostgreSQL behind a shared repository contract, structural tenant isolation, S3-compatible object storage and durable jobs with separate workers. These are required implementations, not existing capabilities or a configuration switch. Local SQLite/files/in-process work remain separate implementations without requiring hosted services. The owner chose global reach, an open-source core and potential optional commercial modules. See [product decisions](PRODUCT_MODEL.md). Regional formatting preferences are implemented; they do not choose physical data residency or certify legal compliance. Per-tenant data region, recovery objectives and production providers remain deployment decisions.

## Migration and rollback

Migrations are additive and recorded by version. The workspace exposes Loft through its existing authorized console; it does not copy Loft drafts into a second authoritative store. Loft has not yet been converted to the generic V2 document editor. Legacy authentication and operational data remain intact. New sites and demo fixtures use their own project records.

Test upgrades and recovery against a copy first. A normal code rollback retains the current operational database; it must not restore an older backup and lose post-upgrade reservations/payments. Additive changes alone do not prove compatibility: certify the exact N-1 reader/writer version before declaring code rollback supported. Never remove legacy columns during this compatibility window. Backup restoration is for an assessed recovery scenario (failed migration, corruption or disaster), with reconciliation and an explicit recovery point, not routine code rollback. The new secure-backup entry point separates and encrypts key material; the legacy backup command remains unchanged for compatibility. Data copies themselves need external encryption/access controls. See [operations](OPERATIONS.md). Restoring a content revision never restores an operational database backup.

## First acceptance slice

Authenticated workspace -> connect/import -> review capability and field mapping -> select a page -> drag/keyboard edit -> shared validation -> save with expected revision -> inspect isolated preview -> create immutable release/export -> restore content.

Exercise this with Loft, an independent static site, a React SDK fixture and an explicitly labelled WordPress contract fixture. Real provider credentials are required before claiming live GitHub/WordPress acceptance.

## Delta implementation order (2026-11-06)

Keep all 54 legacy and 26 original V2 tests as regression coverage, including features deferred from new hosted acceptance. First complete local security hardening and the threat model. Then implement hosted repository/tenant/worker contracts (Phase 1), source drift and reconciliation (Phase 2), isolated runner/React acceptance (Phase 3), real WordPress/API acceptance and declared component regions (Phase 4), and operations/theme/free-layout expansion (Phase 5). Existing features are not removed to match phase boundaries.

Static source-location patches remain valid source editing, distinct from the legacy Loft post-build replacement path. Apply rich-content rules to editable fields, isolation to previews, and source/publish policy to original code; never blanket-strip an imported application's scripts/styles from its export.

See [delta status](../delta-durum.md), [threat model](../security/threat-model.md) and [traceability](../traceability.md) for implementation evidence and unresolved work.
