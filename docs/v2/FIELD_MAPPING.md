# Unmarked HTML discovery and field selection

Import review lists static HTML text and attribute candidates with their source file,
section, tag, attribute, field type and a bounded text sample. Individual checkboxes and
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

Discovery retains the existing limits: 40 HTML pages, at most 40 text candidate nodes
and 40 link/image candidate nodes inspected per section, and at most 40 fields total
per section (text first). Supported lowercase page paths and document/import limits apply.
The visual picker selects supported manual candidates, not arbitrary DOM nodes. Navigation
outside existing sections, React runtime trees and CMS schemas need their respective
adapters/SDK or later mapping support. Supported additional leaves can now be selected
through the manual source-DOM path list below.

## Visual click selection

The import review offers a page selector and a sandboxed preview for manual candidates.
Click an outlined leaf or focus it with Tab and press Enter/Space; the pending DOM
selection toggles. The path list remains the accessible fallback and selection record.
`GET /api/v2/imports/:id/selection-preview?file=...` requires import ownership/scope
and review status. It returns sanitized HTML, an ephemeral channel and allowed keys.

The iframe has `sandbox="allow-scripts"` only: no same-origin, forms or navigation
permissions. Imported scripts/frames/forms and forged picker attributes are removed;
only the generated nonce-authorized Studio controller executes under a network-denying
CSP. The parent checks the exact iframe window, opaque null origin, current channel,
message schema and key allowlist. Clicks do not write data; commit rechecks the source
mapping. Normal previews remain script-free. Unknown JS behavior is not reproduced.

## Manual DOM path selection and framework evidence

Import review includes an opt-in, searchable list grouped by source file. It shows
DOM ancestry (`nth-of-type` paths), section and literal text sample. Supported
additional leaves are span/li/dt/dd/figcaption/address/div/label containing only
plain text, inside already mapped source sections. Existing field ancestors,
dynamic/hidden/form elements, markup-bearing leaves and control characters are
excluded. This avoids overlapping replacement ranges. At most 200 candidates are
shown; the shared 40-field section limit still applies at commit. The user can
deselect automatic fields to make room. This is a filtered source tree, not an
interactive live page or arbitrary CSS selector execution.

`report.manualCandidates` exposes opaque keys and display metadata, not trusted
client selectors. Commit accepts `manualFields: string[]`. The server recomputes
keys from file, section, full HTML hash and source offset against the quarantined
snapshot, validates the selection and writes permanent markers/sidecar in the
existing import transaction. Unknown, duplicate and stale keys are rejected.
Manual choices start unchecked. Existing explicit manifest field allowlists are
not expanded by this flow. Empty manual selection leaves the source unchanged.

`report.framework` is available for successful and discovery-failed imports.
Package dependency declarations and known HTML markers provide bounded evidence
for React, Next.js, Vue/Nuxt, Svelte/SvelteKit, Astro and Angular. Scripts, package
installers and framework runtimes are never executed. The report does not switch
adapters or claim that declared dependencies run on the site. No signal means
unknown/static, not proven static. A Studio SDK manifest remains authoritative
for SDK content. Sources with detected framework signals do not offer additional
manual HTML mappings: generated HTML is not the component source. Existing static
snapshot behavior remains available with the explicit integration warning.

## Links and images

Static HTML sections also expose anchor `href`, image `alt`, and verified local image
`src` as independent fields. Href values follow the shared HTTPS/mailto/tel/root-relative
or fragment policy; unsupported page-relative URLs remain untouched with a warning.
Nested link markup is preserved when changing its destination. Images imported under
legacy paths gain a canonical `media/<hash>.<extension>` library copy; original paths
and bytes remain intact. The source src changes only when the chosen image changes,
and is written relative to the HTML page. The existing media picker selects verified
library images. Alt is plain text, bounded to 500 characters and may be empty for
decorative images. URL fields are bounded to 2000 characters.

External images are not downloaded. Responsive `srcset`/`picture`, `data-src`, base-URL
documents, template expressions and event-bound elements are not automatically mapped
for source replacement. Safe alt fields can still be offered on external/responsive
images. Markers `data-studio-href`, `data-studio-src`, `data-studio-alt` persist each
binding; restore verifies its allowed tag/type pair. Multiple changes to one opening
tag are merged using parser attribute offsets, retaining unrelated attributes and
attribute-like text inside quoted values. Previous text field IDs are not renumbered.

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

Attribute tests additionally cover simultaneous src/alt edits, nested-page image paths,
link markup and quoted attribute preservation, invalid URL/media rejection, forged
marker/type rejection, source-only preservation and the shared section field limit.
