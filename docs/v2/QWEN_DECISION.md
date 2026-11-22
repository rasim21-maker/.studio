# Qwen-only, local open-weight execution decision

22 November 2026. Owner decision superseding the comparative model-selection plan.

- Proceed with Qwen; skip comparative real-model performance benchmarking.
- Preserve local/self-hosted open-weight deployment. Do not integrate or activate
  Qwen4-Max cloud API as a substitute, and do not silently fall back to Qwen3.8,
  Gemma or an external provider.
- Wait for downloadable Qwen4 weights and an applicable license before selecting
  a checkpoint/runtime or installing it. No continuous release-monitoring job has
  been created; recheck official sources when resuming model installation.
- Continue provider-independent durable jobs, quota, lease/fencing and isolated
  local-worker development. Model absence must not disable ordinary CMS editing.

## Verified availability, not an installation claim

Alibaba's [16 November announcement](https://data.alibabagroup.com/ecms-files/1532295521/cecc5998-4c9c-4267-9e18-dafbfe2aa10f/%5BPress%20Release%5D%20Alibaba%20Unveils%20Qwen4-Max.pdf)
announces Qwen4-Max via QwenCloud/API and describes smaller open-weight Qwen4 models
as forthcoming. [Official API documentation](https://docs.qwencloud.com/developer-guides/getting-started/text-generation-models)
lists `qwen4-max`; this is an API identifier, not a local checkpoint identifier.
We have not verified a downloadable Qwen4 checkpoint and license. Do not inherit
Qwen3/Qwen3.8 licensing or hardware requirements for an unreleased Qwen4 variant.

## Revised gates

Comparative quality/latency/cost ranking and the expanded comparison corpus are
deferred at the owner's request, not marked passed. Retain the existing offline
evaluator as regression tooling; synthetic results are not model performance.

Still required before enabling a local model: verify exact weight/runtime revisions,
license/notice obligations, supported architecture and tokenizer/template; validate
basic load/memory feasibility, bounded inference, output schema, source/revision
checks, cancellation, authorization, data isolation and secret handling. These are
integration and safety checks, not a renewed competition between model families.

Next implementation: durable job repository and isolated execution boundary using
fixtures. Live Qwen4 acceptance alone waits on the external weight/license release.
No model downloaded, paid request sent, cloud credential requested or API enabled.
