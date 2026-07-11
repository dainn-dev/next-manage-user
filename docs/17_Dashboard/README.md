# 17 · Dashboard

The web admin/operator dashboard is ParkVision's primary operational surface: today it manages a
single site's gate-access workflow; the target extends it into a multi-tenant, multi-site
operations console with live camera and parking-map views, real-time occupancy, analytics, and
tenant/billing administration.

Status: Draft · Owner: Principal Architect · Last updated: 2026-07-09

## 1. Current state vs. Target

**Current state** (`frontend/`, per §1 of the shared brief):
- **Next.js 14.2.16, App Router**, React 18, TypeScript, pnpm, `output: 'standalone'`.
- **Tailwind CSS v4 + shadcn/ui** (new-york style, Radix primitives), lucide icons, **recharts** for
  charts, react-hook-form + zod for forms, next-themes, sonner for toasts.
- **No react-query/SWR/axios** — data access is native `fetch` wrapped in hand-rolled class API
  clients in `lib/api/` (`auth-api.ts`, `vehicle-api.ts`, `gate-api.ts`, `employee-api.ts`,
  `department-api.ts`, `position-api.ts`, `user-api.ts`, `access-request-api.ts`,
  `vehicle-log-api.ts`, `vehicle-statistics-api.ts`).
- **No global store** — React Context only.
- **Auth:** JWT in `localStorage` (`auth_token`), `Authorization: Bearer` header, client-side expiry
  decode. **No `middleware.ts`** — route protection is client-side via `ProtectedLayout` redirecting
  to `/login`.
- **Realtime:** STOMP over SockJS (`@stomp/stompjs`), hook `hooks/use-websocket.ts`.
- **Existing routes:** `/login`, `/employees` (default landing), `/users`, `/departments`,
  `/positions`, `/vehicles`, `/vehicles/monitoring` (live feed), `/vehicles/entry-exit`,
  `/vehicles/requests`, `/gate` (registry), `/gate/[gateId]` (full-screen kiosk with Web Speech TTS
  vi-VN), `/gate/health`, `/statistics`.
- **No map component and no camera/video component exist today** — `Gate.cameraRtspUrl` is data-only
  (stored, not rendered).

