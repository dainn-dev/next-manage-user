# 01. Project Overview — ParkVision

ParkVision is the target multi-tenant SaaS Smart Parking Platform being built by evolving
`next-manage-user`, a single-tenant license-plate gate-access system that already runs in
production. This document is the entry point for the whole doc set: it explains what exists
in the repo today, what the platform is being evolved into, the concrete gap between the
two, the monorepo layout, and the shared vocabulary every other document assumes.

Status: Draft · Owner: Principal Architect · Last updated: 2026-07-09

## 1. Current State vs Target

### 1.1 Current state — what the code does today

The repo (`C:\Users\hoang\Projects\next-manage-user`) is a **single-tenant** monorepo:
`frontend/` (Next.js 14), `backend/` (Spring Boot 3.2 / Java 17), `edge/` (Python), `deploy/`,
`docs/`, `docker-compose.yml`.

**Backend** (`backend/`, package `com.vehiclemanagement`) — Spring Boot **3.2.0**, Java **17**,
runs on **Jetty** at `:8080`, REST base `/api` (unversioned). Persistence is **PostgreSQL**
(`vehicle_management` db) via Spring Data JPA with **Flyway** migrations V1-V35
(`ddl-auto: update`, `open-in-view: false`). Security is **Spring Security stateless + JWT**
(jjwt 0.11.5, HS256, claims `role`/`email`/`userId`, 86400s expiry) with BCrypt(strength 12)
password hashing; a second filter, `GateApiKeyAuthFilter`, guards gate endpoints via the
`X-Gate-Key` header (`GATE_API_KEY` env var) and runs **open** if the key is unset (a dev
fallback, not a production posture). Roles today are **USER, APPROVER, SECURITY_OFFICER,
ADMIN** (`ROLE_<name>`), enforced via URL rules and `@PreAuthorize`. Realtime is **STOMP over
WebSocket** (SockJS), an in-memory `SimpleBroker` on `/topic`, endpoint `/ws`, topics
`/topic/vehicle-check` and `/topic/gate/{gateId}/check`; missed events are replayed via
`GET /api/gates/{id}/recent-checks`. **There is no RabbitMQ and no Redis today.** There are
**8 entities**, all UUID-keyed, **none tenant-scoped**: `Employee`, `Vehicle`, `VehicleLog`,
`User`, `VehicleAccessRequest`, `Gate`, `Department`, `Position`. `Gate` models a physical
gate location (id, name, location, `cameraRtspUrl`, status, `lastHeartbeatAt`) — it is not a
tenant boundary. Snapshots are stored on **local disk** (`uploads/snapshots`, served at
`/uploads/**`). Observability is Micrometer + Prometheus (`/actuator/prometheus`) and
springdoc OpenAPI/Swagger. Tests use JUnit + Testcontainers (Postgres, 1.21.4).

**Frontend** (`frontend/`) — **Next.js 14.2.16, App Router**, React 18, TypeScript, **pnpm**,
`output: 'standalone'`. Styling is **Tailwind CSS v4** + **shadcn/ui** (new-york, Radix),
lucide icons, **recharts** for charts, `react-hook-form` + `zod` for forms, `next-themes`,
`sonner` for toasts. There is **no react-query/SWR/axios** — API access is native `fetch`
wrapped in hand-rolled client classes under `lib/api/`. There is **no global store**, only
React Context. Auth is a **JWT kept in `localStorage`** (`auth_token`), sent as
`Authorization: Bearer`, with client-side expiry decoding; there is **no `middleware.ts`** —
route protection is client-side via a `ProtectedLayout` component that redirects to `/login`.
Realtime uses `@stomp/stompjs` over SockJS in `hooks/use-websocket.ts`. Routes: `/login`,
`/employees` (default landing page), `/users`, `/departments`, `/positions`, `/vehicles`,
`/vehicles/monitoring` (live), `/vehicles/entry-exit`, `/vehicles/requests`, `/gate`
(registry), `/gate/[gateId]` (full-screen kiosk with Web Speech TTS in `vi-VN`),
`/gate/health`, `/statistics`. **There is no map component and no camera/video component** —
camera is data-only, represented by `Gate.cameraRtspUrl`.

