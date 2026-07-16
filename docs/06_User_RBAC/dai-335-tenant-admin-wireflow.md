# DAI-335 · Tenant Admin Wireflow and Implementation Handoff

- Status: Approved UX/design handoff
- Owner: Product + UX
- Security-boundary reviewer: Principal Architect
- Date: 2026-07-16
- Tracking: DAI-335 · Parent: DAI-331
- Inputs: [DAI-332 permission matrix](permission-matrix.md),
  [ADR-0605](adr/ADR-0605-rbac-product-decisions-and-ux-permission-contract.md),
  [DAI-333 IA and interaction standards](ia-interaction-standards.md),
  [Parking Map Designer](../08_Parking_Map_Designer/README.md),
  [Subscription and Billing](../05_Subscription_Billing/README.md)
- Diagrams: [end-to-end wireflow](diagrams/dai-335-tenant-admin-wireflow.mmd) ·
  [risky-action sequence](diagrams/dai-335-tenant-admin-risky-action-sequence.mmd)

## 1. Authority, role boundary, and non-goals

This document applies the approved Tenant Operations contract to `TENANT_ADMIN`: tenant-wide
administration plus intentionally narrowed selected-site operations. It does not change the
DAI-332 permission matrix or add a new role/API authority.

| Layer | Authority |
|---|---|
| UI visibility, selector, URL, breadcrumbs, and drilldown links | UX context only. They cannot grant data access. |
| Frontend route guard | Wrong-shell/content-flash prevention only. |
| Backend authorization | Authoritative role/capability decision. |
| Tenant/site/ownership scope | Tenant RLS, resource ownership, and server-side [SiteAccess](../../backend/src/main/java/com/vehiclemanagement/security/SiteAccess.java) validation are authoritative. |

### Non-goals

- No Platform control-plane action, no Member self-service action, and no Security Guard
  configuration authority.
- No new tenant `/audit` route; a future billing audit is an embedded `/billing` panel only after a
  tenant-scoped read contract is approved.
- No runtime route, API, database, Flyway, or authorization change in DAI-335.
- No direct editing of published commissioning configuration.
- No DAI-341 Camera/Gate enrollment design or DAI-342 geometry-editor design beyond their required
  handoff points.

## 2. Tenant-wide versus selected-site scope

A Tenant Admin is authorized across the validated tenant. The active site/zone is an operational
narrowing of what this person can view and act on; it is not an authorization grant and must never
be silently reused as a global-administration filter.

### 2.1 Mandatory visible scope label

| Context | Routes | Required label and behavior |
|---|---|---|
| **Tenant-wide** | `/settings/organization`, `/sites`, `/users`, `/billing` | Show “Tenant-wide” with tenant identity. Retain the current operational site for safe return, but do not filter global data/actions by it. |
| **Selected site** | `/dashboard`, `/events`, `/vehicles/monitoring`, `/vehicles/search`, `/vehicles/entry-exit`, `/vehicles/requests`, `/parking/maps`, `/parking/cameras`, `/parking/commissioning` | Show selected site. A zone and camera are subordinate scope. Operational lists, queues, and mutations consume this selected scope. |
| **Kiosk** | `/gate/[gateId]` | Gate site is server-resolved and locked. Tenant Admin can enter it only through the matrix-approved route; no selector changes scope inside kiosk mode. |

### 2.2 Selector and direct-link contract

Use [DashboardScopeProvider](../../frontend/lib/dashboard-scope-context.tsx),
[dashboard-policy.mjs](../../frontend/lib/dashboard-policy.mjs), and
[Topbar](../../frontend/components/layout/topbar.tsx) as implementation foundations, following
DAI-333 rather than treating their current behavior as the final contract.

1. Resolve authenticated identity and permitted sites before site-scoped fetches/mutations.
2. A valid URL `siteId` and subordinate `zoneId` wins over stored preference. A stored preference is
   fallback only and must be keyed by authenticated user and tenant.
3. Zero sites: show `Chưa được gán site`, issue no scoped request/mutation, disable operational
   actions, and offer only non-privileged recovery guidance.
