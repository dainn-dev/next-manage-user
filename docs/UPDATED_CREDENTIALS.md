# User Roles & Default Accounts

The system uses a three-role model: **`PLATFORM_ADMIN`**, **`TENANT_ADMIN`**, and **`MEMBER`**.

## Roles

- **`MEMBER`** — vehicle owner / end-user with self-service access (own vehicles, requests, dashboard basics).
- **`TENANT_ADMIN`** — full control within one tenant (users, vehicles, sites, gates, approvals, billing portal). Legacy SITE_MANAGER / SECURITY_GUARD / APPROVER / SECURITY_OFFICER / tenant ADMIN duties fold here.
- **`PLATFORM_ADMIN`** — SaaS operator (tenant lifecycle, platform billing overview). Not day-to-day parking ops.

## Default accounts

On a fresh database the backend seeds accounts (e.g. platform/tenant admin and a member). **Their passwords are NOT stored in this repository.**

- Set the initial passwords via environment variables at first boot — see `sample.env` / `backend/.env.example` (`ADMIN_DEFAULT_PASSWORD`, `USER_DEFAULT_PASSWORD` or the equivalent keys your deployment uses).
- If no override is provided, the seeded accounts are created in a **must-change-password** state; log in once and set a real password before exposing the app.
- **Never commit real credentials.** Rotate any password that has ever been shared in plaintext.

> Security note: this file previously listed hard-coded default passwords. They were removed. If those defaults were ever deployed, rotate them immediately.

## Role permissions

| Feature | MEMBER | TENANT_ADMIN | PLATFORM_ADMIN |
|---|---|---|---|
| Login / Logout | ✅ | ✅ | ✅ |
| View Dashboard | ✅ (own scope) | ✅ | Platform console |
| Manage Employees / Vehicles | limited / own | ✅ | — |
| Manage Departments | — | ✅ | — |
| **Manage Users** | ❌ | ✅ (tenant) | Platform admins |
| **Bulk Operations** | ❌ | ✅ | — |
| **Tenant / system administration** | ❌ | ✅ (tenant) | ✅ (platform) |

## Troubleshooting "Access Denied"

1. Confirm you're logged in with a **`TENANT_ADMIN`** account for tenant admin routes (`/users`, `/api/admin/**`), or **`PLATFORM_ADMIN`** for `/platform/*`.
2. Inspect the JWT payload (browser dev tools) to verify the `role` claim.
3. Clear cached cookies/tokens after a role change and log in again.
