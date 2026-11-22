# AI contracts and offline evaluation v1

Owner scope update: [local Qwen4 decision](QWEN_DECISION.md) defers the expanded
comparative performance benchmark below. Keep this evaluator for contract regression;
functional and security acceptance remain required. No cloud fallback is authorized.

22 November 2026. Implemented developer tooling, not an inference service or live
CMS feature. No new dependency: JSON Schema compilation reuses installed Ajv.

## Contracts

`shared/v2/ai-contracts.mjs` exports job/result JSON schemas and validators. Both
reject additional fields and type coercion. Job scope includes tenant/site/actor,
environment, base revision, source digest, allowed targets/evidence, region and
bounded token/time/retention policy. The result binds back to the job and source,
reports model/runtime revisions and usage, and contains content changes, a review
report or refusal. Duplicate targets, undeclared evidence, wrong source/job,
over-budget usage and edits from review-only jobs are rejected.

These are preview internal contracts, not a new public HTTP endpoint or SDK export.
Caller-supplied tenant/actor IDs are not authorization. A future trusted server must
derive scope, enforce entitlements and validate live permissions/revision again.
Budget checks on reported usage are not execution limits; workers must enforce
deadlines and independently reconcile metering. Strings are data, never executable
HTML/code. Server field schemas, dictionaries, URL/HTML rules and existing human
proposal acceptance remain the authority. No contract result applies itself.

This slice deliberately contains no arbitrary tools, raw URLs, layout/code writes,
active scan job, queue lease, remote credentials or publication permission. Reports
can cite only supplied evidence IDs; citation membership does not prove truth.
Attempt fencing, cancellation, durable dispatch and signed worker identity belong
to the next jobs/runtime slice.

## Synthetic corpus and CLI

`scripts/ai-benchmark-fixtures.mjs` deterministically produces 60 development cases:
12 constrained translations, 12 numeric-boundary refusals, 12 HTML field mappings,
8 publication reviews, 8 seeded code reviews and 8 forbidden-action refusals.
The holdout has 20 distinct IDs/inputs using the same template families. It is public,
not a secret or independent generalization benchmark. No real customer content,
network targets or model calls are used. Content cases supply the expected phrase;
they measure instruction following, not free-form translation quality.

```powershell
node scripts/ai-benchmark.mjs fixtures development
node scripts/ai-benchmark.mjs fixtures holdout
node scripts/ai-benchmark.mjs score development path/to/responses.json
```

Fixture export omits answer keys. Response files are arrays of
`{ "caseId": "development-content-0", "result": <AI result envelope v1> }`.
The result includes version/jobId/attempt/baseRevision/artifactDigest/model/
modelRevision/runtimeRevision/usage/output as specified in aiResultSchema. Use
the fixture's job ID, revision and digest, never invent a matching source snapshot.
Files are bounded to 2 MiB; malformed, oversized, duplicate and unknown responses
are rejected. Errors do not echo supplied file contents. CLI makes no HTTP requests.

The report distinguishes missing, invalid, checks-failed and checks-passed. Missing
answers remain in the denominator; any missing/invalid/failed case exits nonzero.
All checks-passed responses still require human review. Reports always state
`modelPerformanceVerified: false`: response files can be synthetic or fabricated,
and this tool cannot attest their origin. Raw responses are not copied into reports.

Automated checks verify exact constrained edits, matching report evidence lists and
refusal shape. They do not assess report correctness, refusal explanation, factual
accuracy, prompt-injection robustness, actual language quality or real execution
side effects. Positive tests feed synthetic expected responses solely to verify
the evaluator, never to claim a model passed 60 tasks.

## Remaining evaluation work

Before model selection add independently reviewed natural Turkish/English tasks,
benign security lookalikes, actual screenshot/DOM pairs and stronger unseen holdout
families. A future inference runner must pin model/runtime/template/quantization,
record trusted measurement provenance and hardware, and compute latency/memory/cost
from observed runs. This offline scorer does not implement those measurements.
Keep those substantive quality gates separate from the implemented smoke corpus.

Tests: `test/v2/ai-contracts.test.mjs` covers schema rejection, stale source/target/
budget checks, review boundaries, deterministic splits, wrong versus missing
answers, duplicate responses and CLI input limits/redaction. Existing AI access
and proposal APIs are unchanged.
