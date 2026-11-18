# Asynchronous module runtime and database acceptance

Date: 2026-11-19. Module API 2 is an explicit preview contract; API 1 remains
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

The outbox is durable and transactional. API 2 does NOT yet provide a delivery
worker, cross-module integration projection or independent before/after audit
capture. Event insertion is not a claim that external delivery occurred.
The previous API 1 booking-CRM worker and audit system continue unchanged.

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

The existing /v2/ application still composes the API 1 host. This delivery does
not switch existing sites automatically, migrate production data, or declare
the whole CMS PostgreSQL-ready. Booking's operational store, SEO's content-save
service, booking-CRM delivery and audit capture need transaction-aware ports
before the default application can switch safely. defineAsyncModule rejects
legacy eventSource/exportData/services ports instead of pretending they share
the new transaction.

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
