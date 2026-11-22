# AI model feasibility comparison

Superseded selection policy: the owner chose local/open-weight Qwen and to await
Qwen4 weights, skipping comparative real-model benchmarks. See [decision](QWEN_DECISION.md).
The desk research below is retained as historical evidence, not the active rollout.

22 November 2026. Desk research and proposed evaluation, not executed inference.
Code baseline: `130080b`. No model weights, packages or paid services installed.

## Decision

Benchmark Qwen3-8B first for text-only proposal plumbing, Gemma 4 E4B alongside it
for visual mapping, and Qwen3.8-27B as the higher-resource challenger. This is an
evaluation order, not a measured quality ranking or production selection. The
gateway must accept all three through replaceable provider adapters. No single
model should be mandatory for CMS operation or paid-module activation.

## Verified checkpoint scope

| Checkpoint | Publisher-reported facts | Loft hypothesis and limitation |
| --- | --- | --- |
| Google `gemma-4-E4B` | Text/image/audio; 128K context; 4.5B effective, about 8B with embeddings; Apache-2.0 | Candidate for screenshot plus DOM evidence. E4B is not a 4GB-memory promise. Turkish editing, JSON reliability and inference speed require measurement. [Model card](https://huggingface.co/google/gemma-4-E4B), [license](https://gemma.ai/resources/apache-2/) |
| Alibaba `Qwen3-8B` | Text; 8.2B parameters; native 32,768 context, extended 131,072 with YaRN; Apache-2.0 | Text/schema baseline; screenshots require a separate visual model or supplied DOM description. Test thinking and non-thinking configurations separately. [Model card](https://huggingface.co/Qwen/Qwen3-8B), [license](https://huggingface.co/Qwen/Qwen3-8B/blob/main/LICENSE) |
| Alibaba `Qwen3.8-27B` | Vision-language; 27B language model plus vision encoder; native 262,144 context, extended up to 1M; Apache-2.0 | Candidate for code and visual mapping; higher memory cost. Its hosted offering and Max models are separate deployment choices. [Model card](https://huggingface.co/Qwen/Qwen3.8-27B), [license](https://huggingface.co/Qwen/Qwen3.8-27B/blob/main/LICENSE) |

Published benchmark tables use different harnesses, budgets and sometimes adjusted
datasets. Do not subtract their scores to rank Loft quality. Native context limits
are not recommended default request sizes. Start with a bounded 8K-token workload;
use 32K only for cases that justify it. Image/token budgets also need explicit caps.

Model-card license review is not a complete distribution clearance. Pin checkpoint,
tokenizer, quantizer and runtime revisions before installation; retain LICENSE and
applicable NOTICE/attribution and modification records. Separately review service
terms for a hosted API. Do not infer the product's own license from dependency
licenses or describe open weights as proof that training data/code are open.

## Resource feasibility and cost

Arithmetic lower bounds below use decimal GB: parameter count × bits / 8.
These exclude quantization metadata, vision/audio encoders, KV/cache state,
runtime buffers, operating system and concurrent requests; they are NOT VRAM
requirements or validated device-fit estimates.

| Approximate parameter basis | BF16 weights | 8-bit weights | 4-bit weights |
| --- | ---: | ---: | ---: |
| Gemma E4B, 8B including embeddings | 16 GB | 8 GB | 4 GB |
| Qwen3, 8.2B | 16.4 GB | 8.2 GB | 4.1 GB |
| Qwen3.8, 27B language model only | 54 GB | 27 GB | 13.5 GB |

Local read-only inventory reports approximately 63.4 GiB physical RAM and Intel
Graphics. Windows AdapterRAM is not reliable dedicated-VRAM evidence for an
integrated GPU; no suitable discrete GPU was established. Quantized CPU/shared-memory
experiments are worth testing, but interactive latency and concurrent production
capacity cannot be promised. Do not purchase hardware from these lower bounds.

Record GPU/CPU hours, electricity or rental charge, storage, idle capacity, gateway
cost, failed attempts and human review time. Cost per accepted task = total measured
cost / accepted tasks (undefined when zero accepted). For APIs record provider,
date, region and input/output/reasoning charges. No current dollar quote is assumed.
Free model licensing does not imply free operation; self-hosting does not inherently
reduce the tokens consumed by the Codex development conversation.

## Bounded open-source runtime reuse

- [llama.cpp](https://github.com/ggml-org/llama.cpp), [MIT license](https://github.com/ggml-org/llama.cpp/blob/master/LICENSE): first candidate for local quantized experiments. Verify each exact architecture, multimodal projector, template and quantization against a pinned release; do not assume every new checkpoint works.
- [vLLM](https://github.com/vllm-project/vllm): Apache-2.0 server candidate for a separate supported GPU host. Its [structured-output interface](https://docs.vllm.ai/en/latest/features/structured_outputs/) can constrain JSON, but does not enforce Loft permissions or semantic validation.

Neither runtime was installed or adopted in this analysis. Release pins, transitive
licenses, advisories and checkpoint smoke tests are installation gates. Avoid adding
a general agent framework until a concrete unmet orchestration need is demonstrated.

## Reproducible benchmark specification

Prepare 60 synthetic cases before inference: 12 Turkish/English content and translation,
12 schema/dictionary/boundary constraints, 12 DOM/component mappings, 8 publication
diff explanations, 8 seeded security findings with known evidence, and 8 benign
lookalikes/injection/unauthorized-action cases. Keep a separate 20-case holdout.
This is a dataset specification; the fixtures and runner are still to be built.

Common text cases use identical semantic input and accepted-output criteria. Visual
cases form a separate track; mark text-only Qwen3 as unsupported, not an artificial
quality failure. Use three repeats per configuration, fixed seed where supported,
explicit sampling parameters and bounded reasoning/output budget. Start concurrency
one; test four only if memory and latency are acceptable. Compare quantizations
separately; a model family name is not an experiment identity.

Save model/weight digest, runtime/version, template, quantization, hardware, prompt
fixture hash, context/output budgets, seed, input/output tokens, time-to-first-token,
total p50/p95 latency, peak memory, retries, validation results and reviewer decision.
Keep input text synthetic; logs should reference artifacts rather than copy secrets.

Proposed product gates (targets, not achieved scores): at least 95% schema-valid
first responses and 90% accepted content/mapping cases; two independent reviewers
for subjective language cases, resolve disagreements with recorded reasons. Any
cross-tenant write, direct publish, secret disclosure or out-of-scope scanner action
fails the system gate regardless of average model quality. A secure validator must
reject unsafe proposals even when the model emits them. Zero failures in this small
suite is not proof against all prompt injection. Set interactive latency/cost SLOs
after the hardware pilot and before selecting the production model.

## Remaining decisions

Actual throughput/Turkish quality and quantization effects are unknown. Production
concurrency, monthly inference budget, deployment region and whether weights ship
with the product remain open. They do not block contract/fixture development; they
do block a defensible production model, machine-size and pricing commitment.
