# AI job repository v1

Implemented internal service: `src/v2/ai-jobs.mjs`, backed by Storage API 1 on
SQLite/PostgreSQL. Not wired to HTTP, panel or a model worker yet.

Initialization creates additive `studio_ai_job_scopes` and `studio_ai_jobs_v1`
tables. Jobs, state, source revision/digest and validated completion results persist.
Uniqueness covers tenant/site/job and tenant/site/idempotency key. Identical replay
returns the original record; changed input conflicts. No existing CMS data migrates.

Mutations serialize through a tenant scope row and compare-and-swap the revision.
PostgreSQL serialization failures remain explicit RETRY_TRANSACTION; callers must
retry with current authority/state, never blindly replay an external side effect.
Audit records and mutations share a transaction; audit failure rolls everything back.
Completion saves a validated result for review, not content publication.

The mandatory deployment-supplied `authorize(actor, site, action)` resolves current
tenantId/siteId/maxActive and, for worker actions, authenticated workerId. It MUST
deny unauthorized actions, distinguish human review from worker commands, and use
authoritative local permissions. Scope validation is not authentication. Do not expose
this class directly to client-provided actors/worker IDs. Rights are checked again
before returning reads/replays and before committing mutations. No model or remote
network call belongs inside these transactions. Acceptance only marks job metadata;
CMS content acceptance still requires the existing authorized proposal API.

Quota is outstanding jobs per tenant, across sites: queued/leased/running/review
reserve a slot; cancellation/failure/rejection/acceptance releases it. Expired leases
remain outstanding until reassigned or explicitly cancelled. maxActive is trusted
deployment policy (1–1000), not client configuration. This is NOT token billing,
rate limiting, subscription entitlement or provider usage reconciliation.

Tests cover both actual engines, competing claims/last quota slot, wrong tenant/site,
worker identity, changed idempotency input, stale result attempt, atomic audit failure,
revocation rollback and persisted results. SQLite is additionally read through a
second file-backed connection. No process-crash recovery or isolated worker claim
is made. Next: HTTP composition, worker identity/lease recovery, token accounting,
retention/deletion and isolated local Qwen execution after verified weights release.
