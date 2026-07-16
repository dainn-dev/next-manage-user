# DAI-333 · Information Architecture and Interaction Standards

- Status: Approved design contract
- Owner: Product + UX
- Security-boundary reviewer: Principal Architect
- Date: 2026-07-16
- Tracking: DAI-333 · Parent: DAI-331
- Inputs: [DAI-332 permission matrix](permission-matrix.md),
  [ADR-0605](adr/ADR-0605-rbac-product-decisions-and-ux-permission-contract.md),
  [ADR-1703](../17_Dashboard/adr/ADR-1703-dashboard-rbac-realtime-contracts.md)
- Downstream: DAI-334 through DAI-342, DAI-339, DAI-340

## 1. Authority and non-goals

This document defines the information architecture (IA), interaction behavior, responsive behavior,
and reusable UX-component contract for the three application shells:

1. **Platform** — SaaS control plane.
2. **Tenant Operations** — tenant/site operational workspace, including the kiosk sub-mode.
3. **Member** — consumer self-service.

It does **not** create a second authorization model:

| Source | Authority |
|---|---|
| [DAI-332 permission matrix](permission-matrix.md) | Canonical role × route × action × data-scope policy, including technical principals and current conformance gaps. |
| [ADR-0605](adr/ADR-0605-rbac-product-decisions-and-ux-permission-contract.md) | Product role decisions, audit/confirmation/reason rules, and the distinction between UI, frontend routing, backend enforcement, and data scope. |
| [ADR-1703](../17_Dashboard/adr/ADR-1703-dashboard-rbac-realtime-contracts.md) | Tenant/site/zone operational scope and realtime correctness/degraded-mode behavior. |
| This document | Shell ownership, navigation, breadcrumbs, state behavior, deep links, responsive rules, and component reuse. |

UI visibility, selector filtering, disabled controls, breadcrumbs, and browser redirects are UX
behavior only. Backend authorization and tenant/site/ownership scope are authoritative.

### Non-goals

- No API, database, Flyway, or runtime authorization change.
- No implicit tenant support/impersonation context for `PLATFORM_ADMIN`.
- No native mobile application requirement for MVP.
- No Notification Center route, inbox, or deep link before the permission matrix defines it.
- No claim that the DAI-337 guard override/audit flow exists today.
- No new route is launchable until it has a permission-matrix row, server policy, data-scope rule,
  and navigation/deep-link behavior.

## 2. Three-shell navigation model

### 2.1 Canonical landing and wrong-shell fallback

| Canonical role | Landing | Wrong-shell response |
|---|---|---|
| `PLATFORM_ADMIN` | `/platform/overview` | Replace the URL with `/platform/overview`. Do not show tenant operational data. |
| `TENANT_ADMIN` | `/dashboard` | Replace unavailable/legacy paths with `/dashboard` unless a more specific permitted parent exists. |
| `SITE_MANAGER` | `/dashboard` | Replace unavailable/tenant-admin-only paths with `/dashboard`. |
| `SECURITY_GUARD` | `/dashboard` | Replace unavailable/configuration paths with `/dashboard`. |
| `MEMBER` | `/me` | Replace Platform or Tenant Operations URLs with `/me`. |

A redirect uses replace-style navigation so Back does not loop through a forbidden page. The feedback is
generic—“This area is not available”—and must not expose a tenant, site, resource name, or resource
identifier outside the person's scope.

### 2.2 Navigation groups

The current [Sidebar](../../frontend/components/layout/sidebar.tsx) is the implementation baseline.
A later shared shell component must preserve these task-first groups unless the permission matrix and
this document are revised together.

