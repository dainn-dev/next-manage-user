# User Identity & RBAC

How ParkVision authorizes humans and edge devices in a multi-tenant SaaS: the role
model, JWT claims, permission matrix, and camera credential model.

Status: Draft · Owner: Principal Architect · Last updated: 2026-07-11

## 1. Purpose

Define the role set, JWT claim semantics, permission matrix, and the credential model for
edge/camera authentication. Tenant-context mechanics live in `04_Multi_Tenant_Design`.

## 2. Current State vs Target

### Implemented now

- **Roles**: `PLATFORM_ADMIN`, `TENANT_ADMIN`, `SITE_MANAGER`, `MEMBER` (DB CHECK +
  `User.Role` enum). Site membership in `user_site` for `SITE_MANAGER`.
- **JWT**: jjwt, HS256; claims include `role`, `email`, `userId`, `tenant_id` (omitted for
  `PLATFORM_ADMIN` and `MEMBER`), `site_ids` (non-empty for `SITE_MANAGER`),
  `affiliation_tenant_ids[]` (MEMBER), `password_version`.
- **Frontend auth**: JWT in `localStorage` (`auth_token`); route protection is client-side
  (`ProtectedLayout`). Platform console under `/platform/*` is gated to `PLATFORM_ADMIN`.
- **Gate/edge auth**: `GateApiKeyAuthFilter` + `X-Gate-Key` (shared key; see ADR-0602 for
  per-camera target).
- **MEMBER (Phase A–C, ADR-0603)**: platform consumer with `users.tenant_id NULL`;
  `member_affiliation` + RLS so TA/SM see affiliated MEMBERs; JWT omits `tenant_id` and
  carries `affiliation_tenant_ids[]`; invite/link `POST /api/member-affiliations/invite`;
  create MEMBER via admin path (null tenant) + affiliation; MEMBER vehicle list is
  owner+affiliation scoped (no default-tenant leak).
- **Parking fee (bank transfer)**: `parking_session` / `parking_payment` / site bank account
  (V60); SePay webhook; ADR-0503. Not wired to gate ANPR yet.

### Target refinements (still open)

- **ADR-0604 Phase D:** `tenant_vehicle_registration` (V62); register-by-plate API; gate checks
  ACTIVE registration; vehicle DELETE revokes registration only. Nullable `vehicles.tenant_id`
  still transitional.
- MEMBER web shell — **shipped** `/me/*` + `/api/member/*` (garage, orgs, QR claim, history).
- Gate auto-open `ParkingSession` + QR print; lot camera → slot on session; site `accessMode`.
- Per-camera keys (ADR-0602); optional OIDC later (ADR-0601).

## 3. Role Model

| Role | Scope | Responsibility |
|---|---|---|
| `PLATFORM_ADMIN` | Cross-tenant (`tenant_id` NULL) | SaaS operator: tenant lifecycle, platform billing overview, platform audit/support. **Not** day-to-day parking ops. |
| `TENANT_ADMIN` | One tenant | Org settings, billing, sites CRUD, users (including assigning `SITE_MANAGER` + sites), invite/link MEMBER affiliations, full ops. |
| `SITE_MANAGER` | 1+ sites via `user_site` / JWT `site_ids` | Ops within assigned branches: gates, cameras, zones, logs, vehicle approve. **No** org/billing/create-delete sites. May manage MEMBER vehicles/affiliations in assigned sites (product: closed orgs). |
| `MEMBER` | **Platform consumer** (`tenant_id` NULL) | One account per person. Self-service across affiliations + claimed public sessions. **Not** an ops role. |

Legacy `SECURITY_GUARD` remains retired. `SITE_MANAGER` was reintroduced (V57) for multi-branch orgs.

### 3.1 MEMBER: public vs non-public