**Target** additions layered on this same stack (no framework rewrite, per §3.1 "evolve, don't
rewrite"): multi-site switcher, Live Camera view, Parking Map view, real-time slot occupancy,
vehicle search, event timeline, analytics widgets, notifications center, tenant/site admin screens,
billing screens.

## 2. Target feature additions

| Area | Description | Links to |
|---|---|---|
| Multi-site switcher | Global site/tenant context selector in the shell nav; scopes every subsequent view's queries by `siteId` | `04_Multi_Tenant_Design` |
| Live Camera view | Renders a site's cameras (HLS/WebRTC, MJPEG fallback via a media gateway) | `07_Camera_Management` |
| Parking Map view | SVG overlay of `ParkingSlot` polygons over the calibrated site image, colored by occupancy | `08_Parking_Map_Designer` |
| Real-time slot occupancy | Slot color updates live as `VehicleEntered`/`VehicleRelocated`/`VehicleExited` events arrive | this doc, `diagrams/realtime-update-sequence.mmd` |
| Vehicle search | Cross-site (within tenant) plate/owner search | extends existing `/vehicles` |
| Event timeline | Chronological feed of the 9 domain events (`MotionDetected` … `NotificationSent`) per site/vehicle | `10_Event_Bus` (if present) |
| Analytics widgets | recharts-based dashboards (occupancy trends, peak hours, dwell time) | `20_Analytics` |
| Notifications center | In-dashboard inbox for `Notification` rows (push/email/ws channels) | `19_Notifications` |
| Tenant/site admin | CRUD for `Tenant`, `Site`, `Zone`, `Camera`, `Gate` | `04_Multi_Tenant_Design` |
| Billing screens | Plan/subscription status, usage against entitlements | `05_Subscription_Billing` |

## 3. Information architecture

Route tree, existing routes unchanged, new routes added under the same shell (see
`diagrams/sitemap-ia.mmd`):

```
/login
/{shell: site switcher + role-based nav}
  /employees, /users, /departments, /positions          (existing — workforce module, §4)
  /vehicles, /vehicles/monitoring, /vehicles/entry-exit,
  /vehicles/requests                                     (existing)
  /gate, /gate/[gateId], /gate/health                    (existing)
  /statistics                                             (existing)
  /sites/{siteId}/map                                     (target — Parking Map view)
  /sites/{siteId}/cameras                                 (target — Live Camera view)
  /vehicles/search                                        (target)
  /events                                                 (target — event timeline)
  /analytics                                              (target — 20_Analytics)
  /notifications                                          (target — 19_Notifications)
  /admin/tenant, /admin/sites, /admin/roles, /admin/billing (target)
```

`/employees` remains a sensible default landing route only for tenants using the workforce module
(§4 "keep existing Employee/Department/Position as an optional workforce module"); multi-site
tenants without that module should land on a new operations overview (out of scope to fully design
here — flag as an open question, §8).

## 4. Role-based navigation

Nav visibility is driven by the JWT `role` claim, per the target role set (§3.9 of the shared
brief, detailed in `06_User_RBAC`):

| Role | Sees |
|---|---|
| `PLATFORM_ADMIN` | Cross-tenant admin (out of the per-tenant dashboard; separate platform console, out of scope here) |
| `TENANT_ADMIN` | Everything below + `/admin/tenant`, `/admin/billing`, `/admin/roles` — site ops, map, cameras, monitoring, statistics, approvals (legacy APPROVER / SITE_MANAGER / SECURITY_GUARD duties fold here) |
| `MEMBER` | Own-vehicle views, requests, chatbot (`16_AI_Chatbot`) — a subset closer to the mobile app's scope than the operator dashboard |

This is additive to today's URL + `@PreAuthorize` pattern on the backend (§1) — the dashboard nav
only *hides* unauthorized items; the backend remains the enforcement point.

## 5. Realtime data strategy

Today: STOMP over SockJS, in-memory `SimpleBroker`, topics `/topic/vehicle-check` and
`/topic/gate/{gateId}/check`, with `GET /api/gates/{id}/recent-checks` covering missed-event replay
on reconnect (§1). This pattern is **kept and extended**, not replaced:

- New topics: `/topic/site/{siteId}/slots` (occupancy changes), `/topic/site/{siteId}/events`
  (timeline feed), `/topic/user/{userId}` (notifications).
- **Scale-out:** today's in-memory broker only fans out within one backend instance. Target adds
  **Redis pub/sub as a STOMP relay** (§3.6) so multiple backend instances share fan-out — required
  once the dashboard runs behind more than one backend replica (K8s HPA, §3.14).
  See `diagrams/realtime-update-sequence.mmd` for the full path: edge → ingest API → outbox →
  RabbitMQ → parking module → Redis pub/sub → STOMP → UI.
- **Reconnect/replay** follows the existing pattern: on reconnect, the Parking Map view calls
  `GET /api/v1/sites/{siteId}/parking-status` once to resync full state, then resumes incremental
  STOMP updates — mirroring how `recent-checks` backstops today's gate monitoring.

## 6. State management approach

Kept as-is for now: native `fetch` wrapped in `lib/api/` clients, React Context for cross-cutting
client state (auth, current tenant/site, theme). New views add new `lib/api/` clients following the
existing naming convention (`site-api.ts`, `parking-slot-api.ts`, `camera-api.ts`,
`notification-api.ts`, `analytics-api.ts`). See `adr/ADR-1701-fetch-context-vs-react-query.md` for
the explicit criteria under which the team should adopt **react-query** instead — this is not a
permanent decision, it is a "not yet, here's the trigger" decision.

## 7. Diagrams

- `diagrams/sitemap-ia.mmd` — full route tree, existing routes vs. target additions (color-coded).
- `diagrams/dashboard-component-architecture.mmd` — component view: shell, site switcher,
  role-based nav, feature views, data layer (`lib/api/` clients, Context, `use-websocket` hook),
  backend REST + STOMP, and the target Redis relay.
- `diagrams/realtime-update-sequence.mmd` — a slot-occupancy change from edge ingest through the
  outbox/event-bus/Redis relay to the Parking Map view updating in place.

## 8. Decisions / ADRs

- `adr/ADR-1701-fetch-context-vs-react-query.md` — keep native fetch + Context for the first wave
  of additions; explicit triggers for adopting react-query.
- `adr/ADR-1702-parking-map-render-approach.md` — SVG overlay driven by the `08_Parking_Map_Designer`
  polygon data, vs. Canvas or a geo-mapping library.

## 9. Open questions / risks

- What does a non-workforce-module tenant land on by default, if not `/employees`? Needs an
  operations-overview design, not specified here.
- Live Camera view's media gateway (HLS/WebRTC transcoding from RTSP) is a new backend/infra
  component not detailed in this doc — owned by `07_Camera_Management`.
- Redis STOMP relay introduces a new infra dependency and a cutover step (today's in-memory
  `SimpleBroker` has no persistence/relay); needs a migration plan, not just a target-state diagram.
- Analytics widget data volume/query patterns aren't yet defined — likely the first concrete trigger
  for the react-query adoption threshold in ADR-1701.
- Notifications center UX (read/unread, grouping, do-not-disturb) is scoped to `19_Notifications`,
  not detailed here beyond the inbox route.

## 10. Cross-references

- `04_Multi_Tenant_Design` — tenant/site model backing the multi-site switcher and admin screens.
- `05_Subscription_Billing` — billing screens, plan/usage display.
- `06_User_RBAC` — role definitions behind role-based navigation.
- `07_Camera_Management` — Live Camera view's data source and media gateway.
- `08_Parking_Map_Designer` — source of the polygon data the Parking Map view renders.
- `16_AI_Chatbot` — chat widget embedded in the dashboard shell.
- `18_Mobile_App` — shares the same REST API surface for overlapping features (find-my-car, alerts).
- `19_Notifications` — notifications center backing service.
- `20_Analytics` — analytics widgets' data source.