**Edge** (`edge/`, Python) — a headless service `edge/edge/` (`EdgeService`,
`DetectionCore`, `GateClient`, `EventQueue`) plus a legacy PyQt5 desktop app
(`license_plate_monitor.py`). AI today is **YOLOv5** (via `torch.hub`, vendored
`ultralytics_yolov5_master`): one model detects the plate bounding box, a **second YOLOv5
model detects individual characters** (OCR-by-detection), which are sorted into Vietnamese
1-line/2-line plate strings in `function/helper.py`, with a deskew retry over 4 orientations.
Optional fallback OCR engines (**EasyOCR / Tesseract / Google Vision**) are available behind
guarded imports. **There is no PaddleOCR, no VietOCR, no ByteTrack/DeepSORT, and no motion
detection (MOG2) today.** "Tracking" today is **not a real multi-object tracker** — it is a
per-plate-string dictionary of first-seen/last-sent timestamps with a cooldown /
minimum-detection-duration rule used to decide when a detection is confirmed and should be
sent. Capture is `cv2.VideoCapture(rtsp, CAP_FFMPEG)`, one RTSP stream per process (1 process
== 1 gate), with frame validation and a `frame_interval_ms` throttle (200ms). The edge talks
to the backend through `GateClient` using `X-Gate-Key`: `POST /api/gates/register`,
`POST /api/gates/{id}/heartbeat`, `POST /api/vehicles/check-vehicle` (JSON or multipart with
snapshot; payload carries an `eventId` UUID and `occurredAt` for idempotency). It has a
**durable, bounded FIFO SQLite queue** (`edge/edge_queue/events.sqlite3`) with a background
retry worker, exponential backoff, and idempotent dedup by `event_id` — this store-and-forward
mechanism is kept and extended in the target design. There is **no parking-slot / occupancy
logic today**; snapshots are sent to the backend as evidence and are not persisted locally
except inside the offline queue's BLOB payload.

### 1.2 Target vision

ParkVision is a **multi-tenant SaaS**: one tenant (e.g. a supermarket chain) owns many
**sites** (parking lots); each site has many **cameras/gates** and a **parking map** of
**slots**. The target detection pipeline is: motion detection (OpenCV MOG2, to save GPU) →
vehicle detection (**YOLOv11**) → plate detection (existing YOLOv5 pipeline, kept) → OCR
(**PaddleOCR** primary, EasyOCR/VietOCR as comparators) → **ByteTrack** multi-object tracking
→ **parking-slot polygon mapping** (vehicle center → slot) → **vehicle-relocation detection**
→ an **event bus** → database / notifications / snapshots / an **AI chatbot**. On top of
that: subscription billing, richer RBAC, camera management, a parking-map designer, AI
calibration tooling, analytics dashboards, a mobile app, and Kubernetes-based deployment.
Nine domain events are standardized: `MotionDetected`, `VehicleDetected`, `PlateRecognized`,
`VehicleEntered`, `VehicleRelocated`, `VehicleExited`, `PersonDetected`, `SnapshotSaved`,
`NotificationSent`. The chatbot exposes four tenant-scoped read tools:
`getVehicleLocation()`, `getHistory()`, `getSnapshot()`, `getParkingStatus()`.

## 2. Current -> Target Gap Table

