# 14. Backend API

REST and WebSocket API design for ParkVision: what the existing Spring Boot backend already
exposes (kept as-is), the new versioned `/api/v1` surface for the multi-tenant SaaS domain,
the shared error model, the AI ingest contract, and the realtime STOMP topics. This doc's
endpoint list is the source the architect's OpenAPI 3.1 spec should be generated/checked
against.

Status: Draft · Owner: Principal Architect · Last updated: 2026-07-09

## 1. Current state vs Target

### Current state (verified in code)

- Spring Boot **3.2.0** on **Jetty**, port **8080**, REST base `/api`, no version segment.
- Auth: **Spring Security stateless + JWT** (jjwt 0.11.5, HS256, claims role/email/userId,
  86400s expiry). A second filter, `GateApiKeyAuthFilter`, guards gate/edge endpoints via the
  `X-Gate-Key` header (env `GATE_API_KEY`) — it **runs OPEN (unauthenticated) if the key is
  unset**, a dev fallback, not something to carry into the multi-tenant ingest endpoint (see
  ADR-1402).
- Roles today: **USER, APPROVER, SECURITY_OFFICER, ADMIN**, enforced via URL rules in
  `SecurityConfig` (`.requestMatchers(...).hasAnyRole(...)`) and method-level
  `@PreAuthorize`.
- Error handling: a single `@RestControllerAdvice` (`GlobalExceptionHandler`) — see §4.
- Realtime: STOMP over WebSocket (SockJS) via Spring's in-memory `SimpleBroker`, endpoint
  `/ws`, topics `/topic/vehicle-check` and `/topic/gate/{gateId}/check` (see
  `13_Event_Driven_Architecture` for why this cannot fan out durably or across instances).
- OpenAPI/Swagger already wired (springdoc), reachable at `/api-docs`, `/swagger-ui`.
- 10 controllers exist today (Auth, Vehicle, VehicleStatistics, Employee, User, Department,
  Position, VehicleLog, VehicleLogExport, VehicleAccessRequest, Gate) — full table in §2.

### Target

- Every existing endpoint kept byte-for-byte compatible under unversioned `/api/**`
  (ADR-1401). New SaaS resources ship under `/api/v1/**`: tenants, sites, zones, cameras,
  parking-slots, vehicles (+ current location), parking-events, snapshots, subscriptions,
  notifications, analytics, chat.
- Roles evolve per brief §3.9: **PLATFORM_ADMIN, TENANT_ADMIN, SITE_MANAGER,
  SECURITY_GUARD** (maps from `SECURITY_OFFICER`), **MEMBER** (maps from `USER`); `APPROVER`
  folds into `SITE_MANAGER`'s approval rights. JWT gains `tenant_id` + site scope claims.
- Ingest gets a dedicated, idempotent, per-camera-keyed endpoint feeding the transactional
  outbox (`13_Event_Driven_Architecture`).
- New per-site STOMP topic for slot occupancy; existing topics kept for the legacy gate-kiosk
  UI.

## 2. Existing endpoints (kept, unversioned `/api`)

Representative endpoints per controller; the full exhaustive list (search/stats/bulk
sub-routes) is generated at `/api-docs`. Role column reflects `SecurityConfig` URL rules;
"authenticated" means any valid JWT with no specific role restriction beyond the blanket
`/api/**` → `authenticated()` default.

