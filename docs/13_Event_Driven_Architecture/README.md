# 13. Event-Driven Architecture

ParkVision's event backbone: the nine domain events emitted by the AI/edge pipeline and
backend, the RabbitMQ topology that fans them out to independent consumers, the
transactional outbox pattern that makes publishing atomic with persistence, and the
idempotency/ordering/retry contract that ties it all together. This document is the
reference for anyone producing or consuming a ParkVision domain event.

Status: Draft; slot-transition contract signed off by DAI-297 · Owner: Principal Architect · Last updated: 2026-07-14

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
`tenant_id`, `site_id`, `occurred_at`, `correlation_id`, `causation_id`, `payload`); the table below lists the
event-specific fields carried in `payload` and where they originate.

| Event | Emitted by | Key payload fields | Typical consumers |
|---|---|---|---|
| `MotionDetected` | Edge (OpenCV MOG2 gate) | camera_id, person_present, roi | analytics, db-projector (`MotionEvent`) |
| `VehicleDetected` | Edge (YOLOv11) | camera_id, track_id, bbox, confidence | analytics |
| `PlateRecognized` | Edge (YOLOv5 plate/char + PaddleOCR) | camera_id, track_id, license_plate, confidence | db-projector, notification |
| `VehicleEntered` | Backend occupancy projector | vehicle identity, tracker, slot/map/geometry IDs, transition sequence, assignment, evidence | notification, analytics, chatbot-index |
| `VehicleRelocated` | Backend occupancy projector | vehicle identity, tracker, old/new slot/map/geometry IDs, transition sequence, assignment, evidence | notification, analytics, chatbot-index |
| `VehicleExited` | Backend occupancy projector | vehicle identity, tracker, slot/map/geometry IDs, exit reason, last seen, transition sequence, evidence | notification, analytics, chatbot-index |
| `PersonDetected` | Edge (YOLOv11 person class) | camera_id, bbox, confidence | analytics |
| `SnapshotSaved` | Ingest API (on multipart upload) | snapshot_id, kind, object_url, related event_id | snapshot, chatbot-index |
| `NotificationSent` | Notification service | user_id, channel, notification_id, related event_id | analytics (delivery metrics) |

`VehicleEntered` / `VehicleExited` / `VehicleRelocated` in this contract describe authoritative
**parking-slot occupancy transitions**, not gate authorization. The backend is their only domain
event producer: edge `VehicleDetected` observations are provisional inputs. Gate access may be a
cause or consumer, but remains a separate state machine.

### DAI-297 normative slot-transition events

The accepted boundary and failure semantics are in
`../11_Parking_Slot_Detection/adr/ADR-1102-slot-runtime-and-event-contract.md`. The executable
JSON Schemas are stored under `backend/src/main/resources/events/schemas/`:

- `common/domain-event-envelope-v1.json`
- `vehicle-entered/v1.json`
- `vehicle-exited/v1.json`
- `vehicle-relocated/v1.json`

The event is written with the occupancy/history changes and transactional outbox in one database
transaction. `event_id` provides delivery idempotency; monotonic `transition_sequence` provides
per-identity stale/out-of-order detection. `correlation_id` links a parking lifecycle and
`causation_id` points to the observation or prior event that caused the transition. Snapshot
evidence is best-effort: an event remains valid with `partial` or `unavailable`
evidence status and must not be rolled back because object storage is unavailable.

The HTTP edge-ingress profiles below use camelCase transport fields. Projection to the domain
bus is an explicit trust boundary: the backend derives tenant/site scope and emits the snake_case
envelope validated by the registry schemas.

### DAI-288 typed LPR ingress profiles (`lpr-mvp-v1`)

The HTTP camera-ingest ledger and the future event-store/outbox/bus are deliberately separate
layers. Today, `POST /api/v1/parking-events` durably accepts a generic envelope containing
`eventId`, `eventType` (or the legacy `type` alias), `occurredAt`, optional echoed `cameraId`,
and a JSON `payload`. It is idempotent by `(authenticatedCameraId, eventId)`. It does **not** yet
validate, project, or publish the typed profiles below. A later event-store/outbox implementation
may project them into the target envelope in §2; this contract must not be interpreted as proof
that RabbitMQ or `ParkingEvent` exists today.

#### Trust, versioning, and coordinate invariants

- The device authenticates with `X-Camera-Id` and `X-Camera-Key`. The backend derives the tenant
  and site from that credential before ingest; neither `tenantId` nor `siteId` is accepted as
  edge authority. `cameraId`, when echoed in the body, must equal the authenticated header ID.
- `eventType` is the canonical transport name. Typed LPR payloads require
  `payload.eventVersion: 1`; `type` remains only a compatibility alias for existing generic
  producers. Additive fields within a version are compatible; a semantic break requires a new
  `eventVersion`.
- Timestamps are RFC 3339 offset date-times. Detection/OCR confidences use `[0,1]`. Bounding
  boxes are `{x, y, width, height}` in original-frame pixels with a top-left origin and must fit
  within the accompanying frame dimensions.
