# User Roles & Sample Accounts (local testing)

ParkVision uses four product roles: **`PLATFORM_ADMIN`**, **`TENANT_ADMIN`**,
**`SITE_MANAGER`**, and **`MEMBER`**. See [`06_User_RBAC`](./06_User_RBAC/README.md) for the
permission matrix and JWT claims.

## Roles (summary)

| Role | Scope | Typical use |
|------|--------|-------------|
| `PLATFORM_ADMIN` | Cross-tenant (`tenant_id` NULL) | SaaS operator: tenants, platform billing/audit. Not day-to-day parking ops. |
| `TENANT_ADMIN` | One tenant | Org settings, billing, sites, users, invite MEMBERs, full ops. |
| `SITE_MANAGER` | Assigned sites (`user_site` / JWT `site_ids`) | Branch ops: gates, cameras, vehicles, logs. No org/billing/site CRUD. |
| `MEMBER` | Platform consumer (`tenant_id` NULL) | One account per person; affiliations + claimed parking sessions. |

## Sample accounts (local / testing)

These credentials are for **local development and e2e only**. Disable the demo seeder in
prod (`APP_SEED_DEMO_USERS=false` / `app.seed-demo-users=false`).

### Auto-seeded (`DataSeederService`)

Runs on first boot when the user table is empty (or promotes an existing `admin` to
`PLATFORM_ADMIN` if present).

| Username | Password | Email | Role |
|----------|----------|-------|------|
| `admin` | `SecurePass123!` | `admin@vehiclemanagement.com` | `PLATFORM_ADMIN` |
| `user` | `UserPass123!` | `user@vehiclemanagement.com` | `MEMBER` (affiliated to DEFAULT tenant) |

### Create the other roles for testing

| Role | How |
|------|-----|
| `TENANT_ADMIN` | Public register: `POST /api/auth/register` (UI signup) — creates tenant + site + TA. E2e scripts use password `SecurePass123!`. |
| `SITE_MANAGER` | As TA: create user with `role=SITE_MANAGER` and non-empty `siteIds`. See `backend/scripts/e2e-site-manager.ps1`. |
| Extra `MEMBER` | As TA/SM: `POST /api/member-affiliations/invite` (create-or-link). See `backend/scripts/e2e-member-phase-b.ps1`. |

### Optional / edge

| Identity | How |
|----------|-----|
| Flyway `platform_admin` | Only inserted when `PLATFORM_ADMIN_EMAIL` and `PLATFORM_ADMIN_PASSWORD_HASH` are both set (V42 fail-closed). |
| Gate / edge | Header `X-Gate-Key` must match backend `GATE_API_KEY`. If unset locally, the gate filter runs open. |

## Role permissions (high level)

| Feature | MEMBER | SITE_MANAGER | TENANT_ADMIN | PLATFORM_ADMIN |
|---|---|---|---|---|
| Login / Logout | ✅ | ✅ | ✅ | ✅ |
| Own vehicles / affiliations | ✅ | — | — | — |
| Site-scoped ops (gates, cameras, vehicles) | — | ✅ assigned | ✅ | — |
| Users / billing / sites CRUD | — | limited / no | ✅ | — |
| Platform console `/platform/*` | ❌ | ❌ | ❌ | ✅ |

## Troubleshooting "Access Denied"

1. Use **`TENANT_ADMIN`** for tenant admin routes, **`SITE_MANAGER`** only within assigned
   sites, **`PLATFORM_ADMIN`** for `/platform/*`, **`MEMBER`** for consumer self-service.
2. Inspect the JWT (`role`, `tenant_id`, `site_ids`, `affiliation_tenant_ids`).
3. Clear `localStorage` `auth_token` after a role change and log in again.