| Method | Path | Role | Purpose |
|---|---|---|---|
| POST | `/api/auth/login` | public | Issue JWT for username/password |
| GET | `/api/auth/me` | authenticated | Current user profile |
| POST | `/api/auth/logout` | authenticated | Client-side session end (stateless JWT) |
| GET | `/api/vehicles` | authenticated | Paginated vehicle list |
| GET | `/api/vehicles/{id}` | authenticated | Vehicle detail |
| POST | `/api/vehicles` | ADMIN, APPROVER | Create vehicle |
| PUT | `/api/vehicles/{id}/approve` | ADMIN, APPROVER | Approve vehicle access request |
| PUT | `/api/vehicles/{id}/reject` | ADMIN, APPROVER | Reject vehicle access request |
| DELETE | `/api/vehicles/{id}` | ADMIN | Delete vehicle |
| GET | `/api/vehicles/check-vehicle` | public + `X-Gate-Key` | **Deprecated** GET variant; scheduled for removal |
| POST | `/api/vehicles/check-vehicle` (JSON) | public + `X-Gate-Key` | Gate access check; mutates `approved→entered→exited`, creates `VehicleLog`, pushes WS event; idempotent on `eventId` |
| POST | `/api/vehicles/check-vehicle` (multipart) | public + `X-Gate-Key` | Same, plus optional evidence `snapshot` part |
| GET | `/api/vehicles/export`, `/export/template` | ADMIN, APPROVER | Excel export / column template |
| POST | `/api/vehicles/import` | ADMIN, APPROVER | Bulk import |
| GET | `/api/vehicles/statistics/overview` | authenticated | Dashboard counts |
| POST | `/api/gates/register` | public (`X-Gate-Key`) | Edge process registers a gate |
| POST | `/api/gates/{id}/heartbeat` | public (`X-Gate-Key`) | Liveness ping (30s staleness sweep) |
| GET | `/api/gates` | authenticated | List gates |
| GET | `/api/gates/health` | authenticated | Online/offline/disabled summary |
| GET | `/api/gates/{id}/recent-checks` | authenticated | Replay recent check events (WS-miss recovery) |
| PUT | `/api/gates/{id}` | authenticated | Update gate config |
| GET | `/api/vehicle-logs` | ADMIN, APPROVER, SECURITY_OFFICER | Paginated log list |
| POST | `/api/vehicle-logs` | public | Create log (legacy direct-write path) |
| GET | `/api/vehicle-logs/{today,weekly,monthly,date-range}` | ADMIN, APPROVER, SECURITY_OFFICER | Time-bucketed queries |
| GET | `/api/vehicle-logs/export/{excel,csv}` | ADMIN, APPROVER, SECURITY_OFFICER | Report export |
| POST | `/api/access-requests` | authenticated | Submit access request |
| GET | `/api/access-requests`, `/pending` | ADMIN, APPROVER | Review queue |
| GET | `/api/access-requests/my` | authenticated | Own requests |
| PUT | `/api/access-requests/{id}/{approve,reject,cancel}` | ADMIN, APPROVER (cancel: owner) | Resolve request |
| GET/POST/PUT/DELETE | `/api/employees/**` | authenticated / ADMIN, APPROVER for writes+export | Workforce CRUD |
| GET/POST/PUT/DELETE | `/api/admin/users/**` | ADMIN | User management |
| GET/POST/PUT/DELETE | `/api/departments/**`, `/api/positions/**` | authenticated / role-gated writes | Org structure CRUD |

## 3. New `/api/v1` endpoints (SaaS)

| Method | Path | Role | Purpose |
|---|---|---|---|
| POST | `/api/v1/tenants` | PLATFORM_ADMIN | Provision a tenant |
| GET | `/api/v1/tenants` | PLATFORM_ADMIN | List all tenants |
| GET | `/api/v1/tenants/{id}` | PLATFORM_ADMIN, TENANT_ADMIN (self) | Tenant detail |
| PUT | `/api/v1/tenants/{id}` | PLATFORM_ADMIN, TENANT_ADMIN | Update tenant profile/status |
| POST | `/api/v1/sites` | TENANT_ADMIN | Create a site |
| GET | `/api/v1/sites` | TENANT_ADMIN, SITE_MANAGER | List sites (tenant-scoped) |
| GET | `/api/v1/sites/{id}` | TENANT_ADMIN, SITE_MANAGER | Site detail |
| PUT/DELETE | `/api/v1/sites/{id}` | TENANT_ADMIN | Update / decommission site |
| POST | `/api/v1/sites/{siteId}/zones` | TENANT_ADMIN, SITE_MANAGER | Create zone |
| GET | `/api/v1/sites/{siteId}/zones` | SITE_MANAGER, SECURITY_GUARD | List zones |
| PUT/DELETE | `/api/v1/zones/{id}` | TENANT_ADMIN, SITE_MANAGER | Update / remove zone |
| POST | `/api/v1/cameras` | TENANT_ADMIN, SITE_MANAGER | Register camera (issues per-camera `X-Gate-Key`) |
| GET | `/api/v1/sites/{siteId}/cameras` | SITE_MANAGER, SECURITY_GUARD | List cameras |
| PUT | `/api/v1/cameras/{id}` | SITE_MANAGER | Update rtsp/role/panel_type |
| PATCH | `/api/v1/cameras/{id}/calibration` | SITE_MANAGER | Save homography/calibration JSON |
| POST | `/api/v1/cameras/{id}/heartbeat` | device (`X-Gate-Key`) | Camera liveness |
| POST | `/api/v1/parking-slots` | SITE_MANAGER | Define slot polygon |
| GET | `/api/v1/sites/{siteId}/parking-slots` | SITE_MANAGER, SECURITY_GUARD, MEMBER | List slots + status |
| PUT | `/api/v1/parking-slots/{id}` | SITE_MANAGER | Edit polygon / manual status override |
| GET | `/api/v1/vehicles` | TENANT_ADMIN, SITE_MANAGER, SECURITY_GUARD | Tenant vehicle list |
| GET | `/api/v1/vehicles/{id}` | TENANT_ADMIN, SITE_MANAGER, SECURITY_GUARD, MEMBER (own) | Vehicle detail |
| GET | `/api/v1/vehicles/{id}/location` | MEMBER (own), SITE_MANAGER, SECURITY_GUARD | Current site/slot ("where is my car") |
| GET | `/api/v1/vehicles/by-plate/{plate}` | SITE_MANAGER, SECURITY_GUARD | Plate lookup |
| POST | `/api/v1/parking-events` | device (`X-Gate-Key`, per-camera) | **Ingest endpoint** — see §5 |
| GET | `/api/v1/parking-events` | TENANT_ADMIN, SITE_MANAGER, SECURITY_GUARD | Query event log (filterable) |
| GET | `/api/v1/parking-events/{id}` | same | Event detail |
| GET | `/api/v1/snapshots/{id}` | TENANT_ADMIN, SITE_MANAGER, SECURITY_GUARD | Fetch snapshot metadata / signed URL |
| POST | `/api/v1/subscriptions` | TENANT_ADMIN | Start/change plan (Stripe checkout session) |
| GET | `/api/v1/subscriptions/current` | TENANT_ADMIN | Current plan + entitlements + usage |
| POST | `/api/v1/subscriptions/webhook` | public (Stripe-signature verified) | Stripe billing events |
| GET | `/api/v1/notifications` | any authenticated | Own notification inbox |
| PATCH | `/api/v1/notifications/{id}/read` | any authenticated | Mark read |
| GET | `/api/v1/analytics/occupancy` | TENANT_ADMIN, SITE_MANAGER | Occupancy/dwell-time aggregates |
| GET | `/api/v1/analytics/usage` | TENANT_ADMIN | Metered usage (for billing) |
| POST | `/api/v1/chat/messages` | MEMBER, SITE_MANAGER, TENANT_ADMIN | Chatbot query (tool-calling, tenant-scoped) |
| GET | `/api/v1/chat/sessions/{id}` | same | Chat session history |

