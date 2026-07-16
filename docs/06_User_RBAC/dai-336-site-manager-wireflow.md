# DAI-336 · Site Manager Wireflow and Implementation Handoff

- Status: Approved UX/design handoff
- Owner: Product + UX
- Security-boundary reviewer: Principal Architect
- Date: 2026-07-16
- Tracking: DAI-336 · Parent: DAI-331
- Inputs: [DAI-332 permission matrix](permission-matrix.md),
  [ADR-0605](adr/ADR-0605-rbac-product-decisions-and-ux-permission-contract.md),
  [DAI-333 IA and interaction standards](ia-interaction-standards.md),
  [Dashboard contract](../17_Dashboard/README.md),
  [DAI-335 Tenant Admin wireflow](dai-335-tenant-admin-wireflow.md)
- Diagrams: [end-to-end wireflow](diagrams/dai-336-site-manager-wireflow.mmd) ·
  [risky-action sequence](diagrams/dai-336-site-manager-risky-action-sequence.mmd)

## 1. Authority, role boundary, and non-goals

`SITE_MANAGER` is an assigned-site operations role. An active site selection narrows work to one
assigned, operationally enabled site; it does not create authority. The DAI-332 matrix remains the
source of truth for route/action/scope. DAI-333 remains the source of truth for shell, selector,
deep-link, state, and responsive behavior.

| Layer | Authority |
|---|---|
| Navigation, selector, URL, breadcrumb, and route guard | UX context only. They cannot authorize a request. |
| Backend role/capability checks | Authoritative action decision. |
| Tenant RLS, site/resource ownership, and [SiteAccess](../../backend/src/main/java/com/vehiclemanagement/security/SiteAccess.java) | Authoritative data boundary. |

### Explicit exclusions

The Site Manager must not discover or access Platform or Member shell work, billing, organization
settings, site CRUD, tenant-wide users, guard provisioning, credential administration, tenant-wide
rollups, or an out-of-assignment site. Direct navigation uses replace-style return to `/dashboard`
with generic unavailable feedback; it does not disclose the prohibited resource.

A Site Manager may inspect and escalate an unresolved event. Escalation is not event resolution,
impersonation, role delegation, a Tenant Admin directory, or a notification-center route.

## 2. Route boundary and selected-site scope

| Surface | Site Manager contract |
|---|---|
| `/dashboard` | Assigned, active selected-site operational dashboard; queues precede KPIs. |
| `/events` | Assigned selected-site event timeline and unresolved-event escalation initiation. |
| `/vehicles/monitoring`, `/vehicles/search`, `/vehicles`, `/vehicles/entry-exit` | Selected-site operations only. Vehicles with no `currentSiteId` remain Tenant Admin-only. |
| `/vehicles/requests` | Selected-site access-request queue; approve/reject only when server-resolved request site is active and assigned. |
| `/parking/maps`, `/parking/cameras`, `/parking/commissioning` | Selected active site, then zone/camera child scope. Commissioning lifecycle remains draft/validate/publish/archive/rollback. |
| `/gate`, `/gate/[gateId]`, `/gate/health` | Matrix-approved assigned-site gate/health/kiosk behavior; server resolves gate site. |
| `/statistics` | Selected-site metrics and export only; never a tenant rollup. |
| `/platform/*`, `/me/*`, `/sites`, `/settings/organization`, `/billing`, `/users`, legacy tenant-wide administration | Not visible and not accessible; generic fallback to `/dashboard`. |

## 3. Login, scope restoration, and assignment states

### 3.1 Login and deep-link sequence

1. An unauthenticated person opening an operational URL goes to login with only a validated relative
   return path retained.
2. After login, refresh identity, account status, canonical role, tenant context, and server-resolved
   `UserSite` assignments before selecting a landing or restoring a deep link.
3. Reauthorize the return route and every supplied `siteId`, `zoneId`, `cameraId`, gate, and resource
   hierarchy. A URL never expands assignment scope.
4. Restore in this order: valid active assigned URL site; authenticated-user-and-tenant-keyed stored
   preference; first active assigned site.
5. Invalid/revoked scope is replaced with a valid active assignment when one exists; feedback is
   generic and does not name inaccessible site/resource data.
6. A site change clears zone, cancels/restarts scoped loads, refreshes realtime subscriptions, and
   replaces browser history. Session expiry stops subscriptions, clears protected content, and requires
   reauthorization/reconfirmation after login.

[DashboardScopeProvider](../../frontend/lib/dashboard-scope-context.tsx),
[dashboard-policy.mjs](../../frontend/lib/dashboard-policy.mjs),
[Topbar](../../frontend/components/layout/topbar.tsx), and
[ProtectedLayout](../../frontend/components/layout/protected-layout.tsx) are current implementation
bases. Global local-storage persistence, URL reconciliation, return-path restoration, and unified
`401` handling are DAI-339 gaps.

