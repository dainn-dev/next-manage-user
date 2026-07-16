# DAI-334 · Platform Admin Wireflow and Implementation Handoff

- Status: Approved UX/design handoff
- Owner: Product + UX
- Security-boundary reviewer: Principal Architect
- Date: 2026-07-16
- Tracking: DAI-334 · Parent: DAI-331
- Inputs: [DAI-332 permission matrix](permission-matrix.md),
  [ADR-0605](adr/ADR-0605-rbac-product-decisions-and-ux-permission-contract.md),
  [DAI-333 IA and interaction standards](ia-interaction-standards.md),
  [ADR-1703](../17_Dashboard/adr/ADR-1703-dashboard-rbac-realtime-contracts.md)
- Diagrams: [end-to-end wireflow](diagrams/dai-334-platform-admin-wireflow.mmd) ·
  [risky-action sequence](diagrams/dai-334-platform-admin-risky-action-sequence.mmd)

## 1. Scope and authority

`PLATFORM_ADMIN` is a SaaS control-plane operator. Platform scope is cross-tenant metadata,
lifecycle, subscription/usage/health summaries, Platform Admin administration, and platform audit.
It is **not** access to a tenant's parking operation.

The [permission matrix](permission-matrix.md) remains the authoritative role × route × action ×
scope contract. This document applies that policy to one role's journeys, screen states, and runtime
handoff; it does not grant additional permissions or redefine backend enforcement.

### Explicit non-goals

A Platform Admin must not receive any of the following from this wireflow:

- Tenant impersonation, a support session, or a handoff into Tenant Operations.
- Vehicle/registration/access-request approval, plate lookup, gate action, camera action,
  commissioning, parking-map mutation, or tenant-site configuration.
- Tenant user/role/site assignment management.
- Tenant billing-portal or payment-method mutation on behalf of a tenant.
- A billing-resolution command not explicitly defined, authorized, reasoned, and audited by a later
  product/API contract.

A future support capability is separate work: it needs explicit tenant scope, expiry, mandatory
reason, audit identity, and a dedicated permission-matrix change.

## 2. Platform shell boundary and navigation

### 2.1 Landing, routing, and direct links

| Visitor / response | Required behavior |
|---|---|
| Authenticated `PLATFORM_ADMIN` | Land at `/platform/overview`; see Platform navigation only. |
| Unauthenticated visitor | Go to login. Retain only a validated relative return path; after login, re-fetch role and reauthorize the target. |
| `TENANT_ADMIN`, `SITE_MANAGER`, `SECURITY_GUARD` | Replace Platform URL with `/dashboard` and show generic unavailable feedback. |
| `MEMBER` | Replace Platform URL with `/me` and show generic unavailable feedback. |
| Platform API `401` | Stop protected work, clear protected data, announce expiry, redirect to login, and require reconfirmation of a mutation after login. |
| Platform API `403` | Do not expose target details; show generic unavailable state and return to `/platform/overview`. |
| Tenant/deep-link `404` | Treat as unavailable, not proof of existence; return to `/platform/tenants`. |

The current Platform layout sends every non-Platform role to `/dashboard`; the Member destination is
therefore a DAI-339 conformance gap, not the target behavior.

### 2.2 Fixed Platform navigation

| Navigation item | Route | Primary task | Breadcrumb |
|---|---|---|---|
| Overview | `/platform/overview` | Review platform lifecycle, subscription/exception, health/usage, admin, and audit summaries. | None |
| Tenants | `/platform/tenants` | Find or create a tenant; open its control-plane detail. | `Platform › Tenants` |
| Billing | `/platform/billing` | Review cross-tenant subscription state and control-plane billing exceptions. | `Platform › Billing` |
| Admins | `/platform/admins` | Add and manage Platform Admin accounts. | `Platform › Admins` |
| Audit | `/platform/audit` | Review immutable platform audit history. | `Platform › Audit` |

