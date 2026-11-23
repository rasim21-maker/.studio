# AI job repository v1

Implemented internal service: `src/v2/ai-jobs.mjs`, backed by Storage API 1 on
SQLite/PostgreSQL. The local platform now composes it with `ai-service.mjs`,
the authenticated site API and the AI panel; `ai-worker.mjs` orchestrates a trusted
connector. No local model runtime is installed or silently substituted.

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
second file-backed connection. Service acceptance additionally covers abrupt child-process
exit without cleanup on both engines, restart/reclaim, stale completion fencing,
revocation during inference, cancellation and invalid results. This does not certify
an isolated inference process. Token accounting, retention/deletion and isolated
local Qwen execution remain pending.

## API and panel (2026-11-23)

Authenticated site routes under /api/v2/sites/:site/ai-jobs require content permission
and the existing session/CSRF boundary. GET lists 1–100 rows with bounded offset;
GET /:id returns a scoped job. POST accepts only revision and idempotencyKey;
server derives tenant, actor, digest, limits and a deterministic ID. The first
exposed kind is a read-only publication-review report. POST /:id/cancel or /reject
requires the current job revision. Claim/start/complete/fail are never HTTP actions.
There is no accept/apply/deploy or security scanning endpoint in this slice.

The panel polls every five seconds while open, offers pagination, start, cancel
and close-review, and renders model text as escaped text. Missing connector is
explicit: start is disabled and API submission returns 503. Existing agent-token
and content-proposal flows remain separate. Jobs and results survive restarts.
Audit records include a resource key and reach the existing query/export log.

## Connector and recovery

Trusted server configuration may inject security.aiConnector.execute({job, attempt,
artifact, signal}); it must return the shared validated result envelope. This is
an in-process orchestration boundary for a future isolated local Qwen transport,
NOT a sandbox or permission to execute imported code. No browser can configure a
connector/URL or provide worker credentials. The default application has no connector. `LOFT_AI_CONFIG` now supports the
operator-owned container transport described in AI_LOCAL_RUNNER.md. Real container
acceptance uses a synthetic probe; a Qwen inference image is not installed.
Fixture connectors deliberately identify themselves as fixture-not-qwen.

A private WeakMap binds each service worker identity to the submitting human and
site; current content authority and source revision/digest are rechecked. Only the
structured CMS document is supplied, not source files, credentials or a shell.
The current document must still equal the queued version; stale inputs fail visibly
rather than silently switching versions. Revoked permissions block execution and
completion; an authorized site editor can cancel remaining outstanding jobs.

The scheduler scans bounded batches with a tenant/site/id cursor. Database claim
CAS serializes competing workers. Leases last timeout + 5 seconds (capped at five
minutes); the HTTP job timeout is 60 seconds. Shutdown aborts the connector signal,
leaves active ownership until expiry and returns without waiting for a connector
that ignores cancellation. Restart reclaims expired ownership with a higher attempt;
late results cannot commit. Ten exhausted attempts cancel the job. Cancellation
aborts local active work after its state commits. Other instances are fenced by CAS;
remote inference may continue until its own deadline unless its transport honors
AbortSignal. No heartbeat or exactly-once inference claim is made.

Outstanding quota is currently 10 per tenant. Result review retains a slot until
closed. Fixed region=local is routing metadata, not a jurisdiction/compliance
assertion. retentionDays is currently contract metadata, not an enforced deletion
policy. Do not offer paid service or production data retention promises yet.
