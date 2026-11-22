# Targeted reuse decision — 22 November 2026

Scope: visual source picking and declared React component bindings. No new third-party
dependency or copied external source was added. Existing parse5 8.1.0 (MIT), React
19.3.1 (MIT) and esbuild 0.28.2 (MIT) handle parsing, UI and build/test work. Their
exact locked versions and notices remain in the generated dependency inventory and
THIRD_PARTY_NOTICES.md; the full license/SBOM/audit checks still apply.

| Candidate / official evidence | Assessment | Decision |
| --- | --- | --- |
| [GrapesJS core](https://github.com/GrapesJS/grapesjs), [package](https://github.com/GrapesJS/grapesjs/blob/dev/packages/core/package.json), [license](https://github.com/GrapesJS/grapesjs/blob/dev/packages/core/LICENSE) | Inspected dev package reports 0.23.9 / BSD-3-Clause; repository displays ~26.4k stars. Full editor/model with Backbone and CodeMirror 5 dependencies alongside our current React/source-authority model. | Do not introduce a second editor for a bounded picker. Reassess for a separate template-builder adapter. |
| [react-dev-inspector](https://github.com/zthxxx/react-dev-inspector), [README](https://github.com/zthxxx/react-dev-inspector/blob/dev/README.md), [license](https://github.com/zthxxx/react-dev-inspector/blob/dev/LICENSE) | MIT; ~1.3k stars. Inspects running React and communicates with dev-server middleware to open IDE source. | Wrong trust boundary for inert imported-site previews. No version adopted or pinned. |

Stars are dated context, not quality/security evidence. These candidates were screened
for functional fit, not installed or comprehensively audited. No claim is made that
their current transitive dependencies are vulnerability-free. A future adoption must
verify a concrete release/commit, maintenance, accessibility, licenses and advisories.
GrapesJS core and the separately licensed Grapes Studio SDK are different products;
the latter was not treated as unrestricted open-source code.

The small first-party picker protocol and content-prop bridge are Loft-specific glue:
they preserve server authorization, source hashes and the opaque-origin iframe
boundary. This saves effort by reusing installed parsers/renderers, while avoiding
framework execution or a second content authority merely to obtain click selection.