`Gate` remains today's logical entry/exit point, now `site_id`-scoped and referencing
`Camera` (see `15_Database_Design`); it is not a separate top-level `/api/v1/gates`
resource — gates are addressed via `/api/v1/sites/{siteId}/cameras/{cameraId}` and continue
to use the existing `/api/gates/register`/`/heartbeat` device contract until migrated.

## 4. Pagination, filtering, and the error model

**Pagination**: existing list endpoints follow two informal patterns today — the bare path
(e.g. `GET /api/vehicles`) returns a Spring Data `Page` (paginated, `page`/`size`/`sort`
query params), while a `/list` suffix (e.g. `GET /api/vehicles/list`) returns the full
unpaginated collection — a legacy convenience kept for small admin dropdowns. **New `/api/v1`
endpoints only expose the paginated form** (`page` default `0`, `size` default `20`, max
`100`; `sort=field,asc|desc`, repeatable). Response envelope:
```
{ "content": [...], "page": 0, "size": 20, "totalElements": 137, "totalPages": 7 }
```

**Filtering**: query params matching resource fields (e.g.
`GET /api/v1/parking-events?siteId=...&type=VehicleEntered&from=...&to=...`). Range filters
use `from`/`to` on the primary timestamp field. No generic filter DSL — keep filters explicit
per resource, matching the existing controllers' `search`/`status/{status}`/`type/{type}`
sub-route style rather than introducing a new query language.

**Error model** (`GlobalExceptionHandler`, kept as the standard for both legacy and `/api/v1`):

| Exception | HTTP status | Shape |
|---|---|---|
| `ResourceNotFoundException` | 404 | `{status, message, timestamp}` |
| `MethodArgumentNotValidException` | 400 | `{status, message: "Validation failed", fieldErrors: {field: msg}, timestamp}` |
| `AuthenticationException` | 401 | `{status, message: "Invalid username or password", timestamp}` (deliberately generic — does not reveal account existence) |
| any other `Exception` | 500 | `{status, message: "An unexpected error occurred: ..."}` |

For `/api/v1`, extend this envelope **additively** with an optional machine-readable
`errorCode` field (e.g. `TENANT_NOT_FOUND`, `SLOT_ALREADY_OCCUPIED`) so SaaS frontend/mobile
clients can branch on error type without string-matching `message` — existing clients
ignore the new field, so this is non-breaking per ADR-1401.

## 5. AI ingest endpoint contract

`POST /api/v1/parking-events` (full sequence in `diagrams/ingest-sequence.mmd`):

