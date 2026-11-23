# Local AI container transport

23 November 2026. Container transport implemented and tested with a synthetic probe; not an installed Qwen runtime.

## Delivered boundary

`src/v2/ai-container.mjs` implements the existing `execute({job, attempt, artifact,
signal})` connector, using the host's Docker CLI with shell disabled. The CMS
orchestrator remains a trusted process; inference is intended to run in a separate
Linux container per job. This is a container boundary, not a virtual-machine or
host-administrator security boundary. The host Docker daemon is privileged infrastructure.

Deployment configuration pins a local image ID (sha256), model, model revision,
runtime revision, memory and CPUs. No image pull, build, installation or model
download is performed by Studio. Mutable tags, URLs, mounts and arbitrary options
are rejected. Only the standard local Linux socket or Docker Desktop Linux named
pipe is used; remote contexts/DOCKER_HOST are not inherited. Rootless/custom sockets
and GPU passthrough require a separately reviewed deployment profile.

The container runs with network=none, a read-only root, UID/GID 65534, all capabilities
dropped, no-new-privileges, 64 PIDs, bounded CPUs/RAM, no additional swap, a 16 MiB
noexec/nosuid/nodev temporary filesystem, no persistent Docker logs and no host mounts.
Images declaring VOLUME are rejected. No CMS environment, SQL connection, session,
Docker socket or publishing credential is passed. The operator must review the image
itself for baked-in secrets/code and maintain a patched Docker host.

Requests use stdin, never command-line prompt arguments. Input is bounded to 1 MiB;
combined stdout/stderr is bounded to 256 KiB. Only one JSON result is accepted;
scope, attempt, model/runtime identity and shared result schema are checked.
Raw engine errors and output are not logged. Admission currently allows only
publication-review; content tools, shell proposals and active security scans are denied.

## Runtime image contract (not yet supplied for Qwen4)

The reviewed image must contain `/bin/busybox` and executable `/studio/worker`.
The latter reads exactly one UTF-8 JSON envelope `{version:1, job, attempt, artifact}`
from stdin and returns the shared AI result envelope on stdout, then exits zero.
Use concise reports/refusals, not private reasoning traces. Weights, tokenizer,
templates and runtime must be prepackaged offline and individually verified.
No arbitrary repository installation scripts or remote model code may run.

An independent in-container BusyBox timeout bounds execution if the CMS crashes.
Parent timeout/abort force-stops the CLI and removes that exact randomly named
container. Create and start are separate; abort during create prevents start.
Close waits for active transport cleanup. Cleanup failure disables new dispatch
until restart/preflight. Cancellation cannot promise cleanup while the daemon is
unreachable. Following abrupt host death the watchdog bounds running computation;
stopped/container-create remnants may require operator cleanup. A future scoped
janitor is still pending; do not globally prune unrelated containers.

The image contract is an integration target, not evidence that a Qwen4 checkpoint
is available or supported. No checkpoint or inference engine has been selected,
installed or silently substituted. Container CPU/memory limits do not prove model
fit. Real inference/token measurement is a separate acceptance gate.

## Operator configuration

With an independently reviewed, licensed and tested local runtime image, create
an operator-owned JSON file outside imported site sources:

```json
{
  "image": "sha256:<64 lowercase hexadecimal characters>",
  "model": "qwen4-<verified-local-model-id>",
  "modelRevision": "<verified-weight-revision>",
  "runtimeRevision": "<verified-runtime-revision>",
  "memoryMiB": 8192,
  "cpus": 4
}
```

Set `LOFT_AI_CONFIG` to that file before `npm start`. These are placeholders,
not a working model configuration. Without the variable, AI remains disabled.
Invalid configuration or failed engine/image preflight logs a fixed error and
leaves normal CMS editing available. The browser cannot change this file.
Preflight checks configuration and engine resources; it does not certify runtime
functionality. Do not enable a production image before its functional acceptance.

## Acceptance and current limitation

Mock transport tests cover exact isolation flags, fail-closed preflight, unsupported
jobs, digest/input/output/schema/provenance rules, cancellation during create,
concurrency, shutdown waiting and cleanup failure. Existing service/API tests still
exercise authorization, lease recovery and result fencing.

`test/fixtures/ai-container` provides a deterministic, model-free Linux probe derived
from the already pinned PostgreSQL Alpine test image. It checks non-root identity,
only loopback networking, read-only image content, absent host secrets/socket,
no-new-privileges, zero capabilities, timeout, oversized output and cleanup.
Its source Dockerfile is provided, not a redistributed binary image. The dedicated
GitHub ai-isolation job runs this gate independently of the SQLite/PostgreSQL jobs.

After explicit owner authorization, the real Docker fixture was built and acceptance
passed: cgroup memory/CPU/PID/swap limits, network/filesystem boundaries, cancellation,
output limits, watchdog after abrupt orchestrator death and the authenticated HTTP
job flow. No live Qwen inference acceptance has run. The repeatable gate is:

```powershell
docker build --network=none --pull=false -t loft-ai-isolation-fixture test/fixtures/ai-container
$env:LOFT_TEST_AI_IMAGE = docker image inspect --format '{{.Id}}' loft-ai-isolation-fixture
node scripts/test-ai-container.mjs
```

The gate requires an image ID and cannot silently skip. Ordinary tests report the
container test as skipped if the environment variable is absent. The fixture base
must already be available locally; do not interpret the command as model installation.

## Reuse and license inventory

No new npm package or copied third-party source was added. Docker CLI/Engine are
used as installed operator tooling (upstream Apache-2.0); Docker Desktop is a separate
product with its own terms, not an automatically free redistribution dependency.
BusyBox in the fixture/runtime contract is GPL-2.0; copied Alpine libraries have
their own licenses. Image redistribution requires a complete image SBOM, license
notices and applicable corresponding-source obligations; the npm notice inventory
does not cover container binaries. No runtime image is distributed in this delivery.

References consulted: [Docker run controls](https://docs.docker.com/reference/cli/docker/container/run/),
[offline networking](https://docs.docker.com/engine/network/drivers/none/),
[Docker CLI license](https://github.com/docker/cli/blob/master/LICENSE).
llama.cpp's official MIT source was inspected as a future runtime candidate; no
version was adopted because the Qwen4 architecture/weights remain unverified.
