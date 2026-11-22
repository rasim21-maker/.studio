# Optional AI modules — analysis scope and ordering

22 November 2026. Requested product direction, NOT implemented functionality.

## Priority and architectural decision

Desk analysis is complete: [model comparison](AI_MODEL_COMPARISON.md) and
[execution ADR](ADR_AI_EXECUTION.md). The [first contracts/offline evaluator slice](AI_EVALUATION.md)
is implemented; durable execution and real inference remain next. Model selection and installation remain
pending; the comparison is not measured benchmark evidence.
Implementation follows the worker-isolation and commercial-entitlement prerequisites;
it must not be presented as completion of core CMS/blog/editorial backlog items.
The current application is a modular monolith. The new AI execution layer is designed
as separately deployable services/workers behind versioned APIs, not embedded model
code in platform.ts or additional provider-specific branches in business modules.

## Independently installable units

| Unit | Responsibility | Authority |
| --- | --- | --- |
| Model gateway | Local/self-hosted/provider adapters, model capability registry, streaming, cancellation and token accounting | No direct CMS/database/deploy authority |
| Editing assistant module | Content/translation/layout proposals and declared component-field suggestions | Scoped read/propose; normal acceptance/write APIs |
| Publication assistant module | Explain diffs, run allowed checks, prepare release proposals | Existing publication policy and explicit release action; no unrestricted shell |
| Security assessment module | Authorized target validation, bounded scan jobs, evidence and remediation proposals | Dedicated isolated worker; target-specific scope, no admin session |
| Entitlement integration | Activation, subscriptions/credits, quotas, metering and feature availability | Server-enforced permission plus entitlement; neither replaces the other |

Modules should depend on gateway/job contracts, not model brands. A missing gateway,
disabled module, exhausted quota or expired entitlement must be visible and leave
normal CMS editing available. Disabling a module preserves content and prior reports;
in-flight jobs are cancelled or safely completed according to persisted job policy.

## Proposed contracts for analysis

- Gateway capabilities: context limits, structured output, supported languages,
  tool proposal format, cost/memory estimates and license/distribution constraints.
- Job envelope: tenant/site/environment, verified actor and permission snapshot,
  purpose, target allowlist, model/version, input artifact digests, budget/deadline,
  idempotency key, cancellation token and audit correlation ID.
- Result envelope: typed proposal/report, evidence references, confidence and
  uncertainties, measured usage, validation failures and proposed next action.
- Persist jobs with queued/running/review/completed/failed/cancelled states. Events
  and delivery retries must be idempotent; provider calls are outside DB locks.
- Gate all final writes with current authorization, revision, validation and the
  site's existing publication policy. Model completion is never approval.

## Model, license and resource evaluation

Benchmark a small shortlist on Loft tasks: Turkish/English editing, constrained
JSON, source/field mapping, code-change proposals, tool-call correctness and
security-report quality. Measure correctness, unsupported claims, prompt injection
resistance, context limits, latency, VRAM/RAM, concurrency and cost per accepted
task. Compare local/remote deployment and multiple quantizations on actual hardware.
Do not choose based solely on parameter count, benchmark marketing or GitHub stars.

Distinguish open-source code, open weights and a model license allowing commercial
hosting/resale/redistribution. Verify exact weight/version/tokenizer licenses and
notice duties before adoption. Hardware, peak concurrency, hosting budget and
whether weights will be redistributed are unresolved inputs to the analysis.

## Initial model shortlist (official evidence checked 2026-11-22)

Include US and Chinese model developers under the same acceptance criteria.
Developer origin is separate from inference location, retention and data residency.
No weights have been downloaded and no performance claim is established locally.

| Candidate | Official evidence | Proposed evaluation role |
| --- | --- | --- |
| Google Gemma 4, initially E4B | [Official model card](https://huggingface.co/google/gemma-4-E4B) lists Apache-2.0 | Smaller deployment baseline; multilingual editing and visual/source mapping |
| Alibaba Qwen 3, initially Qwen3-8B | [Official model card](https://huggingface.co/Qwen/Qwen3-8B) lists Apache-2.0 | Structured proposals, Turkish/English tasks and tool-call validation |
| Alibaba Qwen 3.8, initially Qwen3.8-27B | [Official model card](https://huggingface.co/Qwen/Qwen3.8-27B) lists Apache-2.0 | Higher-resource comparison for coding and multimodal mapping |

These are benchmark candidates, not default providers or licensed redistribution
decisions. Before adoption pin a weight revision, tokenizer and inference runtime;
review their actual license files and any quantized derivative separately. A model
family name or a hosted Max API does not establish the terms of every checkpoint.
Measure resource use and accepted-task cost on available hardware before choosing
a small/local versus larger/remote deployment. Keep additional candidates bounded
to a demonstrated gap; do not download multiple large models speculatively.

Commercial value comes from scoped workflows, validated proposals, integration,
auditing and support. Customers can select a compatible self-hosted gateway or an
explicitly configured remote provider. Never route customer data to a different
provider or region silently when a model fails.

## Security and commercial acceptance requirements

Treat uploaded sites, fetched pages and model text as untrusted data. Credentials
remain in the secret service; no production secrets in prompts, training, logs or
worker environments by default. Tenant isolation, retention, deletion/export and
region/provider choice need explicit policies; country detection is not compliance.

Security assessment requires documented authorization for each target and method,
private/metadata-network exclusion, DNS/redirect revalidation, rate/time/resource
limits and stop controls. Discovery/passive review and active tests are distinct
job types. Reports must distinguish heuristic/model claims from verified evidence;
do not market an LLM report as a completed penetration test or certification.

Paid-module acceptance needs lifecycle tests (enable/disable, expiry, revocation,
offline grace policy), cross-tenant denial, quota races, accurate metering, sandbox
escape tests and validation that model output cannot publish or alter data directly.
Pricing, billing provider integration, packaging and model selection remain pending.