| Area | Today | Target |
|---|---|---|
| Multi-tenancy | None — no `tenant_id`/`site_id` on any of the 8 entities; single implicit tenant | `tenant_id` + `site_id` on every tenant-owned table, enforced by PostgreSQL Row-Level Security + a Hibernate tenant filter, tenant resolved from JWT claims (ADR-worthy; see `04_Multi_Tenant_Design`) |
| Tenant hierarchy | None — `Gate` is a flat, ungrouped entity | Tenant → Site → Zone → ParkingSlot, and Tenant → Site → Camera/Gate |
| Geospatial | None | PostGIS for `ParkingSlot.polygon` and vehicle-center point-in-polygon queries |
| Event bus | None — STOMP is a direct in-memory broadcast only, no durable event log | RabbitMQ, with a transactional outbox pattern in the backend (event row + business write in one tx, relayed to the broker) |
| Realtime scale-out | Single-instance in-memory `SimpleBroker`, does not fan out across nodes | Redis as a STOMP relay / pub-sub so WebSocket delivery scales horizontally |
| Caching / rate limiting | None | Redis for cache, rate-limit counters, and gate/camera presence |
| Snapshot storage | Local disk (`uploads/snapshots`), served at `/uploads/**` | Object storage (MinIO/S3); local disk retained for dev only |
| Time-series events | None — no event log table at all | `ParkingEvent` table partitioned by time (native Postgres partitioning; TimescaleDB optional later) |
| Edge — vehicle detection | Not performed (only plate detection runs) | YOLOv11 vehicle detection, gated by OpenCV MOG2 motion detection to save GPU |
| Edge — plate detection | YOLOv5 (kept) | YOLOv5 (kept, unchanged) |
| Edge — OCR | Second YOLOv5 model does character-level detection (OCR-by-detection); optional EasyOCR/Tesseract/Google Vision fallback | PaddleOCR as primary OCR engine; EasyOCR/VietOCR retained as comparators for accuracy evaluation |
| Edge — tracking | Per-plate-string dict of first-seen/last-sent timestamps + cooldown; **not** a real multi-object tracker, no stable identity across frames | ByteTrack multi-object tracking producing a stable `track_id` per physical vehicle |
| Edge — parking logic | None — no slot/occupancy concept | Parking-slot polygon mapping (vehicle center → slot) + relocation detection (same `track_id`, slot changed → `VehicleRelocated`) |
| Edge — offline resilience | SQLite store-and-forward queue, exponential backoff, idempotent dedup by `event_id` | Same mechanism, kept and extended |
| RBAC | USER, APPROVER, SECURITY_OFFICER, ADMIN (flat, no tenant scope) | PLATFORM_ADMIN, TENANT_ADMIN, SITE_MANAGER, SECURITY_GUARD (from SECURITY_OFFICER), MEMBER/USER; APPROVER folds into SITE_MANAGER; JWT carries `tenant_id` + site scope + role |
| Billing | None | Stripe subscriptions; Free/Starter/Pro/Enterprise plans with metered entitlements (max sites, max cameras, retention days, AI minutes, chatbot messages), usage metered off the event stream |
| AI chatbot | None | LLM with tool-calling (default local Ollama, Qwen2.5/Llama 3.1; optional hosted Claude/OpenAI), tenant-scoped tools, optional RAG over docs/FAQ |
| Frontend — map / camera UI | None — camera is data-only via `Gate.cameraRtspUrl`, no map, no video player | Parking-Map Designer (SVG/Canvas polygon editor + homography calibration), Live Camera view (HLS/WebRTC via a media gateway, MJPEG fallback) |
| Mobile app | None | React Native (Expo), reusing the REST API, push via FCM/APNs |
| Deployment | Docker Compose only | Docker Compose for dev, Kubernetes for prod (Deployments, HPA, Ingress-NGINX, cert-manager), GitOps/Helm |
| Backend architecture | Flat layered packages (`controller/service/repository/entity`), no internal module boundaries | Modular monolith with explicit modules: `iam`, `tenancy`, `billing`, `parking`, `ai-ingest`, `events`, `chatbot`, `notification`, `analytics` |
| API versioning | `/api`, unversioned | `/api/v1`, OpenAPI 3.1 as the contract, idempotency keys on edge ingest |
| Domain entities | 8 entities, none tenant-scoped | Tenant, Site, Zone, Camera, Gate (site-scoped), ParkingSlot, Vehicle (tenant-scoped), VehicleTrack, ParkingEvent, ParkingHistory, MotionEvent, Snapshot, Subscription, Plan, UsageRecord, Notification, User (tenant-scoped); Employee/Department/Position retained as an optional tenant-scoped "workforce" module |

## 3. Monorepo Layout

### 3.1 Today

```
next-manage-user/
├── frontend/           Next.js 14 App Router (app/, components/, hooks/, lib/api/)
├── backend/            Spring Boot 3.2 / Java 17 (src/main/java/com/vehiclemanagement/)
├── edge/                Python edge service (edge/edge/, function/, edge_queue/)
├── deploy/              docker-compose.dev.yml, build/push scripts
├── docs/                documentation (this doc set)
└── docker-compose.yml   Postgres (dev)
```

See `diagrams/monorepo-structure.mmd` for the full annotated tree, including today's
sub-folders (`backend/src/main/java/com/vehiclemanagement/{controller,entity,service,
repository,config,dto,util}`, `edge/edge/`, `frontend/app/{employees,gate,vehicles,...}`).