There is no tenant/site selector in this shell. A Tenant Detail selection is a control-plane
resource context; it does not change the principal's tenant context or authorize tenant operations.

### 2.3 Detail hierarchy and safe labels

- `/platform` is an index redirect to `/platform/overview`.
- `/platform/tenants/[id]` renders `Platform › Tenants › {tenant name}` only after the authorized
  detail request resolves. Before then use the accessible generic label “Tenant details.”
- An unavailable detail must not reveal cached or supplied tenant names, slugs, or identifiers.
- The Audit screen is read-only. Filtering is the only primary interaction until a future export
  capability is separately approved.

## 3. Tenant Detail control-plane information architecture

Tenant Detail is a tabbed Platform resource, not a tenant workspace. It has exactly five tabs:

| Tab | Data and hierarchy | Primary / contextual action | Forbidden tenant-operation affordances |
|---|---|---|---|
| **Overview** | Lifecycle status, name/slug, management model, creation/update time, and aggregate control-plane health summary. | `Suspend tenant` when active; `Reactivate tenant` when suspended; terminal explanation for pending deletion. Rename and pending-deletion are secondary actions. | Enter tenant, vehicle/access controls, site setup, gates, cameras, maps. |
| **Sites / usage** | Read-only site inventory and aggregate usage/entitlement/health indicators, e.g. `used / limit / status`, source freshness, and delayed/unavailable labels. | None; read-only inspection. | Open site, create/edit/delete site, open camera/gate, change operational health/configuration. |
| **Subscription** | Plan, subscription status, current-period/renewal date, cancellation-at-period-end, `pastDueSince`, and a billing-exception state. | `Review exception` only when an approved control-plane triage API exists; otherwise show the exception and recovery/contact context. | Change payment method, open a tenant billing portal, alter a Stripe subscription, or perform tenant operations. |
| **Admin contacts** | Read-only directory of tenant-admin name, username, email, status, and last login where supported. | Contact/recovery guidance only. | Invite/suspend tenant admin, assign tenant roles/sites, or modify tenant users. |
| **Audit** | Tenant/resource-scoped Platform audit history: actor, target, action, reason, result/outcome, timestamp, and audit/correlation identifier. | Read-only filtering when supported. | Edit/delete audit entries or navigate into tenant audit. |

### Current implementation versus required handoff

The current `/platform/tenants/[id]` view provides registration, sites, and tenant-admin cards. It
does not yet provide first-class tabs, Subscription, usage/health, or tenant-scoped audit. This
wireflow is the contract for DAI-339; it must not be approximated with client-side guesses or
operational deep links.

## 4. Required journeys

Every journey has a happy path and its loading, empty, error, unavailable, and session-expiry paths.
The end-to-end diagram is the companion visual flow.

### A. Login → Platform Overview

**Entry:** person opens `/login`, or an expired Platform session redirects there.

1. Submit credentials.
2. Refresh identity/role before choosing a landing.
3. A Platform Admin goes to `/platform/overview`; another role follows the safe destination in
   section 2.1.
4. Load platform overview panels independently: tenant lifecycle totals, subscription/exception
   summary, aggregate health/usage indicators when available, Platform Admin count, and recent audit.
5. A successful panel can render while another panel remains loading or failed. No panel may claim a
   healthy/complete status when its source is unavailable.

| State | Required behavior |
|---|---|
| Loading | Render stable Platform shell plus panel-local skeletons/progress. |
| Empty | Explain zero tenants, zero admins, or no recent audit rather than showing a blank card. |
| Partial error | Mark failed panel with local retry; retain successful panel data and label it accurately. |
| Full error | Show page-level retry without replacing the Platform shell. |
| Forbidden/unavailable | Use generic unavailable behavior from section 2.1. |
| Session expiry | Stop protected work and redirect to login; do not replay a prior action. |

### B. Find/select tenant → Tenant Detail

**Entry:** Platform navigation or overview shortcut.

