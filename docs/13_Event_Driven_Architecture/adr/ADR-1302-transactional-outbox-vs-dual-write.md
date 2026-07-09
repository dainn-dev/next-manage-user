# ADR-1302: Transactional outbox pattern (vs dual-write)

- Status: Proposed
- Date: 2026-07-09
- Deciders: Principal Architect
- Context doc: 13_Event_Driven_Architecture

## Context

The closest thing to idempotent event handling that exists today is
`GateEventDeduplicator` (`backend/src/main/java/com/vehiclemanagement/service/`), used by
`VehicleController#checkVehiclePost` / `checkVehicleMultipart`. It is explicitly a
best-effort, **in-memory**, bounded (20,000 entries), TTL-expiring (10 minutes) LRU cache
keyed on the edge-supplied `eventId` — it does not survive a restart and is not shared
across instances. That is adequate for today's single-instance, no-bus deployment, but is
not a durable idempotency or publish guarantee, and there is no outbox table, no message
broker, and no relay process today.

Once RabbitMQ is introduced (ADR-1301), the naive approach — write the `ParkingEvent` row to
Postgres, then publish to RabbitMQ, as two separate operations ("dual write") — has a
well-known failure mode: if the process crashes or the publish fails between the DB commit
and the broker ack, the event is silently lost (or, with retry-then-write, silently
duplicated). Given events drive money-adjacent notification and analytics flows and the
edge already retries via its own SQLite store-and-forward queue, we need an end-to-end
guarantee, not just a client-side one.

## Decision

Use the **transactional outbox pattern**: the ingest API writes the `ParkingEvent` row and
an `outbox_message` row (event type, routing key, JSON payload, `status=PENDING`) in a
**single database transaction**. A separate **Outbox Relay** worker polls
`outbox_message WHERE status='PENDING'` (`SELECT ... FOR UPDATE SKIP LOCKED`), publishes to
RabbitMQ with publisher confirms, and marks the row `DISPATCHED` only after the broker acks.
See `../diagrams/outbox-relay-sequence.mmd`. Idempotency is enforced durably at the ingest
API via a **unique constraint on `ParkingEvent.event_id`** — the same edge-generated
`eventId` (UUID) + `occurredAt` pair that the edge already sends today, replacing the
in-memory dedup cache with a durable, multi-instance-safe check.

## Alternatives considered

- **Dual write (DB commit, then publish)** — simplest to write, but not atomic: a crash or
  broker outage after the DB commit loses the event entirely, with no recovery path.
  Rejected — unacceptable for events that drive notifications and billing-adjacent
  analytics.
- **Publish-then-persist** — publish to RabbitMQ first, then write to Postgres; risks a
  published event with no corresponding durable record (consumers get ahead of the source of
  truth) and duplicate publishes on retry. Rejected for the same class of reasons.
- **Change Data Capture (CDC) off the `ParkingEvent` table** (e.g. Debezium) — removes the
  need for an explicit outbox table by tailing the WAL; genuinely elegant. Rejected for now
  as extra operational surface (Kafka Connect or Debezium Server) not justified at current
  scale; the explicit outbox + polling relay is simpler to run and reason about in a modular
  monolith. Revisit if outbox polling latency or DB load becomes a bottleneck.
- **Transactional outbox with polling relay (chosen)** — pros: atomic with the business
  write via a normal ACID transaction, no new infra beyond a worker thread/process, durable
  idempotency key doubles as the event store's natural primary lookup. Cons: polling adds
  latency (bounded by poll interval, ~200ms) versus push-based CDC; relay is a new
  single-purpose process to operate and monitor (queue depth, oldest-pending-age alerts).

## Consequences

- Positive: at-least-once delivery to RabbitMQ with no lost events across a crash; the
  `event_id` unique constraint gives durable idempotency across restarts and multiple ingest
  API instances, closing the gap the in-memory `GateEventDeduplicator` could not close;
  reuses the edge's existing `eventId`/`occurredAt` contract with no edge-side change.
- Negative / trade-offs: consumers must still be idempotent (retries and, rarely,
  at-least-once redelivery can still duplicate a message downstream of the relay); the
  outbox table needs its own retention/cleanup job so it doesn't grow unbounded.
- Follow-ups: retire `GateEventDeduplicator` once the outbox path is live for
  `check-vehicle`/ingest, or keep it purely as a fast-path pre-check in front of the DB
  unique constraint; add an ops alert on `outbox_message` age/backlog.
