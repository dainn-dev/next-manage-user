# ADR-0602: Edge/Camera Credential Model — Per-Camera Key with Rotation

- Status: Proposed
- Date: 2026-07-09
- Deciders: Principal Architect
- Context doc: 06_User_RBAC

## Context

Today, gate/edge authentication is a single shared secret: `GateApiKeyAuthFilter` checks the
`X-Gate-Key` header against one `GATE_API_KEY` environment value for **every** gate in the
deployment, and — critically — **runs open (no auth) if `GATE_API_KEY` is unset**, a dev
fallback that must not reach production (brief §1). In the target multi-tenant vision, edge
agents belong to specific tenants/sites/cameras (`04_Multi_Tenant_Design`), and a single
shared key across all of them means one leaked key compromises every tenant's ingest
endpoint simultaneously, and there is no way to revoke one compromised device without
rotating the key for the entire platform.

## Decision

Evolve from one shared `X-Gate-Key` to a **per-camera credential**: each `Camera` (brief §4)
is issued its own API key at registration time (`POST /api/v1/cameras/register`), stored
hashed (same BCrypt-style approach as user passwords, or a dedicated HMAC-verifiable token) and
associated with exactly one `tenant_id`/`site_id`/`camera_id`. The ingest request header
becomes `X-Camera-Key` (renamed for clarity as scope narrows from gate to camera), and the
`ai-ingest` module resolves tenant/site context directly from the key's associated camera
record — this is the same resolution step ADR-0402 describes for edge requests. Keys are
rotatable per-camera via an admin endpoint (`SITE_MANAGER`+ scope), with a grace window
(old + new key both valid for N hours) to allow the edge agent's config to roll without a
hard cutover outage. As a further-future step, evaluate **mTLS** (client certificates per
edge appliance) for deployments needing stronger machine-identity guarantees than a bearer
key provides — noted as an explicit option, not committed in this ADR.

## Alternatives considered

- **Keep one shared `X-Gate-Key` platform-wide** — pros: zero change; cons: fundamentally
  incompatible with multi-tenant isolation guarantees (`04_Multi_Tenant_Design`) — a leaked
  key affects every tenant's cameras at once, and there's no way to know which physical
  device leaked it since they're indistinguishable at the auth layer; also cannot be scoped
  per-tenant for rate limiting (`03_SaaS_Architecture` ADR-0303) — the shared-key model
  breaks multi-tenant isolation regardless of how carefully it is deployed.
- **Per-tenant shared key** (one key per tenant, all that tenant's cameras use it) — pros:
  smaller blast radius than platform-wide, simpler than per-camera; cons: still can't
  identify/revoke a single compromised device without affecting every camera at that tenant's
  sites; doesn't match the granularity of `Camera` as the auth subject that per-camera
  `calibration_json`/heartbeat tracking already implies.
- **mTLS for every edge device now** — pros: strongest machine identity, no bearer token to
  leak; cons: certificate provisioning/rotation/revocation (CRL or OCSP) infrastructure is a
  meaningfully bigger lift than a rotatable API key, and today's edge deployment
  (`cv2.VideoCapture` + `GateClient`, one process per gate) has no existing cert machinery to
  build on — appropriate as a later hardening step for security-sensitive enterprise tenants,
  not the default for all tenants at launch.
- **Per-camera key with rotation (chosen)** — pros: matches the `Camera` entity as the natural
  auth subject, contains blast radius to one device, supports the store-and-forward retry
  model unchanged (key travels the same way `X-Gate-Key` does today), rotation grace window
  avoids a hard cutover; cons: key distribution to edge appliances needs a secure provisioning
  step (out of band or via a one-time registration token) instead of one shared env var.

## Consequences

- Positive: a compromised or decommissioned camera's key can be revoked without affecting any
  other device; per-camera keys give `03_SaaS_Architecture`'s per-tenant rate limiting a
  natural finer-grained dial (per-camera limits, not just per-tenant); closes the "runs open
  if unset" hole implicitly, since per-camera keys have no meaningful "unset" default — a
  camera with no key simply cannot authenticate, fail-closed by construction.
- Negative / trade-offs: key provisioning and rotation add operational steps to camera
  onboarding (today's `POST /api/gates/register` is a simple unauthenticated-by-shared-key
  call; the new flow needs a registration token or admin-issued initial key); edge appliance
  configuration management (pushing rotated keys to on-site devices with only outbound
  connectivity) needs a defined mechanism — likely the edge agent polls for "your key is
  rotating" during its normal heartbeat call.
- Follow-ups: design the initial-provisioning flow (how does a brand-new camera get its first
  key securely — installer-entered registration token is the leading candidate); define the
  rotation grace-window duration; decide the trigger conditions for offering mTLS to specific
  enterprise tenants; remove the current `GateApiKeyAuthFilter` "open if unset" fallback as
  part of this migration, not left in place alongside the new model.
