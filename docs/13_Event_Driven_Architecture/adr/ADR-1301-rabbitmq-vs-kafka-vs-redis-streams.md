# ADR-1301: RabbitMQ as the domain event bus (vs Kafka, vs Redis Streams)

- Status: Proposed
- Date: 2026-07-09
- Deciders: Principal Architect
- Context doc: 13_Event_Driven_Architecture

## Context

Today the backend has no durable event bus. Realtime fan-out is an in-memory STOMP
`SimpleBroker` (`WebSocketConfig`, topics `/topic/vehicle-check` and
`/topic/gate/{gateId}/check`) — it holds no state across restarts, does not persist events,
and cannot be consumed by anything other than a connected WebSocket client. There is no
message broker, no consumer group, no retry/DLQ mechanism.

The target platform (§2/§3.5 of the architecture brief) needs a durable, multi-consumer bus
for the nine domain events (MotionDetected, VehicleDetected, PlateRecognized, VehicleEntered,
VehicleRelocated, VehicleExited, PersonDetected, SnapshotSaved, NotificationSent), fanned out
to five independent consumer groups (DB projector, notification, snapshot, analytics,
chatbot-index) with per-consumer retry and dead-lettering, and it must fit a **modular
monolith** that a small team runs on Docker Compose today and Kubernetes later — not a
large distributed streaming platform.

## Decision

Adopt **RabbitMQ** (topic exchange `parkvision.events`, routing key
`tenant_id.site_id.event_type`) as the event bus for the initial platform. One exchange,
one queue per consumer group, each queue bound to the routing keys it cares about (see
`../diagrams/event-bus-topology.mmd`), each queue with a per-queue DLQ via a dead-letter
exchange.

## Alternatives considered

- **Apache Kafka** — pros: log-based replay, very high throughput, strong ecosystem for
  stream processing/CDC. Cons: operational weight (ZooKeeper/KRaft, partitions, consumer
  offset management) is disproportionate to current event volume (single-digit sites,
  low-thousands of events/day at launch); no team member currently operates Kafka; harder
  to run cheaply on a single Docker Compose host for dev/small tenants.
- **Redis Streams** — pros: we are already adding Redis for cache/rate-limit/STOMP relay
  (§3.6), so Streams would mean one fewer moving part. Cons: weaker consumer-group/ack/DLQ
  ergonomics than RabbitMQ, no native routing-key fan-out (would need manual stream-per-topic
  wiring), persistence is secondary to Redis's cache role and less battle-tested as a
  primary durable bus at our reliability bar.
- **RabbitMQ (chosen)** — pros: mature topic-exchange routing matches our
  tenant/site/event-type fan-out exactly, per-queue DLQ is first-class, publisher confirms
  give the outbox relay a clean ack contract, operationally light (single container, well
  understood), consumers can be added without touching producers. Cons: no built-in log
  replay (mitigated by the durable `ParkingEvent` table acting as the event store, §4 /
  `15_Database_Design`); horizontal broker scaling is coarser than Kafka's partitioning.

## Consequences

- Positive: fast to stand up in Docker Compose today, matches the routing-key model in
  §3.5, keeps the modular monolith's operational footprint small (ADR from
  `15_Backend_Deployment`-style follow-up), per-consumer DLQ gives clean failure isolation.
- Negative / trade-offs: no infinite log retention/replay — replay must go through the
  `ParkingEvent` table, not the bus; RabbitMQ clustering for HA is required before it can be
  a single point of failure in production.
- Follow-ups: if analytics/chatbot-index consumers need to reprocess months of history at
  high throughput, revisit Kafka or a CDC pipeline off `ParkingEvent` (see ADR-1503 on
  time-partitioning) rather than replaying through RabbitMQ.