### 3.2 Evolution

The monorepo shape does not change at the top level — `frontend/`, `backend/`, `edge/`,
`deploy/`, `docs/` remain. What changes is internal structure:

- `backend/src/main/java/com/vehiclemanagement/` gains module packages —
  `iam/`, `tenancy/`, `billing/`, `parking/`, `ai-ingest/`, `events/`, `chatbot/`,
  `notification/`, `analytics/` — replacing the current flat
  `controller/service/repository/entity` split (see ADR-0102). Existing entities move into
  `parking` (Vehicle, Gate, VehicleLog) and `iam` (User) as a first step; net-new tenancy,
  billing, events, chatbot, notification, and analytics code lands in their own packages
  from the start.
- `frontend/app/` gains new route groups for the Parking-Map Designer and Live Camera view,
  plus tenant/site-scoped navigation.
- `edge/` gains `motion/` (MOG2), `tracker/` (ByteTrack), and an `ocr/` abstraction wrapping
  PaddleOCR/EasyOCR/VietOCR, alongside the existing YOLOv5 plate-detection code and the SQLite
  queue, which are both kept unchanged.
- `deploy/` gains Kubernetes manifests/Helm charts alongside the existing Docker Compose dev
  setup; `docker-compose.yml` gains `rabbitmq`, `redis`, and `minio` services for local dev
  parity with the target infra.

## 4. Component Responsibilities

| Component | Technology | Responsibility | Status today |
|---|---|---|---|
| Web App | Next.js 14 App Router, Tailwind v4, shadcn/ui | Tenant/site admin, vehicle & gate management, kiosk view, statistics | Exists (single-tenant scope) |
| Parking-Map Designer | Next.js, SVG/Canvas | Draw slot polygons over a camera still / lot image, calibrate homography | Target only |
| Live Camera view | Next.js, HLS/WebRTC/MJPEG | View a site's camera feeds in the browser | Target only |
| `iam` module | Spring Security, JWT (jjwt) | Authn/authz, roles, tenant-aware JWT claims | Exists as flat Spring Security config; module boundary + tenant claims are target |
| `tenancy` module | PostgreSQL RLS, Hibernate filter | Tenant/Site/Zone resolution and isolation | Target only |
| `billing` module | Stripe | Plans, subscriptions, usage metering | Target only |
| `parking` module | Spring Data JPA | Vehicle, Gate, Camera, ParkingSlot, VehicleLog domain logic | Exists (Vehicle/Gate/VehicleLog); ParkingSlot/Camera/tenant-scoping are target |
| `ai-ingest` module | Spring MVC | Validate & persist edge events, write to outbox | Exists as the `check-vehicle` endpoint; outbox + event publish are target |
| `events` module | RabbitMQ, outbox relay | Publish and route the 9 domain events | Target only |
| `chatbot` module | LLM tool-calling (Ollama/Claude/OpenAI) | Tenant-scoped natural-language Q&A over parking data | Target only |
| `notification` module | Push/email/WebSocket | Deliver alerts (e.g. `VehicleRelocated`) to users | Target only (today: raw STOMP broadcast only) |
| `analytics` module | Aggregation queries, recharts | Dashboards, usage metering for billing | Target only |
| Edge capture + detection | Python, OpenCV, YOLOv5 (today) / +MOG2 +YOLOv11 (target) | RTSP capture, motion gate, vehicle & plate detection | Exists (plate detection only); motion + vehicle detection are target |
| Edge OCR | YOLOv5 char-detection (today) / +PaddleOCR (target) | Convert plate crop to a VN plate string | Exists (YOLOv5 + optional EasyOCR/Tesseract/Google Vision fallback); PaddleOCR-primary is target |
| Edge tracking | first-seen/cooldown dict (today) / ByteTrack (target) | Assign stable identity to a vehicle across frames | Exists as a pseudo-tracker; real multi-object tracking is target |
| Edge queue | SQLite (`events.sqlite3`) | Store-and-forward for offline resilience | Exists, kept & extended |
| PostgreSQL | `vehicle_management` db, Flyway | System of record | Exists |
| PostGIS | Postgres extension | Slot polygon storage, point-in-polygon queries | Target only |
| RabbitMQ | AMQP broker | Domain event bus | Target only |
| Redis | In-memory store | Cache, rate limits, presence, STOMP relay | Target only |
| Object storage | MinIO/S3 | Snapshot storage at scale | Target only (today: local disk `uploads/snapshots`) |