| Shell | Navigation groups | Visibility rule |
|---|---|---|
| Platform | **Platform:** Overview, Tenants, Billing, Admins, Audit | `PLATFORM_ADMIN` only. Platform scope never implies tenant operational access. |
| Tenant Operations | **Overview**; **Vận hành:** Giám sát, Thông tin ra/vào, Cổng kiosk, Sự kiện; **Bãi đỗ xe:** Sơ đồ bãi, Camera, Thiết lập bãi đỗ; **Phương tiện:** Tìm biển số, Danh sách xe, Yêu cầu ra/vào; **Phân tích:** Thống kê; **Quản trị:** Tổ chức, Sites, Thanh toán, Quản lý người dùng | Show only the permitted items for A/M/G; a visible item remains subject to backend policy and assigned-site scope. |
| Member | Xe của tôi, Đăng ký tại org, Visit/QR, Lịch sử, Tài khoản | `MEMBER` only; affiliations do not expose an operations navigation group. |

`/parking/slots` remains a disabled “coming soon” sidebar item. It has no page, breadcrumb, direct
link, hidden keyboard shortcut, or deep-link promise until it has an approved route/API/scope row.

### 2.3 Route-complete sitemap and traceability

Every implemented `frontend/app/**/page.tsx` has exactly one row below. **PM** refers to the matching
row in section 2 of the [permission matrix](permission-matrix.md). **Status** is deliberately
separate from authorization: `implemented`, `index redirect`, `kiosk sub-mode`, or `legacy follow-up`.

