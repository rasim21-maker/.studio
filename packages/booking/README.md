# @loft-studio/booking

Version 0.1.0. See docs/v2/MODULES.md in the Studio repository for the public contract, usage, migration and security boundaries.

This first-party package is private while the product license is being selected. It is tested as a standalone local tarball; it has not been published to npm.

Current applications use `AsyncBooking` from `./async-engine` with an initialized
`OperationsRepository` from `./repository`. Supply Storage API 1, authoritative
site resolution, audit and authorization hooks. Await every domain operation.
SQLite and PostgreSQL run the same capacity/idempotency/payment-lock tests.
`./engine` remains the synchronous compatibility export; it is not the new
application's persistence path. See docs/v2/OPERATION_STORAGE.md for migration.
