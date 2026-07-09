# Camera & Gate Management

ParkVision sites are watched by cameras: today those cameras exist only as a single RTSP URL
field on a gate-access `Gate` row; the target platform promotes the camera to a first-class,
site-scoped entity with its own lifecycle, credentials, health signal, and live-view delivery
pipeline. This document defines that lifecycle — provisioning, authentication, health/offline
alerting, multi-camera-per-site topology, the edge appliance model, and how camera video reaches
an operator's browser. It is the foundation `08_Parking_Map_Designer` (drawing slots over a
camera still) and `09_AI_Calibration` (tuning detection per camera) build on.

Status: Draft · Owner: Principal Architect · Last updated: 2026-07-09

## 1. Current state vs Target

### 1.1 Current state (verified from code, `backend/`, `edge/`, `frontend/`)

| Concern | Today |
|---|---|
| Camera as an entity | Does not exist. `Gate` (JPA entity, UUID PK) carries `cameraRtspUrl` as a plain string field — one gate has at most one implicit camera. |
| Gate fields | `id, name(unique), location, cameraRtspUrl, status{online,offline,disabled}, lastHeartbeatAt`. No `site_id`/`tenant_id` (single-tenant repo). |
| Cardinality | **One edge process == one gate == one RTSP stream.** `cv2.VideoCapture(rtsp, CAP_FFMPEG)` opens exactly one stream per process. |
| Provisioning | `POST /api/gates/register` — self-registration, edge process calls this on startup with its configured `gate.id`/`name`/`camera_rtsp` (see `edge/config.example.json`). No enrollment token, no admin approval step. |
| Heartbeat | `POST /api/gates/{id}/heartbeat`, interval driven by edge config (`gate.heartbeat_interval`, default 30s, `heartbeat_backoff_max` 300s). |
| Auth | Single shared secret via `X-Gate-Key` header, checked by `GateApiKeyAuthFilter` against one env var `GATE_API_KEY`. **Not per-camera** — one key for the whole deployment. If `GATE_API_KEY` is unset, the filter runs **OPEN** (dev fallback — a real gap, see §11). |
| Status derivation | No explicit push of "offline" from the edge. `GateService` runs a **30s staleness sweep**: if `lastHeartbeatAt` is older than the threshold, the gate flips to `offline` server-side. |
| Health/monitoring surface | `GET /api/gates/{id}/health`, `GET /api/gates/{id}/recent-checks` (replay of missed check events), frontend page `/gate/health`. |
| Live status | STOMP over SockJS, topic `/topic/gate/{gateId}/check`; consumed by the full-screen kiosk page `/gate/[gateId]` (Web Speech TTS, vi-VN) and the gate registry page `/gate`. |
| Live video | **None.** No camera/video component in the frontend anywhere. The RTSP URL is data-only; nothing streams it to a browser. |
| Multi-camera per site | N/A — no `site` concept yet; every gate is independent and flat. |
| Edge appliance | A single Python process (`EdgeService`) per gate, plus a legacy PyQt5 desktop app (`license_plate_monitor.py`) for local operators. No concept of one host running multiple camera workers. |

### 1.2 Target (from the vision, §2/§4 of the shared brief)

