# User Roles & Default Accounts

The system uses a two-role model: **USER** and **ADMIN**.

## Roles

- **USER** — regular user with basic access (dashboard, employees, vehicles, departments).
- **ADMIN** — full access, including user management (`/users`), bulk operations, and system administration.

## Default accounts

On a fresh database the backend seeds two accounts (`admin` and `user`). **Their passwords are NOT stored in this repository.**

- Set the initial passwords via environment variables at first boot — see `sample.env` / `backend/.env.example` (`ADMIN_DEFAULT_PASSWORD`, `USER_DEFAULT_PASSWORD` or the equivalent keys your deployment uses).
- If no override is provided, the seeded accounts are created in a **must-change-password** state; log in once and set a real password before exposing the app.
- **Never commit real credentials.** Rotate any password that has ever been shared in plaintext.

> Security note: this file previously listed hard-coded default passwords. They were removed. If those defaults were ever deployed, rotate them immediately.

## Role permissions

| Feature | USER | ADMIN |
|---|---|---|
| Login / Logout | ✅ | ✅ |
| View Dashboard | ✅ | ✅ |
| Manage Employees | ✅ | ✅ |
| Manage Vehicles | ✅ | ✅ |
| Manage Departments | ✅ | ✅ |
| **Manage Users** | ❌ | ✅ |
| **Bulk Operations** | ❌ | ✅ |
| **System Administration** | ❌ | ✅ |

## Troubleshooting "Access Denied"

1. Confirm you're logged in with an **ADMIN** account — only ADMIN can reach `/users` and `/api/admin/**`.
2. Inspect the JWT payload (browser dev tools) to verify the `role` claim.
3. Clear cached cookies/tokens after a role change and log in again.
