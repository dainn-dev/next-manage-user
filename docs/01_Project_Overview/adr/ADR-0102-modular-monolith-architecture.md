# ADR-0102: Modular monolith architecture style

- Status: Proposed
- Date: 2026-07-09
- Deciders: Principal Architect
- Context doc: 01_Project_Overview

## Context

Today's backend is a single Spring Boot 3.2 / Java 17 application (`com.vehiclemanagement`)
with a conventional layered package structure — `controller/`, `service/`, `repository/`,
`entity/`, `dto/`, `config/`, `util/` — and no internal module boundaries: any controller or
service can call any repository directly, and there is no enforced separation between, say,
gate-heartbeat logic and vehicle-log logic. It ships as one deployable, one Jetty process on
:8080, one PostgreSQL database (`vehicle_management`).

The target platform (§2/§3 of the shared brief) adds substantial new surface area: tenancy
and RLS enforcement, Stripe billing, a richer parking domain (Camera, ParkingSlot,
VehicleTrack, ParkingEvent), an edge ingest pipeline feeding a RabbitMQ event bus, an AI
chatbot with tool-calling, notifications, and analytics/usage-metering. Some of these
(ai-ingest under load from many concurrent camera streams, analytics running heavy
aggregations) plausibly need to scale independently of the rest. Others (iam, tenancy) are
low-traffic and tightly coupled to almost everything else via cross-cutting concerns
(tenant filtering, auth).

The team is small relative to the number of new capabilities being added, and per ADR-0101
the system is evolving from a live single-tenant deployment, not starting greenfield. The
architecture style decision determines how much operational and coordination overhead the
team takes on before there's evidence any component actually needs independent scaling.

## Decision

Start as a **modular monolith**: one Spring Boot deployable, restructured into clearly
bounded Java packages/modules — `iam`, `tenancy`, `billing`, `parking`, `ai-ingest`,
`events`, `chatbot`, `notification`, `analytics` — each with an explicit public API
(service interfaces / facade classes) and no direct cross-module repository or entity
access. Modules communicate through their public interfaces or through domain events on the
outbox/RabbitMQ bus (see the event-bus ADR in `05_...` / the eventing doc), not through
shared mutable state. Extract a module into an independently deployable service only when a
concrete, measured justification exists (e.g. `ai-ingest` needs GPU-adjacent scaling or
`analytics` needs a different runtime/language) — this is canonical decision #15 in the
shared architecture brief (§3).

## Alternatives considered

- **Modular monolith with strangler-fig extraction later (chosen)** — One deployable today,
  enforced module boundaries, extract to services opportunistically.
  - Pros: single deployment pipeline and single transaction boundary while the domain
    model is still moving fast; enforced module boundaries pay for themselves immediately
    (they're what makes later extraction possible at all, and they also make the
    single-tenant → multi-tenant retrofit from ADR-0101 tractable module by module);
    lowest operational overhead (no service mesh, no distributed tracing required yet, no
    N sets of CI/CD); cross-module transactions (e.g. an `ai-ingest` event that must also
    update `parking.ParkingSlot.status` in the same commit) stay simple ACID transactions
    instead of sagas.
  - Cons: requires real discipline to keep module boundaries honest in a single codebase —
    without automated enforcement (e.g. ArchUnit tests forbidding cross-module entity
    imports) they erode over time; a bug or resource leak in one module can still take
    down the whole process; scaling is all-or-nothing until a module is actually extracted.

- **Microservices from day one** — Split `iam`, `tenancy`, `billing`, `parking`,
  `ai-ingest`, `events`, `chatbot`, `notification`, `analytics` into separately deployable
  services immediately, each with its own datastore.
  - Pros: independent scaling and deployment per module from the start; forces clean
    contracts immediately; matches the eventual target topology in §3.14
    (Kubernetes/HPA) without a later migration.
  - Cons: massively higher upfront cost for a team simultaneously executing ADR-0101's
    evolve-not-rewrite migration — distributed transactions/sagas for flows that today are
    one `@Transactional` method (e.g. ingest event → update slot → emit notification),
    N services' worth of CI/CD/observability/on-call before any of them has proven load
    that justifies it, and cross-service data consistency during the tenant_id/site_id
    backfill (ADR-0101) is materially harder than a single-database migration; premature
    given no component has yet demonstrated it needs independent scaling.

- **Single undifferentiated monolith (no module boundaries)** — Keep growing the current
  flat `controller/service/repository/entity` structure, adding tenancy, billing, events,
  chatbot etc. as more classes in the same undifferentiated packages.
  - Pros: zero upfront restructuring cost; fastest to add the first new feature.
  - Cons: with 9 new capability areas landing on top of an already-flat structure, coupling
    compounds fast — a chatbot tool-call handler could reach directly into a
    `VehicleRepository` with no tenant filter applied, defeating the RLS/tenant-isolation
    guarantees this whole platform depends on; makes future extraction (if ever needed)
    far more expensive because there are no seams to cut along; harder to reason about
    which team/agent owns which code as the system grows.

## Consequences

- Positive: enforced module boundaries make the ADR-0101 evolve-not-rewrite migration
  tractable one module at a time; keeps one deployment pipeline and one transactional
  database while the domain model is still settling; leaves a documented, low-cost path to
  extract `ai-ingest` or `analytics` later without a redesign.
- Negative / trade-offs: boundary discipline must be actively maintained (recommend
  ArchUnit or equivalent build-time checks once modules exist) or the monolith degrades
  into the "undifferentiated" alternative by accretion; no independent scaling or fault
  isolation between modules until something is actually extracted; a resource-heavy
  `ai-ingest` burst (many concurrent camera streams) can still contend with `parking` API
  traffic in the same process until extraction happens.
- Follow-ups: define the initial Java package-per-module layout and the ArchUnit
  boundary-enforcement rule in `03_SaaS_Architecture`; track the extraction trigger
  criteria (what load/metric justifies pulling `ai-ingest` or `analytics` out) in
  `23_Roadmap`.