- **Camera** is a first-class, `site_id`-scoped entity: `id, site_id, name, rtsp_url, role{ANPR_GATE, OVERVIEW}, panel_type{entry,exit}, status, last_heartbeat_at, calibration_json`.
- **Gate** becomes a thin, logical entry/exit point that references a `Camera`: `id, site_id, name, camera_id, direction` — i.e. today's `Gate` (identity + kiosk behavior) is retained, but the RTSP/health concerns move to `Camera`.
- Multiple cameras per site, of two roles: `ANPR_GATE` (drives the existing plate-check flow at a physical gate) and `OVERVIEW` (wide lot view, feeds `08_Parking_Map_Designer` and slot-occupancy detection — no ANPR).
- A structured enrollment flow with per-camera credentials (rotate/revoke independently), not one shared deployment-wide key.
- Health monitoring that actively **alerts** (notification, not just a status flip) when a camera goes offline.
- Live-view delivery to the browser: RTSP → media gateway → HLS/WebRTC, with MJPEG fallback.
- An edge appliance model where **one on-site host can run several camera workers concurrently** (today's one-process-per-camera is the starting point, not the ceiling — see ADR-0702).

### 1.3 The gap

The current system has no notion of a camera separate from a gate, no live video path at all, a
single shared API credential for every gate, and a 1:1 process-to-stream model that does not
scale past a handful of gates per host. Everything in §3–§8 below is new work; nothing here is a
description of existing functionality except where explicitly marked "today".

## 2. Requirements

1. A site can have any number of cameras; a camera belongs to exactly one site.
2. Cameras must self-identify and authenticate independently — compromising one camera's
   credential must not expose others.
3. Operators must see, at a glance, which cameras are online/offline/disabled per site, and be
   alerted (not just shown a red dot) when a camera silently drops off.
4. Operators must be able to view a camera's live feed from the browser without installing
   anything, on both desktop and the gate kiosk.
5. The camera model must carry enough metadata (`role`, `panel_type`, `calibration_json`) for
   downstream consumers (map designer, AI calibration, ANPR pipeline) to configure themselves
   without a second lookup.
6. Edge appliances must be able to add/remove cameras without redeploying the whole host process.

## 3. Target data model

### 3.1 `Camera`

| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `site_id` | UUID FK → Site | tenant scoping is implicit via `Site.tenant_id` |
| `name` | string | operator-facing label |
| `rtsp_url` | string | credentials should be stored separately/encrypted, not inline in the URL, in the target design |
| `role` | enum `ANPR_GATE`, `OVERVIEW` | drives which pipelines subscribe to this camera's frames |
| `panel_type` | enum `entry`, `exit` | meaningful for `ANPR_GATE` cameras only; mirrors today's `Gate` semantics |
| `status` | enum `provisioned`, `online`, `offline`, `disabled` | see state diagram §9.2 |
| `last_heartbeat_at` | timestamp | same staleness-sweep pattern as today's `Gate.lastHeartbeatAt`, generalized |
| `calibration_json` | jsonb | owned in detail by `09_AI_Calibration`; this doc only defines where it lives |

### 3.2 `Gate`

| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `site_id` | UUID FK → Site | |
| `name` | string | |
| `camera_id` | UUID FK → Camera | replaces today's inline `cameraRtspUrl` |
| `direction` | enum `entry`, `exit` | |

A `Gate` is a logical concept ("the north entry lane"); a `Camera` is the physical device behind
it. This split is what allows an `OVERVIEW` camera to exist with no gate at all, and (later) a
gate to be re-pointed at a replacement camera without losing its history.

## 4. Provisioning & enrollment flow

1. A site admin creates a camera record from the frontend (`POST /api/v1/sites/{siteId}/cameras`)
   with `name`, `rtsp_url`, `role`, `panel_type`. The backend creates the row in `provisioned`
   status and issues a short-lived **enrollment token**.
2. The admin delivers the enrollment token to the edge appliance (config file drop, QR code
   scanned by an on-site setup tool, or manual paste) — analogous to today's `gate.id` line in
   `edge/config.example.json`, but token-based instead of a bare UUID.
3. The edge camera worker opens the RTSP stream (`cv2.VideoCapture(rtsp_url, CAP_FFMPEG)` —
   unchanged from today) and calls a registration endpoint with the enrollment token.
4. The backend validates the token, rotates it into a permanent **per-camera API key**, and
   returns `camera_id` + key to the appliance. The appliance persists the key locally (same
   pattern as today's edge config file).
5. From then on the appliance authenticates every call — heartbeat, ingest — with its own key
   (see §5), and the backend flips `provisioned → online` on first heartbeat.

See `diagrams/camera-enrollment.mmd`.

## 5. Per-camera credentials

- Today: one process-wide secret (`GATE_API_KEY`) shared by every gate; unset means the filter is
  **open** (no auth) — acceptable only in dev.
- Target: each `Camera` gets its own credential (API key or short-lived signed token), checked by
  a generalized `CameraApiKeyAuthFilter` (successor to `GateApiKeyAuthFilter`) resolving the
  camera by `id` in the path and comparing against a **per-row** secret hash, not a single env
  var. Keys must be rotatable and revocable from the admin UI without redeploying the backend.
  The "run open if unset" dev fallback must be scoped to a non-prod profile only — see §11.

## 6. Health monitoring & offline alerts

- Freshness-based status derivation is kept from today's `GateService` sweep, generalized to
  `Camera.last_heartbeat_at` (still no dedicated push-down from the edge on graceful shutdown is
  assumed — the sweep is the source of truth, same as today).
- New: an `online → offline` transition **publishes a domain event** (see §3.5 of the shared
  brief — the RabbitMQ event bus / transactional outbox) so that a `Notification` can reach the
  responsible `SITE_MANAGER`/`TENANT_ADMIN` (push/email/ws), instead of only being visible if
  someone happens to look at `/gate/health` (today's only surface).
- `GET /api/v1/cameras/{id}/health` and `GET /api/v1/cameras/{id}/recent-events` are the direct
  successors of today's `/api/gates/{id}/health` and `/api/gates/{id}/recent-checks`.

## 7. Live-view delivery

Today there is **no** live video path to the browser at all — this is entirely new capability.

- Edge camera worker keeps the RTSP connection it already holds for AI inference and additionally
  relays it to a **media gateway** (e.g. MediaMTX/go2rtc pattern) running on the edge appliance or
  centrally, which re-packages the stream as:
  - **HLS** — default, works everywhere, higher latency (~2–6s), cheap to scale via a CDN/cache.
  - **WebRTC** — opt-in low-latency mode for the gate kiosk (`/gate/[gateId]`), where an operator
    wants near-real-time confirmation of what the plate reader just saw.
  - **MJPEG** — fallback for constrained clients/older browsers/low-bandwidth links.
- The Next.js frontend gets a new Live-View player component (there is no video component today)
  that picks a transport based on capability/network, with MJPEG as the guaranteed-to-work floor.
- See ADR-0701 for the transport decision and `diagrams/live-view-pipeline.mmd`.

## 8. Multi-camera-per-site & edge appliance model

- Today: 1 process = 1 RTSP stream = 1 gate; running N gates means N independent OS processes
  (or N desktop app instances), each with its own model load, its own SQLite queue file, its own
  config.
- Target: an **edge appliance** (a physical or virtual host placed on-site) runs a **pool of
  camera workers**, one per RTSP stream, supervised by a single process. This lets a site with,
  say, 6 ANPR gates and 2 overview cameras run on one appliance instead of 8. GPU-bound inference
  can still be isolated into separate worker processes for fault containment while lighter
  capture/heartbeat/queue logic shares the supervisor. See ADR-0702 for the trade-off.
- The store-and-forward SQLite queue (kept & extended per the brief) becomes per-appliance rather
  than strictly per-camera where practical, to avoid N independent queue files with N independent
  retry loops.

## 9. Diagrams

- `diagrams/camera-enrollment.mmd` — sequence diagram of the provisioning/enrollment flow in §4,
  from admin creation through first heartbeat and status flip to `online`.
- `diagrams/camera-state.mmd` — state diagram of the camera lifecycle:
  `provisioned → online → offline → disabled`, including admin disable/re-enable and delete paths.
- `diagrams/live-view-pipeline.mmd` — flowchart of the RTSP → media gateway → HLS/WebRTC/MJPEG →
  browser path described in §7.

## 10. Decisions / ADRs

- [ADR-0701](adr/ADR-0701-live-view-transport.md) — Live-view transport: WebRTC vs HLS vs MJPEG.
- [ADR-0702](adr/ADR-0702-edge-camera-worker-model.md) — One-process-per-camera edge model vs a
  multi-stream worker pool.

## 11. Open questions / risks

- **Dev-fallback auth gap**: today's "run open if `GATE_API_KEY` unset" behavior must not survive
  into the multi-tenant, per-camera-credential target unscoped — it needs an explicit
  environment/profile guard so it can never be accidentally live in production.
- RTSP credentials embedded in `rtsp_url` (current pattern) are a secret-management smell once
  multi-tenant; target should store camera credentials separately from the URL and encrypt at
  rest.
- Media gateway placement (per-appliance on-site vs centralized in the cloud) affects bandwidth
  cost and latency and is not fully settled here — flagged for `03_SaaS_Architecture` /
  infrastructure sizing.
- Camera-to-appliance reassignment (moving a camera's stream to a different appliance without
  losing its `camera_id`/history) is not designed yet.

## 12. Cross-references

- `08_Parking_Map_Designer` — consumes `OVERVIEW` camera still frames and writes back through the
  same `calibration_json` field this doc defines the home for.
- `09_AI_Calibration` — owns the full shape and lifecycle of `calibration_json` introduced in §3.1.
- `03_SaaS_Architecture` — tenant/site hierarchy that `Camera.site_id` scopes into, and RLS
  enforcement on the `Camera` table.
- `15_Database_Design` — full ERD and migration plan for `Camera`/`Gate` alongside the rest of the
  domain model in §4 of the shared brief.