4. One site: render an accessible fixed scope label rather than a redundant selector.
5. Many sites: render an explicit selector; only server-authorized sites appear.
6. Invalid or revoked URL/stored scope falls back to an authorized site and gives generic feedback
   without naming a denied resource.
7. A site change clears zone, cancels/restarts scoped loads, refreshes realtime subscriptions, and
   replaces—rather than appends—browser history.
8. Tenant-wide routes keep but do not consume the selected operational scope. Returning to operations
   restores/revalidates it.

Current persistence, URL synchronization, request cancellation, and subscription-refresh gaps remain
DAI-339 work. The selected-site query convention below is the required target handoff:

| Drilldown | Target route handoff |
|---|---|
| Events | `/events?siteId={selectedSiteId}&zoneId={selectedZoneId}` |
| Monitoring | `/vehicles/monitoring?siteId={selectedSiteId}` |
| Entry / exit | `/vehicles/entry-exit?siteId={selectedSiteId}` |
| Access requests | `/vehicles/requests?siteId={selectedSiteId}` |
| Parking maps | `/parking/maps?siteId={selectedSiteId}` |
| Cameras | `/parking/cameras?siteId={selectedSiteId}` |
| Commissioning | `/parking/commissioning?siteId={selectedSiteId}&cameraId={selectedCameraId}` |

## 3. Required journeys

### A. Tenant dashboard → selected site → operational drilldown

**Entry:** Tenant Admin lands at `/dashboard` after login or a safe wrong-shell/direct-link fallback.

1. Resolve tenant identity, authorized sites, current selected `siteId`, and optional `zoneId`.
2. Render the **actionable work queue before passive KPIs**. The primary queue is selected-site
   `PENDING` access requests, with count and a safe link to the full scoped queue.
3. Render operational snapshot after the queue: occupancy/available slots, entries, exits, unique
   vehicles, dwell, camera/map/event summary, connection state, and `last updated` state.
4. Drill down using the scope handoffs in section 2.2. A global route does not inherit the site as a
   data filter.

#### Queue-first dashboard contract

| Surface | Required content | Behavior |
|---|---|---|
| Pending work | Request time, plate/linked vehicle, requester or gate-origin source, site, gate, validity window, request reason, status, and decision link. | Visible before KPIs. Empty means “No pending actions,” not a dashboard failure. |
| KPI/support cards | Occupancy, availability, entries, exits, unique vehicles, dwell, camera/map/event summaries. | Supporting context only; clearly show unavailable/stale/polling state. |
| Scope header | Selected site and zone, freshness/realtime state. | Changing site clears zone and resets scoped data. |
| Drilldowns | Events, monitoring, entry/exit, requests, maps, cameras, commissioning. | Carry valid selected scope; target revalidates it before rendering. |

### B. Organization → Sites → Users, roles, and site assignment

This is a **Tenant-wide** administration path. The header visibly says Tenant-wide even while a
selected site is retained for a later return to operations.

#### Organization — `/settings/organization`

Show name, slug, tenant lifecycle status, current plan, actual site count, declared `areaCount`, and
management model. Explain that `areaCount` is planning intent: it does not create sites or override
billing entitlement. Material profile updates use server-confirmed durable audit feedback when the
runtime outcome contract exists; no success toast alone proves the audit outcome.

#### Sites — `/sites`

| List field | Required behavior |
|---|---|
| Name, location, created time, updated time | Tenant-wide inventory, never selected-site filtered. |
| Create | Validate input; submitted site becomes assignable only after server success and inventory refresh. |
| Edit | Confirm material impact where policy requires; preserve prior server state on failure. |
| Delete | Confirmation states target/scope/impact; require reason when policy requires; lock duplicate submit; show returned audit outcome. |

#### Users — `/users`

The directory must show identity (name, username, email), canonical role, assignment scope, assigned
site names or `Tenant-wide`, account status, last login, created/updated time, and contextual action.
Frontend aliases remain presentation-only: `ADMIN` represents canonical `TENANT_ADMIN`.

