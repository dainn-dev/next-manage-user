# 02 — Business Flow

ParkVision's end-to-end business flows: how a tenant onboards, how cameras/gates get
registered, and how a vehicle's journey through a site (entry, relocation, exit) turns
into domain events that drive the database, notifications, dashboards, a security guard's
live view, and an AI chatbot. This document is the flow-level narrative that sits between
the vision (`00_Vision`) and the detailed subsystem designs (`03_SaaS_Architecture` and
beyond) — read it to understand *what happens, in what order, and who/what triggers it*.

Status: Draft · Owner: Principal Architect · Last updated: 2026-07-09

## 1. Current State vs Target

ParkVision evolves the existing single-tenant "Vision License Plate" gate-access system
(repo: `next-manage-user`) into a multi-tenant SaaS parking platform (decision #1, see
`03_SaaS_Architecture`). Every flow below is written as **today** (what the code in
`backend/`, `frontend/`, `edge/` actually does) followed by **target** (what the flow
becomes once the multi-tenant/event-driven capabilities land). Nothing below claims
RabbitMQ, Redis, ByteTrack, PaddleOCR, parking-slot polygons, or multi-tenancy exist
today — those are target-only additions (vision §2 / decisions §3 / domain model §4).

| Aspect | Today | Target |
|---|---|---|
| Tenancy | Single-tenant, no `tenant_id`/`site_id` anywhere | Multi-tenant, `tenant_id` + `site_id` on every owned table (RLS) |
| Vehicle detect + plate | Single YOLOv5 model (plate box) + a second YOLOv5 model (chars) | YOLOv11 (vehicle) + separate plate detection + PaddleOCR (primary OCR) |
| Tracking | Per-plate-string dict of first-seen/last-sent + cooldown | ByteTrack multi-object tracker, stable `track_id` |
| Slot/occupancy | None — no `ParkingSlot`, no polygon, no occupancy concept | PostGIS polygons, point-in-polygon vehicle-to-slot mapping |
| Ingest transport | `POST /api/vehicles/check-vehicle` writes `VehicleLog` directly | Ingest API → transactional outbox → RabbitMQ → consumers |
| Realtime | STOMP over SockJS, in-memory `SimpleBroker`, single instance | STOMP + Redis pub-sub relay for horizontal scale-out |
| Approval role | `APPROVER` role, single-tenant, sees all pending requests | Folded into `SITE_MANAGER`, scoped to sites they manage (decision #9) |
| Chatbot | Does not exist | LLM tool-calling (`getVehicleLocation`, `getHistory`, `getSnapshot`, `getParkingStatus`) |

## 2. End-to-End Business Flows

Each flow below is numbered step-by-step. "Today" steps cite real endpoints/entities from
the codebase; "Target flow adds" call out what is new. Diagrams referenced inline live in
`diagrams/` (see § Diagrams for the full list).

### 2.1 Tenant Onboarding & Site Setup

Entirely a **target** capability — there is no `Tenant`, `Site`, or `Zone` concept in the
codebase today (§1 of the brief: NO tenant_id/site_id anywhere, single-tenant only).

1. Prospect signs up; a `Tenant` row is created (`name`, `slug`, `status`, `plan_id`).
2. Prospect selects a **Plan** (Free / Starter / Pro / Enterprise) — see `05_Subscription_Billing`.
3. Stripe checkout runs; a `Subscription` row is created (`stripe_customer_id`,
   `stripe_subscription_id`, `current_period_end`); `Tenant.status` moves to `active`.
4. Tenant creates its first `Site` (`name`, `address`, `geo`, `timezone`, `status`).
5. Tenant optionally creates `Zone`s under the site (e.g. Floor A / Floor B) for grouping
   `ParkingSlot`s.
6. Tenant registers `Camera`/`Gate` entities for the site (flow 2.2).
7. Tenant draws `ParkingSlot` polygons over a camera still using the Parking-Map Designer
   (see `08_Parking_Map_Designer`); slots get `code` (e.g. "A01") and `polygon GEOMETRY`.
8. Initial `TENANT_ADMIN` / `SITE_MANAGER` users are invited (`User.tenant_id` set,
   role assigned per `06_User_RBAC`).
9. The edge agent is deployed on-site, starts heartbeating, and the camera's `status`
   flips to `online`.
10. Site `status` becomes `ready` — onboarding is complete and the site can start
    accepting `VehicleEntered` events.

Diagram: `diagrams/tenant-onboarding-flow.mmd`.

### 2.2 Camera / Gate Registration

**Today:** a single-tenant flow already exists and is kept as the functional core.

1. Edge process calls `POST /api/gates/register` carrying header `X-Gate-Key`.
2. `GateApiKeyAuthFilter` validates the key against `GATE_API_KEY`; if the key is unset,
   the filter runs **open** (documented dev fallback — a real risk in prod, see § Open
   Questions).
3. Backend upserts a `Gate` row (`name` unique, `location`, `cameraRtspUrl`,
   `status=online`).
4. Edge periodically calls `POST /api/gates/{id}/heartbeat` (also `X-Gate-Key`-guarded)
   to refresh `lastHeartbeatAt`.
5. `GateService` sweeps every 30 seconds and flips gates with a stale heartbeat to
   `status=offline`.
6. The frontend surfaces this at routes `/gate` (registry list) and `/gate/health`.

**Target flow adds:**

7. Registration becomes **site-scoped**: a `Camera(id, site_id, name, rtsp_url,
   role{ANPR_GATE,OVERVIEW}, panel_type{entry,exit}, status, last_heartbeat_at,
   calibration_json)` row is created first (see `07_Camera_Management`).
8. `Gate(id, site_id, name, camera_id, direction)` becomes a thin logical entry/exit
   pointer to a `Camera`, rather than owning the RTSP URL itself — this is the
   supersedes/extends relationship called out in the domain model (§4 of the brief).
9. `calibration_json` stores the homography/parking-map calibration produced by the
   AI-calibration workflow (`09_AI_Calibration`).
10. Camera presence is mirrored into Redis (decision #6) so heartbeat/online state is
    visible to all backend instances behind the STOMP relay, not just the one that
    received the heartbeat.

Diagram: `diagrams/camera-gate-registration-sequence.mmd`.

### 2.3 Vehicle Entry

**Target flow** (the full pipeline described in the vision, §2):

1. Camera streams RTSP frames to the edge pipeline.
2. OpenCV **motion detection (MOG2)** gates further processing to save GPU cycles →
   emits `MotionDetected`.
3. **YOLOv11** vehicle detection runs on frames that passed the motion gate →
   `VehicleDetected`.
4. Plate bounding-box detection runs on the vehicle crop.
5. OCR runs — **PaddleOCR primary**, with EasyOCR/VietOCR as comparators (decision #8) →
   `PlateRecognized`.
6. **ByteTrack** assigns/updates a stable `track_id` for the vehicle across frames,
   recorded as a `VehicleTrack` row.
7. The vehicle's center point is mapped to a `ParkingSlot` polygon via **point-in-polygon**
   (PostGIS) — decision #4.
8. Edge posts to the backend **ingest API** (`POST /api/v1/sites/{siteId}/ingest/events`)
   with `eventId` (idempotency) + `occurredAt`, `type=VehicleEntered`, plate, `track_id`,
   `slot_id`, and the evidence snapshot.
9. The backend validates tenant/site scope from the device credential, then writes a
   `ParkingEvent(type=VehicleEntered)` row **and** an outbox row in a single transaction
   (transactional outbox pattern, decision #5).
10. An outbox relay publishes `VehicleEntered` to **RabbitMQ**.
11. Consumers: update `Vehicle.current_slot_id` and `ParkingSlot.status=occupied`, emit
    `SnapshotSaved` for the evidence image (object storage — decision #7), emit
    `NotificationSent`, and push a live update to the dashboard over the STOMP/Redis
    relay.

**Today's simpler flow (§1), for contrast:**

- A single YOLOv5 model detects the plate box; a **second YOLOv5 model detects
  characters** (OCR-by-detection), sorted into VN 1-line/2-line plate strings in
  `function/helper.py`, with deskew retry across 4 orientations. Optional fallback OCR
  (EasyOCR/Tesseract/Google Vision) is guarded-import only.
- "Tracking" today is a per-plate-string dict of first-seen/last-sent timestamps plus a
  cooldown / min-detection-duration confirmation window — **not** a real multi-object
  tracker.
- Edge posts directly to `POST /api/vehicles/check-vehicle` (JSON or multipart with
  snapshot); idempotency via `eventId` UUID + `occurredAt` already exists today and is
  the convention the target ingest API keeps.
- The backend writes a `VehicleLog` row (`licensePlateNumber`, `vehicle`, `employee`,
  `entryExitTime`, `type=entry`, `gate` FK nullable, `securityGuard`, `imagePath`) — no
  slot concept, no `ParkingEvent`, no RabbitMQ, no outbox.
- The result broadcasts directly over STOMP topics `/topic/vehicle-check` and
  `/topic/gate/{gateId}/check` via the in-memory `SimpleBroker` — there is no persistent
  event bus today.
- The snapshot is written to local disk `uploads/snapshots`, served at `/uploads/**`.
- **No parking-slot or occupancy logic exists today.**

Diagram: `diagrams/vehicle-entry-sequence.mmd`.

### 2.4 Vehicle Relocation

**Target-only flow** — there is no relocation concept today (§1: `VehicleLog` only has
`type{entry,exit}`, no `slot_id`, no history table).

1. A vehicle is already parked; its `VehicleTrack(track_id)` is continuously tracked by
   ByteTrack across frames from an overview camera.
2. On a later frame, the same `track_id` resolves via point-in-polygon to a *different*
   `ParkingSlot` than its last known slot.
3. Edge debounces the change over N consecutive frames to filter out occlusion/jitter
   false positives.
4. Edge posts `type=VehicleRelocated` to the ingest API with `track_id`, `old_slot_id`,
   `new_slot_id`, and plate.
5. In one transaction, the backend: writes `ParkingEvent(VehicleRelocated)` + outbox row,
   inserts a `ParkingHistory(tenant_id, plate, old_slot, new_slot, occurred_at)` row,
   flips the old `ParkingSlot.status` to `free` and the new one to `occupied`, and
   updates `Vehicle.current_slot_id`.
6. The outbox relays `VehicleRelocated` to RabbitMQ; consumers push a live slot-map
   update and a `NotificationSent` (e.g. "your car moved to A02").

Diagram: `diagrams/vehicle-relocation-sequence.mmd`.

### 2.5 Vehicle Exit

**Today:**

1. Edge posts to the *same* endpoint used for entry, `POST /api/vehicles/check-vehicle`,
   with `type=exit` (multipart, includes evidence snapshot).
2. Backend inserts a `VehicleLog` row (`type=exit`, `entryExitTime`, `gate` FK,
   `securityGuard`, `imagePath`) and updates `Vehicle.status=exited`.
3. Result broadcasts over STOMP `/topic/vehicle-check` and `/topic/gate/{gateId}/check`.
4. Operational safety net: `VehicleSchedulerService` runs daily at 1AM and resets any
   vehicle stuck in `entered` status (covers missed/failed exit events) — this job has no
   defined target-flow analog yet (see § Open Questions).

**Target flow adds:**

5. Camera at the exit gate streams frames; pipeline runs `VehicleDetected` →
   `PlateRecognized` (PaddleOCR) → ByteTrack matches the plate's `track_id` against the
   known `VehicleTrack`.
6. Edge posts `type=VehicleExited` to the ingest API with `track_id`, `slot_id`, plate,
   snapshot.
7. Backend writes `ParkingEvent(VehicleExited)` + outbox row in one transaction; releases
   the `ParkingSlot` (`status=free`, `current_vehicle_id=null`); clears
   `Vehicle.current_slot_id`, updates `last_seen_at`.
8. Outbox relays to RabbitMQ; consumers free the slot on the live dashboard and may emit
   `NotificationSent` (e.g. duration/billing hooks — see `05_Subscription_Billing`).

Diagram: `diagrams/vehicle-exit-sequence.mmd`.

### 2.6 Security Guard: Live Gate Review

**Today:**

1. Guard opens the `/gate/[gateId]` full-screen kiosk view (Web Speech TTS, vi-VN).
2. The frontend's `hooks/use-websocket.ts` opens a SockJS/STOMP connection to `/ws` and
   subscribes to `/topic/gate/{gateId}/check` (and `/topic/vehicle-check` for the
   aggregate feed).
3. On load, the frontend calls `GET /api/gates/{id}/recent-checks` to replay events
   missed while the guard's browser was disconnected — the in-memory `SimpleBroker` has
   no built-in replay, so this REST endpoint is the recovery path.
4. Each vehicle check streams live: plate, `type` (entry/exit), evidence snapshot path.
5. Guard can also check `/gate/health` for aggregate gate online/offline/disabled state.

**Target flow adds:**

6. A **Live Camera** view is embedded in the kiosk/dashboard via a media gateway
   (HLS/WebRTC, MJPEG fallback) — there is no video/camera component in the frontend
   today; camera is data-only via `Gate.cameraRtspUrl` (§1).
7. A **Redis pub-sub STOMP relay** (decision #6) keeps the live feed consistent across
   horizontally-scaled backend instances instead of one process's in-memory broker.

Diagram: `diagrams/guard-live-gate-review-sequence.mmd`.

### 2.7 Vehicle Owner: "Where is my car?" (Chatbot)

**Target-only capability** — no chatbot, no owner-facing self-service API exists today;
today's `Vehicle` links to `Employee`, not an `owner_user_id` (§1/§4 gap).

1. A vehicle owner (`MEMBER/USER`) asks "where is my car?" in the web or mobile app.
2. The request hits the Chatbot API carrying the caller's tenant-scoped JWT.
3. The chatbot forwards the prompt plus tool definitions to the LLM (default local
   **Ollama**, Qwen2.5/Llama 3.1; optional hosted Claude/OpenAI — decision #11).
4. The LLM responds with a tool call, e.g. `getVehicleLocation(licensePlate?)`.
5. The tool executor calls the internal, **tenant-scoped** read API, which re-validates
   `tenant_id` + `owner_user_id` on every call (strict isolation, decision #11).
6. Backend resolves `Vehicle.current_slot_id` → `ParkingSlot.code` + `Site.name`.
7. The tool result is appended to the LLM's context; the LLM produces the final
   natural-language answer.
8. The app displays the answer, e.g. "Your car is at slot A02, Downtown Lot, updated 2
   minutes ago."

The same tool-calling pattern extends to `getHistory()` (reads `ParkingHistory`),
`getSnapshot()` (reads `Snapshot` from object storage), and `getParkingStatus()`
(aggregate site/zone occupancy) for related questions.

Diagram: `diagrams/chatbot-where-is-my-car-sequence.mmd`.

### 2.8 Access-Request Approval (APPROVER → SITE_MANAGER)

**Today:**

1. A `VehicleAccessRequest` is created with `source{USER,GATE}` (explicitly by a user, or
   auto-raised at a gate) and starts `status=PENDING`.
2. Any user holding role `APPROVER` opens `/vehicles/requests` and sees **all** pending
   requests — there is no site scoping today (single-tenant).
3. The `APPROVER` approves or rejects; `status` moves to `APPROVED`/`REJECTED` (a
   requester can also move it to `CANCELLED`).
4. The decision cascades to `Vehicle.status` (`approved`/`rejected`).
5. The decision is broadcast/notified to the requester.

**Target flow** (evolution, not a new decision — see § Decisions / ADRs):

6. Per canonical decision #9, the standalone `APPROVER` role **folds into
   `SITE_MANAGER`'s approval rights**; the target RBAC set is `PLATFORM_ADMIN`,
   `TENANT_ADMIN`, `SITE_MANAGER`, `SECURITY_GUARD` (maps from `SECURITY_OFFICER`),
   `MEMBER/USER`.
7. `VehicleAccessRequest` gains `tenant_id` + `site_id` scope; a `SITE_MANAGER` only sees
   requests for sites they manage, e.g.
   `GET /api/v1/sites/{siteId}/access-requests?status=PENDING`.
8. The approve/reject `PATCH` re-validates that the acting `SITE_MANAGER` actually owns
   `site_id` before allowing the transition — defends against cross-site/cross-tenant
   approval.
9. Approval publishes via the transactional outbox (a `ParkingEvent` and/or
   `NotificationSent`) instead of an ad hoc broadcast.

Diagram: `diagrams/access-request-approval-sequence.mmd`.

## 3. Domain Events Reference

The 9 standardized domain events (vision §2) and where each fits in the flows above:

| Event | Emitted by | Consumed by | Used in flow(s) | Today's equivalent |
|---|---|---|---|---|
| `MotionDetected` | Edge (OpenCV MOG2) | Edge pipeline (gates the YOLOv11 stage) | 2.3 Vehicle Entry | None — no motion pre-filter exists |
| `VehicleDetected` | Edge (YOLOv11) | Edge pipeline | 2.3, 2.5 | None as a discrete event (YOLOv5 detection is inline, not eventized) |
| `PlateRecognized` | Edge (PaddleOCR) | Edge pipeline, ingest API | 2.3, 2.5 | Today's YOLOv5 char-detection OCR produces the plate string inline |
| `VehicleEntered` | Ingest API (outbox) | RabbitMQ → DB / Notification / Dashboard | 2.3 | `VehicleLog` row (`type=entry`) via `POST /api/vehicles/check-vehicle` |
| `VehicleRelocated` | Ingest API (outbox) | RabbitMQ consumers | 2.4 | No equivalent |
| `VehicleExited` | Ingest API (outbox) | RabbitMQ → DB / Notification / Dashboard | 2.5 | `VehicleLog` row (`type=exit`) |
| `PersonDetected` | Edge (person/pedestrian model) | Edge pipeline, security workflows | Future — see `24_Future_Features` | No equivalent |
| `SnapshotSaved` | Ingest API / object-storage writer | Notification, Dashboard | 2.3, 2.5 (evidence) | Image written synchronously to local disk `uploads/snapshots`, no discrete event |
| `NotificationSent` | Notification service | Dashboard, push/email/ws channels | 2.3, 2.4, 2.5, 2.8 | STOMP broadcast is the closest analog; not a persisted `Notification` record today |

## 4. Diagrams

- `diagrams/tenant-onboarding-flow.mmd` — flowchart of tenant signup through plan
  selection, site/zone/camera creation, and readiness (§2.1).
- `diagrams/camera-gate-registration-sequence.mmd` — sequence contrasting today's
  `POST /api/gates/register` + heartbeat flow with the target site-scoped Camera/Gate
  registration (§2.2).
- `diagrams/vehicle-entry-sequence.mmd` — sequence of the full target detection pipeline
  (motion → vehicle → plate → OCR → track → slot map → event bus) with a note contrasting
  today's simpler check-vehicle flow (§2.3).
- `diagrams/vehicle-relocation-sequence.mmd` — sequence for a tracked vehicle changing
  slots, producing `VehicleRelocated` and a `ParkingHistory` row (§2.4).
- `diagrams/vehicle-exit-sequence.mmd` — sequence for exit, today vs target (§2.5).
- `diagrams/guard-live-gate-review-sequence.mmd` — sequence for a security guard viewing
  a live gate/kiosk and recent checks, today vs target live-camera addition (§2.6).
- `diagrams/chatbot-where-is-my-car-sequence.mmd` — sequence for the tool-calling chatbot
  flow answering "where is my car?" (§2.7).
- `diagrams/access-request-approval-sequence.mmd` — sequence contrasting today's
  `APPROVER`-based approval with the target site-scoped `SITE_MANAGER` approval (§2.8).
- `diagrams/parking-session-lifecycle-state.mmd` — state diagram of a `ParkingSlot`
  across free/occupied/relocated/exited (plus reserved/disabled) transitions, annotated
  with the domain events that drive each transition.

## 5. Decisions / ADRs

This document is a pure flow/descriptive document — **0 ADRs** are recorded here, which
is expected per the output conventions for docs without a genuine new decision to make.

The one decision referenced repeatedly above — folding the `APPROVER` role into
`SITE_MANAGER`'s approval rights (§2.8) — is canonical decision #9 from the shared
architecture brief and is owned by `06_User_RBAC` (see that document's `adr/` folder for
the formal record). This document only describes the resulting flow change; it does not
re-decide it.

## 6. Open Questions / Risks

- **Dev fallback on gate auth.** `GateApiKeyAuthFilter` runs open when `GATE_API_KEY` is
  unset (today's behavior, §2.2 step 2). This must be closed off (fail-closed) before any
  multi-tenant ingest API goes live, or one tenant's edge device could write into another
  tenant's site.
- **Relocation debounce window.** The number of frames (N) used to confirm a
  `VehicleRelocated` transition (§2.4 step 3) is not yet tuned; too low risks false
  relocations from occlusion/jitter, too high delays a legitimate slot-map update.
- **Outbox relay latency.** Polling interval vs. CDC-based relay for the transactional
  outbox is not yet decided (affects how "real-time" the dashboard/notification flows in
  §2.3–2.5 actually feel) — to be resolved in `13_Event_Driven_Architecture`.
- **Calibration drift.** If a camera is bumped or repositioned, the `calibration_json`
  homography used for point-in-polygon slot mapping can silently go stale, corrupting
  entry/relocation/exit flows until recalibrated — needs a drift-detection process (see
  `09_AI_Calibration`).
- **Stuck-occupancy safety net.** Today's `VehicleSchedulerService` daily 1AM reset for
  stuck `entered` vehicles (§2.5 step 4) has no defined analog for slot-based occupancy —
  a dropped `VehicleExited` event could leave a `ParkingSlot` marked `occupied`
  indefinitely without an equivalent sweep job.
- **Chatbot tenant isolation.** Every chatbot tool call in §2.7 must re-validate
  `tenant_id`/`owner_user_id`; a prompt-injection or tool-call bug that skips this check
  would leak another tenant's vehicle location — flag for a dedicated security review
  before GA.
- **Idempotency under redelivery.** Today's `eventId` UUID + `occurredAt` convention
  (§2.3) needs an explicit exactly-once/at-least-once contract once RabbitMQ redelivery
  and outbox relay are introduced.

## 7. Cross-References

- `00_Vision` — product vision and target capabilities these flows implement.
- `01_Project_Overview` — repo/module map referenced throughout (`backend/`, `frontend/`,
  `edge/`).
- `03_SaaS_Architecture` — overall target architecture (event bus, outbox, module
  boundaries) that flows 2.3–2.5 and 2.8 depend on.
- `04_Multi_Tenant_Design` — `tenant_id`/`site_id` scoping model referenced in flow 2.1
  and throughout.
- `05_Subscription_Billing` — plan selection and metering referenced in flow 2.1.
- `06_User_RBAC` — full role model, including the `APPROVER` → `SITE_MANAGER` ADR
  referenced in flow 2.8.
- `07_Camera_Management` — `Camera`/`Gate` entity design referenced in flow 2.2.
- `08_Parking_Map_Designer` — polygon-drawing tool referenced in flow 2.1.
- `09_AI_Calibration` — homography/calibration workflow referenced in flow 2.2 and the
  calibration-drift risk above.
- `13_Event_Driven_Architecture` — RabbitMQ, outbox, and consumer design underlying flows
  2.3–2.5 and 2.8.
- `14_Backend_API` — ingest API and endpoint contracts referenced throughout.
- `15_Database_Design` — `ParkingEvent`, `ParkingHistory`, `VehicleTrack`, and related
  table definitions referenced throughout.
- `23_Roadmap` — phasing/sequencing of when each target flow addition ships.
- `24_Future_Features` — `PersonDetected` and other flows not yet in initial scope.
