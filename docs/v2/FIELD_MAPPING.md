# Unmarked HTML discovery and field selection

Import review now lists static HTML text candidates with their source file,
section, tag, field type and a bounded text sample. Individual checkboxes and
select-all/clear controls use native keyboard-accessible controls. Samples are
rendered as text, never injected HTML. The final import action commits the chosen
editing scope; discovery itself creates no live deployment.

The static adapter recognizes explicit `main` (or `body`) roots, their direct
section/article/div/header/footer children, and now direct h1–h6/paragraph children.
Within those sections it discovers headings and paragraphs without requiring
pre-existing Studio markers. It adds source markers without introducing wrappers.
Simple text and formatting are supported. Candidates with event handlers,
recognized template expressions, hidden/editable/dynamic ancestors, form controls,
links or attributed nested elements are conservatively excluded. Source bytes for
those elements remain intact; this heuristic is not a complete framework detector
or a guarantee that any arbitrary HTML is safe to execute.

Discovery retains the existing limits: 40 HTML pages and 40 candidate nodes per
section, supported lowercase page paths, and current document/import limits.
This is not a visual selector for arbitrary DOM nodes. Images, link destinations,
arbitrary spans, navigation outside the main root, React runtime trees and CMS
schemas need their respective adapters/SDK or later explicit mapping support.

## Persistence and API

`GET /api/v2/imports/:id` includes `report.fieldCandidates` for static imports.
`POST /api/v2/imports/:id/commit` accepts `selectedFields: string[]` containing
candidate keys. Empty selection is valid. Unknown and duplicate keys are rejected.
Keys are hashes of page/section/field identifiers, not client-supplied selectors.
The server uses the persisted quarantine result, validates the selected snapshot,
and commits it through the existing ownership, CSRF, revision and transaction
boundaries. The UI always sends its selection; omitting the property retains the
previous API behavior for existing clients. A committed job remains idempotent.

Deselection removes edit authority from the document/bindings, not HTML content or
its markers. It does not disable section layout or page SEO controls. The sidecar
`studio/source-state.json` persists that scope and source hashes. Export/reimport
preserves identifiers and choices; changed HTML with an old sidecar is rejected.
To rediscover previously deselected fields, remove the sidecar from a separate
source copy and review a new import; do not delete the active site's data. Existing
sidecars are restored without silently applying new discovery heuristics.

## Evidence

`test/v2/field-mapping.test.mjs` covers direct/nested unmarked text, identical labels,
stable bindings, source-only preservation, actual field writes, empty/invalid
selection, export/reimport, stale-source rejection, HTTP CSRF and persistent import
commit after restart. Browser checks exercise the actual selection component with
local sample data. They are not full accessibility certification or live-framework
acceptance. No new dependency or AI service is required.
