# Current development tasks

Updated: 2026-11-23. This order supersedes the older feature gap report's sequencing.
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

- [x] Owner model decision: local/open-weight Qwen only; wait for verified Qwen4
  weights/license. No Qwen4-Max cloud API or silent older-model fallback.
  Comparative real-model benchmarking is deferred by request, not passed.
  See [current Qwen decision](QWEN_DECISION.md).

- [x] AI desk comparison: Gemma 4 E4B, Qwen3-8B and Qwen3.8-27B; official
  model/license sources, memory lower bounds and local hardware feasibility.
  See [comparison](AI_MODEL_COMPARISON.md). No real inference benchmark claimed.
- [x] AI execution architecture and benchmark specification; current content-only
  proposal permissions preserved. See [ADR](ADR_AI_EXECUTION.md).
- [x] Preview AI job/result contracts and offline evaluation CLI: 60 development
  and 20 separate synthetic smoke cases. No actual inference or quality score.
  See [scope and usage](AI_EVALUATION.md).
- [x] Internal durable AI job repository: SQLite/PostgreSQL, atomic revision writes,
  idempotency, mandatory authorization/audit and tenant outstanding-job quotas.
  See [scope](AI_JOB_STORAGE.md); now composed with the authorized API/panel.
- [x] Fix PostgreSQL CI clean-checkout failure: migration fixture no longer assumes
  test-results exists. AI repository tests added to required PostgreSQL acceptance.
- [x] Authorized AI API and panel: list/read, idempotent review submission, cancel,
  close review, worker-unavailable state and escaped result display.
- [x] Trusted connector orchestration and expired-lease recovery, including abrupt
  child exit on SQLite/PostgreSQL and rejection of late/cancelled/invalid results.
- [x] Docker local transport: pinned image, offline container, bounded input/output,
  resource limits, cancellation, cleanup and operator configuration.
- [x] Actual Linux container acceptance: non-root/read-only/network/cgroup controls,
  abrupt orchestrator death/watchdog, HTTP queue and dedicated CI gate. Synthetic
  probe only, not Qwen inference; see [runner scope](AI_LOCAL_RUNNER.md).
- [ ] NEXT after isolation delivery: shared contextual AI chat/right sidebar, with
  discoverable entry points on relevant editor, content, SEO, media, booking, CRM,
  commerce and publication screens. Show the selected site/page/record and explicitly
  scoped data to be sent; preserve drafts, keyboard access and mobile usability.
  Reuse authorized job/proposal APIs; no automatic edits, publishing or scanning.
  Missing model/capability must be clearly disabled, not simulated as live AI.
- [ ] Refresh the existing Sites interactive application preview after the shared
  AI interface is ready. Label sample chat/results and unsupported actions clearly;
  Sites preview must not receive local Docker access, production secrets or data.
  Verify desktop/mobile, sidebar interactions and error/unavailable states before
  updating the existing preview. Keep this separate from CMS production deployment.
- [ ] Verified Qwen4 runtime image, model load and functional/security acceptance.
- [ ] Crash-remnant janitor and separately reviewed GPU/rootless deployment profiles.
- [ ] Token accounting, retention and paid-module entitlement integration.
- [x] Pure AI job transition policy: expiring ownership, increasing attempt,
  stale revision/worker rejection, cancellation and separate human review state.
  Persistence/CAS, slot quota, human API authorization and private service worker
  identity are implemented; externally authenticated isolated workers remain pending.
- [ ] Local Qwen4 checkpoint/runtime pinning and functional/security smoke acceptance
  after official open weights and license are verified. External release pending;
  independent jobs/worker implementation continues. No quality benchmark required.
- Deferred by owner: cross-model inference comparison, expanded quality corpus and
  measured model-ranking decision. Existing offline regression tools remain available.

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
- [x] Manual source-DOM path selection for supported plain-text leaves in existing
  sections; fingerprint-bound IDs, overlap prevention and 40-field limits.
- [x] Non-executing framework evidence report, including failed imports; runtime
  component editing remains explicitly unsupported without SDK/adapter integration.
- [x] Visual click/keyboard selection of supported manual candidates in an isolated
  source preview; imported site scripts stay disabled and commit remains authoritative.
- [x] Declared React SDK component-prop bindings and a real compiled React fixture;
  no customer JSX execution or automatic component source rewriting.
- [x] Visual/component delivery gates: 233 application tests with real PostgreSQL,
  packed SDK consumer, browser click/keyboard selection and shared security policy.
  See [verification](VERIFICATION.md); full arbitrary-framework editing is not claimed.
- [ ] New section-root mapping and additional framework adapters/live build isolation.
- [ ] Legacy-console retirement plan with data authority and recovery checkpoints.
- [ ] General content types/blog followed by editorial workflow.
- [ ] SEO/media expansion, booking–CRM automations and commerce completion.
- [ ] External module distribution and paid-module entitlement lifecycle.
- [ ] Optional AI modules implementation after the analysis, isolated worker runtime
  and entitlement foundations; independent gateway and workers, not embedded model code.

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