### 3.2 No assignment is not a disabled assignment

| Condition | Required UI and request behavior |
|---|---|
| **No site assignment** | Show `Chưa được gán site`. Do not issue site reads, mutations, exports, or realtime subscriptions. Disable dependent actions; provide only non-privileged “Contact a Tenant Admin” recovery guidance. Do not display a selector with tenant sites. |
| **Assigned but disabled site** | Show distinct text such as `Site được phân công hiện đang tạm ngưng`. Keep the assigned-site label, clear protected operational data, stop realtime activity, and disable reads needing an operational site, mutations, approvals, escalation, commissioning, and export. |
| **One active assignment** | Render fixed accessible scope label; no redundant selector. |
| **Multiple active assignments** | Selector lists active assigned sites only. Disabled assignments may be visible as unavailable context but are never selectable operational scope. |
| **Assignment revoked / out-of-scope URL** | Generic unavailable feedback; do not reveal the denied name/ID. Resolve active assignment or no-assignment state. |
| **Active site disabled mid-session** | Cancel in-flight work, clear queues/events, stop subscriptions, preserve no pending mutation, then enter disabled-site state. A new action needs a newly resolved active scope. |

The current `Site`/`SiteDto` API has no operational status and `SiteAccess` validates assignment
membership, not operational availability. DAI-339 must add active/disabled status to scope bootstrap,
server enforcement, and a distinct `SITE_DISABLED` outcome for an assigned disabled site; an
out-of-scope resource remains non-disclosing `404`.

## 4. Required Site Manager journeys

### A. Assigned-site dashboard → operational drilldown

**Entry:** `/dashboard` after active assigned-site resolution.

The dashboard is task-first. It renders the two queues below **before** passive KPIs:

| Queue | Required fields and behavior |
|---|---|
| Pending access requests | Plate/linked vehicle, source, gate, selected site, validity window, request reason, status, evidence, and decision link. Show count and safe handoff to `/vehicles/requests?siteId={selectedSiteId}`. Empty means no pending action, not dashboard failure. |
| Unresolved events | Severity/type, occurrence time, gate/camera/zone, evidence state, current event state, and correlation ID. It supports inspect and escalate, not unapproved resolution/configuration control. Empty means no unresolved event. |

Only after these queues, render occupancy, available slots, entry/exit volume, vehicles, camera/map
health, event summaries, and source freshness. Apply ADR-1703: REST bootstrap, subscription,
reconciliation after subscription, polling fallback, and truthful `Live`, `Reconnecting`, `Polling`,
or `Updated <time>` status. Never show stale data as live.

Safe selected-site drilldowns include events, vehicle monitoring/search/entry-exit, gates, parking
maps/cameras/commissioning, statistics, and export. Every target revalidates its scope before rendering.

### B. Access request review → approve or reject

**Route:** `/vehicles/requests?siteId={selectedSiteId}`.

1. Show selected-site `PENDING` work first; history is separately filterable.
2. Detail has plate/vehicle, source/requester/gate-detected label, site/gate, timestamp, validity
   window, request reason, status, approver, rejection reason, evidence, and returned
   audit/correlation reference when available.
3. **Approve:** confirmation names request, selected site, and effect; submit is pending-locked.
4. **Reject:** confirmation requires nonblank reason both before submit and server-side.
5. A request no longer pending is a stale/conflict outcome: refresh authoritative data rather than
   issue another decision.
6. Show inline success only after returned decision outcome and durable audit/correlation reference;
   toast is supplementary. Preserve safe reason/context for recoverable failure.

The selected site must not be trusted from query/UI input. DAI-339 must make the server resolve
request-site ownership, active status, assignment, pending state, and audit outcome atomically.

### C. Unresolved events → escalation to Tenant Admin

This is a required target flow, but an escalation resource is not implemented yet. Release requires a
DAI-332 matrix/API-policy row in the same change that introduces it.

1. From an unresolved selected-site event, open a read-only event context.
2. Show target event, selected site, severity/type, evidence availability, correlation ID, current
   state, and escalation impact.
3. Require a nonblank escalation reason; an optional note is safe only if it does not expose
   out-of-scope data.
4. Confirm and lock duplicate submission with idempotency context.
5. Server verifies Site Manager role, active assigned site, source/event site ownership, and source
   escalation eligibility. It selects active Tenant Admin recipients without exposing a user directory.
6. Server persists escalation plus append-only tenant/site operational audit in one transaction and
   performs delivery via approved outbox/handoff infrastructure.
7. Return `escalationId`, status/outcome, `auditReference`, `correlationId`, and timestamp. Show the
   inline durable result only after this response.

