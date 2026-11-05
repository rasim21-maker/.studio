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
6. All remote HTTP goes through pinned-address HTTPS requests with destination validation, bounded responses and timeouts. Build jobs cannot execute arbitrary uploaded package scripts. A separately provisioned isolated runner is required for arbitrary framework builds.
7. Scoped permissions distinguish content, design, import, integration, publication and membership. Actor provenance records user and AI proposals. AI proposals invoke the same command path.
8. Immutable content releases and revision restoration only change content. Reservation and payment tables are independent. External Git updates use commit/ref checks; CMS publishing requires conditional writes or is reported unavailable.

## Data boundaries

Organization -> workspace -> project -> site -> environment. Each imported site currently creates one workspace/project in a development environment. The manifest can describe several authorities, but the local connector store currently retains one remote connection per site. Source files, media bytes and immutable snapshots are stored in SQLite JSON columns; media names are content hashes. API callers cannot choose filesystem paths. This deliberately bounded local storage is not an object-store implementation.

For a hosted multi-worker service, PostgreSQL should replace the local repository, with tested tenant policies and migrations; S3-compatible storage should replace local objects and an external worker service should consume durable jobs. These are deployment choices, not claims that switching a configuration string already enables them. Avoid introducing a distributed service dependency into the local edition.

## Migration and rollback

Migrations are additive and recorded by version. The workspace exposes Loft through its existing authorized console; it does not copy Loft drafts into a second authoritative store. Loft has not yet been converted to the generic V2 document editor. Legacy authentication and operational data remain intact. New sites and demo fixtures use their own project records.

Before upgrading an existing installation, stop it and back up the full data directory and secret key files. Test the new binary against a copy first. Rolling back application code uses the matching database backup. Restoring a content revision never restores an operational database backup.

## First acceptance slice

Authenticated workspace -> connect/import -> review capability and field mapping -> select a page -> drag/keyboard edit -> shared validation -> save with expected revision -> inspect isolated preview -> create immutable release/export -> restore content.

Exercise this with Loft, an independent static site, a React SDK fixture and an explicitly labelled WordPress contract fixture. Real provider credentials are required before claiming live GitHub/WordPress acceptance.
