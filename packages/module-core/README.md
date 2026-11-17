# @loft-studio/module-core

The ./storage subpath exports an asynchronous transaction contract, dedicated
SQLiteStorage and an injected-pool PostgreSQLStorage. The ./trust subpath exports
deployment approval checks and a loader gate. Existing ModuleHost remains the
synchronous SQLite v1 compatibility host. See docs/v2/STORAGE_AND_TRUST.md in
the repository for ownership, migration and live-PostgreSQL validation limits.

Version 0.1.0. See docs/v2/MODULES.md in the Studio repository for the public contract, usage, migration and security boundaries.

This first-party package is private while the product license is being selected. It is tested as a standalone local tarball; it has not been published to npm.
