# Asynchronous storage and module trust contracts

2026-11-19 update: the [API 2 preview runtime](ASYNC_MODULES.md) now provides
async records/lifecycle/commands and CRM/commerce ports, including legacy record
migration and real PostgreSQL acceptance. The original foundation description
below remains the API 1 compatibility boundary; default application cutover and
transaction-aware booking/SEO/integration/audit ports are still outstanding.

Date: 2026-11-17. Status: implemented storage foundation; existing application
and module API v1 remain on the synchronous SQLite compatibility path.

## Scope and compatibility

The new `@loft-studio/module-core/storage` export provides a versioned,
Promise-based unit-of-work contract with SQLite and PostgreSQL implementations.
It is not a switch that migrates the whole application to PostgreSQL. Existing
content, booking, integrations and audit triggers still use their current store.
No customer data, existing tables or content authority are migrated by this change.

This separation is intentional: changing v1's synchronous return values into
Promises would silently break module hooks, migrations, financial calculations
and event handlers. Keep v1 stable while building an explicitly versioned next
module host. Do not advertise API v2 until its lifecycle, records, hooks, events
and authorization all use the new transaction-scoped repositories.

## Implemented storage interface

`Storage.apiVersion = 1`; dialect is sqlite or postgres.
`await storage.transaction(async tx => result)` commits only after the callback
and all submitted operations complete. Failure rolls back. The transaction
handle exposes Promise-based query/get/all. It becomes invalid after completion.

SQL is only for trusted repository implementations, not browser inputs or module
commands. Use bound parameters. For differing SQL use a statement object:
`{sqlite: '... WHERE id=?', postgres: '... WHERE id=$1'}`.
There is no regular-expression placeholder rewrite that could corrupt quoted SQL.

Transactions are not automatically retried. PostgreSQL serialization/deadlock
failures have code RETRY_TRANSACTION. The caller may retry the complete use case
only when its side effects are safe. Do not send email, charge cards or call
external APIs in callbacks that may be repeated. Use an atomic outbox instead.

Nested transactions are rejected before waiting, preventing SQLite queue
deadlocks. Reuse the transaction argument for repository calls. Do not keep a
global ambient repository that accidentally escapes the unit of work. Query
failure poisons the unit even when caught by the callback; neither backend
silently commits partial work. A stale transaction handle cannot issue SQL.

### SQLite

`new SQLiteStorage(filename)` owns a dedicated node:sqlite connection and enables
foreign keys/WAL/busy timeout. Transactions use BEGIN IMMEDIATE and a per-instance
queue held across await boundaries. Concurrent callbacks cannot commit or roll
back one another's work. Close drains accepted work and rejects new work.

Never wrap the legacy Store's exposed connection and then await inside it.
Existing synchronous routes could otherwise execute in another request's open
transaction. Dedicated ownership is part of this interface's safety contract.
The async interface does not make synchronous SQLite queries nonblocking.

### PostgreSQL

`new PostgreSQLStorage(pool)` accepts a node-postgres-compatible injected pool.
Each unit leases one client; BEGIN SERIALIZABLE, all queries, COMMIT/ROLLBACK and
release use that client. pool.query is never used for transactions. Rollback
failure discards the client. The caller owns pool configuration and shutdown,
including connection TLS, credentials, statement/lock timeouts and pool size.

No driver package is added or downloaded by this library. Deployment must supply
an independently reviewed driver. Tests exercise the protocol using a controlled
pool; this delivery has not run against a live PostgreSQL server. Docker is
installed on the development machine, but its engine is not available.

The contract is based on the official
[node-postgres transaction guidance](https://node-postgres.com/features/transactions)
and [PostgreSQL transaction semantics](https://www.postgresql.org/docs/current/sql-set-transaction.html).
No third-party source code was copied.

## Required next repository boundary

The new module host must expose asynchronous repositories scoped by a verified
organization/site/module, not raw SQL. All collection lookup, uniqueness checks,
reference protection, expected-revision writes, event insertion and audit
insertion must use the same transaction handle.

The next Context contract is:
- transaction(work): Promise of work result; work receives a transaction-bound context.
- records.get/list/find/put/remove: Promise results, requiring await.
- emit: Promise, inserting a durable outbox record in the same transaction.
- migrations and hooks: awaitable and limited to declared repository/service ports.
- permissions and current installation state: checked on reads and again before
  writes after asynchronous boundaries.
- external side effects: only after committed outbox delivery with idempotency.

This is a migration specification, not a claim that current SDK Context already
implements it. PostgreSQL tenant policies, CAS/uniqueness constraints, durable
reference semantics and cross-backend module acceptance must land before moving
application traffic. Existing SQLite audit triggers cannot be assumed to operate
on PostgreSQL: implement a PostgreSQL capture backend or transactional audit port
with rollback/failure tests. Content/operational rollback separation stays intact.

## Enforced deployment trust model

Two execution policies exist:
- trusted-local (compatibility default): deployment-selected packages are trusted
  Node code in the application process.
- reviewed-only: exact package ID/version approval map is required for every
  module and integration. Unknown packages/versions fail host construction.

Pass the policy via createApp security.moduleTrustPolicy, or directly to
ModuleHost. It is operator/deployment configuration, never a package's own claim.
An isolated mode is rejected because an isolated executor is not implemented.

`loadReviewedPackage({id,version,load}, policy)` checks approval before invoking
the deployment-owned loader and verifies returned identity afterwards.
Use it when loading optional reviewed packages. Static imports execute before
ModuleHost can inspect them; host validation cannot retroactively protect against
import-time code. Never import an unknown package merely to inspect its manifest.

An ID/version approval is not a signature or content hash. Operators must lock
and review the actual artifact and installation provenance. No upload/install
endpoint or marketplace is added. Service permissions are not OS isolation.
Paid versus free does not determine trust. A vetted commercial package can use
trusted execution; unreviewed third-party code needs a separate restricted
process/container with brokered capabilities before it can be supported.

## Acceptance and migration order

1. Current foundation: asynchronous transaction contract, both backend
   implementations, rollback/concurrency/lifetime tests, deployment trust gates.
2. Introduce transaction-scoped repositories and a new versioned module context;
   run the same repository suite against actual SQLite and PostgreSQL.
3. Port module lifecycle/hooks/commands, integration delivery and audit capture;
   retain a clearly separate v1 compatibility host.
4. Add PostgreSQL tenant boundaries, migration/export/reconciliation tools and
   real-provider CI. Test cross-tenant denial and competing transactions.
5. Move one vertical use case, then expand. Keep booking/payment history and IDs;
   never convert operational data by restoring an old content snapshot.

The first step is delivered here. Later steps are not implied by the presence
of a PostgreSQL adapter class.

## Verification

test/v2/storage.test.mjs covers SQLite async rollback and serialized concurrency,
escaped handles, nested transactions, PostgreSQL same-client lifecycle,
serialization failure without implicit retry, failed rollback connection discard,
caught query errors, and trust rejection before loading. The packed-package
consumer also imports the storage/trust subpaths and performs a SQLite unit.

The PostgreSQL protocol fixture is deliberately not labelled a PostgreSQL engine
integration test. Existing v1 module/application suites remain required.