1. Open `/platform/tenants`; load lifecycle totals and a paginated tenant list.
2. Search by name/slug, filter lifecycle status, and page results.
3. Select a row or accessible detail link.
4. Navigate to `/platform/tenants/[id]`; load the detail header before resolving a named breadcrumb.
5. Default to **Overview**; changing tabs retains the Platform resource context, not a tenant session.

| State | Required behavior |
|---|---|
| Loading | Table/stat skeleton; detail header/tab-local loading. |
| Empty list | Distinguish “no tenants” from “no tenant matches this search/filter.” |
| Paging race/stale result | Keep current filter context; ignore out-of-date result; never open a row from a previous page/search response. |
| Detail unavailable | Generic unavailable feedback, then `/platform/tenants`; no tenant name/id disclosure. |
| Partial tab error | Preserve successful tabs; show tab-local retry and unavailable data freshness. |
| Session expiry | Preserve only safe list/detail route; authorize it again after login. |

### C. Create tenant

**Entry:** `Create tenant` from `/platform/tenants`.

The existing onboarding fields in [the tenant list page](../../frontend/app/platform/tenants/page.tsx)
are the content baseline: tenant name/optional slug, first site, location, management model,
`areaCount`, and initial tenant-admin identity.

1. **Enter details.** Validate field format as the person types and on submit. Explain that
   `areaCount` is capacity/intent only: onboarding still creates exactly one initial site.
2. **Review and create.** Show organization, first site, initial admin, model, and area intent in a
   confirmation review. The person can return to edit safe fields.
3. **Submit once.** Lock the final action, display pending state, and reject duplicate submissions.
4. **Complete.** Only after the server returns success and an auditable onboarding outcome, navigate
   to the created tenant's **Overview** tab and show durable completion details.
5. **Recover.** Validation/duplicate/network failure retains safe entered values, focuses the first
   invalid field or inline error, and does not claim the tenant exists.

Creation confirmation is a review of a new tenant and initial admin—not permission to operate the
new tenant after creation.

### D. Suspend, reactivate, and mark pending deletion

**Entry:** Tenant list row action or Tenant Detail Overview contextual action.

All material lifecycle transitions use one `ConfirmActionDialog` contract:

1. Identify target tenant, current status, requested next status, and control-plane impact.
2. State what will **not** happen: no parking operation is opened or changed through this dialog.
3. Require a nonblank reason for suspend, reactivate, and pending deletion.
4. Show a cancel-safe action and lock submission/dismissal while the request is pending.
5. Server authorizes, transitions, and appends the audit record atomically.
6. Refresh detail/list header only after the response includes a durable audit outcome/reference.
7. Render inline result with action, target status, reason, actor/time, and audit/correlation reference;
   a toast may supplement this but is not evidence.

| Failure | Required result |
|---|---|
| Blank/invalid reason | Keep dialog open; field-level error and focus. |
| Validation/conflict (`409`) | Preserve current displayed lifecycle state; explain conflict and offer refresh. |
| Authorization/unavailable | Do not expose target context beyond what was already authorized; return to safe parent if needed. |
| Network failure | Keep dialog context/reason for retry when safe; no optimistic status change. |
| Audit outcome unavailable | Do not present the transition as completed. |

### E. Subscription, usage, health, and billing exceptions

**Entry:** Platform Billing list or Tenant Detail **Subscription** / **Sites / usage** tab.

The UI classifies control-plane data without inventing a payment mutation:

| State | Meaning | UI behavior |
|---|---|---|
| Normal | Active/trialing subscription and expected entitlement/health signals. | Show summary, freshness, and no action-required CTA. |
| Attention | Cancel-at-period-end, near limit, or delayed health/usage source. | Visible warning and source freshness; no implied account change. |
| Action required | Missing subscription after approved grace rules, `past_due`, `unpaid`, `incomplete`, cancellation with entitlement impact, or health signal beyond approved threshold. | Show exception context and an approved triage/handoff affordance only when its API exists. |
| Unavailable | Billing/usage/health source did not load or is too stale. | Never infer normal/healthy; show retry and source-unavailable label. |

