# ADR-0302: Introduce RabbitMQ Event Bus with Transactional Outbox

- Status: Proposed
- Date: 2026-07-09
- Deciders: Principal Architect
- Context doc: 03_SaaS_Architecture

## Context

Today the backend has **no message broker at all**. Realtime updates travel only over STOMP
WebSocket with Spring's in-memory `SimpleBroker` (`/topic/vehicle-check`,
`/topic/gate/{gateId}/check`), which only fans out to clients connected to the *same* JVM
instance and has no durability — missed events are only recoverable via the
`GET /api/gates/{id}/recent-checks` polling endpoint. The target vision requires nine domain
events (MotionDetected, VehicleDetected, PlateRecognized, VehicleEntered, VehicleRelocated,
VehicleExited, PersonDetected, SnapshotSaved, NotificationSent) to fan out to multiple
independent consumers — notification, analytics, chatbot context, future microservices — a
pattern in-memory broadcast cannot support once the API runs as multiple horizontally-scaled
pods (ADR-0301, ADR-0303). Naively publishing to a broker directly inside the same
transaction that writes domain state risks the classic dual-write problem: if the DB commit
succeeds but the broker publish fails (or vice versa), state and events diverge silently.

## Decision

Introduce **RabbitMQ** as the domain event bus, fed via the **transactional outbox pattern**:
every write that produces a domain event writes the event row into an `outbox_event` table
(or the `ParkingEvent` log itself, see `04_Multi_Tenant_Design`/`15_Database_Design`) in the
**same database transaction** as the state change. A separate relay (a polling publisher or
Debezium-style CDC reader) reads committed outbox rows in order and publishes them to
RabbitMQ, marking them relayed. Routing keys follow `tenant.<tenant_id>.site.<site_id>.<eventType>`
so consumers can bind selectively. The edge ingest API (`ai-ingest` module) is the single
producer for AI-pipeline events; the backend validates and persists first, publishes second —
edge devices never talk to RabbitMQ directly.

## Alternatives considered

- **Direct publish-then-persist (no outbox)** — pros: simpler, one fewer moving part; cons:
  not atomic — a crash between publish and commit either loses the event or double-publishes
  it with no clean way to distinguish, unacceptable for billing usage metering (ADR-0502)
  and audit trails.
- **Kafka instead of RabbitMQ** — pros: better raw throughput and native log-based replay for
  very high event volumes; cons: heavier operational footprint (ZooKeeper/KRaft, partition
  rebalancing) than this stage's traffic (per-site event volume, see NFRs in README)
  justifies; RabbitMQ's routing-key model maps more directly onto tenant/site multi-tenant
  fan-out and the team has more familiarity with AMQP-style brokers.
- **Keep WebSocket-only, no broker (status quo)** — pros: zero new infra; cons: cannot
  survive multi-pod horizontal scaling (each pod's SimpleBroker is isolated), no durable
  replay for consumers added later (analytics, chatbot), no decoupling between producers
  (ai-ingest) and consumers (notification, analytics).

## Consequences

- Positive: atomic state+event writes eliminate dual-write bugs; new consumers (analytics,
  chatbot RAG indexing) can subscribe without touching producer code; RabbitMQ's per-tenant
  routing keys give a natural place to enforce per-tenant queue quotas later (noisy-neighbor
  mitigation, see `04_Multi_Tenant_Design`).
- Negative / trade-offs: outbox relay adds latency (polling interval, or CDC operational
  complexity) between "committed" and "published"; RabbitMQ becomes a new operational
  dependency requiring HA (quorum queues) in production; consumers must be idempotent since
  outbox-relay-then-broker delivery is at-least-once.
- Follow-ups: pick and load-test the relay mechanism (scheduled poll vs Debezium) before
  first production tenant; define per-tenant/per-event-type queue and DLQ topology; wire
  RabbitMQ metrics into the Prometheus setup already present today (`/actuator/prometheus`).
