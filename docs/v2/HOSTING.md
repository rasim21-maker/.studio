# Hosting connectors

2026-11-21. Hosting is separate from source publication and from the private Sites
demo. The editor publication dialog now contains hosting configuration, submission,
status checks and explicit handling of ambiguous responses. These are deployment
connections for managed websites, not a claim that the CMS itself runs on every host.

| Provider | Implemented path | Requirements / limits |
|---|---|---|
| Netlify | Static ZIP deployment to an existing project | Project UUID and token; currently the static adapter only; no raw React/TypeScript source upload |
| Cloudflare Pages | Deploy an already linked GitHub production branch | Account/project, repository, production branch, Pages token and a completed GitHub publication for the same Studio revision |
| Self-hosted | Studio static deployment agent | Node 24, trusted dedicated service account, writable storage, HTTPS reverse proxy, public IPv4 DNS and dedicated origin |
| Natro | Same agent on a VPS/VDS or other plan where its runtime can be installed | Node/runtime and reverse proxy availability must be verified for the actual plan; shared FTP-only hosting is not supported |

All provider credentials stay in encrypted `studio_hosting_connections`, separately
from source connections. Configuring a connection requires integrations permission;
submitting/checking requires publish permission. Credentials are never returned by
the API. Read verification establishes identity/access, not a guarantee that a future
write will be accepted. Configuration changes use expected revisions and are blocked
while a deployment is pending or uncertain. HTTP routes inherit session/origin/CSRF
checks and site scope.

## Deployment records and verification

`studio_deployments` records site revision, provider/config revision, artifact digest
or Git commit, provider ID, state, URL and timestamps. A filtered unique index allows
one active deployment per site/provider. State is written before network submission.
There is no automatic POST retry. Network failure may mean the remote write succeeded.
Keep the existing record, inspect status, or explicitly acknowledge a manual provider
check; acknowledgement never rolls back a remote deployment. A process-local lock is
an additional safeguard, not a multi-worker scheduler. Use one application writer.

Statuses: submitting, pending, ready, failed, review, acknowledged. Provider-ready
responses remain pending locally until a status check verifies readiness and performs
an unauthenticated HEAD request to the deployment URL. The self-hosted check also
requires the release response header and artifact digest to match. This is availability
verification, not a full browser/functionality/security test. Redirects, private DNS
addresses and IPv6-only targets remain blocked by the shared safeRequest policy.

Netlify may start production publication when its POST is accepted. Cloudflare deploys
branch HEAD: the API does not pin the requested commit. Studio deliberately does not
send the expected hash as cosmetic deployment metadata. Instead it checks the provider's
reported commit and branch and marks a mismatch for review. Such a review cannot prevent
a different HEAD from having reached the provider. Disable conflicting auto-deploy or
other release writers in the provider workflow if controlled releases are required.

The initial connectors use official HTTPS APIs, not arbitrary API base URLs supplied by
users. Self-hosted targets use the same public-address/DNS pinning and redirect refusal
as other network access. Returned URLs are constrained to provider domains or the exact
configured agent origin; bearer credentials are never forwarded to availability probes.

## Static agent installation

Use a separate host/account and origin from the Studio admin panel. Install the reviewed
repository revision and its locked dependencies with `npm ci --ignore-scripts`; run the
agent with Node 24.13+ (<25), the same supported runtime as Studio. The current script
uses repository libraries; it is not yet an independently published npm package.

Set environment variables in a protected service configuration, never in Git:

```
STUDIO_DEPLOY_DIRECTORY=/var/lib/studio-static
STUDIO_DEPLOY_INSTANCE=<random UUID>
STUDIO_DEPLOY_ORIGIN=https://your-static-domain.example
STUDIO_DEPLOY_TOKEN=<cryptographically random secret, at least 32 characters>
STUDIO_DEPLOY_PORT=4392
```

Run `node scripts/start-deploy-agent.mjs` under a dedicated unprivileged service user.
It binds loopback only. Configure your TLS reverse proxy to forward this origin to that
port, preserving `Authorization`, `If-Match`, content type and `X-Studio-*` headers.
Require TLS with a valid certificate, set an 8 MiB request-body limit and sensible
rate limits/timeouts, and do not expose the internal loopback listener directly.
Use one agent process per data directory. Do not share that directory with other
applications or untrusted accounts. An operator can optionally restrict API paths
`/_studio/*` by source IP at the proxy in addition to bearer authentication.

In Studio choose Self-hosted or Natro VPS/VDS and enter the HTTPS origin, matching
instance UUID and token. Save verifies the agent protocol and identity. Deploy only
reviewed static sites; this service does not run builds, PHP, arbitrary shell commands,
package installation or server-side Node applications.

The authenticated API is `GET /_studio/v1/info`, `POST /_studio/v1/releases/:id` and
`GET /_studio/v1/releases/:id`. POST accepts an 8 MiB bounded ZIP, its SHA256 header
and expected current release ID in If-Match (`empty` initially). It rejects unsupported
source/runtime paths, bad archives, links, path escapes, size limits and a reserved
`_studio` path. Static serving exposes only manifest-listed files under a completed
release, never metadata, keys or staging files. Files are not served before the active
pointer is atomically replaced. Release IDs/digests are idempotent and conditional
activation prevents stale overwrites. Restart retains the active pointer.

At most 32 release/staging directories are accepted (each expanded archive at most
24 MiB). The service retains previous releases; automatic pruning/rollback is not
implemented. Stop the agent before operator backup or cleanup, inspect current.json,
preserve the active release and the desired recovery versions, and clean only known
inactive/staging paths. A crash can leave staging or an unactivated release; it is never
silently served. Filesystem backup and service supervision remain operator responsibilities.

## Acceptance and remaining work

Hosting contract tests use synthetic Netlify/Cloudflare responses. Self-hosted/Natro
agent tests run real loopback HTTP, ZIP validation and disk persistence, with activation,
auth, stale current rejection, duplicate IDs, hash mismatch and restart. A local
transport bridge is test-only; production does not disable HTTPS/private-network checks.
No live provider account or Natro instance has been accepted in these development tests.

Remaining: shared-host FTPS/SFTP capability detection and secure transfer, independent
agent packaging, provider rollback, resumable upload, background status polling,
multi-worker leases and isolated React build output integration. No product/module
license was changed and no new third-party dependency was installed.

Official API references reviewed on 2026-11-21:
- https://docs.netlify.com/api-and-cli-guides/api-guides/get-started-with-api/
- https://developers.cloudflare.com/api/resources/pages/subresources/projects/subresources/deployments/methods/create/
- https://www.natro.com/hemendestek/bilgibankasi/dosyalarimi-web-siteme-nasil-aktarabilirim
- https://www.natro.com/hemendestek/bilgibankasi/websitem-icin-ssh-erisimini-nasil-kullanabilirim
