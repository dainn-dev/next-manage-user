# User Identity & RBAC

How ParkVision evolves today's single-tenant JWT and four-role model into a multi-tenant,
site-scoped identity and authorization system, plus the machine-identity model for edge
devices.

Status: Draft · Owner: Principal Architect · Last updated: 2026-07-09

## 1. Purpose

Define the target role set and how it maps from today's roles, the JWT claim evolution, the
permission matrix, site-scoped authorization, and the credential model for edge/camera
authentication. This document assumes the tenant-context mechanics defined in
`04_Multi_Tenant_Design`.

## 2. Current State vs Target

### Current state (brief §1)

- **Roles today**: `USER`, `APPROVER`, `SECURITY_OFFICER`, `ADMIN` — stored as `ROLE_<name>`,
  enforced via URL security rules and `@PreAuthorize`. No tenant or site concept, no
  hierarchy beyond these four flat roles.
- **JWT**: jjwt 0.11.5, HS256, claims `role`/`email`/`userId` only, 86400s expiry. No
  `tenant_id`, no site scope.
- **Frontend auth**: JWT stored in `localStorage` (`auth_token`), sent as
  `Authorization: Bearer`, client-side expiry decode, **no `middleware.ts`** — route
  protection is client-side only (`ProtectedLayout` redirects to `/login`).
- **Gate/edge auth**: a second Spring Security filter, `GateApiKeyAuthFilter`, checks a
  single shared `X-Gate-Key` header against one `GATE_API_KEY` env value for **all** gates.
  **Runs open (no auth) if `GATE_API_KEY` is unset** — an explicit dev fallback, not a
  production-safe default.
- **No Keycloak/OIDC, no MFA, no per-camera credentials, no site scoping** exist today.

### Target

Five roles (`PLATFORM_ADMIN`, `TENANT_ADMIN`, `SITE_MANAGER`, `SECURITY_GUARD`,
`MEMBER`/`USER`) with tenant + site scoping carried in the JWT; a permission matrix enforced
by an authorization guard layered on top of `@PreAuthorize`; per-camera credentials replacing
the single shared gate key; Keycloak/OIDC kept as an explicit optional future path, not
adopted now (ADR-0601).

### The gap

Role model, JWT claims, and authorization checks all need to change; the frontend needs
route-level tenant/site awareness; the entire edge credential model (ADR-0602) needs to move
from one shared key to per-camera keys before multi-tenant production launch.

## 3. Role Model and Mapping from Today

| Target role | Scope | Maps from today's role (brief §1) |
|---|---|---|
| `PLATFORM_ADMIN` | Cross-tenant, platform operations | New — no equivalent today; carved out of `ADMIN`'s broader powers |
| `TENANT_ADMIN` | Full control within one tenant, all its sites | `ADMIN` (tenant-scoped portion) |
| `SITE_MANAGER` | Manages one or more sites within a tenant; approves requests | `ADMIN` (site-scoped ops) **+** `APPROVER`'s approval rights fold in here |
| `SECURITY_GUARD` | Gate/kiosk operation at assigned site(s) | `SECURITY_OFFICER`, renamed |
| `MEMBER` / `USER` | Vehicle owner, self-service (view own vehicle/history) | `USER` |

`APPROVER` does not survive as a standalone role — its sole responsibility (approving
`VehicleAccessRequest`s) becomes one of `SITE_MANAGER`'s permissions, since approval is
inherently a site-level operational decision, not a distinct persona. See
`diagrams/role-hierarchy.mmd`.

## 4. JWT Claim Evolution

| Claim | Today | Target |
|---|---|---|
| `userId` | yes | yes (unchanged) |
| `email` | yes | yes (unchanged) |
| `role` | yes, one of 4 flat roles | yes, one of 5 target roles |
| `tenant_id` | — | new; null only for `PLATFORM_ADMIN` |
| `site_ids[]` | — | new; array of site UUIDs the token holder is scoped to, or a wildcard marker for `TENANT_ADMIN`/`PLATFORM_ADMIN` |
| `exp` | 86400s | unchanged for now (see ADR-0601 open question on refresh) |

Full propagation mechanics (ThreadLocal + RLS session var) are defined in
`04_Multi_Tenant_Design` ADR-0402 — this document owns the *role/permission* semantics of the
claims, that document owns the *tenant isolation* mechanics.

## 5. Permission Matrix

Resource × action × role. `✓` = allowed, `Site` = allowed only within the role's scoped
site(s), `Own` = allowed only on the acting user's own records, `—` = denied.