| Route | Shell / mode | Nav entry | PM role/scope reference | Breadcrumb behavior | Deep-link / status |
|---|---|---|---|---|---|
| `/` | Public / no chrome | None | Public | None | Public entry; implemented |
| `/login` | Public / no chrome | None | Public | None | Authenticate then validated return path or role landing; implemented |
| `/register` | Public / no chrome | None | Public | None | Public registration; implemented |
| `/forgot-password` | Public / no chrome | None | Public | None | Public reset request; implemented |
| `/reset-password` | Public / no chrome | None | Public | None | Public token confirmation; implemented |
| `/platform` | Platform | Overview | P / Platform | None | Replace with `/platform/overview`; index redirect |
| `/platform/overview` | Platform | Overview | P / Platform | None | Platform landing; implemented |
| `/platform/tenants` | Platform | Tenants | P / Platform | `Platform › Tenants` | Authorized list; implemented |
| `/platform/tenants/[id]` | Platform | Tenants | P / Platform | `Platform › Tenants › {authorized tenant name}` | Resolve label only after authorized load; otherwise generic fallback + platform landing; implemented |
| `/platform/billing` | Platform | Billing | P / Platform | `Platform › Billing` | Authorized view; implemented |
| `/platform/admins` | Platform | Admins | P / Platform | `Platform › Admins` | Authorized view; implemented |
| `/platform/audit` | Platform | Audit | P / Platform | `Platform › Audit` | Authorized view; implemented |
| `/me` | Member | Xe của tôi | U / self-owned | None | Member landing; implemented |
| `/me/orgs` | Member | Đăng ký tại org | U / self-affiliation | `Member › Đăng ký tại org` | Authorized self-service view; implemented |
| `/me/visit` | Member | Visit/QR | U / claimed session | `Member › Visit / QR` | Authorized claim/list; implemented |
| `/me/visit/[sessionId]` | Member | Visit/QR | U / claimed session | `Member › Visit / QR › {authorized visit}` | Resolve label only after ownership check; unavailable details return to `/me/visit`; implemented |
| `/me/history` | Member | Lịch sử | U / self and claimed session | `Member › Lịch sử` | Authorized self-service view; implemented |
| `/me/account` | Member | Tài khoản | U / self | `Member › Tài khoản` | Authorized self-service view; implemented |
| `/dashboard` | Tenant Operations | Tổng quan | A tenant; M/G assigned site | None | Tenant Operations landing; implemented |
| `/events` | Tenant Operations | Sự kiện | A tenant; M/G assigned site | `Vận hành › Sự kiện` | Authorized event view; implemented |
| `/parking/maps` | Tenant Operations | Sơ đồ bãi | A tenant; M/G assigned site, G read-only | `Bãi đỗ xe › Sơ đồ bãi` | Authorized map view; implemented |
| `/parking/cameras` | Tenant Operations | Camera | A tenant; M/G assigned site, G read-only | `Bãi đỗ xe › Camera` | Authorized camera view; implemented |
| `/parking/commissioning` | Tenant Operations | Thiết lập bãi đỗ | A tenant; M assigned site | `Bãi đỗ xe › Thiết lập bãi đỗ` | G redirects to `/dashboard`; implemented |
| `/gate` | Tenant Operations | Cổng kiosk | A tenant; M assigned site | `Vận hành › Cổng kiosk` | G redirects to `/dashboard`; implemented |
| `/gate/[gateId]` | Tenant Operations / full-screen kiosk | Cổng kiosk | A tenant; M/G assigned site | None | Server validates gate site; A/M Back → `/gate`, G Back → `/dashboard`; kiosk sub-mode |
| `/gate/health` | Tenant Operations | None | A tenant; M assigned site | `Vận hành › Cổng kiosk › Sức khỏe cổng` | G redirects to `/dashboard`; implemented |
| `/vehicles/monitoring` | Tenant Operations | Giám sát | A tenant; M/G assigned site | `Vận hành › Giám sát` | Authorized operational read; implemented |
| `/vehicles/search` | Tenant Operations | Tìm biển số | A tenant; M/G assigned site | `Phương tiện › Tìm biển số` | Authorized required-site search; implemented |
| `/vehicles` | Tenant Operations | Danh sách xe | A tenant; M assigned site | `Phương tiện › Danh sách xe` | G redirects to `/dashboard`; implemented |
| `/vehicles/entry-exit` | Tenant Operations | Thông tin ra/vào | A tenant; M assigned site | `Vận hành › Thông tin ra/vào` | G redirects to `/dashboard`; implemented |
| `/vehicles/requests` | Tenant Operations | Yêu cầu ra/vào | A tenant; M assigned site | `Phương tiện › Yêu cầu ra/vào` | G redirects to `/dashboard`; implemented |
| `/statistics` | Tenant Operations | Thống kê | A tenant; M assigned site | `Phân tích › Thống kê` | G redirects to `/dashboard`; implemented |
| `/sites` | Tenant Operations | Khu vực (Sites) | A / tenant | `Quản trị › Khu vực (Sites)` | M/G redirect to `/dashboard`; implemented |
| `/settings/organization` | Tenant Operations | Tổ chức | A / tenant | `Quản trị › Tổ chức` | M/G redirect to `/dashboard`; implemented |
| `/billing` | Tenant Operations | Thanh toán | A / tenant | `Quản trị › Thanh toán` | M/G redirect to `/dashboard`; implemented |
| `/users` | Tenant Operations | Quản lý người dùng | A / tenant | `Quản trị › Quản lý người dùng` | M/G redirect to `/dashboard`; implemented |
| `/departments` | Legacy administrative destination | None | A / tenant (target) | `Legacy admin › Departments` | Not standard navigation; until DAI-339 guard/API work, direct entry falls back to `/dashboard`; legacy follow-up |
| `/positions` | Legacy administrative destination | None | A / tenant (target) | `Legacy admin › Positions` | Not standard navigation; until DAI-339 guard/API work, direct entry falls back to `/dashboard`; legacy follow-up |
| `/employees` | Legacy administrative destination | None | A / tenant (target) | `Legacy admin › Employees` | Not standard navigation; until DAI-339 guard/API work, direct entry falls back to `/dashboard`; legacy follow-up |

## 3. Breadcrumb standard

- Do not render a breadcrumb at the roots: Platform Overview, Tenant Operations Dashboard, and
  Member Garage.
- Render hierarchy from this IA, not by splitting URL segments. Labels must be human-readable and
  localized consistently with navigation.
- A dynamic resource label is fetched only through the authorized data request. Before it succeeds,
  use a generic accessible label such as “Tenant details” or “Visit details”; never render an
  unauthorised identifier or cached name.
- An out-of-scope API `404` is presented as “This item is not available,” then routes to the
  permitted parent/landing. It does not prove that the requested resource exists.
