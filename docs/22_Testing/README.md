# 22. Testing

Test & quality strategy for ParkVision: how correctness is validated across the backend, edge AI
pipeline, event-driven middleware, and dashboard — from today's backend-only JUnit/Testcontainers
setup to a full target test pyramid with AI evaluation, edge resilience, load, multi-tenant
isolation, and security testing.

Status: Draft · Owner: Principal Architect · Last updated: 2026-07-09

## 1. Current state vs Target

**Current state (verified in code, brief §1).** The backend has real, working test
infrastructure: **JUnit + Testcontainers (1.21.4, explicitly version-pinned above the Spring Boot
3.2.0 BOM default in `pom.xml`)** against a genuine **PostgreSQL** container. Concretely, in
`backend/src/test/java/com/vehiclemanagement/`: `integration/AbstractPostgresIntegrationTest`
is the shared Testcontainers base class, `integration/CheckVehicleFlowIntegrationTest` exercises
the gate check-vehicle flow end-to-end against it, and unit tests
(`GateEventDeduplicatorTest`, `GateServiceTest`, `VehicleSchedulerServiceTest`,
`VehicleRbacTest`, `WebSocketServiceTest`, `VehicleLogExportServiceTest`, and others) cover
service-layer logic with mocks. The **frontend has no test tooling configured at all** —
`frontend/package.json` scripts are only `build`, `dev`, `lint`, `start`; no Vitest/Jest/
Playwright dependency exists today. The **edge** has one resilience test,
`edge/edge/test_edge_resilience.py`, which drives `EventQueue` + `GateClient` directly against a
faked backend (at the `requests` layer) to verify three scenarios: (1) backend down → confirmed
events land in the durable SQLite queue, nothing lost; (2) backend up → the retry worker drains
the queue, delivering every event exactly once with its original timestamp, queue ends empty;
(3) the same `event_id` retried twice → the backend records a single logical event (idempotent
dedup, mirroring the Java-side `GateEventDeduplicator`). There is **no contract testing, no AI/ML
evaluation harness, no E2E testing, no load/perf testing, no multi-tenant isolation testing** (no
tenants exist today), and **no dedicated security testing** in the repo today.