| | Non-public (closed) | Public (open / retail) |
|--|---------------------|-------------------------|
| Examples | `school`, `boarding-house` | `retail`, `airport` |
| Identity | Every managed person **has** a MEMBER account | Login optional to enter/exit; required for find-my-car / QR claim |
| Org control | TA/SM **register plate into tenant management** (ADR-0604); may auto-affiliate existing MEMBER. **No** platform vehicle CRUD by tenant | **Visit only** — no tenant plate registration |
| Multi-org | One plate → many closed registrations (dorm + school) | Same MEMBER claims sessions at any ParkVision retail tenant |
| Find my car | Registered vehicles / entry logs | Gate prints QR → MEMBER web scans → claim; lot camera assigns slot by plate |

Site policy should use `accessMode` (`closed` | `open` | `mixed`) — schools are often `mixed`
(students closed, visitors open). `managementModel` remains industry label only until flags ship.

### 3.2 Affiliation + vehicle registration

`member_affiliation(user_id, tenant_id, status)` — who the org manages.

**Target (ADR-0604):** platform `vehicle` (unique plate, optional MEMBER owner) +
`tenant_vehicle_registration` for closed whitelist. MEMBER garage = owned platform vehicles;
“registered at orgs” = registrations; retail history = claimed `ParkingSession`s.

**Transitional (today):** tenant-scoped `vehicles` rows + owner/affiliation scoping until
Phase D migration.

### 3.3 MEMBER web MVP (locked)

Minimal web (not mobile-first): **Xe · Đăng ký tại org · Visit/QR · Lịch sử · Tài khoản**.
No ops chrome. Retail find-car: QR at gate + claim + camera→slot on open session.

## 4. JWT Claim Evolution

| Claim | Semantics |
|---|---|
| `userId` | Subject user id |
| `email` | Email |
| `role` | One of `PLATFORM_ADMIN` / `TENANT_ADMIN` / `SITE_MANAGER` / `MEMBER` |
| `tenant_id` | Ops: home tenant. **Omitted** for `PLATFORM_ADMIN` and `MEMBER`. |
| `site_ids[]` | Assigned sites for `SITE_MANAGER`; **empty** = tenant-wide (TENANT_ADMIN) |
| `affiliation_tenant_ids[]` | Active MEMBER affiliations (Phase B) |
| `password_version` | Invalidates sessions after password reset |
| `exp` | Expiry (default 86400s) |

## 5. Permission Matrix

`✓` = allowed · `Own` = own records only · `Site` = within JWT `site_ids` · `Aff` = within
tenant affiliation · `—` = denied.

| Resource | Action | PLATFORM_ADMIN | TENANT_ADMIN | SITE_MANAGER | MEMBER |
|---|---|---|---|---|---|
| Tenant | list / get / rename / status | ✓ | — | — | — |
| Tenant | view/update own profile | — | ✓ | — | — |
| Site | create/edit/delete | — | ✓ | — | — |
| Site | list/view assigned | — | ✓ (all) | Site | — |
| Camera/Gate/Zone | CRUD | — | ✓ | Site | — |
| Vehicle | view / approve (`current_site_id`) | — | ✓ | Site* | Own |
| Vehicle registration (closed) | add plate / revoke from tenant management | — | ✓ | Site* | — |
| Vehicle | platform master CRUD | — | via register† | via register† | config own (target) |
| VehicleAccessRequest | approve/reject | — | ✓ | ✓ | — |
| VehicleAccessRequest | create | — | ✓ | ✓ | Own |
| Vehicle logs | view/export | — | ✓ | Site | Own (target) |
| Member affiliation | invite / link / revoke | — | ✓ | ✓ (closed) | — |
| ParkingSession | claim QR / where-is-my-car | — | — | — | Own (target) |
| User (ops) | manage + assign sites | — | ✓ | — | — |
| Subscription/Billing (SaaS) | own portal | ✓ (overview) | ✓ | — | — |
| Analytics dashboard | tenant ops | — | ✓ | ✓ | — |
| Analytics | cross-tenant overview | ✓ | — | — | — |
| Audit log | platform / tenant | ✓ / — | — / ✓ | — | — |

\* SITE_MANAGER vehicle scope: `current_site_id IN site_ids`; NULL = TENANT_ADMIN-only until stamped.
† ADR-0604: ops **register plate** into `tenant_vehicle_registration` (link existing platform
  vehicle or create master + registration); revoke registration does not delete the platform row.

