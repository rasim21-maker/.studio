# Asynchronous module runtime and database acceptance

2026-11-21 update: booking/payment repositories now use the same asynchronous
storage contract on SQLite and PostgreSQL. See [operational storage](OPERATION_STORAGE.md)
for current composition, migration and acceptance; the 20 November boundary below
describes the preceding cutover stage.

Date: 2026-11-20. Module API 2 is an explicit preview contract; API 1 remains
available for existing applications. Storage API version remains 1.

## Implemented runtime

Import AsyncModuleHost from @loft-studio/module-core/async and supply either
SQLiteStorage or PostgreSQLStorage. Call await host.initialize() before serving
requests. The host implements asynchronous lifecycle, collection, execute,
export and importLegacy methods. No SQL handle or database connection is exposed
to business modules.

The SDK exports defineAsyncModule and AsyncContext/AsyncRecords types. API 1
modules are rejected by this runtime instead of silently receiving Promise
values. Hooks, migrations, commands, record operations and emit must be awaited.
A context expires when its transaction ends. Submitted repository operations
are tracked before commit; a caught repository/nested context error still aborts
the unit. ctx.transaction(work) joins the existing unit; it is not a savepoint
and cannot independently commit or roll back.

The first business ports are:
- @loft-studio/crm/async: companies, contacts, opportunities, activities and
  currency-separated pipeline summary.
- @loft-studio/commerce/async: catalog/stock, atomic manual order, request
  idempotency and cancellation with a single stock restoration.

They reuse existing schemas and preserve default API 1 exports. API 2 command
implementations explicitly await repository calls; there is no source rewriting,
Promise proxy or automatic conversion of unreviewed module code.

## Persistence and transaction rules

New tables are studio_async_scopes, studio_async_installations,
studio_async_records and studio_async_outbox. Records are scoped by organization,
site, module, collection and record ID. Authorization resolves the organization
from a trusted current site lookup; a caller cannot supply an arbitrary tenant
to a record operation. Permissions are checked at repository boundaries, after
hooks, and before returning from the unit.

A scope row is updated to serialize decisions within a site. SQLite holds its
dedicated queued connection. PostgreSQL uses SERIALIZABLE and a leased client;
competing transactions may return RETRY_TRANSACTION. Retrying is explicit at the
application/use-case boundary, never hidden inside the database adapter. No
network side effect may be repeated blindly.

All schema validation, uniqueness/reference checks, record mutations and
outbox inserts happen in the same transaction. Migration failure rolls back
the installation and its new records. Disabled/uninstalled modules preserve
read/export access. Deleted records retain an internal tombstone and a monotonic
revision, preventing old updates from being accepted after ID recreation.

This preview evaluates collection search, uniqueness and references in the
repository process under the site lock. It is intended for bounded local/module
datasets; high-volume indexed query/unique/reference repositories are a later
optimization. This is application-enforced tenant scoping, not PostgreSQL RLS.
Authorization infrastructure must use the current authoritative memberships.

The outbox now has versioned event envelopes, awaited source ingestion and a
durable integration delivery worker. Booking-CRM projections, delivery state,
cross-module references and audit append share the transaction. Failed handlers
roll back projections, retry with bounded backoff and store a fixed error code.
Disabled modules hide related views and pause delivery without deleting history.
Integration contexts expire and track submitted operations, like module contexts.
This is local durable delivery, not a claim of external provider delivery.

## Migrating existing records

host.importLegacy(actor, siteId, moduleId, snapshot) accepts the existing
ModuleHost.export result (format studio-module-data, version 1).

Requirements:
1. Quiesce source writes and take the normal protected backup.
2. Export under the authorized source account; keep the export private.
3. Use an empty target installation with the same site ID, module version and
   schema version. API 2 definitions must be registered.
4. Run importLegacy. IDs, revisions, timestamps, values and installation state
   are preserved; normalizing or silently dropping values is rejected.
5. Compare source and target exports. Keep source history and backup.
6. Switch the application's routing to the selected authority only after all
   required integrations have been migrated. Do not leave two writable sources.

Duplicates, dangling references, unexpected IDs, invalid data, mismatched site,
nonempty targets and repeated imports are refused. Import is atomic.
Domain beforeSave hooks run with a read-only context for validation and must not
transform migrated values. The initial migration limit is 10,000 records.
Operational export payloads and nonempty integration records are refused, since
silently discarding booking/customer relationships would be data loss.

The implementation leaves the source untouched. A successful copy alone does
not freeze the old source or switch the live UI. Source quiescence and authority
cutover remain explicit deployment steps.

## Application boundary

The default /v2/ panel now composes AsyncModuleHost. All catalog, lifecycle,
collection, command, integration and export routes await it. The delivery timer
coalesces overlapping runs, and shutdown waits for delivery/audit work.