| Role | Assignment contract |
|---|---|
| `PLATFORM_ADMIN` | Never offered, created, or assigned through tenant administration. |
| `TENANT_ADMIN` | Tenant-wide; no `siteIds`; assignment controls are hidden/cleared. |
| `SITE_MANAGER` | Requires one or more distinct current-tenant sites. Empty, unknown, duplicate, or cross-tenant assignment is invalid. |
| `SECURITY_GUARD` | Requires one or more distinct current-tenant sites. It remains operationally restricted; assignment does not grant configuration or approval authority. |
| `MEMBER` | Consumer identity. Affiliation is not an operational site assignment and must not populate `siteIds`. |

[UserService.replaceSiteAssignments](../../backend/src/main/java/com/vehiclemanagement/service/UserService.java)
is the current server-side base: it rejects Platform Admin through tenant APIs, requires sites for
site-scoped roles, deduplicates site IDs, and verifies sites exist. The future UI/API must validate
the full proposed role-and-sites configuration atomically before saving.

Role/site removal, role change, user deactivation, and deletion use one review flow: show old/new
role and assignments, target and tenant-wide scope, impact, confirmation, required reason where
policy applies, pending lock, returned audit outcome, failure recovery, and focus return. Do not use
row or bulk role shortcuts that bypass this full assignment validation.

### C. Access request → review → approve or reject

**Route:** `/vehicles/requests?siteId={selectedSiteId}`. The server owns final request-site scope;
a selected query parameter or hidden action does not authorize a decision.

1. Display selected-site `PENDING` records before resolved history. Approved, rejected, and cancelled
   records are separately filterable.
2. Show list/detail fields: plate or linked vehicle, source/requester/gate-detected label, selected
   site, gate, timestamp, valid-from/to window, request reason, status, approver, rejection reason,
   evidence snapshot, and audit/correlation reference when returned.
3. **Approve:** a decision confirmation names request, selected site, effect, and pending state.
4. **Reject:** a reason-required decision dialog rejects blank input locally and server-side.
5. Lock duplicate submission. A no-longer-pending request is a stale/conflict result: refresh it
   instead of making a second decision.
6. Render success only after authoritative response and durable audit/correlation outcome. Preserve
   dialog/reason on recoverable failure; never use a toast as proof.

[VehicleRequestsPage](../../frontend/app/vehicles/requests/page.tsx) and its reject dialog are the
current `ApprovalQueue`/`DecisionDialog` foundation. DAI-339 must add selected-site filtering and
server-side request-site enforcement before this target contract is considered shipped.

### D. Commissioning: draft → validate → publish → rollback

**Route:** `/parking/commissioning?siteId={selectedSiteId}&cameraId={selectedCameraId}`.

Required context is selected site, overview camera, optional zone, source image, calibration version,
draft/map version, lock version, and current map status. DAI-341 owns camera/gate enrollment; DAI-342
owns detailed map/slot drawing. This flow owns their Tenant Admin lifecycle handoff.

| State / action | Required behavior |
|---|---|
| History | Show version, `DRAFT` / `PUBLISHED` / `ARCHIVED` status, slot count, lock version, timestamp, actor if returned, and permitted actions. |
| Draft edit | Only a `DRAFT` is editable. Require current source image and valid calibration; save with optimistic lock state. |
| Published version | Read-only preview/export/archive context. Never render edit/save controls that directly update a published map. |
| New work from published | Create a separate draft using required source image/calibration, then validate and publish it; never mutate published geometry directly. |
| Validate | Display all server errors: calibration, polygon validity, code uniqueness, coverage, overlap, zone/camera ownership, and partition conflicts. |
| Publish | Require successful validation, target/site/camera/draft/version/effect confirmation, `If-Match` conflict handling, idempotency key, pending lock, and returned durable audit outcome. |
| Archive/delete | Confirm material target/scope/impact; preserve prior version state on failure; return audit outcome where the API supplies it. |
| Rollback | Only an archived valid candidate may roll back. Require confirmation and a nonblank reason, revalidate target, handle lock conflict, and return auditable result. |

[ParkingMapContractService](../../backend/src/main/java/com/vehiclemanagement/parking/ParkingMapContractService.java)
already enforces drafts-only update, validation, lock-version publish, idempotency, site/camera checks,
and rollback reason. The Tenant Admin wireflow must reuse those states rather than invent a
published-edit path.