## 5. Glossary

Definitions below follow the target domain model exactly (see §4 of the shared brief and
`04_Multi_Tenant_Design` for full field lists); none of these concepts exist as named,
schema-backed entities in today's code except where noted.

- **Tenant** — the root of isolation; a customer organization (e.g. a supermarket chain).
  Fields: `id, name, slug, status, plan_id, created_at`. Does not exist today — the current
  system is implicitly a single tenant.
- **Site** (bãi đỗ xe) — a physical parking location belonging to a tenant. Fields:
  `id, tenant_id, name, address, geo, timezone, status`. Does not exist today; today's `Gate`
  is not site-scoped.
- **Zone** — an optional grouping of slots within a site, e.g. a floor or section ("A", "B").
  Fields: `id, site_id, name`. Target only.
- **Slot** (ParkingSlot) — a single parking space, geofenced by a polygon. Fields:
  `id, site_id, zone_id, code` (e.g. `"A01"`), `polygon GEOMETRY(Polygon), status
  {free,occupied,reserved,disabled}, current_vehicle_id, updated_at`. Target only — no
  slot/occupancy concept exists today.
- **Camera** — a video source at a site, superseding/extending today's `Gate.cameraRtspUrl`.
  Fields: `id, site_id, name, rtsp_url, role{ANPR_GATE, OVERVIEW}, panel_type{entry,exit},
  status, last_heartbeat_at, calibration_json`. Target model; today's `Gate` entity carries
  only a single `cameraRtspUrl` field with no role/calibration concept.
- **Gate** — a logical entry/exit point, distinct from `Camera` in the target model. Today:
  `id, name (unique), location, cameraRtspUrl, status{online,offline,disabled},
  lastHeartbeatAt` — a flat, non-site-scoped entity that conflates the physical gate and its
  camera. Target: `id, site_id, name, camera_id, direction` — site-scoped, camera is a
  separate linked entity.
- **Track** (VehicleTrack) — a ByteTrack tracklet: a temporally continuous detection of one
  physical vehicle across frames, identified by a stable `track_id`. Fields:
  `id, site_id, camera_id, track_id, license_plate nullable, first_seen_at, last_seen_at`.
  Target only. Today's "tracking" is a per-plate-string dictionary of first-seen/last-sent
  timestamps with a cooldown rule — it has no cross-frame object identity and is not a
  tracklet in this sense.
- **Relocation** — the event/record produced when the same `track_id` is observed moving
  from one `ParkingSlot` to a different one. Emits a `VehicleRelocated` domain event and is
  recorded in `ParkingHistory (id, tenant_id, plate, old_slot, new_slot, occurred_at)`.
  Target only; no relocation concept exists today because there is no slot concept to move
  between.

## 6. Assumptions & Constraints

- **Backward compatibility during migration.** The current single-tenant gate-access flow
  (register → heartbeat → check-vehicle → STOMP broadcast) must keep working for the
  existing deployment while multi-tenancy is retrofitted; see ADR-0101 and
  `04_Multi_Tenant_Design` for the migration approach (treat the existing deployment as one
  implicit tenant/site during backfill).
  - **JWT compatibility.** New JWT claims (`tenant_id`, site scope) must be additive; existing
  tokens issued under the current `role/email/userId` claim set should not be invalidated
  mid-migration without a documented cutover window.
- **Edge devices are network-constrained.** The SQLite store-and-forward queue and
  exponential-backoff retry are load-bearing for on-site reliability (edge runs outbound-only
  per §3.14 of the brief) and must be preserved unchanged through every edge AI upgrade.
- **One RTSP stream per process remains the edge concurrency model** unless a specific
  scaling document (see `07_Camera_Management`) revises it; this constrains how many cameras
  a single edge appliance can serve.
- **`GateApiKeyAuthFilter`'s open-when-unset fallback is a dev convenience, not a target
  posture** — production tenants must have `GATE_API_KEY` (or its multi-tenant successor)
  enforced; this is called out again under Open Questions below.
