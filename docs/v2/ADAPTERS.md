# Adapter and data contracts

## Versioned document

The executable shape is `shared/v2/schema.ts`; the generated portable JSON Schema is `document.schema.json`. `shared/v2/validation.ts` adds cross-field, dictionary, rich-text, URL and uniqueness rules. The browser and server use the same compiled validator. Generated validation does not require browser eval.

`Document(schemaVersion=2)` contains site name, default locale, enabled locales, theme tokens, pages and dictionaries. Pages own stable IDs, source paths, SEO fields, responsive layouts and ordered sections. Sections use registered kinds and typed fields. Fields carry required/length/numeric bounds, step, dictionary reference and optional localized values. Only rich fields accept restricted HTML. Existing source schemas cannot be relaxed by an edit. Layout bounds are padding/margin/gap 0–160 px, columns 1–4 and maximum width 320–1920 px.

Dictionary entries have stable IDs, localized labels, aliases and active flags. Changing a dictionary increments its version exactly once. Removed entries/dictionaries are rejected; historical assignments can retain an inactive value. Strict enums reject unknown values. Suggest mode does not reject free text. This version does not include a spelling service or an interactive unknown-value import mapping screen.

## Manifest example

```json
{
  "manifestVersion": 2,
  "adapter": {"id": "react-sdk", "version": 1},
  "name": "Example site",
  "contentPath": "studio/content.json",
  "locales": ["tr", "en"],
  "connections": [{"id": "source", "kind": "files", "authority": ["code", "content", "design"]}],
  "preview": {"mode": "sdk"},
  "publish": {"mode": "export"}
}
```

Each authority has at most one owner. Import cannot declare operational data as a source authority. Optional `editableFields` restricts static field discovery to explicit permanent IDs. Unknown adapters fail closed. Manifest capabilities cannot enable conditional publication without an actual authenticated connection.

## Implementing an adapter

Implement `Adapter` from `shared/v2/model.ts` and register it in `AdapterRegistry`. Methods are `discover`, `capabilities`, `validate`, `write`, `preview`, `export`, and optional conditional `publish`. Discovery returns the schema-bearing document plus source bindings. Writes receive the previous and proposed document and return new source bytes. Core APIs own authorization, local expected revisions, durable versions and audit. Adapters must validate again before writing.

The core invokes optional publishing through the adapter contract; WordPress behavior is inside its adapter. Adding a trusted adapter requires registration/composition, not a new site-type switch in command handling. The contract test registers a fourth adapter through the same discovery entry point. This is a trusted extension API, not permission to execute downloaded plugins. General builds remain unsupported until an isolated runner is provisioned. Content rollback uses immutable core versions, not a payment or booking rollback.

Static HTML bindings use parse5 locations and permanent `data-studio-page`, `data-studio-id`, `data-studio-field` attributes. Unknown code remains in source. Only direct sections/articles/divs/header/footer under main/body and safely identifiable text fields are discovered. Existing source sections can be reordered or hidden; deleting them, creating pages or rewriting arbitrary nested framework structures is unavailable.

Exports include `studio/source-state.json` with the validated document and page hashes. Reimport preserves stable bindings, translations, theme and layout. A hash mismatch refuses a stale mapping; remove the sidecar deliberately and inspect a fresh mapping report when editing HTML outside Studio. Hashes detect inconsistency, not authenticity. GitHub connections are read-only snapshots; `connection/check` detects changed refs. A reviewed reimport keeps the site identity and uses the expected local revision.

The React SDK contract reads `studio/content.json` and writes `studio/design.css`. The supplied independent Northstar application consumes both files; its own pinned esbuild pipeline compiles React outside Studio. Other React applications must explicitly consume this contract or provide an adapter. Imported JSX is never executed in the Studio preview.

## WordPress bridge protocol

The local WordPress example is a contract fixture. A standard WordPress REST endpoint does **not** supply this conditional HTML bridge automatically. No WordPress plugin has been installed or tested on a live site in this release.

- Authenticated HTTPS `GET /wp-json/loft-studio/v1/pages/:id` returns `{html, revision}` for one editable HTML page.
- Authenticated `PUT` accepts `{html}` plus the prior opaque revision in `If-Match`.
- The bridge must atomically compare and write, return 409/412 without mutation on a mismatch, check page-scoped edit/publish permission and return the new revision on success.
- Bridge credentials should be dedicated WordPress Application Passwords with the narrowest available role. The server seals them; APIs, previews and releases omit them.
- Bridge implementation must retain WordPress revisions and must not flatten Gutenberg blocks, shortcodes or page-builder code it cannot safely map. Those are unsupported until separately implemented.

Transport-level fixtures prove conflict handling, credential separation and cancellation; they do not prove a WordPress deployment. See [WordPress authentication documentation](https://developer.wordpress.org/advanced-administration/security/application-passwords/).

## Storage and operational boundaries

Additive tables: `studio_orgs`, `studio_workspaces`, `studio_projects`, `studio_sites`, `studio_members`, `studio_versions`, `studio_releases`, `studio_imports`, `studio_connections`, `studio_audit`, `studio_migrations`. Every site operation derives its scope from the authenticated actor, never from a trusted request tenant ID. Release rows reference immutable version rows. The current store is local SQLite; PostgreSQL RLS and object storage are planned, not active.

Operations reuse the existing independently keyed booking, calendar, payment and integration tables under the new site UUID. `reservation_participants` adds generic participants; legacy pet arrays remain readable through an additive compatibility projection. No operational data is copied into source history. The hosted version still needs transactional outbox/events and an external worker queue.
