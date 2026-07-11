# ADR-1901: Notification delivery architecture (event-bus consumer + channel adapters)

- Status: Proposed
- Date: 2026-07-09
- Deciders: Principal Architect
- Context doc: 19_Notification

## Context

Today the backend has exactly one realtime delivery mechanism: STOMP over WebSocket (SockJS),
an in-memory `SimpleBroker` on `/topic`, topics `/topic/vehicle-check` and
`/topic/gate/{gateId}/check`, with missed events replayable via
`GET /api/gates/{id}/recent-checks`. There is no RabbitMQ, no Redis, and no `Notification`
entity or notion of "channel" or "user preference" in the code today — WebSocket pushes are
fire-and-forget UI updates for whoever happens to have the kiosk/dashboard open, not addressed,
persisted notifications to a specific user.

The target vision needs notifications that are: (a) triggered by domain events already
standardized in `13_Event_Driven_Architecture` (VehicleRelocated, VehicleExited, PersonDetected,
CameraOffline-equivalent, etc.), (b) delivered over multiple channels (push, email, in-app), (c)
addressed to specific users (a vehicle owner, a site manager) rather than "everyone connected to
this topic", (d) durable — a user who was offline should see it later in a notification center,
and (e) governed by per-user preferences and dedup/throttling so a flapping camera does not spam
a site manager every 200ms.

The architecture decision is where notification fan-out logic lives relative to the event bus,
and how the existing STOMP mechanism is preserved rather than replaced outright.

## Decision

Notifications are delivered by a dedicated **notification consumer inside the modular monolith**
(module `notification`, per brief §3.15) that subscribes to the RabbitMQ domain-event exchange
(via the transactional-outbox relay described in `13_Event_Driven_Architecture`) and fans each
qualifying event out through **channel adapters**:

1. **Event bus consumer.** The notification module owns a durable queue
   (`events.notification`) bound to the domain-event exchange with a routing pattern covering
   the relevant event types (`VehicleRelocated`, `VehicleExited`, `PersonDetected`,
   `CameraOffline`, plus future types). It does not query the OLTP tables directly to decide
   whether to notify — it reacts to events only, keeping it decoupled from the ingest path's
   write latency.
2. **Rule evaluation.** For each event, resolve interested users (vehicle owner, on-duty
   TENANT_ADMIN for the site), load `NotificationPreference` per user/event-type,
   apply severity threshold and dedup/throttle (Redis-backed dedup key
   `user_id:vehicle_id:type` with a TTL window), then persist a `Notification` row per
   (user, channel) pair that survives the check (brief §4 `Notification` entity: id, tenant_id,
   user_id, channel, type, payload, read_at, sent_at).
3. **Channel adapters.** A small adapter interface (`NotificationChannel.send(Notification)`)
   with three initial implementations:
   - **WebSocket/in-app**: publish to a per-user or per-vehicle STOMP destination
     (`/topic/vehicle/{vehicleId}` or `/user/{userId}/queue/notifications`), reusing the existing
     STOMP infrastructure but adding a Redis-backed relay (ADR in `04_Multi_Tenant_Design` /
     platform-scale doc) so it fans out across multiple backend instances, not just the
     single-broker-per-instance behavior of today.
   - **Push**: FCM/APNs, detailed in ADR-1902.
   - **Email**: transactional email provider (SMTP relay or a provider API), lowest priority
     initially.
4. **Idempotency & ordering.** Each `Notification` write is keyed by `(event_id, user_id,
   channel)` so a redelivered RabbitMQ message (at-least-once) cannot create a duplicate row;
   this mirrors the edge's existing `event_id`-based dedup pattern already proven in
   `GateEventDeduplicator` / the SQLite store-and-forward queue (see `22_Testing`).
5. The existing gate-facing STOMP topics (`/topic/vehicle-check`,
   `/topic/gate/{gateId}/check`) are **not replaced** — they remain the low-latency kiosk/live-
   monitoring feed. The new per-user notification channel is additive, addressed differently
   (per-user, not per-topic-subscriber), and persisted.

## Alternatives considered

- **Notification consumer + channel adapters off the event bus** (chosen) — a dedicated consumer
  reacts to domain events published via the outbox relay.
  - Pros: fully decoupled from request/response latency of ingest; natural place for
    dedup/throttle/preferences; every future event type gets notification support by adding a
    routing key, not new code paths; consistent with the platform's overall event-driven
    direction (brief §3.5, §3.15); durable by construction (queue + persisted `Notification` row
    survive consumer restarts).
  - Cons: introduces an ordering/at-least-once delivery concern (mitigated by idempotency keys);
    depends on RabbitMQ being introduced first (sequenced after `13_Event_Driven_Architecture`).

- **Synchronous notification call from the domain service** (e.g. `VehicleService` calls
  `NotificationService.notify()` directly inside the same request that detects a relocation).
  - Pros: simplest to implement, no new infrastructure, immediate feedback.
  - Cons: couples ingest-path latency to notification fan-out (email/push calls can be slow or
    fail); no natural retry/backpressure; violates the outbox/event-bus pattern already chosen
    for the rest of the platform; every new notification trigger requires touching domain service
    code instead of just subscribing to an event.

- **Third-party notification-as-a-service (e.g. Courier, Novu, OneSignal for everything)**
  handling routing/preferences/channels end-to-end.
  - Pros: fastest to ship a polished preference center; less code to maintain.
  - Cons: another vendor dependency and per-notification cost at scale; harder to guarantee
    strict per-tenant data isolation (brief §3.2) since notification payloads may contain
    plate/location data; less control over dedup semantics tailored to vision events; still needs
    an internal consumer to bridge RabbitMQ to the vendor, so it does not remove the core
    architecture question, only the channel-adapter implementation.

## Consequences

- Positive: notification logic is centralized in one module, testable in isolation from ingest;
  new event types (future `SnapshotSaved`-triggered notices, billing alerts) opt in by routing
  key; the durable `Notification` row gives the frontend a real notification center (read/unread)
  instead of ephemeral toasts only.
- Negative / trade-offs: adds a dependency on RabbitMQ + the outbox relay existing first (this
  doc cannot ship before `13_Event_Driven_Architecture` is implemented); at-least-once delivery
  requires careful idempotency keys everywhere; Redis-backed dedup adds an operational dependency
  (mitigated — Redis is already planned platform-wide per brief §3.6).
- Follow-ups: define the exact RabbitMQ routing-key taxonomy in `13_Event_Driven_Architecture`;
  define the Redis STOMP relay in the realtime-scale-out doc; ADR-1902 covers channel/provider
  choice and fan-out details.
