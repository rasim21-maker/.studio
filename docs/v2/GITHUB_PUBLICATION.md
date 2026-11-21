# GitHub publication

2026-11-21. GitHub-connected sites can prepare and explicitly submit a saved
snapshot from the editor's publication dialog. ZIP export remains available.
This writes source files to GitHub; it does not build or deploy a hosted website.

## User flow

Import a repository using a branch name and a repository-scoped token with Contents
write permission. Tokens remain in the existing encrypted connection store. Tags
and SHA-only snapshots are readable imports but cannot be publication targets.
Existing tree-based imports are accepted only when the exact branch still resolves
to the imported tree. No permission is inferred from the presence of a token.

Save edits, open Publish, then prepare the saved revision. Inspect the repository,
branch, commit and changed paths before selecting the separate send action. This
is the normal product publication action; preparation alone never updates a ref.
Protected branch rules are honored. No automatic force-push, PR bypass or workflow
permission elevation is performed.

The first release adds/updates regular files and preserves untouched repository
paths and executable mode. Deletion, symlink/submodule replacement, credentials,
runtime files and `.github` workflow writes are excluded. File/tree size and path
constraints share import limits. Binary assets use base64 blobs and returned Git
object hashes are checked. A Git tree's SHA is never used as a commit parent.

## Components and API

- `src/v2/github-publisher.ts`: fixed api.github.com transport through safeRequest,
  branch resolution, immutable object preparation, parent validation and non-forced
  reference update. Transport injection is only for trusted composition/tests.
- `src/v2/github-publications.ts`: host-owned durable state, site/permission/revision
  checks, encrypted connection access and atomic local completion/audit writes.
- `ui/github-publish-panel.tsx`: preparation, changed path review, status and retry.
- `GET /api/v2/sites/:site/github-publications`: last 30 scoped records.
- `POST /api/v2/sites/:site/github-publications`: `{revision}`; idempotent for the
  same site revision and connection revision when preparation has completed.
- `POST /api/v2/sites/:site/github-publications/:id/publish`: finalize/reconcile
  the persisted commit. All endpoints require publication permission; mutation
  routes inherit the application's session, origin and CSRF checks.

The additive `studio_github_publications` table lives in console.sqlite, alongside
content authority, and is included by existing backups. States are preparing,
prepared, publishing, published, failed and review. No data rewrite is required.
Preparation errors can retry; incomplete preparation may leave unreachable Git
objects, never an updated branch. Prepared objects survive server restart.

An ambiguous ref-update response leaves the record for review. Retrying the same
record first reads the branch: if it already equals the recorded commit, local
completion proceeds without another PATCH. If another writer advanced the branch,
the operation stops. Changes to the local site or connection also stop publication;
after an uncertain remote write plus such a local change, manually inspect GitHub
and re-import rather than automatically accepting or overwriting either side.

Local record creation/completion/audit are transactional; GitHub and SQLite are not
a distributed transaction. The local host serializes each site's publication;
multi-process publication workers/leases are not supported by this first slice.
No automatic network-side-effect retries occur. GitHub fast-forward checks reject
divergent races but are not an exact old-value compare-and-swap API against external
force resets; do not grant other actors force-reset permissions as part of a release
workflow. Publication is not continuous deployment or provider rollback.

## Verification

`test/v2/github-publisher.test.mjs` covers stable parent/tree handling, changed-file
overlays, modes, binary blobs, no-op, invalid paths, forbidden files, truncated trees,
stale heads, races, authorization revocation, unexpected response hashes and lost
PATCH replies. HTTP acceptance uses real local persistence and encrypted import
credentials, restart, CSRF, scope checks, review-state recovery and no duplicate
branch update. GitHub responses are controlled fixtures, not live provider acceptance.

The actual React publication panel was exercised in a local fixture: preparation,
ambiguous-response display and Enter-key reconciliation. The narrow viewport was
also inspected; this is not a full WCAG or cross-device certification. The Sites
sample demo is separate and has not been replaced by a live GitHub-connected CMS.

API contracts reviewed against official documentation (2026-11-21):
- https://docs.github.com/en/rest/git/refs
- https://docs.github.com/en/rest/git/trees
- https://docs.github.com/en/rest/git/commits

No new package dependency, npm license obligation or SDK version change was needed.