| Resource | Action | PLATFORM_ADMIN | TENANT_ADMIN | SITE_MANAGER | SECURITY_GUARD | MEMBER |
|---|---|---|---|---|---|---|
| Tenant | create/suspend | ✓ | — | — | — | — |
| Tenant | view own | ✓ | ✓ | Site | — | — |
| Site | create/edit/delete | ✓ | ✓ | — | — | — |
| Site | view | ✓ | ✓ | Site | Site | — |
| Camera/Gate | register/edit | ✓ | ✓ | Site | — | — |
| Camera/Gate | view status | ✓ | ✓ | Site | Site | — |
| ParkingSlot | configure (draw polygon) | ✓ | ✓ | Site | — | — |
| Vehicle | view any (tenant) | ✓ | ✓ | Site | Site | Own |
| Vehicle | register/edit | ✓ | ✓ | Site | — | Own |
| VehicleAccessRequest | approve/reject | ✓ | ✓ | Site | — | — |
| VehicleAccessRequest | create | ✓ | ✓ | Site | Site (on behalf) | Own |
| Gate kiosk check-in | perform | — | — | — | Site | — |
| User | invite/manage roles | ✓ (any tenant) | ✓ (own tenant) | Site (guards only) | — | — |
| Subscription/Billing | view/manage | ✓ | ✓ | — | — | — |
| Notification | configure channels | ✓ | ✓ | Site | — | Own |
| Chatbot | query | ✓ | ✓ | Site | Site | Own |
| Analytics dashboard | view | ✓ (cross-tenant) | ✓ | Site | — | — |
| Audit log | view | ✓ (cross-tenant) | ✓ (own tenant) | — | — | — |

This matrix is the source of truth for the `@PreAuthorize`/`AuthzGuard` implementation — see
`diagrams/authz-decision-flow.mmd` for how a request is evaluated against it at runtime.

## 6. Site-Scoped Permissions

Roles below `TENANT_ADMIN` carry a `site_ids[]` scope. Authorization for a site-scoped
resource (Camera, ParkingSlot, Gate, site-level Vehicle views) requires **both**: (1) the
permission matrix (§5) allows the role+action+resource combination, **and** (2) the
resource's `site_id` is present in the token's `site_ids[]`. A `SITE_MANAGER` assigned to
Site A cannot approve a `VehicleAccessRequest` at Site B even though the role generally has
approval rights — the site-scope check in `diagrams/authz-decision-flow.mmd` runs after the
role check and independently rejects out-of-scope requests with 403.

## 7. Gate/Edge Machine Authentication

Today: single shared `X-Gate-Key` header, checked by `GateApiKeyAuthFilter`, **fails open if
unset** (brief §1) — a known gap that must close before multi-tenant production use.

Target (ADR-0602): **per-camera API key**, issued at camera registration, associated with
exactly one `tenant_id`/`site_id`/`camera_id`, sent as `X-Camera-Key`. Keys are rotatable
with a grace window so an edge appliance's config can roll without a hard outage. A
compromised or decommissioned camera's key is revoked individually — no platform-wide key
rotation required. **mTLS** (client certificates per edge appliance) is noted as a future
option for tenants needing stronger machine-identity guarantees, not committed as the
default now.

## 8. Future: Keycloak/OIDC

Not adopted now (ADR-0601). The JWT claim shape (`sub`/`role`/`tenant_id`/`site_ids`/`exp`)
is deliberately kept OIDC-adjacent so that if a concrete driver appears later — enterprise
tenant SSO requirement, centralized session revocation, MFA — swapping the `iam` module's
`TokenIssuer`/`TokenValidator` for an OIDC-backed implementation is a contained change behind
that interface rather than a rewrite of every consumer of role/tenant claims.

## 9. Diagrams

- `diagrams/role-hierarchy.mmd` — target role scopes and the explicit mapping from today's
  four roles.
- `diagrams/auth-sequence.mmd` — login → JWT issuance → subsequent request tenant/role
  scoping via `TenantContextFilter` and `@PreAuthorize`.
- `diagrams/authz-decision-flow.mmd` — the authorization decision flow: token validity →
  cross-tenant check → permission matrix → site scope → hand-off to `EntitlementGuard`.

## 10. Decisions / ADRs

- [`adr/ADR-0601-custom-jwt-now-oidc-later.md`](adr/ADR-0601-custom-jwt-now-oidc-later.md) — Keep custom JWT now, optional OIDC/Keycloak later.
- [`adr/ADR-0602-edge-camera-credential-model.md`](adr/ADR-0602-edge-camera-credential-model.md) — Edge/camera credential model: per-camera key with rotation.

## 11. Open Questions / Risks

- Frontend JWT storage remains `localStorage` (XSS-exposed) — migration to httpOnly
  cookie/in-memory storage is tracked but not scheduled; independent of the RBAC changes
  here.
- 86400s JWT expiry was designed for a single-tenant, low-risk context; whether it remains
  appropriate once tokens carry `tenant_id`/`site_ids[]` (higher blast radius if leaked) is
  an open question — see `04_Multi_Tenant_Design` ADR-0402.
- `site_ids[]` claim size for a `SITE_MANAGER` at a very large tenant with many sites is
  unbounded today — may need a cached lookup instead of an inline claim (same open question
  as ADR-0402).
- The permission matrix (§5) is a first draft — needs product/security sign-off before
  encoding into `@PreAuthorize` annotations at implementation time.

## 12. Cross-References

- `04_Multi_Tenant_Design` — JWT tenant-claim propagation mechanics (ThreadLocal/RLS), which
  this document's role claims ride alongside.
- `03_SaaS_Architecture` — `iam` module placement in the overall module decomposition.
- `05_Subscription_Billing` — `TENANT_ADMIN` as the only role permitted to manage billing;
  `EntitlementGuard` as the next check after authorization (§5/§6 here hand off to it).
- `07_Camera_Management` (sibling doc) — camera registration flow that issues the per-camera
  key described in §7.
