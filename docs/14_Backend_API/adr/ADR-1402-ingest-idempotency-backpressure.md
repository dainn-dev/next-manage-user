# ADR-1402: Ingest API idempotency and backpressure

- Status: Proposed
- Date: 2026-07-09
- Deciders: Principal Architect
- Context doc: 14_Backend_API

## Context

The AI ingest path is the highest-volume, least-trusted-network endpoint in the platform:
edge devices in the field, on variable connectivity, each running a durable SQLite
store-and-forward queue that **retries the same event** until it gets a success response
(`edge/edge/event_queue.py`). Today's `POST /api/vehicles/check-vehicle` already
demonstrates the pattern this must generalize: it accepts an `eventId` (UUID) and
`occurredAt`, is guarded by `GateApiKeyAuthFilter` (`X-Gate-Key` header,
`SecurityConfig` permits it publicly at the HTTP layer and relies on the filter, falls back
to **open/unauthenticated if `GATE_API_KEY` is unset** — a dev convenience, not something to
inherit for the multi-tenant ingest endpoint), and is deduped in-process by
`GateEventDeduplicator`. There is currently no backpressure mechanism at all — the endpoint
processes every request synchronously inline with the HTTP response.

For the SaaS ingest endpoint (`POST /api/v1/parking-events`, replacing/extending
`check-vehicle` for the target model), we now have: one `X-Gate-Key` per **camera** (not one
shared secret), potentially many cameras per tenant bursting simultaneously, and a
transactional-outbox write on every accepted request (see `13_Event_Driven_Architecture`
ADR-1302) — meaning each request does more DB work than today's endpoint.

## Decision

- **Idempotency**: `event_id` is a required field, validated as a UUID, and enforced by a
  **unique constraint on `ParkingEvent.event_id`** in Postgres (not just the in-memory cache
  used today). A duplicate `event_id` returns the original `200`/`202` result without
  re-running side effects or re-publishing to the outbox — durable and safe across backend
  restarts and multiple instances, unlike today's `GateEventDeduplicator`.
- **Auth**: `X-Gate-Key` moves from one shared `GATE_API_KEY` env var to **one key per
  camera**, resolved to a `camera_id` (and transitively `site_id`/`tenant_id`) by the auth
  filter, so a compromised key only exposes one camera and every ingested event is
  automatically scoped without trusting a client-supplied tenant/site field. The current
  "runs OPEN if key unset" dev fallback is explicitly **not** carried into the multi-tenant
  ingest endpoint — a missing/invalid key is always rejected there.
- **Backpressure**: the endpoint does the minimum synchronous work (validate, idempotency
  check, single-transaction insert of `ParkingEvent` + `outbox_message`) and returns
  immediately — the actual publish to RabbitMQ happens asynchronously via the outbox relay,
  so a slow/unavailable broker never blocks or times out an edge request. Rate limiting is
  applied per camera key (target: Redis-backed token bucket, brief §3.6) so one misbehaving
  camera cannot starve others; over-limit requests get `429` with a `Retry-After` header,
  which the edge's existing exponential-backoff retry logic already knows how to honor.
- **Multipart snapshots**: capped at a fixed max size (e.g. 5 MB), streamed to object storage
  rather than buffered fully in memory, matching today's pattern of an optional `snapshot`
  multipart part on `check-vehicle`.

## Alternatives considered

- **Synchronous publish to RabbitMQ inline with the HTTP response** — simpler code path, but
  couples ingest latency/availability to broker availability and reintroduces the dual-write
  risk ADR-1302 rejects. Rejected.
- **No per-camera rate limit, rely on infra-level throttling only** — simpler, but a single
  misconfigured or compromised camera key could degrade ingest for the whole tenant/site.
  Rejected in favor of a cheap per-key token bucket.
- **Keep the single shared `GATE_API_KEY`** — least change, but does not scope compromise
  blast radius and cannot attribute an ingested event to a camera without trusting a
  client-supplied field, which is exactly what a malicious or misconfigured client could
  spoof. Rejected for the multi-tenant ingest endpoint (legacy `/api/gates/register` and
  `/heartbeat` may keep the current shared-key behavior since they are lower-risk and
  already public per `SecurityConfig`).

## Consequences

- Positive: durable idempotency closes the gap identified in ADR-1302; per-camera keys give
  precise auth scoping and blast-radius containment; async publish keeps ingest latency
  decoupled from broker health.
- Negative / trade-offs: per-camera key management is new operational surface (issuance,
  rotation, revocation UI/API — not yet designed); rate-limit tuning needs real traffic data
  before defaults are trustworthy.
- Follow-ups: design the camera-key issuance/rotation flow (likely part of `07_Camera_Management`);
  add a load test simulating a multi-tenant camera burst before this goes to production.
