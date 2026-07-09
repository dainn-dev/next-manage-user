# ADR-2201: Testcontainers-based integration testing

- Status: Proposed
- Date: 2026-07-09
- Deciders: Principal Architect
- Context doc: 22_Testing

## Context

The backend already uses **JUnit + Testcontainers (1.21.4, version pinned above the Spring Boot
3.2.0 BOM default per the pom.xml comment)** for integration tests against a real
**PostgreSQL** container — `AbstractPostgresIntegrationTest` is the shared base class, and
`CheckVehicleFlowIntegrationTest` exercises the gate check-vehicle flow against it (brief §1,
verified in `backend/src/test/java/com/vehiclemanagement/integration/`). Unit tests
(`GateEventDeduplicatorTest`, `GateServiceTest`, `VehicleSchedulerServiceTest`, etc.) sit
alongside using mocks, not containers. The frontend today has **no test script at all** in
`package.json` (`build`/`dev`/`lint`/`start` only) — no unit or integration test tooling
configured. The edge has one Python resilience test, `test_edge_resilience.py`, which fakes the
backend at the `requests` layer rather than using a real container. The target platform adds
**RabbitMQ** and **Redis** as hard dependencies (brief §3.5, §3.6) that integration tests must
exercise realistically — mocking a message broker's delivery semantics (redelivery, ack/nack,
ordering) tends to hide real bugs that only appear against the genuine broker. We need to decide
how integration testing extends as these new dependencies are introduced.

## Decision

**Extend the existing Testcontainers pattern to cover RabbitMQ and Redis**, keeping Postgres as
today, rather than introducing embedded/in-memory fakes for the new dependencies:

- `AbstractPostgresIntegrationTest`-style base classes are added for RabbitMQ
  (`AbstractRabbitMqIntegrationTest`) and Redis (`AbstractRedisIntegrationTest`), each spinning up
  the real image (`rabbitmq:3-management`, `redis:7-alpine` or similar) via Testcontainers, matching
  the versioning discipline already established for the Postgres container.
- Where a test needs more than one dependency (e.g. the outbox relay: writes to Postgres, publishes
  to RabbitMQ), a composed base class starts all needed containers together, reusing containers
  across test classes in the same JVM run where Testcontainers' reuse feature applies, to keep
  suite runtime manageable.
- Integration tests validate **real broker semantics** the platform actually depends on: at-least-
  once delivery + idempotent consumption (the notification/analytics consumers' `event_id`
  dedup, `19_Notification`/`20_Analytics`), outbox-relay exactly-once-effective delivery, and
  Redis-backed dedup/rate-limit TTL behavior.
- Frontend integration/unit testing is introduced (Vitest + React Testing Library is the
  recommended pairing, given Next.js 14 App Router + existing React 18/TS stack) as a **new
  capability**, not an extension of anything that exists today — this is called out explicitly so
  it is not mistaken for already having coverage.
- The edge's existing fake-backend-at-the-requests-layer pattern (`test_edge_resilience.py`) is
  **kept as-is** for what it tests (store-and-forward queue behavior, independent of any real
  network) — it is deliberately not converted to hit a containerized backend, since its entire
  point is to validate behavior when the backend is unreachable.

## Alternatives considered

- **Testcontainers for all new stateful dependencies** (chosen) — extends the proven pattern.
  - Pros: tests run against the real broker/cache engine, catching integration bugs that mocks
    hide (e.g. RabbitMQ redelivery semantics, Redis TTL edge cases); consistent tooling and
    developer experience with what the backend team already has for Postgres; runs in CI without
    needing shared/external test infrastructure (each run gets fresh, isolated containers).
  - Cons: slower test suite than mocks (container startup overhead per suite, mitigated by
    Testcontainers' container reuse); requires Docker-in-Docker or equivalent in the CI runner
    environment (already a prerequisite today for the existing Postgres Testcontainers usage, so
    not a new CI capability).

- **Embedded/in-memory fakes** (e.g. an embedded RabbitMQ-like broker, `fakeredis`-equivalent for
  Java, or hand-rolled mocks of the AMQP/Redis client interfaces).
  - Pros: fastest possible test execution; no Docker dependency in CI.
  - Cons: embedded fakes for RabbitMQ specifically are not well-maintained/production-representative
    in the Java ecosystem; mocked semantics drift from real broker behavior over time (a classic
    source of "tests pass, prod breaks" bugs), which is precisely the risk with an event-driven
    architecture where delivery guarantees (at-least-once, ordering per queue) are load-bearing;
    rejected for anything touching message delivery semantics.

- **Shared, long-lived test infrastructure** (a persistent dev/test RabbitMQ+Redis+Postgres
  cluster that all CI runs and developers point at).
  - Pros: no per-run container startup cost.
  - Cons: test isolation breaks down (one test's leftover state affects another); cannot run
    tests in parallel safely without careful namespacing; a shared resource becomes a bottleneck
    and a single point of CI flakiness; contradicts the existing per-run-isolated Testcontainers
    philosophy already working for Postgres today.

## Consequences

- Positive: integration-test confidence extends naturally to the new event-driven dependencies
  without introducing a second testing philosophy; the pattern is already proven and understood by
  the team (Postgres Testcontainers is in production use today); CI does not need new shared
  infrastructure to provision.
- Negative / trade-offs: CI runtime grows with each new containerized dependency (mitigated via
  parallelization and container reuse); the frontend testing capability is being built from zero,
  which is a real, non-trivial scope item, not a small extension.
- Follow-ups: define coverage targets per layer (README §5 below); pick and wire the frontend test
  runner (Vitest/RTL) as an implementation ticket; the CI pipeline stages that run these tests are
  specified in `21_Deployment`'s CI/CD section and `diagrams/ci-test-stage-pipeline.mmd` in this
  doc.