### E. Billing and audit

**Route:** `/billing`. This is **Tenant-wide**, with no selected-site data filter.

1. Load plan, subscription status, current period end, entitlement/usage values, source freshness,
   and unavailable state.
2. Show only Tenant Admin billing actions: Stripe portal and checkout/upgrade.
3. External return triggers a server status refresh. `?checkout=success` means only that the external
   flow returned; it is not proof that the subscription changed.
4. Show billing failure/unavailable states without inferring plan health. Retain current
   server-confirmed status until a refresh succeeds.
5. A future embedded billing-audit panel shows timestamp, actor/source, action, plan/subscription
   impact, result/outcome, Stripe event/correlation reference, and safely redacted detail.

[BillingService](../../backend/src/main/java/com/vehiclemanagement/billing/BillingService.java) writes
`billing_audit` records for checkout and webhook lifecycle events, but no contracted tenant-scoped
billing-audit read API/UI currently exists. Until DAI-339 supplies it, this wireflow is status and
portal/checkout handoff only; it does not invent a tenant `/audit` route.

## 4. Shared state, safety, and accessibility matrix

| State | Required behavior |
|---|---|
| Scope loading | Preserve stable shell, announce loading, and make no scoped request before valid scope resolution. |
| Zero sites | Show `Chưa được gán site`; disable operational actions; offer non-privileged recovery guidance. |
| One / many sites | Fixed accessible current site for one; explicit selector for many. |
| Invalid/revoked scope | Fall back to an authorized site; generic feedback; no denied site/resource disclosure. |
| Empty queue/history | Distinguish no pending action from no historical records. |
| Partial/full error | Preserve successful panels, mark failure, and retry only failed source when possible. |
| Forbidden/scoped `404` | Treat as unavailable; safe parent/landing redirect; reveal no inaccessible target detail. |
| Offline/stale/reconnecting | Label already-loaded data offline/polling/stale; never claim live/healthy data when source is stale. |
| Session expiry | Stop realtime work, clear protected content, preserve only validated return route, refresh identity/scope after login, require reconfirmation. |
| Mutation failure | Keep prior server-confirmed state; preserve safe dialog context/reason for retry; no false success. |
| Responsive/accessibility | Keep scope label visible; use table-to-card alternatives; provide non-color status labels, keyboard selector/dialog navigation, focus return, and `aria-live` state announcements. |

## 5. Risky-action and audit contract

| Action | Scope | Confirmation | Reason | Pending / server result | Durable audit requirement |
|---|---|---|---|---|---|
| Organization material update | Tenant-wide | Per impact policy | Per policy | Lock duplicate submit; refresh server result | Returned audit outcome when contract exists |
| Site deletion | Tenant-wide | Required | Per policy | Preserve inventory on failure; refresh before assignment | Target/action/outcome/reference |
| Role/site assignment | Tenant-wide | Required for role/site removal/change | Required for removal/deactivation policy | Validate full configuration atomically; no bulk bypass | Old/new role/sites, actor, outcome/reference |
| User deactivation/deletion | Tenant-wide | Required | Required | Lock action; preserve current status on failure | Target/status/reason/outcome/reference |
| Access approval | Selected site | Required | Not normally required | Lock decision; refresh stale request | Decision actor/outcome/reference |
| Access rejection | Selected site | Required | Required | Reject blank reason; retain on failure | Reason/actor/outcome/reference |
| Publish commissioning map | Selected site/camera | Required after valid server validation | Not normally required | `If-Match`, idempotency, duplicate lock | Version/publish actor/outcome/reference |
| Archive/delete map | Selected site/camera | Required | Per policy | Preserve prior state on conflict/failure | Version/action/outcome/reference |
| Roll back archived map | Selected site/camera | Required | Required | Revalidate archived candidate and lock version | Reason/version/actor/outcome/reference |
| Checkout/portal handoff | Tenant-wide | External provider handoff confirmation | Not required | Refresh server status on return | Billing audit/event reference when readable |

A `Dialog` and `useToast` are implementation primitives, but a toast cannot substitute for
server-confirmed audit evidence. Every dialog summarizes target, current scope, impact, reason rule,
cancel path, pending lock, failure recovery, and keyboard focus return.

