# 19. Notification

Notifications & alerts for ParkVision: turning vision-derived domain events (a vehicle moved,
left the lot, a person is lingering, a camera dropped) into timely, addressed, de-duplicated
messages delivered to the right user over the right channel.

Status: Draft · Owner: Principal Architect · Last updated: 2026-07-09

## 1. Current state vs Target

**Current state (verified in code, brief §1).** The repo has exactly one realtime mechanism:
**STOMP over WebSocket** (SockJS), an in-memory Spring `SimpleBroker` on `/topic`, exposed at
endpoint `/ws`. Two topics exist: `/topic/vehicle-check` (global feed) and
`/topic/gate/{gateId}/check` (per-gate feed, added "Phase 3.2" per the frontend hook's comments).
A client that reconnects can catch up via `GET /api/gates/{id}/recent-checks`. This is a
**broadcast, unaddressed, ephemeral** mechanism — any client subscribed to a topic sees the
message; there is no concept of "notify this specific user," no persistence, no channel other
than WebSocket, no severity, no preferences, and **no `Notification` entity at all** in today's 8
entities (Employee, Vehicle, VehicleLog, User, VehicleAccessRequest, Gate, Department, Position).
There is **no RabbitMQ and no Redis today** — the frontend hook `hooks/use-websocket.ts` connects
directly via `@stomp/stompjs` + `sockjs-client` to the backend's single-broker `/ws` endpoint.

**Target.** A durable, addressed, multi-channel notification system driven by the domain event
bus (`13_Event_Driven_Architecture`): push (FCM/APNs, `18_Mobile_App`), email, and in-app/
WebSocket (the existing STOMP mechanism, extended with a Redis relay for horizontal fan-out per
brief §3.6). Notifications are persisted (`Notification` entity, brief §4), governed by
per-user/per-event-type preferences, deduplicated/throttled, and severity-tagged.

| Aspect | Current | Target |
|---|---|---|
| Delivery | STOMP broadcast to topic subscribers | Consumer off RabbitMQ, fanned to channel adapters |
| Addressing | None (topic-based) | Per-user (`user_id`) |
| Persistence | None (ephemeral) | `Notification` table, read/unread |
| Channels | WebSocket only | WebSocket, push (FCM/APNs), email |
| Preferences | None | Per user x event type x channel |
| Dedup/throttle | None | Redis-backed dedup key + TTL window |
| Trigger source | Direct service call in request path | Event-bus consumer (async, decoupled) |

## 2. Triggers (from the vision)

These map to the standardized domain events (brief §2):

| Trigger | Domain event | Default severity | Typical recipient |
|---|---|---|---|
| Vehicle moved to a different slot | `VehicleRelocated` | CRITICAL | Vehicle owner, SITE_MANAGER |
| Vehicle left the lot | `VehicleExited` | CRITICAL (if unexpected) / INFO (normal exit) | Vehicle owner |
| Person lingering near a vehicle too long | `PersonDetected` (duration threshold) | WARNING | SITE_MANAGER, SECURITY_GUARD |
| Camera offline | derived from `Camera.status`/heartbeat sweep (today's `GateService` 30s staleness sweep, extended) | WARNING → CRITICAL if sustained | SITE_MANAGER |

The "camera offline" trigger is not one of the 9 standardized domain events in brief §2; it is
derived from `Camera`/`Gate` heartbeat state, the same way today's `GateService` already computes
online/offline from `lastHeartbeatAt` (brief §1). It is included here because the vision
explicitly calls it out as a notification trigger; treat it as an internally-generated event
(`CameraOffline`) published by the heartbeat sweep, not by the edge.

## 3. Notification entity (brief §4)

```
Notification(
  id UUID PK,
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  channel  ENUM('push','email','ws'),
  type     VARCHAR,          -- e.g. 'VehicleRelocated', 'CameraOffline'
  payload  JSONB,            -- vehicle_id, plate, old_slot, new_slot, snapshot_url, ...
  severity ENUM('INFO','WARNING','CRITICAL'),
  read_at  TIMESTAMPTZ NULL,
  sent_at  TIMESTAMPTZ NOT NULL
)
```

One row per (user, channel) that passed preference/dedup evaluation — i.e. a single triggering
event can produce multiple `Notification` rows (one per enabled channel per interested user).
RLS applies via `tenant_id` (see `04_Multi_Tenant_Design`).

### NotificationPreference (supporting table, not yet in brief §4 — proposed here)

```
NotificationPreference(
  user_id UUID,
  event_type VARCHAR,
  channel ENUM('push','email','ws'),
  enabled BOOLEAN DEFAULT true,
  min_severity ENUM('INFO','WARNING','CRITICAL') DEFAULT 'INFO',
  PRIMARY KEY (user_id, event_type, channel)
)
```

Rows are created lazily with sane defaults on first login (see ADR-1902 severity-based defaults)
rather than requiring every user to configure a blank slate.

## 4. Delivery architecture

See ADR-1901 for the full rationale. Summary: `edge` or backend domain logic writes a
`ParkingEvent` row and an outbox row in one transaction (per `13_Event_Driven_Architecture`); the
outbox relay publishes to RabbitMQ; a **notification consumer** in the `notification` module
(brief §3.15 modular-monolith package list) subscribes, evaluates preferences/dedup/severity via
a rule engine, persists `Notification` rows, and dispatches to channel adapters:

- **In-app/WebSocket** — reuses the existing STOMP mechanism, but targets a per-user or
  per-vehicle destination (`/topic/vehicle/{vehicleId}` or a user queue) instead of the current
  global/per-gate topics, and adds a Redis pub-sub relay so it scales across multiple backend
  instances (today's in-memory `SimpleBroker` only fans out within one JVM).
- **Push** — FCM (bridging to APNs for iOS); see ADR-1902.
- **Email** — transactional provider, lowest priority, digest-friendly.

### Dedup & throttling

A Redis key `notif:dedup:{user_id}:{vehicle_id}:{event_type}` with a TTL (default 5 minutes)
suppresses re-alerting on rapid repeat events (e.g. a track jittering across a slot boundary
producing several `VehicleRelocated` events in quick succession). The **first** event in a window
notifies; subsequent ones in-window are recorded (for audit) but not re-delivered.

## 5. Diagrams

- [`diagrams/notification-pipeline.mmd`](diagrams/notification-pipeline.mmd) — end-to-end
  flowchart from event sources (edge, backend) through the outbox/RabbitMQ bus into the
  notification consumer, rule engine, and the three channel adapters.
- [`diagrams/relocation-alert-sequence.mmd`](diagrams/relocation-alert-sequence.mmd) — sequence
  diagram for the canonical case: a `VehicleRelocated` event traveling from the edge through
  ingest, the bus, the consumer/rule engine, and out to the owner via WebSocket and push.
- [`diagrams/preferences-routing.mmd`](diagrams/preferences-routing.mmd) — flowchart of the
  preference/severity/dedup decision tree that determines which channels actually fire for a
  given event and user.

## 6. Decisions / ADRs

- [`adr/ADR-1901-notification-delivery-architecture.md`](adr/ADR-1901-notification-delivery-architecture.md) —
  event-bus consumer + channel-adapter architecture, and why it does not replace the existing
  STOMP gate-facing topics.
- [`adr/ADR-1902-push-provider-multichannel-fanout.md`](adr/ADR-1902-push-provider-multichannel-fanout.md) —
  FCM (bridging APNs) as the push provider, per-user preference model, severity-based channel
  defaults, dedup/throttle design.

## 7. Open questions / risks

- **Notification volume at scale.** A large site with many parked vehicles and a flapping camera
  could generate a high event rate; the dedup TTL needs real-world tuning, and the notification
  consumer needs its own horizontal scale-out story (multiple consumer instances on the same
  queue) once traffic exceeds a single instance.
- **Email deliverability** is out of scope for this ADR set (provider choice, SPF/DKIM, bounce
  handling) — flagged as a follow-up implementation concern, not a doc-level architecture
  decision, since it is low-risk and easily reversible.
- **Cross-device push** — a user with multiple devices (phone + tablet) needs multi-token
  fan-out per user; the `NotificationPreference` model above is per-user, device-token fan-out is
  a mobile-app concern (`18_Mobile_App`).
- **Notification center UI/UX** (mark-as-read, grouping, pagination) is a frontend concern not
  detailed here; only the backing data model and delivery path are specified.

## 8. Cross-references

- `13_Event_Driven_Architecture` — the RabbitMQ bus and transactional outbox pattern this doc's
  consumer subscribes to.
- `18_Mobile_App` — push/device-token registration on the React Native client.
- `17_Dashboard` — the frontend notification center consuming `GET /api/v1/notifications`.
- `04_Multi_Tenant_Design` — RLS/`tenant_id` scoping applied to the `Notification` table.
- `20_Analytics` — `NotificationSent` as one of the 9 standardized domain events, also consumed
  for analytics projections.
- `22_Testing` — dedup/idempotency testing approach shared with the edge's existing
  `event_id`-based store-and-forward dedup.
