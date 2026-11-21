# Current development tasks

Updated: 2026-11-21. This order supersedes the older feature gap report's sequencing.
Update this list and share its current state after each completed task.

## Delivered foundation

- [x] Async storage/module contracts and explicit trusted in-process module model.
- [x] Async reservation/payment storage, SQLite and real PostgreSQL acceptance.
- [x] Private Sites sample panel, separate from production CMS hosting.

## Current delivery

- [x] GitHub write-back provider: immutable objects, expected source checks and
  non-forced branch update. Full regression passed (217 application tests).
- [x] Durable GitHub publication records and panel preparation/reconciliation.
  HTTP persistence/restart and browser fixture checks passed. Live GitHub acceptance
  remains a separate pending check; no live external repository was modified by tests.

## Next dependent work

- [x] Cloudflare Pages Git-connected production-branch deployment, commit receipt
  comparison and HTTP verification (provider fixtures; live acceptance pending).
- [x] Netlify static ZIP deployment and HTTP verification (provider fixtures).
- [x] Self-hosted static deployment agent: real local HTTP/disk/restart tests.
- [x] Natro VPS/VDS connection through the same Node-capable static agent;
  shared FTP hosting is unsupported. See [hosting scope and setup](HOSTING.md).
- [x] Hosting panel state/error checks and full regression: 222 application tests.
- [ ] Live account acceptance for GitHub and all four hosting targets, including
  actual TLS/proxy and provider credentials. No live acceptance claimed by fixtures.
- [ ] Natro shared-hosting/FTP publication, if required, needs a separate connector.
  Keep source commit, build result and deployed release separate; ZIP is not hosting.
- [x] Unmarked static HTML text discovery, import-review selection and permanent
  source annotation. Direct headings/paragraphs and nested section text supported;
  selection/export/reimport and HTTP restart tested. See [scope](FIELD_MAPPING.md).
- [x] Static link targets, image alt and verified local image selection with permanent
  attribute bindings. External/responsive image source replacement remains unsupported.
- [ ] Broader manual DOM mapping and framework-aware discovery.
- [ ] Legacy-console retirement plan with data authority and recovery checkpoints.
- [ ] General content types/blog followed by editorial workflow.
- [ ] SEO/media expansion, booking–CRM automations and commerce completion.
- [ ] External module distribution and paid-module entitlement lifecycle.

Live hosting requires the chosen provider/project and credentials. Product licensing
and public module distribution remain separate decisions. Isolation for untrusted
third-party modules remains a production prerequisite; declared capabilities are
not a sandbox. Full CMS PostgreSQL deployment remains outside the completed
operational-storage acceptance. See the feature gap report for the broader backlog.

Provider research (official references, 2026-11-21):
- https://developers.cloudflare.com/api/python/resources/pages/subresources/projects/subresources/deployments/methods/create/
- https://docs.netlify.com/api-and-cli-guides/api-guides/get-started-with-api/
- https://www.natro.com/hemendestek/bilgibankasi/dosyalarimi-web-siteme-nasil-aktarabilirim
- https://www.natro.com/hemendestek/bilgibankasi/websitem-icin-ssh-erisimini-nasil-kullanabilirim
