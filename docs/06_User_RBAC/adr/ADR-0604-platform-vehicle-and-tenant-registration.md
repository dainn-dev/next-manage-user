# ADR-0604: Platform Vehicle + Tenant Registration (Closed) vs Visit-Only (Open)

- Status: Accepted
- Date: 2026-07-11
- Deciders: Product + Principal Architect
- Context doc: 06_User_RBAC
- Supersedes (in part): ADR-0603 §3 “Vehicles stay tenant-owned” and the rejected
  “global vehicle row” alternative — product now requires one plate across many closed orgs.

## Context

One physical vehicle (one license plate) is used at dorm, school, and supermarket under the
same MEMBER account. Closed orgs need a whitelist of plates; open retail needs visit sessions
and find-my-car without org membership.

Product lock (2026-07-11):

1. **Closed:** Tenant does **not** CRUD platform vehicle master data. Ops only **register a
   plate into the tenant management page**. If the platform already has that plate + MEMBER
   config → mark/link the MEMBER into the tenant (affiliation) and register the vehicle at
   that tenant. If not → create platform vehicle info; when the MEMBER logs in they see the
   vehicle registered at that tenant. Mandatory because one vehicle spans many tenants.
2. **Open (retail):** **Visit only** — no tenant vehicle registration / whitelist.
3. **Find-my-car (retail):** At entry, guard prints a QR; MEMBER logs into the **web** app and
   scans/enters the code to claim the session; lot cameras detect the plate and assign a
   parking-slot / location address to the open session.
4. MEMBER MVP surface is a **minimal web** app (not mobile-first): garage, orgs/registrations,
   QR claim / where-is-my-car, visit history, account.

## Decision

1. **Platform vehicle:** one normalized plate → one platform vehicle row; `owner_user_id`
   points at the platform MEMBER when known. MEMBER may configure vehicle metadata (type,
   color, …). Unique plate platform-wide.
2. **Tenant vehicle registration** (closed / mixed whitelist path):
   `(vehicle_id, tenant_id[, site_id], status)` — ops “add plate to management”. Adding a
   plate may upsert `member_affiliation` when an owner exists. Removing registration does
   **not** delete the platform vehicle. Gate closed checks **registration**, not a
   per-tenant vehicle clone.
3. **Open sites:** entry creates `ParkingSession`; no registration required. Claim via QR
   binds session to MEMBER. Slot/location updates come from lot-camera detection keyed by
   plate on OPEN sessions.
4. **MEMBER web MVP nav:** Xe · Đăng ký tại org · Visit/QR · Lịch sử · Tài khoản. No ops
   chrome (users, gates, SaaS billing).
5. **Implement after identity Phase C** as a dedicated epic (schema migration + gate check
   rewrite + FE MEMBER shell). Until then, code may still use tenant-scoped `vehicles` rows;
   treat that as transitional debt.

## Alternatives considered

- **Keep per-tenant vehicle rows (ADR-0603)** — rejected: forces duplicate masters and fights
  “one plate, many orgs.”
- **Supermarket also registers plates** — rejected: retail is visit-only; loyalty whitelist
  can be a later opt-in.
- **Mobile-first MEMBER MVP** — deferred; web tối giản first.

## Consequences

- Positive: matches real multi-org plate reuse; clear closed vs open UX; find-car path is
  explicit (QR + claim + camera→slot).
- Negative: migration from tenant-owned `vehicles`; gate check and entitlements must read
  registrations; plate uniqueness becomes platform-wide (policy for conflicts).
- Follow-ups: Flyway for platform vehicle + `tenant_vehicle_registration`; MEMBER web shell;
  gate print QR; lot camera → slot on session; amend RBAC matrix (tenant “manage
  registrations”, not vehicle CRUD).

## Schema sketch (target)

```sql
-- Platform master (tenant_id NULL or omitted)
vehicle (
  id UUID PK,
  license_plate_normalized TEXT UNIQUE NOT NULL,
  owner_user_id UUID NULL REFERENCES users(id),  -- MEMBER when linked
  -- brand, model, color, type, ...
)

tenant_vehicle_registration (
  vehicle_id UUID NOT NULL REFERENCES vehicle(id),
  tenant_id  UUID NOT NULL REFERENCES tenant(id),
  site_id    UUID NULL,
  status     TEXT NOT NULL DEFAULT 'ACTIVE',
  PRIMARY KEY (vehicle_id, tenant_id)
)
-- RLS on registration: tenant_id = app.tenant_id
```
