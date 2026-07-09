# SaaS Platform Architecture

ParkVision's overall backend architecture: a modular-monolith Spring Boot platform that
evolves today's single-tenant gate-access system into a multi-tenant SaaS smart-parking
platform, with a documented strangler path to microservices as individual modules outgrow
the monolith.

Status: Draft · Owner: Principal Architect · Last updated: 2026-07-09

## 1. Purpose

This document defines the platform-level architecture: the module decomposition of the
backend, how requests flow end to end, how the system scales horizontally, how tenancy is
resolved on every request, and the non-functional targets the architecture must meet. It is
the entry point for `04_Multi_Tenant_Design`, `05_Subscription_Billing`, and `06_User_RBAC`,
which each go deep on one cross-cutting concern introduced here.

## 2. Current State vs Target

### Current state (verified from code, see brief §1)

- **Monorepo**: `frontend/` (Next.js 14.2.16, App Router), `backend/` (Spring Boot 3.2.0,
  Java 17, package `com.vehiclemanagement`), `edge/` (Python, YOLOv5), `deploy/`, `docker-compose.yml`.
- **Backend runtime**: Jetty on `:8080`, REST base `/api`, single deployable JAR, single
  Postgres database (`vehicle_management`), Flyway migrations V1–V35, `ddl-auto: update`.
- **Persistence**: Spring Data JPA over PostgreSQL. **No PostGIS, no partitioning** today.
  8 entities, all UUID PKs, **no `tenant_id`/`site_id` anywhere** — the system is
  single-tenant.
- **Realtime**: STOMP over WebSocket (SockJS), Spring's **in-memory `SimpleBroker`**
  (`/topic/vehicle-check`, `/topic/gate/{gateId}/check`), single JVM only — no relay, no
  cross-instance fan-out. Missed events replayed via `GET /api/gates/{id}/recent-checks`.
- **No RabbitMQ, no Redis, no object storage** — snapshots are written to local disk
  (`uploads/snapshots`), served at `/uploads/**`.
- **Security**: stateless Spring Security + JWT (jjwt 0.11.5, HS256, claims `role`/`email`/
  `userId`, 86400s expiry), BCrypt(12). A second filter, `GateApiKeyAuthFilter`, guards gate
  endpoints via the `X-Gate-Key` header — it runs **open** if `GATE_API_KEY` is unset (dev
  fallback only, must not ship to prod as-is).
- **Observability**: Micrometer + Prometheus (`/actuator/prometheus`), springdoc OpenAPI.
- **Edge**: one Python process per gate, `cv2.VideoCapture(rtsp, CAP_FFMPEG)`, posts to the
  backend via `GateClient` with `X-Gate-Key`; durable SQLite store-and-forward queue with
  idempotent dedup by `event_id` already exists and is kept/extended, not replaced.

### Target (from the vision, brief §2/§3)

- Multi-tenant SaaS: one backend serving many tenants, each with many sites, resolved from
  JWT claims on every request (`04_Multi_Tenant_Design`).
  service.
- Modular monolith with packages `iam, tenancy, billing, parking, ai-ingest, events, chatbot,
  notification, analytics`, clean internal boundaries, Strangler extraction only when
  justified (ADR-0301).
- PostgreSQL **+ PostGIS** for slot polygons; **RabbitMQ** event bus with transactional
  outbox (ADR-0302); **Redis** for cache, presence, rate limits, and WS relay (ADR-0303);
  object storage (MinIO/S3) for snapshots, local disk only in dev.
- Edge agents evolve in place (kept: SQLite queue, `X-Gate-Key`, one-process-per-gate model)
  but post to a proper validating **ingest API** (`ai-ingest` module) instead of directly
  mutating `VehicleLog`.

### The gap

Every arrow in the target diagrams that touches RabbitMQ, Redis, PostGIS, or object storage
is new infrastructure. The single biggest structural gap is the **complete absence of
tenant/site scoping** in the data model and JWT — this is the subject of
`04_Multi_Tenant_Design` and gates almost everything else (billing entitlements, RBAC site
scoping, per-tenant event routing all assume `tenant_id`/`site_id` exist).

## 3. Module Decomposition

