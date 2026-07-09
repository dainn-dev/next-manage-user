# 13. Event-Driven Architecture

ParkVision's event backbone: the nine domain events emitted by the AI/edge pipeline and
backend, the RabbitMQ topology that fans them out to independent consumers, the
transactional outbox pattern that makes publishing atomic with persistence, and the
idempotency/ordering/retry contract that ties it all together. This document is the
reference for anyone producing or consuming a ParkVision domain event.

Status: Draft · Owner: Principal Architect · Last updated: 2026-07-09

## 1. Current state vs Target

### Current state (verified in code)

- **No message broker exists today.** No RabbitMQ, no Redis, no Kafka. Realtime updates use
  **STOMP over WebSocket** with Spring's **in-memory `SimpleBroker`**
  (`backend/.../config/WebSocketConfig.java`: `config.enableSimpleBroker("/topic")`,
  `setApplicationDestinationPrefixes("/app")`), exposed at endpoint `/ws` (SockJS). Topics are
  `/topic/vehicle-check` (global) and `/topic/gate/{gateId}/check` (per-gate), published from
  `WebSocketService`. This broker holds **no state** — it does not persist messages, has no
  consumer groups, and anything not connected at publish time simply misses the message.
  The only replay mechanism is `GET /api/gates/{id}/recent-checks`, a small in-memory/DB
  lookback, not a durable event log.
- **No outbox table, no event store table.** `VehicleLog` is the closest thing to an event
  record today — an entity row per entry/exit, not a generic, typed, partitioned event log.
- **Idempotency exists, but only as a best-effort, in-process cache.** The edge already sends
  a client-generated `eventId` (UUID) and `occurredAt` with every `check-vehicle` call
  (`edge/edge/` `GateClient`, and `VehicleCheckRequest.eventId` on the backend). The backend
  guards against edge retries with `GateEventDeduplicator`
  (`backend/src/main/java/com/vehiclemanagement/service/GateEventDeduplicator.java`): an
  in-memory, bounded (20,000 entries), TTL-expiring (10 minutes) LRU cache of `eventId` →
  cached response. It is explicitly documented in code as "best-effort... not shared across
  instances and does not survive a restart." This is the seed the outbox/event-store design
  below durably replaces.
- **Store-and-forward already exists at the edge.** `edge/edge_queue/events.sqlite3` is a
  durable, bounded FIFO SQLite queue with a background retry worker, exponential backoff, and
  dedup by `event_id` (see `edge/edge/event_queue.py`). This is kept and extended, not
  replaced — see `../edge` docs / `06_User_RBAC` sibling for the edge stack, and cross-refs
  below.

### Target (this document)

- **RabbitMQ** as a durable, topic-routed event bus (ADR-1301) fed by a **transactional
  outbox** (ADR-1302) written by the backend's ingest API in the same DB transaction as the
  event-store row.
- Nine standardized **domain events**: `MotionDetected`, `VehicleDetected`,
  `PlateRecognized`, `VehicleEntered`, `VehicleRelocated`, `VehicleExited`, `PersonDetected`,
  `SnapshotSaved`, `NotificationSent`.
- Durable, replayable **event store**: the partitioned `ParkingEvent` table (full schema in
  `15_Database_Design`).
- Durable **idempotency** keyed on `event_id`, upgrading today's in-memory dedup to a DB
  unique constraint honored across restarts and multiple instances.
- A versioned, additive-evolution **event schema** (ADR-1303).

## 2. Domain events

All nine events share a common envelope (`event_id`, `event_type`, `event_version`,
`tenant_id`, `site_id`, `occurred_at`, `payload`); the table below lists the
event-specific fields carried in `payload` and where they originate.

