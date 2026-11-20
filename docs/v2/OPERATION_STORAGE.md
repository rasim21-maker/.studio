# Async booking and payment storage

Date: 2026-11-21. The default application now serves booking, calendar, provider
configuration and payments through asynchronous repositories. The old synchronous
Booking/Integrations exports remain for compatibility consumers and migration
tests; the HTTP application no longer writes through them.

## Boundaries

- `@loft-studio/booking/async-engine`: awaited booking/domain operations.
- `@loft-studio/booking/repository`: trusted SQL repository on Storage API 1,
  supporting SQLiteStorage and PostgreSQLStorage. SQL is not exposed to module code.
- `src/async-payments.mjs`: async provider configuration and payment orchestration,
  reusing existing provider transport/signature code.
- `src/operations.mjs`: application composition, source migration, tenant lookup,
  request authorization and audit attachment.
- `packages/booking/rules.mjs`: shared pure validation, date/time and pricing rules
  used by both engines; no runtime source conversion is used.

The local application uses `operations.sqlite`, `modules.sqlite` and
`console.sqlite` in DATA_DIR. `security.operationsStorage` accepts an injected
PostgreSQLStorage; the caller owns its pool shutdown. Authentication, content and
the audit query store still use the existing application store. This is not a
whole-CMS PostgreSQL configuration switch.

## Transactions and provider calls

Booking methods serialize decisions through an operational site scope row.
Nested domain calls join the same transaction. Capacity, revision checks,
participants, idempotency, minimal booking-change events and audit append commit
together. Tenant identity is resolved from the current application authority and
rechecked before commit. The HTTP adapter retains authorization across awaits.
PostgreSQL uses SERIALIZABLE; callers may explicitly retry RETRY_TRANSACTION for
safe domain operations. Network effects are never automatically replayed by storage.

Checkout reserves/reuses a durable payment ID and checks the current booking in a
short transaction, then releases SQL locks before calling a provider. Stripe and
PayPal reuse that ID for their existing idempotency headers. iyzico's attempted
marker is claimed transactionally; uncertain initialization is not blindly retried.
Verification rechecks the current payment and booking before atomically confirming
both. Already-paid/review results cannot be downgraded by another verification.
Late payments remain `review` and never recreate capacity. Stripe event receipt IDs
are scoped to site/provider. No new provider protocol or live payment acceptance is
claimed; external requests in tests use synthetic provider fixtures.

The repository captures before/after changes and booking events without depending
on SQLite-only triggers. The existing audit bridge drains both module and
operational audit stores with stable IDs. Payment secret/reference payloads are
excluded from the audit allowlist. Authorized history, cancellation and payment
reconciliation continue after a booking module is disabled.

## Migration, restart and backup

Stop the application and take a protected offline backup before starting this
version. Startup initializes the legacy schema for compatibility, freezes the old
operational tables, and copies them into an empty target transaction. Reservations,
participants, settings, request fingerprints, encrypted provider keys, payment
IDs/statuses/references and booking event sequences are preserved. A source/target
identity prevents accidental pairing or re-copying stale source data after restart.
An interrupted copy can be retried; the old writer stays frozen. A missing target
after successful cutover fails closed. Keep `integration-key` with the protected
key backup; ciphertext is preserved rather than re-encrypted with a new key.

Local backups must contain all three databases as one offline set. The backup
tool now snapshots and checks each database and excludes their WAL/SHM sidecars.
It refuses a missing paired database. An externally injected PostgreSQL operations
store needs a coordinated PostgreSQL backup/restore process; the local file backup
tool does not pretend to back up that server. Returning to old application code
requires a tested complete backup recovery and reconciliation of new operations,
not simply deleting operations.sqlite or disabling freeze triggers.

## Acceptance

`async-operations.test.mjs` runs against SQLite and real PostgreSQL: capacity race,
idempotency, audit rollback, unlocked provider waits, payment locks, concurrent
verification, late-payment review and tenant/permission checks.
`operations-migration.test.mjs` copies real legacy rows into both backends and
checks restart, original customer management tokens, encrypted provider settings,
request identity and event sequence preservation. The HTTP provider/regression
tests use the default new repository. `test:postgres` requires all async suites;
a missing PostgreSQL URL is a failure for that command.