- A tracker identity is the pair `(sessionId, trackId)`, scoped to one camera stream session. It
  is not a global vehicle identifier and must never be used as cross-camera authorization.
- Edge JSON may describe evidence but cannot submit an object key, signed URL, storage status, or
  retention decision. The backend generates its opaque storage key from trusted tenant/camera/
  event scope after receiving the optional multipart binary.

#### `VehicleDetected` profile

```json
{
  "eventId": "afc28cc1-7d60-4edb-a1d8-92881e00d8e4",
  "eventType": "VehicleDetected",
  "cameraId": "6f5e50b3-b5a7-49b6-b341-bb16f1429100",
  "occurredAt": "2026-07-13T09:18:42.381+07:00",
  "payload": {
    "eventVersion": 1,
    "pipeline": { "id": "lpr-mvp-v1", "configurationHash": "sha256:6e4b1d..." },
    "frame": {
      "capturedAt": "2026-07-13T09:18:42.381+07:00",
      "width": 1920,
      "height": 1080,
      "coordinateSpace": "original-frame-pixels"
    },
    "tracker": { "sessionId": "8dc0d470-f897-4c15-abf9-03c7a8f0ac7f", "trackId": "42" },
    "vehicle": {
      "class": "car",
      "confidence": 0.93,
      "boundingBox": { "x": 492, "y": 243, "width": 916, "height": 540 }
    },
    "models": {
      "vehicleDetector": {
        "name": "yolo11n",
        "artifactVersion": "2026.07.0",
        "confidenceThreshold": 0.4
      }
    }
  }
}
```

#### `PlateRecognized` profile

```json
{
  "eventId": "28e2e297-3285-45a3-89e5-94cc2e1fbbd3",
  "eventType": "PlateRecognized",
  "cameraId": "6f5e50b3-b5a7-49b6-b341-bb16f1429100",
  "occurredAt": "2026-07-13T09:18:42.581+07:00",
  "payload": {
    "eventVersion": 1,
    "causationEventId": "afc28cc1-7d60-4edb-a1d8-92881e00d8e4",
    "pipeline": { "id": "lpr-mvp-v1", "configurationHash": "sha256:6e4b1d..." },
    "frame": {
      "capturedAt": "2026-07-13T09:18:42.581+07:00",
      "width": 1920,
      "height": 1080,
      "coordinateSpace": "original-frame-pixels"
    },
    "tracker": { "sessionId": "8dc0d470-f897-4c15-abf9-03c7a8f0ac7f", "trackId": "42" },
    "vehicle": {
      "class": "car",
      "confidence": 0.94,
      "boundingBox": { "x": 492, "y": 243, "width": 916, "height": 540 }
    },
    "plate": {
      "text": "51A-123.45",
      "normalizedText": "51A12345",
      "detectionConfidence": 0.94,
      "recognitionConfidence": 0.96,
      "boundingBox": { "x": 780, "y": 554, "width": 242, "height": 78 }
    },
    "models": {
      "vehicleDetector": {
        "name": "yolo11n",
        "artifactVersion": "2026.07.0",
        "confidenceThreshold": 0.4
      },
      "plateDetector": {
        "name": "lp-detector-nano",
        "artifactVersion": "61",
        "confidenceThreshold": 0.6
      },
      "ocr": {
        "name": "PaddleOCR",
        "artifactVersion": "pp-ocr-mobile",
        "recognitionConfidenceThreshold": 0.8
      }
    },
    "snapshots": [
      {
        "kind": "original_frame",
        "capturedAt": "2026-07-13T09:18:42.581+07:00",
        "contentType": "image/jpeg",
        "width": 1920,
        "height": 1080,
        "sha256": "sha256:0ad1..."
      },
      {
        "kind": "plate_crop",
        "contentType": "image/jpeg",
        "width": 242,
        "height": 78,
        "sha256": "sha256:c62e...",
        "sourceBoundingBox": { "x": 780, "y": 554, "width": 242, "height": 78 }
      }
    ],
    "snapshotUpload": { "part": "snapshot", "kind": "plate_crop" }
  }
}
```

`original_frame` and `plate_crop` metadata are descriptive, edge-supplied evidence attributes.
The current API accepts one optional binary part named `snapshot`; for this profile it is the
`plate_crop`. The server stores that object under its trusted tenant/camera/event prefix and
persists the resulting opaque key. Uploading an original-frame binary or retaining multiple object
references requires a later additive multipart/storage design.

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
or across sites. Consumers that need strict per-vehicle ordering should compare the monotonic
`transition_sequence` for the reconciled vehicle identity and treat queue order as a hint, not a
guarantee. `occurred_at` remains useful for history display but is not a safe concurrency token:
a redelivered/retried message can arrive out of original order. The event store and occupancy
projector state are the source of truth.

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

DAI-297 adds the first concrete domain-bus artifacts to that registry: the common v1 envelope
and v1 schemas for `VehicleEntered`, `VehicleExited`, and `VehicleRelocated`. Producers must
validate before inserting the outbox row; consumer contract tests must validate representative
messages against the same schema version.

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