## 6. Site vs Gate, and registration intent

- **Site** = chi nhánh / địa điểm / cơ sở. TENANT_ADMIN CRUD; SITE_MANAGER read assigned.
- **Gate** = cổng ra/vào thuộc một site.
- Signup / onboard: **1** default site; `area_count` = intent only; real limit = plan `max_sites`.

## 7. Site-Scoped Permissions

`SITE_MANAGER` membership is stored in `user_site` and copied into JWT `site_ids` at login.
`SiteAccess` + `SiteContext` enforce app-layer checks on gate/camera/zone/logs/vehicles.

- Empty JWT `site_ids` = unrestricted within the tenant (TENANT_ADMIN).
- Vehicles use `vehicles.current_site_id` (last-known branch). Gate entry stamps it from
  `gate.site_id`; exit keeps last-known. `NULL` vehicles are **TENANT_ADMIN-only** until
  stamped or assigned on create. SITE_MANAGER create requires `currentSiteId` in allowed sites.
- `vehicle_log.site_id` and access-request `site_id` are stamped from the gate (not DB default alone).

## 8. Gate/Edge Machine Authentication

Today: shared `X-Gate-Key` via `GateApiKeyAuthFilter`.

Target (ADR-0602): **per-camera API key** bound to `tenant_id` / `site_id` / `camera_id`.

## 9. Future: Keycloak/OIDC

Not adopted now (ADR-0601). Claim shape stays OIDC-adjacent for a later swap behind
`TokenIssuer` / `TokenValidator`. Platform MEMBER identity remains app-issued until OIDC
consumer federation is required.

## 10. Diagrams

- `diagrams/role-hierarchy.mmd` — role scopes
- `diagrams/auth-sequence.mmd` — login → JWT → tenant/role scoping
- `diagrams/authz-decision-flow.mmd` — authz decision flow

## 11. Decisions / ADRs

- [`adr/ADR-0601-custom-jwt-now-oidc-later.md`](adr/ADR-0601-custom-jwt-now-oidc-later.md)
- [`adr/ADR-0602-edge-camera-credential-model.md`](adr/ADR-0602-edge-camera-credential-model.md)
- [`adr/ADR-0603-platform-member-and-affiliation.md`](adr/ADR-0603-platform-member-and-affiliation.md)
- [`adr/ADR-0604-platform-vehicle-and-tenant-registration.md`](adr/ADR-0604-platform-vehicle-and-tenant-registration.md)
- Parking fees (bank transfer): [`../05_Subscription_Billing/adr/ADR-0503-parking-fee-bank-transfer.md`](../05_Subscription_Billing/adr/ADR-0503-parking-fee-bank-transfer.md)

## 12. Sample accounts (local testing)

See the root [`README.md`](../../README.md#sample-accounts-local--testing) and
[`UPDATED_CREDENTIALS.md`](../UPDATED_CREDENTIALS.md). Quick reference:

| Username | Password | Role |
|----------|----------|------|
| `admin` | `SecurePass123!` | `PLATFORM_ADMIN` |
| `user` | `UserPass123!` | `MEMBER` |

`TENANT_ADMIN` / `SITE_MANAGER` are not seeded — create via public register and TA user APIs
(e2e password convention: `SecurePass123!`).

## 13. Open Questions / Risks

- Frontend JWT remains in `localStorage` (XSS-exposed).
- SITE_MANAGER with multiple sites: API returns union of assigned sites; topbar switcher is a
  client-side UX filter only.
- Audited impersonation for support is desired but not implemented.
- MEMBER JWT + RLS must not allow cross-tenant reads outside affiliations / claimed sessions.
- Parking fee billing is separate from SaaS Stripe entitlements (`05_Subscription_Billing`).

## 14. Cross-References

- `04_Multi_Tenant_Design` — tenant claim propagation / RLS
- `03_SaaS_Architecture` — `iam` module placement
- `05_Subscription_Billing` — SaaS billing + `EntitlementGuard`
- `07_Camera_Management` — camera registration / keys
- `18_Mobile_App` — consumer (MEMBER) client target
