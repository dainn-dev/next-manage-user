# 17 · Dashboard

The web admin/operator dashboard is ParkVision's primary operational surface: today it manages a
single site's gate-access workflow; the target extends it into a multi-tenant, multi-site
operations console with live camera and parking-map views, real-time occupancy, analytics, and
tenant/billing administration.

Status: Draft · Owner: Principal Architect · Last updated: 2026-07-09

## 1. Current state vs. Target

**Current state** (`frontend/`):
- **Next.js 14.2.16, App Router**, React 18, TypeScript, pnpm, `output: 'standalone'`.
- **Tailwind CSS v4 + shadcn/ui** (new-york style, Radix primitives), lucide icons, **recharts** for
  charts, react-hook-form + zod for forms, next-themes, sonner for toasts.
- **No react-query/SWR/axios** — data access is native `fetch` wrapped in hand-rolled API clients in
  `lib/api/`; React Context provides cross-cutting state.
- **Auth:** JWT in `localStorage` (`auth_token`) and client-side `ProtectedLayout` routing. Backend
  authorization, tenant RLS, and assigned-site validation remain authoritative.
- **Shells and routes:** Platform, Tenant Operations, and Member routes already exist; DAI-333 and
  the DAI-332 permission matrix are the current route inventory and navigation authority.
- **Scope:** `DashboardScopeProvider` + `Topbar` load permitted sites and zones; their current
  selector behavior is an implementation baseline, not the final UX contract.
- **Realtime:** STOMP/SockJS plus REST polling fallback through `use-dashboard-realtime` and the
  dashboard data context. Explicit stale/reconciliation behavior remains a DAI-339 gap.
- **Operational surfaces:** dashboard, event, camera, parking-map, search, and commissioning pages
  exist; their visibility and mutation boundaries are defined by the DAI-332 matrix.

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

The current, route-complete three-shell sitemap is the
[DAI-333 IA and interaction standards](../06_User_RBAC/ia-interaction-standards.md), derived from
the [DAI-332 permission matrix](../06_User_RBAC/permission-matrix.md). It is authoritative for
shell ownership, navigation, breadcrumbs, deep links, scope selector behavior, and responsive rules.

This document retains the dashboard architecture and realtime strategy; it does not define another
route tree. In particular:

- `/dashboard` is the Tenant Operations landing for Tenant Admin, Site Manager, and Security Guard;
  `/employees` is a legacy administrative destination, not a default landing.
- `/platform/*` and `/me/*` are separate Platform and Member shells, not dashboard routes.
- `/gate/[gateId]` is a full-screen Tenant Operations kiosk sub-mode.
- `/notifications`, `/admin/*`, `/sites/{siteId}/map`, `/sites/{siteId}/cameras`, and `/analytics`
  are historical/future proposals unless and until they have an implemented route and a DAI-332
  permission-matrix row. They must not appear as current navigable IA.
- `/departments`, `/positions`, and `/employees` remain legacy Tenant Admin-only destinations until
  DAI-339 brings browser-route and backend-policy conformance.

## 4. Role-based navigation

The five canonical roles and each implemented route's visibility, browser fallback, API policy, and
data scope are defined by the [DAI-332 permission matrix](../06_User_RBAC/permission-matrix.md).
The three-shell UX behavior is defined by
[DAI-333](../06_User_RBAC/ia-interaction-standards.md).

| Role | Dashboard relationship |
|---|---|
| `PLATFORM_ADMIN` | Uses Platform only; no implicit Tenant Operations data access. |
| `TENANT_ADMIN` | Tenant Operations dashboard across the validated tenant's sites. |
| `SITE_MANAGER` | Tenant Operations dashboard for assigned sites only. |
| `SECURITY_GUARD` | Assigned-site operational dashboard read; no configuration, approval, or vehicle/registration CRUD. |
| `MEMBER` | Uses the separate mobile-first Member shell, not the operator dashboard. |

Navigation hides unavailable items and browser guards prevent wrong-shell content flash. Neither is
backend authorization: server role checks, tenant RLS, and assigned-site validation remain authoritative.

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

- `diagrams/sitemap-ia.mmd` — historical dashboard sitemap draft; the current three-shell sitemap is DAI-333.
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
- `adr/ADR-1703-dashboard-rbac-realtime-contracts.md` — accepted MVP contract for role visibility,
  tenant/site/zone/camera/slot scoping, STOMP with polling fallback, REST/event payloads, and the
  backend gaps that block Stage 5.
- [`../06_User_RBAC/ia-interaction-standards.md`](../06_User_RBAC/ia-interaction-standards.md) —
  current three-shell IA, interaction, state, deep-link, and responsive contract (DAI-333).

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
- `SECURITY_GUARD` now exists in backend/frontend role handling, but its approved read-only
  dashboard boundary, manual-override flow, audit trail, route enforcement, and realtime stale state
  still require the DAI-337/DAI-339/DAI-340 follow-up described by DAI-333.

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