- **Data residency / RLS correctness is a hard constraint**, not a nice-to-have: once
  `tenant_id`/`site_id` + RLS land, every new query path (including the AI chatbot's tool
  calls) must be provably tenant-scoped before it ships.
- **No breaking route changes to `/api` without versioning** — the move to `/api/v1` should
  be additive/parallel-run, not a hard cutover, consistent with the evolve-not-rewrite
  decision (ADR-0101).

## 7. Diagrams

- `diagrams/system-context.mmd` — C4-ish system context: ParkVision's actors (tenant admin,
  site manager, security guard, vehicle owner, mobile app) and external systems (edge
  device/camera, chatbot LLM provider, payment provider) around the platform boundary.
  Dashed nodes/edges are target-only.
- `diagrams/component-overview.mmd` — major internal components: the frontend surfaces, the
  9 target backend modules (`iam, tenancy, billing, parking, ai-ingest, events, chatbot,
  notification, analytics`) mapped against what exists today, the edge pipeline stages, and
  the infra layer (Postgres/PostGIS, RabbitMQ, Redis, object storage). Dashed nodes/edges are
  target-only.
- `diagrams/monorepo-structure.mmd` — today's folder tree (`frontend/`, `backend/`, `edge/`,
  `deploy/`, `docs/`, `docker-compose.yml`) annotated with where new target modules/folders
  will land. Dashed nodes are target-only additions.

## 8. Decisions / ADRs

- [ADR-0101: Evolve existing system, don't rewrite](./adr/ADR-0101-evolve-not-rewrite.md) —
  keep the current Spring Boot/Next.js/Python/PostgreSQL/JWT/STOMP stack and add SaaS
  capabilities incrementally, rather than a greenfield rewrite or a per-tenant fork.
- [ADR-0102: Modular monolith architecture style](./adr/ADR-0102-modular-monolith-architecture.md)
  — start as a single deployable with enforced module boundaries (`iam, tenancy, billing,
  parking, ai-ingest, events, chatbot, notification, analytics`), extracting services later
  only when justified by measured load.

## 9. Open Questions / Risks

- **`GateApiKeyAuthFilter` open-fallback**: today it runs open if `GATE_API_KEY` is unset —
  needs a hard-fail-closed policy per tenant before multi-tenant production rollout.
- **Retrofit order**: which module gets `tenant_id`/`site_id` + RLS first — `parking` (most
  entities) or `iam` (auth is the enforcement point for everything else)? Affects the
  sequencing in `23_Roadmap`.
- **Edge pipeline latency budget**: adding MOG2 motion gating, YOLOv11 vehicle detection, and
  ByteTrack tracking on top of the existing YOLOv5 plate pipeline may exceed the current
  200ms `frame_interval_ms` throttle on constrained edge hardware — needs a benchmark before
  committing to the full pipeline on existing appliances.
- **STOMP-to-Redis-relay cutover**: today's in-memory `SimpleBroker` is simple and
  single-instance; introducing Redis as a relay changes failure modes (broker becomes a
  dependency for realtime delivery) — needs a rollout plan, not just a config flip.
- **Chatbot tool-call tenant isolation**: the four chatbot tools
  (`getVehicleLocation/getHistory/getSnapshot/getParkingStatus`) are the highest-risk new
  surface for cross-tenant data leakage if RLS/tenant filtering has any gap — flagged for
  extra scrutiny in whichever doc specs the chatbot module.

## 10. Cross-References

- `00_Vision` — product vision and business goals this platform serves.
- `02_Business_Flow` — end-to-end user/vehicle flows across the current and target system.
- `03_SaaS_Architecture` — deeper architecture detail building on this doc's component list.
- `04_Multi_Tenant_Design` — the `tenant_id`/`site_id` + RLS design referenced in §2 and §6.
- `05_Subscription_Billing` — Stripe plans/entitlements referenced in §2.
- `06_User_RBAC` — the target role model referenced in §2 and §5.
- `07_Camera_Management` — camera/gate model and edge concurrency constraints referenced in §6.
- `08_Parking_Map_Designer` — the frontend component referenced in §4.
- `09_AI_Calibration` — edge AI pipeline detail (YOLOv11, PaddleOCR, ByteTrack) referenced in §2.
- `23_Roadmap` — phased sequencing of the gaps enumerated in §2.
- `24_Future_Features` — capabilities beyond the current target scope.