**Target.** A full test pyramid — unit, integration (Testcontainers extended to RabbitMQ and
Redis), contract tests for the ingest and REST APIs (OpenAPI-driven), AI/ML evaluation (OCR
accuracy, detection mAP, slot-mapping precision, relocation false-positive rate), edge resilience
(keeping and extending today's suite), E2E (Playwright) for the dashboard, load/perf tests
(events/sec per site), multi-tenant isolation tests (RLS), and security testing — with CI gates
and coverage targets enforcing all of it before promotion to production.

| Layer | Current | Target |
|---|---|---|
| Backend unit | JUnit, service-layer mocks | Same, extended as new modules (iam, tenancy, billing, ...) ship |
| Backend integration | Testcontainers: Postgres only | Testcontainers: Postgres + RabbitMQ + Redis |
| Frontend unit/integration | None | Vitest + React Testing Library (new capability) |
| Contract tests | None | OpenAPI-driven, ingest API + REST API |
| AI/ML evaluation | None (manual review) | Harness with per-stage metrics + acceptance thresholds |
| Edge resilience | `test_edge_resilience.py` (store-and-forward) | Same, extended for new edge stages (motion, tracking, slot-mapping) |
| E2E | None | Playwright against the dashboard |
| Load/perf | None | Events/sec per site, sized to target camera counts |
| Multi-tenant isolation | N/A (single-tenant today) | RLS isolation tests (cross-tenant leak prevention) |
| Security | None dedicated | SAST/DAST + dependency scanning in CI |

## 2. Test pyramid (target)

From most to fewest/slowest: **unit → integration → contract → load/perf → E2E**, plus
cross-cutting suites (AI/ML evaluation, edge resilience, multi-tenant isolation, security) that
run alongside rather than as a pyramid layer, since they validate different axes (model accuracy,
offline resilience, tenant boundary, attack surface) rather than "more/less end-to-end." See
`diagrams/test-pyramid.mmd`.

### Unit tests
- **Backend**: JUnit (as today), one test class per service/util, mocked collaborators. Extends
  to new modules (`iam`, `tenancy`, `billing`, `parking`, `ai-ingest`, `events`, `chatbot`,
  `notification`, `analytics` — brief §3.15) as they ship.
- **Frontend**: Vitest + React Testing Library (new). Component logic, hooks (e.g. a future
  `use-notifications.ts` alongside the existing `use-websocket.ts`), API client classes in
  `lib/api/`.
- **Edge**: pytest for `DetectionCore`, `EventQueue`, `GateClient` logic in isolation (extends the
  pattern already used by `test_edge_resilience.py`).

### Integration tests
Testcontainers-backed, per ADR-2201: Postgres (as today, extended for RLS-scoped queries once
multi-tenancy ships), **plus new RabbitMQ and Redis containers** validating real broker/cache
semantics — outbox-relay delivery, consumer idempotency (`event_id` dedup, same pattern as the
edge's existing dedup), Redis TTL-based dedup/rate-limiting.

### Contract tests
**OpenAPI 3.1** is the API contract (brief §3.16); contract tests validate the **ingest API**
(edge → backend, request/response shape + idempotency-key semantics) and the **REST API**
(dashboard/mobile → backend) against the published spec, catching breaking changes before a
consumer (edge fleet, mobile app) is broken by a backend deploy. springdoc, already present
today generating OpenAPI/Swagger docs (brief §1), is the spec source.

### AI/ML evaluation
Per ADR-2202: OCR accuracy, detection mAP, slot-mapping precision, relocation false-positive
rate, each measured against labeled datasets with acceptance thresholds gating model promotion.
See `diagrams/ai-eval-flow.mmd` and ADR-2202 for the metrics table.

### Edge resilience
Keep and extend `test_edge_resilience.py`'s store-and-forward pattern (backend-down queuing,
exactly-once drain, idempotent dedup) as new edge stages are added (motion detection gating,
ByteTrack tracking, slot mapping) — each new stage that can fail or degrade gracefully should get
an equivalent "what happens when X is unavailable/degraded" test.

### E2E (Playwright)
Critical dashboard flows: login → view live monitoring, view a site's occupancy dashboard,
acknowledge a notification, export a report, configure a parking-slot map. Runs against a staging
deployment (`21_Deployment` CI/CD pipeline), not against mocked APIs, to catch real integration
gaps.

### Load / performance tests
Sized around **events/sec per site** — the ingest API's dominant load driver, since every camera
detection/relocation/exit is a request. Test scenarios simulate N sites x M cameras x expected
detection rate, verifying the ingest path, outbox relay, and downstream consumers
(notification, analytics) keep up without unbounded queue growth.

### Multi-tenant isolation (RLS)
Once `tenant_id`/RLS ships (`04_Multi_Tenant_Design`), a dedicated suite asserts that a query
executed under Tenant A's JWT/session **cannot** read or write Tenant B's rows, across every
tenant-owned table — run as part of integration testing, not a one-time manual check, since RLS
policy regressions are exactly the kind of thing that silently reappears after a migration.

### Security testing
Dependency vulnerability scanning (backend Maven deps, frontend npm deps, edge pip deps) and
SAST/DAST integrated into CI (`21_Deployment`), plus targeted tests for the JWT auth path,
`GATE_API_KEY` enforcement (today's "runs OPEN if unset" dev fallback must fail closed in
non-dev environments), and tenant-boundary enforcement on every new endpoint.

## 3. CI gates and coverage targets

| Gate | Threshold (proposed) | Blocks promotion? |
|---|---|---|
| Unit test pass rate | 100% | Yes |
| Backend line coverage | ≥ 70% (existing service layer), ratcheting up per module as it matures | Yes, on regression below baseline |
| Frontend coverage | ≥ 60% once the test suite exists (new capability, start low, ratchet up) | Yes, once baselined |
| Integration test pass rate | 100% | Yes |
| Contract test pass rate | 100% (no undocumented breaking changes) | Yes |
| AI eval thresholds | Per ADR-2202 table | Yes, for model/pipeline changes only |
| E2E pass rate (staging) | 100% on critical paths | Yes, blocks prod promotion |
| RLS isolation tests | 100% (zero cross-tenant leaks) | Yes, hard gate, no exceptions |
| Security scan | No new Critical/High findings | Yes |

Coverage numbers are starting points to be calibrated against the existing backend baseline
(current test suite size, not measured in this doc) rather than arbitrary targets; the RLS
isolation gate is intentionally zero-tolerance since a leak is a tenant data-breach class bug.

## 4. Diagrams

- [`diagrams/test-pyramid.mmd`](diagrams/test-pyramid.mmd) — the layered pyramid (unit →
  integration → contract → load → E2E) plus the cross-cutting AI-eval/edge-resilience/tenant-
  isolation/security suites.
- [`diagrams/ci-test-stage-pipeline.mmd`](diagrams/ci-test-stage-pipeline.mmd) — how each test
  layer maps to a CI stage, the coverage gate, and the staging gates that block prod promotion.
- [`diagrams/ai-eval-flow.mmd`](diagrams/ai-eval-flow.mmd) — the AI evaluation harness flow from
  labeled datasets through per-stage metrics to a pass/fail acceptance decision.

## 5. Decisions / ADRs

- [`adr/ADR-2201-testcontainers-integration-testing.md`](adr/ADR-2201-testcontainers-integration-testing.md) —
  extend the existing Postgres Testcontainers pattern to RabbitMQ and Redis rather than mocking
  broker/cache semantics.
- [`adr/ADR-2202-ai-model-evaluation-harness.md`](adr/ADR-2202-ai-model-evaluation-harness.md) —
  a dedicated AI evaluation harness with per-stage metrics and acceptance thresholds gating
  model/pipeline promotion.

## 6. Open questions / risks

- **Coverage baselines are unmeasured.** The percentages in §3 are reasonable starting points, not
  measured against the actual current backend suite — an early implementation task should run
  coverage tooling against today's tests to set real baselines before treating them as gates.
- **Labeled dataset ownership and governance** (who curates/approves AI eval datasets) is not
  decided — see ADR-2202 follow-ups.
- **Load test realism** depends on having representative per-site camera counts and detection
  rates, which are product assumptions, not yet validated with real customer data.
- **RLS test coverage completeness** is only as good as remembering to add a case for every new
  tenant-owned table — this needs a checklist/lint rule tied to schema migrations, not just
  developer discipline.

## 7. Cross-references

- `21_Deployment` — CI/CD pipeline stages that run these test layers, and the environments
  (staging/prod) tests gate promotion between.
- `13_Event_Driven_Architecture` — RabbitMQ/outbox semantics validated by the new integration
  tests (ADR-2201).
- `04_Multi_Tenant_Design` — RLS design that the multi-tenant isolation suite validates.
- `19_Notification` — relocation false-positive rate (ADR-2202) directly affects notification
  quality; dedup/idempotency patterns shared with edge resilience testing.
- `20_Analytics` — projections consumed by contract/integration tests validating analytics read
  models stay correct as events replay.