- Kiosk mode has no general breadcrumb or sidebar. Its role-aware Back behavior is the rule in the
  sitemap table.
- Legacy admin breadcrumbs are a temporary direct-link recovery aid, not a reason to restore them
  to ordinary navigation.

## 4. Tenant/site/zone scope selector

The selector is an interaction control over already-authorized data. It never creates authority;
[SiteAccess](../../backend/src/main/java/com/vehiclemanagement/security/SiteAccess.java), tenant RLS,
and server resource checks retain enforcement responsibility.

### 4.1 Shell rules

| Shell / mode | Scope behavior |
|---|---|
| Platform | No tenant/site selector. A Platform view is control-plane scope only, not tenant support access. |
| Member | No operational selector. Active affiliations are consumer data, not a tenant operations scope. |
| Tenant Operations | Use server-authorized selectable sites. Zone is subordinate to the selected site. |
| Kiosk | Lock scope to the server-authorized gate site. Do not offer a site or zone selector. |

### 4.2 Zero, one, and many authorized sites

| Available authorized sites | Required experience |
|---|---|
| Zero | Show “Chưa được gán site”; make no site-scoped read or mutation request; disable dependent actions; offer only a non-privileged recovery message such as “Contact your Tenant Admin.” |
| One | Render the site name as fixed, accessible current scope—not a redundant selector. Zone remains available only when the route supports it. |
| Many | Render the current site and an explicit selector. Use a searchable/scroll-safe list when the list cannot fit. Only server-authorized sites may be offered. |

### 4.3 Resolution, changes, and persistence

1. A valid URL `siteId` and subordinate `zoneId` wins over a stored preference.
2. A stored preference is a fallback, persisted per authenticated user **and tenant**, never as a
   globally reusable site ID.
3. An invalid, revoked, or out-of-scope URL/stored value falls back to the first currently
   authorized site; show generic scope-change feedback without naming a denied site.
4. Changing site clears zone, cancels/restarts scoped loads, refreshes realtime subscriptions, and
   replaces the relevant history entry rather than adding one entry per selector change.
5. Changing zone refetches or filters only data the selected site permits; it cannot survive a
   site change unless it belongs to the new site.

[DashboardScopeProvider](../../frontend/lib/dashboard-scope-context.tsx),
[dashboard-policy.mjs](../../frontend/lib/dashboard-policy.mjs), and
[Topbar](../../frontend/components/layout/topbar.tsx) are the implementation foundations. Current
known gaps are intentional DAI-339 follow-up: G cannot select among multiple assigned sites, stored
selection is not keyed by user/tenant, and URL synchronization does not exist.

## 5. Deep links, Back navigation, and session expiry

### Deep-link algorithm

1. If unauthenticated, store only a validated relative return path. Reject absolute URLs, protocol
   forms, paths outside this app, malformed encoding, and any return path that has become invalid.
2. After login, re-fetch the user and re-evaluate role, tenant, site assignments, and the target
   route. A stale pre-login role or selected site is not trusted.
3. If the route and scope remain authorized, return there. If not, replace with the role landing
   and show generic unavailable feedback.
4. A deep link never bypasses a server action check, assigned-site validation, or resource
   ownership check.

### Back navigation

- Use the previous in-shell history entry only when it remains within an allowed shell and scope.
- Redirect, scope-change, and session-expiry fallback uses replace navigation to avoid looping into
  forbidden paths.
- Detail pages return to their safe IA parent; kiosk uses its special A/M or G destination.
- Never recreate a removed filter, site, zone, or resource from a stale history entry without
  revalidation.

### Session-expiry flow

A token-expiry signal or API `401` uses one global flow:

1. Stop realtime subscriptions and clear protected page content.
2. Preserve a validated relative return path only; never persist unsaved sensitive form values by
   default and never persist a pending destructive/approval/override request.
3. Redirect to login with an accessible “Your session has expired” message.
4. After login, re-resolve identity/scope and require explicit reconfirmation of any mutation.

