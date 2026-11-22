# @loft-studio/sdk

The private workspace also exports `@loft-studio/sdk/components` with
`validateComponentBindings(document, manifest)` and
`componentProps(document, manifest, componentId, locale?)`. It resolves declared
primitive props without loading component source. See [the guide](../../docs/v2/COMPONENT_BINDINGS.md).
This data bridge is separate from business-module API versions.

Version 0.1.0. See docs/v2/MODULES.md in the Studio repository for the public contract, usage, migration and security boundaries.

This first-party package is private while the product license is being selected. It is tested as a standalone local tarball; it has not been published to npm.

For the current panel use `studio-module create-async <directory> <namespace.name>`.
It generates API 2 and `defineAsyncModule`; await all records, emit and transaction
operations. `check` validates either API. `create` remains an API 1 compatibility
generator, not a module for the current panel. Port commands prepare payloads using
a read-only context; deployment-owned ports execute outside the module transaction.