- **Auth**: `X-Gate-Key` header, one key **per camera** (not the single shared
  `GATE_API_KEY` env var used by today's `/api/gates/register`/`/heartbeat`) — resolved by
  the auth filter to `camera_id` → `site_id` → `tenant_id`, so scope is derived from the key,
  never trusted from the request body. See ADR-1402.
- **Idempotency**: required `eventId` (UUID) + `occurredAt` (ISO-8601), matching the pattern
  the edge already implements today for `check-vehicle`. A unique constraint on
  `ParkingEvent.event_id` makes retries safe — a duplicate returns the original response with
  no side effects re-run.
- **Body**: JSON for events with no image (`MotionDetected`, `VehicleDetected`,
  `PersonDetected`), or `multipart/form-data` with an optional `snapshot` part for events that
  carry evidence (`PlateRecognized`, `VehicleEntered`, `VehicleExited`, `VehicleRelocated`) —
  same JSON-or-multipart duality as today's `check-vehicle` endpoint.
- **Backpressure**: synchronous work is limited to validate → idempotency check → single-TX
  insert (`ParkingEvent` + `outbox_message`); the response returns before the RabbitMQ publish
  happens (async via the outbox relay), so ingest latency never depends on broker health.
  Per-camera-key rate limiting (Redis token bucket) returns `429` + `Retry-After`, which the
  edge's existing exponential-backoff retry already respects.
- **Response**: `202 Accepted { "eventId": "...", "status": "accepted" }` on success/duplicate;
  `4xx` with the standard error envelope on validation/auth failure (never persisted, never
  retried by design — the edge should surface these, not loop on them).

## 6. WebSocket / STOMP topics

Endpoint `/ws` (SockJS) is kept. Broker prefix `/topic`, app prefix `/app` — unchanged.

| Topic | Status | Payload | Notes |
|---|---|---|---|
| `/topic/vehicle-check` | existing | check-vehicle result | Global fan-out, all clients |
| `/topic/gate/{gateId}/check` | existing | check-vehicle result | Per-gate kiosk UI (`/gate/[gateId]`) |
| `/topic/site/{siteId}/slots` | **new** | `{slotId, status, vehicleId?}` | Slot-occupancy delta for the parking-map UI |
| `/topic/tenant/{tenantId}/notifications` | **new** | `Notification` payload | In-app notification center push |

Today's `SimpleBroker` is in-memory and single-instance (`13_Event_Driven_Architecture` §1);
the new topics carry the same scaling constraint until the Redis STOMP relay (brief §3.6)
lands — see that document's cross-reference for the upgrade path.

## 7. Diagrams

- `diagrams/api-resource-map.mmd` — how existing and new `/api/v1` resources relate,
  including which legacy resource each new one evolves/supersedes.
- `diagrams/ingest-sequence.mmd` — edge → auth filter → ingest API → outbox → RabbitMQ.
- `diagrams/auth-versioning.mmd` — request routing through gate-key vs JWT auth, RBAC, tenant
  scoping, and the legacy-vs-`/api/v1` path split.

## 8. Decisions / ADRs

- `adr/ADR-1401-api-versioning-strategy.md` — why `/api/v1` for new resources only, legacy
  `/api` frozen, additive-only evolution within a version.
- `adr/ADR-1402-ingest-idempotency-backpressure.md` — durable idempotency, per-camera keys,
  and async-publish backpressure for the ingest endpoint.

## 9. Open questions / risks

- **Camera-key lifecycle** (issuance, rotation, revocation UI) is referenced by ADR-1402 but
  not designed here — likely belongs in `07_Camera_Management`.
- **Rate-limit defaults** need real multi-tenant traffic data before they can be trusted in
  production.
- **Legacy endpoint deprecation timeline** is unset — `/api/vehicles`, `/api/vehicle-logs`,
  etc. have no sunset date yet; they stay first-class until the SaaS frontend fully replaces
  their call sites.
- **Chat endpoint abuse/cost controls** (rate limits, max tokens, tool-call scope
  enforcement) are out of scope for this document; see the future chatbot-focused doc.

## 10. Cross-references

- `13_Event_Driven_Architecture` — what happens after `/api/v1/parking-events` accepts an
  event: outbox, RabbitMQ, consumers.
- `15_Database_Design` — full schema backing every `/api/v1` resource (Tenant, Site, Zone,
  Camera, ParkingSlot, Vehicle, ParkingEvent, Snapshot, Subscription, Notification).
- `03_SaaS_Architecture`, `04_Multi_Tenant_Design` — tenant/site scoping and RLS enforcement
  that every `/api/v1` endpoint relies on.
- `06_User_RBAC` — full role/permission matrix behind the "Role" column above.