The current login flow goes directly to `homeForRole(...)`; safe return-path handling and a unified
API-401 boundary are DAI-339 implementation requirements.

## 6. Shared screen-state and realtime standard

Every screen documents data state, access state, and connection state separately. Stable shell and
scope context remains visible when safe; do not misrepresent partial or stale data as complete/live.

| State | Required behavior | Recovery / accessibility |
|---|---|---|
| Initial loading | Keep shell and known scope; show page-local skeleton/progress rather than replacing all chrome. | Announce loading once; preserve keyboard order. |
| Empty result | Explain whether there are no records, no configured resource, or no assigned site. | Show a CTA only when the role owns the allowed action. |
| No assigned site | Apply the zero-site rule; no site-scoped requests/mutations. | Provide non-privileged recovery guidance. |
| Partial error | Retain successful panels when safe; mark failed panels explicitly. | Inline retry targets the failed request, not a blind page reload. |
| Full error | Do not show stale placeholders as current results. | Show concise error + retry; use the existing error boundary for unexpected rendering failure. |
| Forbidden / out-of-scope | Do not expose target details. Treat scoped `404` as unavailable. | Return to permitted parent/landing or show generic unavailable state. |
| Offline | Persistent connectivity banner; show already-loaded data only with an offline label. | Do not promise mutation queuing/offline writes because no contract exists. |
| Polling fallback | Indicate the dashboard is updating by polling, not live push. | Operational polling: 15 seconds when visible, 60 seconds when hidden. |
| Reconnecting / stale | On disconnect, sequence gap, or failed reconciliation, never label data “Live.” | Use `Reconnecting` or `Updated <time>`; reconcile REST before restoring live status. |
| Recovered | After a healthy subscription and reconciliation fetch, restore normal state. | Announce recovery without interrupting current work. |
| Session expired | Stop subscriptions and remove protected content. | Login redirect with validated return path; mutations require reconfirmation. |

[ADR-1703](../17_Dashboard/adr/ADR-1703-dashboard-rbac-realtime-contracts.md) defines REST
bootstrap, reconciliation, authorized subscriptions, and this polling cadence. The current
[`useDashboardRealtime`](../../frontend/hooks/use-dashboard-realtime.ts) state set is
`connecting | live | polling | disconnected`; it does not yet model the required explicit `stale`
semantic state. That is a DAI-339 implementation gap.

## 7. Shared interaction patterns

### 7.1 Notifications

The disabled Topbar bell is an explicit coming-soon affordance. Do not add an inbox route, an empty
notification page, or a deep link until the permission matrix defines an action/route/scope row.

A future notification surface must be owner or assigned-site scoped, expose unread state accessibly,
distinguish delivery failure from read/acknowledged state, and define a safe deep-link target. A toast
is transient feedback, not the notification inbox or audit record.

### 7.2 Approval queues

[VehicleRequestsPage](../../frontend/app/vehicles/requests/page.tsx) is the reusable reference:

- Present pending work first; filters, counts, and status badges are presentation aids only.
- A/M see only the queue within their server-authorized scope. G has no approve/reject controls.
- The decision dialog states target, current scope, effect, and actor action before submission.
- Rejection requires a nonblank reason. Do not change final UI state until the server succeeds.
- Lock duplicate submissions; refresh the queue after conflict/staleness; surface error and retry.
- On success, say the decision was recorded only after server success. Include a request,
  correlation, or audit reference when an API provides one.

### 7.3 Destructive confirmation and audit feedback

A future `ConfirmActionDialog` has three standard modes:

| Mode | Applies to | Requirements |
|---|---|---|
| Standard | Irreversible or material action | Target, scope, effect summary, cancel-safe action, pending lock. |
| Reason-required | Rejection, user deactivation, role/site removal, credential revocation, map rollback | Standard fields plus server-validated nonblank reason. |
| Elevated override | DAI-337 guard manual override | Target/event/gate context, nonblank reason, explicit final action, server audit outcome. |