**DAI-339 target endpoint:** `POST /api/v1/sites/{siteId}/operational-escalations` with `sourceType`,
`sourceId`, `category`, mandatory `reason`, optional safe note, and idempotency context. Audit failure
fails the escalation transaction. It does not open `/users`, change recipient roles, or guarantee an
inbox route exists.

### D. Vehicles, entry/exit, gates, statistics, and export

- Vehicle monitoring/search/list and entry/exit review are selected-site only. A vehicle with no
  current site remains Tenant Admin-only; do not render it as a manager-visible unscoped row.
- Gate/health/kiosk resolves gate site server-side. A selected gate cannot cross active assignment.
- `/statistics?siteId={selectedSiteId}` is selected-site metrics only; no tenant aggregation is
  available to this role.
- An export review must show selected site, date/filter range, requested fields/format, expected
  scope, and effect. It is audit-before-delivery: the server records actor, site, export type,
  filter/safe filter hash, record count, format, outcome, correlation ID, and audit reference before
  artifact release. No audit reference means no download success claim.

Current vehicle/log exports are insufficient as a Site Manager contract: vehicle export is tenant-wide;
vehicle-log export lacks a `siteId`, may return union-assignment data, and returns no operational audit
outcome. DAI-339 must add a selected-site export request/response API instead of reusing an unaudited
`GET` download.

### E. Site commissioning

**Route:** `/parking/commissioning?siteId={selectedSiteId}&cameraId={selectedCameraId}`.

Resolve selected active site, overview camera, optional zone, source image, calibration, map version,
and lock version. The Site Manager may use this lifecycle within assignment; DAI-341/342 own detailed
camera enrollment and map-editor design.

| State / action | Required behavior |
|---|---|
| Draft | Draft only is editable; use current source image and valid calibration. |
| Published | Read-only preview/export/archive context; no direct edit/save control. |
| New work | From published, create separate draft then validate and publish; never mutate published geometry. |
| Validate | Show all server validation results: calibration, polygon, code uniqueness, coverage, zone/camera ownership, overlap, partition conflicts. |
| Publish | Successful validation, confirmation of site/camera/draft/version/effect, `If-Match`, idempotency, pending lock, and returned audit outcome. |
| Archive/delete | Confirm material action; preserve prior state on conflict/failure; returned audit outcome. |
| Rollback | Valid archived candidate only; confirmation plus nonblank reason, revalidation, lock handling, and audit result. |

[ParkingMapContractService](../../backend/src/main/java/com/vehiclemanagement/parking/ParkingMapContractService.java)
already applies site checks, drafts-only update, validation, optimistic locking, idempotency, and
rollback reason. DAI-339 owns operational audit outcome/reference and shared confirmation feedback.

## 5. Shared state and accessibility matrix

| State | Required behavior |
|---|---|
| Scope loading | Preserve stable shell; announce loading; make no scoped request before active scope resolution. |
| No assignment | Use no-assignment state; no operational request, subscription, mutation, escalation, or export. |
| Disabled assignment | Use distinct disabled-site state; active assignments only selectable; stop protected work. |
| One / many active sites | Fixed accessible label for one; selector for many. |
| Invalid/revoked scope | Generic fallback to active assignment/no-assignment; no denied resource disclosure. |
| Empty queues | Distinguish no pending request from no unresolved event and from failed load. |
| Partial/full error | Preserve safe successful panels, mark failed source, offer local retry; do not imply complete data. |
| Forbidden/non-disclosing `404` | Treat as unavailable; replace to safe parent/landing without disclosure. |
| Offline/polling/reconnecting/stale | Label state accurately; show cached data only with freshness label; no false live state. |
| Session expiry | Stop subscriptions, clear protected work, validated return path only, reauthorize/reconfirm after login. |
| Mutation failure | Prior server state remains authoritative; preserve safe dialog context; no success toast without audit result. |
| Responsive/accessibility | Keep scope label visible; table-to-card alternative; keyboard selector/dialog flow; focus return; non-color status; `aria-live` announcements. |

## 6. Risk, confirmation, and audit contract

| Action | Scope | Confirmation / reason | Pending and server rule | Durable result |
|---|---|---|---|---|
| Approve request | Active selected site | Confirmation; no normal reason | Lock submit; server checks request site/status/assignment | Decision + audit/correlation reference |
| Reject request | Active selected site | Confirmation + required reason | Reject blank/stale request; preserve reason on failure | Decision/reason + audit/correlation reference |
| Escalate unresolved event | Active selected site | Confirmation + required reason | Idempotency; source/event/assignment eligibility; audit failure rolls back | Escalation ID/status + audit/correlation reference |
| Publish map | Active site/camera | Confirmation after valid server validation | `If-Match`, idempotency, duplicate lock | Version/outcome + audit reference |
| Archive/delete map | Active site/camera | Material-action confirmation; reason per policy | Preserve state on conflict/failure | Action/outcome + audit reference |
| Rollback map | Active site/camera | Confirmation + required reason | Archived valid candidate, revalidate, lock conflict | Version/reason/outcome + audit reference |
| Selected-site export | Active selected site | Scope/effect review | Audit before artifact; no artifact if audit fails | Export ID/outcome + audit/correlation reference |