| Event | Emitted by | Key payload fields | Typical consumers |
|---|---|---|---|
| `MotionDetected` | Edge (OpenCV MOG2 gate) | camera_id, person_present, roi | analytics, db-projector (`MotionEvent`) |
| `VehicleDetected` | Edge (YOLOv11) | camera_id, track_id, bbox, confidence | analytics |
| `PlateRecognized` | Edge (YOLOv5 plate/char + PaddleOCR) | camera_id, track_id, license_plate, confidence | db-projector, notification |
| `VehicleEntered` | Edge → Ingest API | site_id, camera_id, gate_id, license_plate, track_id, slot_id (nullable) | db-projector, notification, analytics, chatbot-index |
| `VehicleRelocated` | Edge (ByteTrack + slot mapping) | track_id, license_plate, old_slot_id, new_slot_id | db-projector, notification, chatbot-index |
| `VehicleExited` | Edge → Ingest API | site_id, camera_id, gate_id, license_plate, track_id, slot_id | db-projector, notification, analytics, chatbot-index |
| `PersonDetected` | Edge (YOLOv11 person class) | camera_id, bbox, confidence | analytics |
| `SnapshotSaved` | Ingest API (on multipart upload) | snapshot_id, kind, object_url, related event_id | snapshot, chatbot-index |
| `NotificationSent` | Notification service | user_id, channel, notification_id, related event_id | analytics (delivery metrics) |

`VehicleEntered` / `VehicleExited` / `VehicleRelocated` are the three that also replace the
gate-access "state machine" behavior implicit in today's `Vehicle.status`
(`approved → entered → exited`, mutated inside `VehicleService.checkVehicleAccess`) — see
`14_Backend_API` for how the ingest endpoint that raises these maps onto the existing
`check-vehicle` contract.

## 3. RabbitMQ topology

- **Exchange**: `parkvision.events`, type `topic`, durable.
- **Routing key**: `tenant_id.site_id.event_type` — enables per-tenant, per-site, or
  per-event-type binding without N separate exchanges.
- **Queues per consumer** (durable, each with its own DLQ via a dead-letter exchange
  `parkvision.events.dlx`):
  - `q.db-projector` — bound `#` (all events); keeps `Vehicle.current_slot_id`,
    `ParkingSlot.status`, `ParkingHistory` in sync.
  - `q.notification` — bound to `*.*.VehicleEntered`, `*.*.VehicleExited`,
    `*.*.VehicleRelocated`, `*.*.NotificationSent`.
  - `q.snapshot` — bound to `*.*.SnapshotSaved`; links snapshots to object storage and to
    the triggering event.
  - `q.analytics` — bound `#`; feeds occupancy/dwell-time aggregates and usage metering
    (§3.10 of the brief).
  - `q.chatbot-index` — bound `#`; refreshes the read models the chatbot tools query
    (`getVehicleLocation`, `getHistory`, `getSnapshot`, `getParkingStatus`).
- See `diagrams/event-bus-topology.mmd` for the full binding diagram.

## 4. Transactional outbox pattern

The ingest API (backend `ai-ingest` module, §3.15) writes the `ParkingEvent` row and an
`outbox_message` row in **one database transaction**. A separate **Outbox Relay** worker
polls `outbox_message` for `PENDING` rows (`SELECT ... FOR UPDATE SKIP LOCKED`, small
batches, short poll interval), publishes each to RabbitMQ with publisher confirms, and marks
the row `DISPATCHED` only on broker ack. This closes the crash-window gap a naive "commit
then publish" dual-write has. Full rationale in `adr/ADR-1302-transactional-outbox-vs-dual-write.md`;
sequence in `diagrams/outbox-relay-sequence.mmd`.

## 5. Idempotency via event_id

- The edge already generates `eventId` (UUID) and `occurredAt` per detection today — no
  edge-side change required.
- Target: `ParkingEvent.event_id` gets a **unique constraint**. The ingest API attempts the
  insert; a unique-violation means "already processed" and the API returns the previously
  computed result without re-publishing to the outbox. This is a durable, cross-instance
  version of what `GateEventDeduplicator` does today in memory.
- Downstream consumers must also be idempotent on `event_id` (at-least-once delivery from
  RabbitMQ can still redeliver after a consumer crash before ack).

## 6. Ordering

RabbitMQ preserves order **within a single queue for a single publisher connection**, but
the platform does **not** guarantee global cross-event ordering across different event types
or across sites. Consumers that need strict per-vehicle ordering (e.g. `VehicleEntered`
before `VehicleRelocated` before `VehicleExited` for the same `track_id`) should key off
`occurred_at` and `track_id` in the payload and treat the queue order as a hint, not a
guarantee — a redelivered/retried message can arrive out of original order. The event store
(`ParkingEvent`, ordered by `occurred_at`) is the source of truth for sequencing, not queue
order.