## 6. DAI-339 route/action handoff register

| Screen / action | Route / API family | Permission | Scope | Confirmation / reason | Audit event/result | Existing base | Required gap |
|---|---|---|---|---|---|---|---|
| Queue-first dashboard | `/dashboard`; dashboard APIs | A | Selected site/zone | None | N/A | Dashboard data context | Pending queue first; query-state/realtime refresh |
| Operational drilldown | Events, monitoring, entry/exit, maps, cameras | A | Selected site/zone/camera | None | N/A | Scope provider/topbar | URL reconciliation and safe scope refresh |
| Organization update | `/settings/organization`; tenant API | A | Tenant-wide | Material change policy | Outcome reference | Tenant settings page/API | Durable audit response/feedback |
| Site CRUD | `/sites`; site API | A | Tenant-wide | Delete/material action | Action/outcome | Site page/API | Shared confirmation/audit result |
| User role/site config | `/users`; user API | A | Tenant-wide | Review; removal/deactivation reason | Old/new assignment/outcome | User form/table, `replaceSiteAssignments` | Atomic role-site audit/confirmation contract |
| Access decision | `/vehicles/requests`; access-request API | A | Selected site | Approve confirm; reject reason | Decision/outcome | VehicleRequestsPage | Scoped server filtering, correlation result |
| Commissioning draft/edit | `/parking/commissioning`; map APIs | A | Site/camera/zone | Draft-level material action | Draft/version provenance | ParkingCommissioningPage | Published-read-only affordances, shared result |
| Commissioning publish | Map publish API | A | Site/camera | Confirm after validation | Published version/outcome | Contract service | Inline audit outcome/result |
| Commissioning rollback | Map rollback API | A | Site/camera | Confirm + reason | Rollback version/reason/outcome | Contract service | Shared rollback feedback/focus flow |
| Billing checkout/portal | `/billing`; billing API | A | Tenant-wide | External handoff | Billing event when readable | Tenant billing page/service | Refresh-on-return and audit-read panel |
| Billing audit panel | Future billing-audit read API | A | Tenant-wide | Read-only | Event history | `BillingService` write audit | New tenant-scoped read contract required |

## 7. Existing foundations and downstream ownership

| Concern | Existing foundation | DAI-339 handoff |
|---|---|---|
| Scope | `DashboardScopeProvider`, `dashboard-policy.mjs`, `Topbar`, `SiteAccess` | URL/user-tenant persistence, cancellation/realtime reset, no-site behavior |
| Dashboard/drilldown | Dashboard data/API context and selected-site pages | Queue-first layout, query handoffs, stale/recovery state |
| User administration | Users page/form/table, user API, `UserService.replaceSiteAssignments` | Atomic configuration validation, confirmation/reason/audit outcome, no bypass shortcut |
| Access queue | VehicleRequestsPage, access request API/controller/service | Server site scope/filter, conflict behavior, durable decision result |
| Commissioning | ParkingCommissioningPage, map API, contract service, E2E tests | Published-read-only UI, shared confirm/audit outcome, draft-from-published UX |
| Billing | Tenant billing page/API, BillingService | Tenant billing-audit read/inline result, return refresh semantics |
| Confirmation | Dialog and `useToast` | Shared `ConfirmActionDialog`; toast is supplemental only |

DAI-340 verifies direct link, cross-scope, no-site, expiry, confirmation, responsive, and accessibility
outcomes once DAI-339 implements these contracts.

## 8. Acceptance checklist

- [ ] Tenant-wide and Selected-site labels/behavior are visibly distinct.
- [ ] Pending operational work precedes passive KPIs on the dashboard.
- [ ] Role/site assignment rejects every invalid configuration before save and on the server.
- [ ] Published commissioning versions are read-only; all change flows use a draft and confirmation.
- [ ] Every journey has happy, loading, empty, error, unavailable, conflict/retry where applicable,
  and session-expiry states.
- [ ] Every risky action contains scope, confirmation, reason, pending lock, server outcome, audit
  reference, failure recovery, and focus behavior.
- [ ] No route/action in this document extends the DAI-332 role boundary.