Dialog behavior specifies target, current scope, impact, reason rule, cancel path, pending lock, failure
recovery, and focus return. `useToast` is transient feedback, never audit proof.

## 7. DAI-339 route/action handoff register

| Screen / action | Route / API family | Permission | Scope | Confirmation / reason | Audit outcome | Existing foundation | Contract gap |
|---|---|---|---|---|---|---|---|
| Site Dashboard | `/dashboard`; dashboard APIs | M | Active selected site/zone | None | N/A | Scope/data contexts | Queue-first priority, disabled-site status, stale/recovery |
| Access queue | `/vehicles/requests`; access API | M | Active selected site | Approve confirm; reject reason | Decision/audit/correlation | VehicleRequestsPage | Server scope/status/pending enforcement and returned outcome |
| Unresolved events | `/events`; event API | M | Active selected site/zone/camera | Escalation reason | Escalation/audit/correlation | Dashboard event data | Event state/escalation API, recipient/outbox/audit contract |
| Vehicle/log review | Monitoring/search/entry-exit APIs | M | Active selected site | Per material action | As applicable | Existing vehicle pages | Current-site enforcement and unscoped vehicle exclusion |
| Gate operation/health | Gate APIs | M | Active selected gate site | Per risky action | As applicable | Gate pages | Gate active-site enforcement/outcome behavior |
| Commissioning draft | Parking map APIs | M | Active site/camera/zone | Draft material action | Version/provenance | Contract service | Shared confirmation/audit outcome UI |
| Commissioning publish/rollback | Publish/rollback APIs | M | Active site/camera | Publish confirm; rollback reason | Version/outcome/reference | Contract service | Operational audit response/feedback |
| Site statistics | `/statistics`; analytics API | M | Active selected site | None | N/A | Statistics view | No tenant rollup and server site parameter contract |
| Export | Future selected-site export request | M | Active selected site | Scope/effect review | Export/audit/correlation | Export controls | New audit-before-delivery, selected-site API |
| Escalation | Future `/operational-escalations` API | M | Active selected site/source | Required reason | Escalation/audit/correlation | Event/realtime models | New matrix policy, API, audit/outbox/recipient contract |

## 8. Runtime gaps and DAI-340 validation handoff

| Area | Current limitation | Downstream ownership |
|---|---|---|
| Login/scope URL | No safe return-path, user/tenant-keyed persistence, or complete URL reconciliation. | DAI-339 implementation; DAI-340 direct-link/expiry tests. |
| Disabled sites | No site operational status in `SiteDto` or `SiteAccess`. | DAI-339 data/enforcement/UI; DAI-340 disabled-site tests. |
| Access decisions | Current queue/decision contract lacks selected-site server scope, stale conflict, and audit result. | DAI-339; DAI-340 same/cross-site and audit rollback tests. |
| Escalation | No Site Manager-to-Tenant Admin escalation resource/policy/audit/outbox. | DAI-339 plus required DAI-332 policy update; DAI-340 recipient/privacy/idempotency tests. |
| Export | Current export paths are not selected-site/audited outcomes. | DAI-339; DAI-340 scope/audit-before-delivery tests. |
| Commissioning feedback | Core draft/lock/validation/rollback semantics exist, audit results do not. | DAI-339; DAI-340 lifecycle/audit tests. |
| Realtime | Explicit stale state and scope-change subscription reset incomplete. | DAI-339; DAI-340 degraded-state tests. |
| Tenant/site operational audit | Platform audit cannot evidence Site Manager actions. | DAI-339 creates append-only tenant/site audit; DAI-340 verifies immutability/outcomes. |

DAI-340 validates no/disabled/one/many assignment handling, direct-link and cross-site denial,
selected-site export, request decisions, escalation, draft-only commissioning, stale/offline/expiry,
keyboard focus, `aria-live`, responsive behavior, and forbidden tenant-wide navigation.

## 9. Acceptance checklist

- [ ] Manager cannot view, select, query, mutate, subscribe to, escalate from, or export data outside active `UserSite` assignment.
- [ ] No assignment and disabled assignment have different labels, request behavior, actions, and recovery paths.
- [ ] Billing, organization, site CRUD, and tenant-wide users never appear in Site Manager IA.
- [ ] Pending requests and unresolved events appear before passive KPIs.
- [ ] Approval, rejection, and escalation have inline outcome feedback and audit/correlation reference.
- [ ] Commissioning only edits drafts; published versions are read-only and rollback is reasoned.
- [ ] No documentation claim extends the DAI-332 policy or presents a DAI-339 gap as shipped behavior.