**Approved interaction sequence for a future exception-resolution command:**

1. Identify the exception in Billing or Tenant Detail.
2. Open read-only context: tenant, plan, subscription state, relevant dates, impacted
   entitlement/health signal, freshness, and tenant-admin contacts.
3. Select only a product-approved control-plane triage/handoff command.
4. Confirm target/scope/effect, require a nonblank reason, and lock duplicate submission.
5. On server-confirmed result, refresh exception data and display the durable audit outcome.

The command vocabulary, exception taxonomy, health threshold, freshness rules, and API outcome are
not implemented today. Until they are approved, this flow stops at read-only exception context and
contact/recovery guidance. It must never imply payment resolution, Stripe state mutation, or tenant
parking-operation changes.

### F. Manage Platform Admins and review audit

**Entry:** `/platform/admins` or `/platform/audit`.

1. Load Platform Admin directory; show loading, empty, error, unavailable, and retry states.
2. **Add Platform Admin:** validate fields, show review/confirmation, submit once, then show returned
   audit outcome and refreshed row.
3. **Suspend/reactivate:** show current/next status and scope; require confirmation and nonblank
   reason; prevent self-suspension and enforce a server-side last-active-Platform-Admin safeguard.
4. Refresh only after server mutation + audit outcome; do not let a toast stand in for an audit record.
5. Open Audit with relevant filters pre-applied when the API supports them. Audit is read-only and
   distinguishes “no events for this filter” from a failed load.

The current Platform Admin update flow prevents self-suspension and records a status audit, but it
has no confirmation/reason/outcome response and no last-active-admin safeguard. Those are explicit
DAI-339 API/UI gaps.

## 5. Shared Platform state matrix

| Surface | Loading | Empty | Partial/full error | Forbidden/unavailable | Mutation failure |
|---|---|---|---|---|---|
| Overview | Panel skeletons | Explain zero counts/no recent audit | Local card retry; page retry only if all fail | Generic Platform fallback; no resource leak | N/A |
| Tenants | Table and stats skeleton | No tenants vs no search match | Retain filters; retry list/stats independently | Generic Platform fallback | Keep form/dialog and list state unchanged |
| Tenant Detail | Header then tab-local loading | Per-tab explanatory empty state | Preserve successful tabs; tab-local retry | Generic unavailable then tenant list | Preserve pre-mutation detail and dialog state |
| Billing | Summary/list skeleton | No subscriptions vs no exceptions | Refresh current filters; do not infer healthy | Generic Platform fallback | Do not mark exception triaged/handled |
| Admins | Directory skeleton | Explain no Platform Admin records | Retry directory | Generic Platform fallback | Do not change/create a row until confirmed result |
| Audit | Timeline/table skeleton | Explain no matching events | Retry filters/page | Generic Platform fallback | N/A |

Across all surfaces:

- Use page-local loading/error states, stable layout, focus restoration, `aria-live` state
  announcements, non-color-only lifecycle/health status, and responsive table-to-card layouts per
  [DAI-333](ia-interaction-standards.md).
- Offline displays only already-loaded data with an offline label; no offline mutation queue exists.
- Delayed/unknown usage or health is visibly stale/unavailable, never silently “healthy.”
- Session expiry ends the protected interaction and requires a new confirmation after login.

## 6. Risk, confirmation, and audit standard

| Risky action | Confirmation | Reason | Durable completion evidence |
|---|---|---|---|
| Create tenant | Required review-and-create | Not required unless a later policy adds it | Server-confirmed onboarding + Platform audit outcome/reference |
| Rename tenant | Confirm only if product impact requires it | Optional context | Server-confirmed rename audit outcome/reference |
| Suspend tenant | Required | Required | New status + Platform audit outcome/reference |
| Reactivate tenant | Required | Required | New status + Platform audit outcome/reference |
| Mark pending deletion | Required | Required | New status + Platform audit outcome/reference |
| Billing-exception triage/handoff | Required when an approved command exists | Required | Server-confirmed outcome/reference; never payment mutation by implication |
| Add Platform Admin | Required review | Not required unless a later policy adds it | Created admin + Platform audit outcome/reference |
| Suspend/reactivate Platform Admin | Required | Required | New status + Platform audit outcome/reference |

