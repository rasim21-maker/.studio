# @loft-studio/booking-crm

Trusted optional integration for @loft-studio/module-core. Export the definition
into ModuleHost's integrations array alongside installed studio.booking and
studio.crm modules. Requires the SDK v1 event contract booking.changed v1.

Owns reservation projections, stable person links and a deduplicated timeline.
Never merges contacts by email. Disabling either dependency hides the view and
pauses delivery without deleting history. All commands enforce the current
site/permission scope. The host runs ingest() and drain() from its local worker.

The package has no Studio application imports. See docs/v2/INTEGRATIONS.md in
the repository for API, migration, retry, UI and production limitations.