The local app keeps module state in DATA_DIR/modules.sqlite, on a dedicated
connection, and keeps operational reservations/payments and source content in
console.sqlite. The booking engine and content adapter remain authoritative;
they are not rewritten as PostgreSQL repositories in this delivery. The real PG
tests cover async module/integration/audit persistence with these explicit local
domain ports. The entire CMS is **not** PostgreSQL-ready.

Commands can declare an allowlisted `port` and module `ports`. Their async `run`
prepares a payload with a read-only context. After that transaction commits, the
host rechecks authorization, tenant and installation revision, then calls the
deployment-supplied port outside SQL locks. A port owns its domain transaction,
validation and idempotency. It must recheck domain preconditions at the write.
There is no distributed transaction or automatic retry of side effects.

`booking/async` provides the operational binding and awaited event source;
`seo/async` awaits records and uses expected content revision on applyPage.
`booking-crm/async` awaits every projection/link/timeline operation. Composition
bindings (ports, source, provision and exportData) are trusted application code,
not permissions granted to arbitrary modules. Booking provisioning is idempotent
and runs after installation; a provisioning failure does not roll back the module
database. Retry provisioning before serving that site's operational commands.

`audit/async` appends sanitized before/after values and request provenance in the
same transaction as module/integration changes. Failure aborts the mutation. A
retryable bridge inserts those entries, using their stable IDs and timestamps,
into the existing audit query/export store, then acknowledges the source. A crash
between insert and acknowledgment cannot duplicate entries. Audit reads flush the
bridge after authorization; old audit records remain available. SQL access is
trusted infrastructure access; this is not a tamper-proof/WORM ledger.

### Local cutover and recovery

Before starting this release, stop all old processes and take the existing offline
protected backup of the whole DATA_DIR (including keys through the protected key
backup procedure). Startup freezes legacy module/integration writes, copies IDs,
revisions, values, installations, references, cursors and delivery state into an
empty target transaction, then records a paired database identity. Unknown package
records remain retained. Incompatible installed schema versions require a legacy
upgrade first. Failed copies can be retried; source writes remain frozen.

Legacy source tables and operational data are not deleted. A restart does not
recopy them. A missing modules.sqlite or a database paired with a different source
fails closed. Keep console.sqlite and modules.sqlite in the same offline backup
set; never restore just one after new writes. Rolling back requires the complete
pre-cutover backup plus the matching application version, with a plan for any new
operational data. Do not simply remove freeze triggers or delete modules.sqlite.
No production data was migrated as part of development tests.

The reusable API 2 runtime, CRM/commerce ports and migration are executable
package entry points, verified on both engines. Their deployment is separate
from the legacy application's compatibility path.

## Real database verification

test/v2/async-modules.test.mjs runs one acceptance suite against each backend:
- Real v1 export/import with identity and revision preservation.
- Scoped CRUD, reference integrity, uniqueness and stale updates.
- Mutation/outbox rollback, read-only denial and permission revocation.
- Order pricing, stock, idempotency, cancellation and rollback.
- Submitted unawaited repository operations and caught nested errors.
- Concurrent last-stock competition with one successful order.
- Tombstone revisions and data preservation across disable/enable.
- Failing async upgrade with unchanged installation and records.

Development acceptance used a real PostgreSQL 17.7 server in an isolated Docker
container on 127.0.0.1:55432. Both engines passed all 18 reported tests (including
the two parent tests). No mock pool or in-memory PostgreSQL emulator was used
for this acceptance. Earlier storage protocol fixtures remain useful separate
unit tests.

The dev-only driver is pg 8.23.1, pinned in the lockfile. Upstream:
https://github.com/brianc/node-postgres. The packaged driver is MIT; reviewed
transitive licenses include ISC. pg-types 2.2.0 and pgpass 1.0.5 carry complete
MIT notices in README license sections; scripts/licenses.mjs includes those
specific notices. No package's absence of a separate LICENSE file is treated
as permission without reviewing its notice. Dependency inventory and
THIRD_PARTY_NOTICES.md include the additions.

Run against a dedicated local test database:

~~~powershell
$env:LOFT_TEST_POSTGRES_URL='postgresql://postgres@127.0.0.1:55432/loft_test'
npm.cmd run test:postgres
~~~

The acceptance command fails when its URL is absent and restricts the destination
to loopback loft_test/studio_test databases. Normal test:v2 explicitly skips the
PostgreSQL group if no URL is supplied. CI has a separate mandatory PostgreSQL
service job and invokes test:postgres; it cannot silently skip the database test.
Trust authentication in that ephemeral test container is not a deployment
configuration. No production credentials or user data are needed.

The packed consumer imports AsyncModuleHost, both business ports and the
storage contract outside the application checkout. Keep the full regression,
typecheck, build, dependency inventory and audit gates for delivery.