A confirmation shows target, Platform scope, consequence, reason requirement, cancel path, pending
lock, and focus return. Mutation/audit failure preserves the pre-mutation UI and cannot render a
success outcome. This applies the DAI-332/333 distinction: a `useToast` message is transient feedback,
not an audit record.

## 7. Existing reuse points and DAI-339 API handoff

### Existing implementation foundations

| Concern | Reuse point |
|---|---|
| Platform API clients | [platform-api.ts](../../frontend/lib/api/platform-api.ts) and [tenant-api.ts](../../frontend/lib/api/tenant-api.ts) |
| Platform views | `frontend/app/platform/overview`, `tenants`, `tenants/[id]`, `billing`, `admins`, `audit` |
| Confirmation primitive | [Dialog](../../frontend/components/ui/dialog.tsx) |
| Transient feedback | [useToast](../../frontend/hooks/use-toast.ts) |
| Tenant lifecycle | [TenantController](../../backend/src/main/java/com/vehiclemanagement/controller/TenantController.java) and `TenantAdminService` |
| Platform Admin lifecycle | [PlatformAdminUserService](../../backend/src/main/java/com/vehiclemanagement/platform/PlatformAdminUserService.java) |
| Audit | [PlatformAuditService](../../backend/src/main/java/com/vehiclemanagement/platform/PlatformAuditService.java) |

### Required contract gaps

| Need | Current limitation | DAI-339 handoff |
|---|---|---|
| Tabbed Tenant Detail | Current detail is registration/sites/admin cards. | Aggregate control-plane detail payload for subscription, usage, health, contacts, and audit summary. |
| Overview health/usage | Existing overview has lifecycle/billing/admin/audit totals only. | Define sources, freshness, threshold semantics, and Platform-authorized aggregate payload. |
| Billing exception workflow | Existing billing list exposes status but no controlled triage command. | Define exception taxonomy, detail/list fields, permitted command(s), reason, audit ID/outcome, and idempotency. |
| Tenant audit tab | Platform audit filtering supports action/resource type, not resource ID. | Add resource/tenant ID and correlation filter or tenant-scoped audit endpoint. |
| Lifecycle outcome/reasons | Status request accepts an optional reason; response lacks audit reference. | Require reason for designated lifecycle transitions and return audit outcome/reference. |
| Platform Admin status | Update request has no reason/outcome and only blocks self-suspension. | Add reason/outcome contract and last-active-admin server safeguard. |
| Durable audit feedback | Current pages use toast-only success feedback. | Return/render operation and audit result inline; toast remains supplementary. |
| Member Platform fallback | Platform layout redirects every non-Platform role to dashboard. | Redirect Member to `/me`, as DAI-333 requires. |

## 8. Acceptance checklist and downstream ownership

- [ ] Login, tenant discovery/detail, tenant creation/lifecycle, billing exception review, Platform
  Admin management, and audit have happy, empty, error, unavailable, and expiry paths.
- [ ] Tenant Detail has exactly Overview, Sites / usage, Subscription, Admin contacts, and Audit tabs.
- [ ] No Platform screen or diagram provides tenant parking-operation navigation or action.
- [ ] Every risky action identifies confirmation, reason, pending lock, failure recovery, and
  server-confirmed audit outcome.
- [ ] The diagrams show both role boundary and failure/audit paths.
- [ ] DAI-339 owns runtime/API/component implementation of gaps; DAI-340 owns direct-link,
  cross-scope, expiry, confirmation, responsive, and accessibility validation.