| Module | Responsibility | Maps from today's code |
|---|---|---|
| `iam` | Authentication, users, roles, JWT issuance/validation | Auth controller, `User` entity, `JwtService` |
| `tenancy` | Tenant/site resolution, RLS session context, per-tenant config | New — see `04_Multi_Tenant_Design` |
| `parking` | Sites, zones, slots, cameras/gates, vehicles, entry/exit logs | `Vehicle`, `VehicleLog`, `Gate`, `VehicleAccessRequest`, `Employee`, `Department`, `Position` |
| `ai-ingest` | Validates + persists edge events, idempotency, publishes domain events | `check-vehicle` gate endpoint, `GateApiKeyAuthFilter` |
| `events` | Outbox schema, relay to RabbitMQ, event contracts | New — see ADR-0302 |
| `billing` | Plans, subscriptions, entitlements, Stripe webhooks | New — see `05_Subscription_Billing` |
| `chatbot` | LLM tool-calling over tenant-scoped read APIs | New — see brief §3.11 |
| `notification` | Push/email/WS fanout on domain events | New; supersedes ad hoc STOMP broadcast |
| `analytics` | Aggregates, dashboards, occupancy/heatmap queries | New; reads `ParkingEvent` log |

Module boundary rule: a module may only read/write its own JPA entities. Cross-module reads
go through a published service interface (e.g. `billing` asks `tenancy` "is this tenant
active?", never queries the `tenant` table directly). This is enforced by convention now and
should gain an ArchUnit test as a follow-up (ADR-0301).

## 4. Request Lifecycle

Two representative flows, both scoped by tenant/site from the first hop:

1. **Interactive request** (web/mobile → API): client sends `Authorization: Bearer <JWT>` →
   `iam` validates signature/expiry → `tenancy` extracts `tenant_id`/`site_id` claims, sets
   the Hibernate tenant filter + Postgres RLS session variable for the request scope → target
   module (e.g. `parking`) executes business logic against the now tenant-scoped
   `EntityManager` → response.
2. **Edge ingest → realtime fan-out** (see `diagrams/request-flow.mmd` for the full
   sequence): edge agent posts a detection event with `X-Gate-Key` → `ai-ingest` resolves
   `tenant_id`/`site_id` from the camera/gate registration (edge devices do not carry tenant
   JWTs) → validates idempotency by `event_id` → `parking` applies the domain rule and writes
   state + outbox row in one transaction → outbox relay publishes to RabbitMQ →
   `notification` consumes and publishes to Redis pub/sub → all API pods subscribed to that
   tenant/site topic push a STOMP message to connected WebSocket clients.

Both flows share the same tenancy-resolution step, which is why `tenancy` is a first-class
module rather than a cross-cutting filter bolted onto `iam` — see `04_Multi_Tenant_Design`
for the resolution filter and RLS mechanics.

## 5. Scaling Strategy

- **Stateless API tier**: no server-side session state; every pod can serve any request once
  tenancy context is resolved from the JWT per-request. This lets the API scale via
  Kubernetes HPA on CPU/request-rate with no sticky-session requirement.
- **WebSocket fan-out**: today's `SimpleBroker` is inherently single-instance. The target
  replaces it with a Redis-backed relay (ADR-0303) so a message published on any pod reaches
  clients connected to any other pod.
- **Database**: single Postgres primary for writes; read replica(s) for analytics/reporting
  queries once read load is measurable. High-volume `ParkingEvent`/`MotionEvent` tables use
  native time-range partitioning (brief §3.7) to keep indexes small and enable cheap
  retention-based drops (entitlement-driven retention days, see `05_Subscription_Billing`).
- **AI ingest burst isolation**: `ai-ingest` is the first extraction candidate — camera-heavy
  tenants can produce bursty write load that should not degrade interactive API latency for
  other tenants (noisy-neighbor, see `04_Multi_Tenant_Design`).
- **Edge**: unchanged one-process-per-gate model; outbound-only connections mean no inbound
  firewall exposure on-site, and the existing SQLite store-and-forward queue already absorbs
  backend/network outages without data loss.

## 6. Tenancy Resolution (summary)

Full design lives in `04_Multi_Tenant_Design`. In short: every authenticated request carries
`tenant_id` (and optionally `site_id`) as JWT claims; a servlet filter in the `tenancy`
module reads these claims once per request, sets a `ThreadLocal` tenant context and the
Postgres RLS session variable (`SET LOCAL app.tenant_id = ...`) for the duration of the
transaction, and a Hibernate filter adds `tenant_id = :tenantId` to every tenant-owned
entity's queries as defense in depth on top of RLS. Edge ingest, which has no user JWT,
resolves tenant/site from the authenticated camera/gate's registration record instead.

## 7. Non-Functional Requirements

| Dimension | Target | Notes |
|---|---|---|
| Availability | 99.5% platform API (MVP), 99.9% (post-GA) | Multi-pod API tier + managed/HA Postgres; edge tolerates backend downtime via local queue |
| Latency (interactive API) | p95 < 300ms for read endpoints, < 800ms for writes | Excludes AI inference; entitlement/tenant checks must be cache-backed (Redis) to hold this budget |
| Latency (edge ingest → WS push) | p95 < 2s end to end | Detection → ingest → outbox relay → RabbitMQ → Redis → WS client |
| Throughput per site | Sustain 1 event/sec/camera sustained, burst 10/sec/camera | Drives `ai-ingest` scaling and RabbitMQ queue sizing |
| Data retention | Plan-dependent (Free 7d .. Enterprise 365d) | Enforced via partition drop + object storage lifecycle rules, see `05_Subscription_Billing` |
| Tenant isolation | Zero cross-tenant data leakage under RLS + filter | See `04_Multi_Tenant_Design` §isolation guarantees |

These are starting targets for capacity planning, not SLAs committed to customers yet — they
should be revisited once the first tenant's real traffic is observed.

## 8. Diagrams

- `diagrams/container-architecture.mmd` — C4-container-style view of the modular monolith,
  its internal modules, and the infrastructure it depends on (Postgres/PostGIS, Redis,
  RabbitMQ, object storage, Stripe, LLM provider).
- `diagrams/deployment-topology.mmd` — Kubernetes deployment topology: on-site edge agents
  connecting outbound through an Ingress to a stateless, horizontally-scaled API tier backed
  by a managed/operator-run data tier.
- `diagrams/request-flow.mmd` — sequence diagram of an edge detection event traveling through
  ingest, tenancy resolution, outbox-pattern persistence, RabbitMQ, and Redis-relayed
  WebSocket fan-out to a connected web client.

## 9. Decisions / ADRs

- [`adr/ADR-0301-modular-monolith-strangler.md`](adr/ADR-0301-modular-monolith-strangler.md) — Modular monolith first, Strangler path to microservices.
- [`adr/ADR-0302-rabbitmq-outbox.md`](adr/ADR-0302-rabbitmq-outbox.md) — Introduce RabbitMQ event bus + transactional outbox.
- [`adr/ADR-0303-redis-cache-ws-scaleout.md`](adr/ADR-0303-redis-cache-ws-scaleout.md) — Redis for cache + WebSocket scale-out.

## 10. Open Questions / Risks

- Outbox relay mechanism (scheduled poll vs Debezium CDC) is not yet chosen — affects
  event-to-publish latency budget in §7.
- `GateApiKeyAuthFilter`'s "open if unset" dev fallback must be hardened before any
  multi-tenant production deployment — a missing `GATE_API_KEY` today means *no*
  authentication on gate endpoints.
- No load data exists yet for per-site event throughput; the NFR table's numbers are
  estimates pending the first real tenant.
- Module boundary enforcement (ArchUnit/Spring Modulith) is not yet implemented — without it,
  the modular monolith can silently regress into a ball of mud as modules are added.

## 11. Cross-References

- `04_Multi_Tenant_Design` — full tenancy model, RLS policies, isolation guarantees.
- `05_Subscription_Billing` — plan entitlements that drive retention/throughput limits above.
- `06_User_RBAC` — role/permission model layered on top of the `iam` module.
- `07_Camera_Management`, `10_AI_Pipeline` (sibling docs) — detail on `ai-ingest` producers.
- `15_Database_Design` (sibling doc) — full schema including outbox and partitioned event
  tables.
- `21_Deployment` (sibling doc) — Kubernetes/Helm/GitOps detail behind §"Deployment topology".