## 7. Retries / DLQ

- **Outbox → RabbitMQ**: publish failures leave the `outbox_message` row `PENDING`; the relay
  retries on its next poll. After a configurable max-attempt count the row is marked `FAILED`
  and alerted on (not auto-dead-lettered — a publish failure is an infra problem, not a
  poison message).
- **RabbitMQ → consumer**: consumer nack or unacked-timeout triggers RabbitMQ's standard
  retry via the queue's dead-letter exchange; after N redeliveries the message lands in that
  queue's `.dlq` for manual inspection/replay (`diagrams/event-lifecycle.mmd`).
- **Edge → Ingest API**: unchanged and already durable — the SQLite store-and-forward queue
  retries with exponential backoff until the ingest API accepts (200/202) or dedupes (200
  cached).

## 8. Event schema and versioning

Every event is versioned independently via `event_version` in the envelope; payload changes
within a version must be additive-only. See `adr/ADR-1303-event-schema-versioning-registry.md`
for the full policy and the file-based JSON Schema registry.

## 9. Event store

`ParkingEvent` is the durable event log: partitioned by `occurred_at` (native Postgres range
partitioning), carrying `event_id` (unique, idempotency), `tenant_id`, `site_id`, `camera_id`,
`type`, `license_plate`, `track_id`, `slot_id`/`old_slot_id`/`new_slot_id`,
`person_present`, `confidence`, `snapshot_id`, `occurred_at`, `payload jsonb`. Full DDL and
partitioning strategy live in `15_Database_Design` (see ADR-1503 there); this document only
covers how events get produced onto the bus, not the storage engineering.

## 10. Diagrams

- `diagrams/event-bus-topology.mmd` — exchange, routing keys, per-consumer queues, and DLQ
  wiring.
- `diagrams/outbox-relay-sequence.mmd` — the ingest transaction, outbox relay polling loop,
  and publisher-confirm handshake.
- `diagrams/event-flow-edge-to-consumers.mmd` — end-to-end flow from the edge device through
  ingest, outbox, RabbitMQ, to each of the five consumers.
- `diagrams/event-lifecycle.mmd` — state diagram of a single event from detection through
  consumption, retry, and dead-lettering.

## 11. Decisions / ADRs

- `adr/ADR-1301-rabbitmq-vs-kafka-vs-redis-streams.md` — why RabbitMQ over Kafka/Redis
  Streams for the event bus.
- `adr/ADR-1302-transactional-outbox-vs-dual-write.md` — why the transactional outbox over a
  naive dual write, and how it upgrades today's in-memory `GateEventDeduplicator`.
- `adr/ADR-1303-event-schema-versioning-registry.md` — envelope/payload versioning policy and
  the git-based schema registry.

## 12. Open questions / risks

- **Outbox table growth**: needs a retention/archival job (e.g. delete `DISPATCHED` rows
  older than N days) — not yet specced.
- **Multi-instance ingest API**: the relay must be safely runnable from multiple backend
  instances (`FOR UPDATE SKIP LOCKED` handles this, but needs a load test before prod with
  many concurrent tenants).
- **Consumer idempotency**: each of the five consumers must independently dedupe on
  `event_id`; this is a per-consumer implementation responsibility, not enforced by the bus.
- **RabbitMQ HA**: single-node RabbitMQ is fine for dev; production needs a clustered/quorum
  queue setup before it stops being a single point of failure (tracked as a deployment
  follow-up, not solved in this document).

## 13. Cross-references

- `14_Backend_API` — the ingest endpoint contract that originates events, and how it composes
  with the outbox write.
- `15_Database_Design` — full `ParkingEvent` schema, partitioning (ADR-1503), and the other
  target entities referenced in payloads (`ParkingSlot`, `Vehicle`, `Snapshot`, etc.).
- `03_SaaS_Architecture`, `04_Multi_Tenant_Design` — tenant/site scoping that shapes the
  `tenant_id.site_id.event_type` routing key.