The dialog must return focus to its trigger after cancellation or failure. A destructive success
requires an inline/audit outcome when appropriate; [useToast](../../frontend/hooks/use-toast.ts) is
only the transient confirmation layer and never proof that an audit entry exists.

## 8. Responsive and accessibility rules

| Shell / mode | Desktop | Tablet / mobile | Accessibility baseline |
|---|---|---|---|
| Platform | Persistent/collapsible control-plane sidebar; no tenant selector. | Sidebar becomes an accessible drawer/rail; preserve current Platform context. | Keyboard navigation, visible focus, non-color-only status. |
| Tenant Operations | Desktop operational workspace with visible selected scope. | Sidebar becomes rail/drawer; keep scope visible; dense tables get responsive alternatives, not horizontal overflow alone. | Selector, tables, errors, and live state have accessible names/announcements. |
| Guard kiosk | Full-screen, landscape-oriented gate mode; no sidebar. | Tablet is primary; small phone is recovery-only, not the intended guard surface. | 44px minimum targets, high contrast, large status text, locked gate scope, visible offline/replay state. |
| Member | Constrained readable self-service layout on wider screens. | Mobile-first app header and bottom navigation for the five Member destinations; never reuse operations chrome. | Touch targets, focus order, status announcements, and reduced visual density. |

All shells require visible focus styling, keyboard access to navigation/selectors/dialogs, focus return
after a dialog, text or icon labels in addition to color, and `aria-live` announcements for loading,
error, stale/recovered realtime, and session-expiry changes.

The current [`ProtectedLayout`](../../frontend/components/layout/protected-layout.tsx) still renders
the shared sidebar for Member routes; the mobile-first Member shell is therefore a DAI-339 gap, not a
claim about shipped UI.

## 9. Reusable component inventory

| Concern | Existing base | Target reusable contract |
|---|---|---|
| Shell chrome | `Sidebar`, `Topbar`, `ProtectedLayout` | Role-aware `AppShell`, responsive rail/drawer, shell navigation, kiosk sub-mode |
| Scope | `DashboardScopeProvider`, `dashboard-policy.mjs`, `Topbar` | `ScopeSelector` with zero/one/many display, URL/stored-preference reconciliation, and safe fallback |
| Navigation context | No shared breadcrumbs | Route registry + `Breadcrumbs` driven by this IA |
| Async/failure state | `ErrorBoundary`; local page states | `AsyncState` for loading, empty, error, forbidden, offline, and recovery |
| Realtime | `useDashboardRealtime`, dashboard data context | `RealtimeStatus` for Live/Reconnecting/Polling/Updated/Stale semantics |
| Confirmation | Existing Dialog primitive and page-local dialogs | `ConfirmActionDialog` with impact summary, reason validation, pending lock, and audit outcome |
| Feedback | `useToast` | Transient toast plus durable inline/audit-result feedback |
| Approval work | `VehicleRequestsPage` | Scope-aware `ApprovalQueue` and `DecisionDialog` |
| Authentication continuity | Auth context and login page | Safe-return-path helper + session-expiry boundary |
| Notifications | Disabled Topbar bell | `NotificationTrigger` and future inbox only after matrix approval |

## 10. Conformance and downstream handoff

| Current gap | Downstream owner |
|---|---|
| Shared breadcrumbs, safe deep-link return, session-expiry boundary, selector persistence/URL synchronization, Member mobile shell, confirmation component, realtime stale status | DAI-339 |
| Guard override workflow, reason validation, tenant/site operational audit trail, handover behavior | DAI-337 |
| Role-specific wireflows and commissioning journeys built from this IA | DAI-334 through DAI-338, DAI-341, DAI-342 |
| Forbidden-route, cross-scope, no-site, expiry, confirmation, responsive, and accessibility validation | DAI-340 |

Before implementation handoff, verify that every route in section 2 is still present exactly once,
every sidebar item is represented or explicitly coming soon, and no interaction changes the role or
scope granted by the permission matrix.
