# ADR-0602: Edge/Camera Credential Model — Per-Camera Key with Rotation

- Status: Accepted
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

Evolve from one shared `X-Gate-Key` to a **per-camera credential**. A `TENANT_ADMIN` issues
the first API key with `POST /api/cameras/{id}/credentials` and rotates it with
`POST /api/cameras/{id}/credentials/rotate`. The raw secret is returned only by those
responses and only a BCrypt hash is stored. Edge calls identify the indexed camera row with
the non-secret `X-Camera-Id` header and prove possession through `X-Camera-Key`; this avoids
scanning every salted BCrypt hash. The camera resolver uses the physically separate admin
datasource for this narrow pre-tenant lookup, then binds `tenant_id`/`site_id` before normal
RLS-scoped service work begins. Keys have a configurable grace window (default 24 hours) in
which the immediately previous key remains valid so the edge config can roll without a hard
cutover outage. As a further-future step, evaluate **mTLS** (client certificates per
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
- The initial key is now an explicit tenant-admin issuance action; an enrollment-token workflow
  remains a future UX improvement. The rotation grace window is configurable through
  `CAMERA_KEY_ROTATION_GRACE_PERIOD` (default `24h`).
- The existing `GateApiKeyAuthFilter` remains only as a temporary compatibility path for
  gate endpoints while deployed edge appliances are migrated; camera heartbeats are fail-closed
  and require `X-Camera-Id` plus `X-Camera-Key` now.
- Follow-ups: decide the trigger conditions for offering mTLS to specific enterprise tenants
  and retire the shared gate-key compatibility filter after the edge migration completes.
