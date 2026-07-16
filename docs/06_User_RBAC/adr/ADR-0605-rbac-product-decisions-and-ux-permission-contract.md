# ADR-0605: RBAC Product Decisions and UX Permission Contract

- Status: Accepted
- Date: 2026-07-16
- Owner: Product
- Security-boundary reviewer: Principal Architect
- Tracking: DAI-332 (Stage 1 of DAI-331)
- Downstream: DAI-337, DAI-338, DAI-339, DAI-340
- Context doc: [06_User_RBAC](../README.md)

## Context

The product has five canonical human roles in `User.Role`, while the existing RBAC documentation
still describes four roles and calls `SECURITY_GUARD` retired. Navigation, browser route handling,
Spring Security request matchers, controller annotations, tenant RLS, and `SiteAccess` are separate
layers. They must not be mistaken for substitutes: hiding a control or redirecting a browser does
not authorize a request.

DAI-332 fixes the product decisions that all role wireflows must share and defines the authoritative
review contract. Detailed current route/action policy lives in
[permission-matrix.md](../permission-matrix.md).

## Decision register

| Decision | Owner | Status | Approved outcome | Rationale |
|---|---|---|---|---|
| Security guard authority | Product | Approved by DAI-332 | `SECURITY_GUARD` is an assigned-site operational role. It may view live operations, verify and escalate exceptions, and perform a specifically defined manual access override. It cannot CRUD users, roles, vehicles or registrations, sites, zones, cameras, credentials, billing, or parking-map configuration. | Guards need a controlled way to resolve an on-site access incident without acquiring administrative configuration power. |
| Member identity model | Product | Approved by DAI-332 | One platform-level `MEMBER` identity may hold many tenant/site affiliations. It is self/ownership/claimed-session scoped and never gains tenant back-office rights through an affiliation. | One person must not need duplicate accounts for a school, dorm, retail visit, or another participating tenant. This adopts ADR-0603 and ADR-0604. |
| Site-manager delegation | Product | Approved by DAI-332 | A `SITE_MANAGER` cannot invite, role-assign, activate, deactivate, or site-assign a guard. Only `TENANT_ADMIN` provisions an ops identity and its assignments. Operational coordination does not delegate permissions. | Staffing, identity, and role elevation are tenant-wide security decisions, even when a manager is responsible for a site. |
| MVP device approach | Product | Approved by DAI-332 | Platform and tenant operations use responsive web; guards receive a kiosk/tablet-oriented assigned-site mode; member self-service is mobile-first web. Native applications are outside MVP. | The interfaces serve different environments without committing MVP delivery to native client distribution. |

## Permission contract

### Canonical names

The backend contract uses these exact role names:

- `PLATFORM_ADMIN`
- `TENANT_ADMIN`
- `SITE_MANAGER`
- `SECURITY_GUARD`
- `MEMBER`

The current frontend presents `TENANT_ADMIN` as `ADMIN` and `MEMBER` as `USER`. Those are display
and compatibility aliases only; they must not create a sixth role or weaken the five-role policy.

### Four independent controls

| Control | Responsibility | Non-authoritative / authoritative boundary |
|---|---|---|
| UI visibility | Navigation, buttons, labels, disabled state, and layout | Usability only. A hidden link is not denial. |
| Frontend route guard | Redirect an authenticated person to the right shell and avoid protected-content flash | Browser experience only. It cannot protect a direct HTTP request. |
| Backend API enforcement | Spring Security, controller/service authorization, device filters, and resource ownership checks | Authoritative capability decision. |
| Data scope | Tenant RLS plus resource ownership and assigned-site validation | Authoritative record boundary. A client-supplied tenant or site never expands scope. |

The response contract is: `401` when authentication is absent or invalid; `403` when an authenticated
principal lacks a capability on a visible resource; and `404` for an out-of-scope resource where
revealing that it exists would disclose cross-tenant or cross-site information.

### Scope vocabulary

| Scope | Meaning |
|---|---|
| Platform | SaaS control-plane metadata only; it does not imply tenant parking operations. |
| Tenant | The validated tenant from the principal and request transaction/RLS context. |
| Assigned site | A resource whose owning `siteId` is in the principal's server-resolved assignment. |
| Self / owned | The principal's own profile, vehicle, notification, or other owned record. |
| Affiliation | A MEMBER record reachable through an active member affiliation; it remains consumer self-service. |
| Claimed session | A public parking session claimed by the current MEMBER. |
| Device | A camera, gate, or webhook principal authenticated by its own credential, not a human role. |

`PLATFORM_ADMIN` has no implicit tenant operational access. Any later support access needs a separate,
expiring support-session contract with tenant, scope, reason, and audit identity.

## Guard operational override

A guard override is intentionally narrow: an assigned-site guard may allow or deny a named access
exception only after an explicit confirmation and a mandatory, non-blank reason. The final action
must be written to an append-only tenant/site operational audit record in the same transaction.

DAI-332 approves this behavior but does not claim that it exists today. DAI-337 must define the
request/response shape, assignment and event preconditions, outcome states, audit record, and
supervisor handover experience. It must reuse server-side assigned-site validation; a frontend
selected site or hidden menu cannot establish authority.

## Audit, confirmation, and reason rules

| Rule | Required actions |
|---|---|
| Audit | Platform tenant/admin/billing changes; role or site-assignment changes; user activation/deactivation; member-affiliation changes; vehicle/access approvals and rejections; camera credential issue/rotation/revocation; guard override; exports of sensitive data; parking-map publish/archive/delete/rollback; future support sessions. |
| Explicit confirmation | Delete, archive, publish, rollback, credential rotation/revocation, user deactivation, role/site assignment changes, and guard override. |
| Mandatory reason | Guard override, credential revocation, parking-map rollback, role/site removal, user deactivation, and any future support session. |

The existing platform audit is not a substitute for tenant/site operational auditing. Parking-map
rollback already validates a non-empty reason; later sensitive flows must enforce their reason on
the server as well.

## Consequences and follow-up

- The matrix is the product and UX source of truth for DAI-337 through DAI-340. A downstream route,
action, or API change must update it in the same pull request.
- The existing `TenantContext`, RLS policies, and `SiteAccess.assertSiteAllowed()` remain the
runtime foundations for tenant and assigned-site scope.
- DAI-337 implements guard override/audit behavior. DAI-339 maps target policy to route/API
implementation. DAI-340 verifies denied routes and cross-tenant/site leakage.
- This ADR does not modify Flyway migrations or runtime authorization. Any future schema change
uses a new forward-only migration; existing migrations are immutable.

## Related decisions

- [ADR-0602: Edge/Camera Credential Model](ADR-0602-edge-camera-credential-model.md)
- [ADR-0603: Platform MEMBER Consumer + Multi-Org Affiliation](ADR-0603-platform-member-and-affiliation.md)
- [ADR-0604: Platform Vehicle + Tenant Registration](ADR-0604-platform-vehicle-and-tenant-registration.md)
- [ADR-1703: MVP dashboard RBAC, scoping, realtime, and frontend contracts](../../17_Dashboard/adr/ADR-1703-dashboard-rbac-realtime-contracts.md)
