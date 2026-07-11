# ADR-0603: Platform MEMBER Consumer + Multi-Org Affiliation

- Status: Accepted
- Date: 2026-07-11
- Deciders: Product + Principal Architect
- Context doc: 06_User_RBAC

## Context

ParkVision serves both **closed** sites (school, boarding house — whitelist, SM-managed
residents) and **open** sites (retail, airport — transient parking sessions, QR, fees).
Product decisions (2026-07-11):

1. One **platform consumer** account per person (`role=MEMBER`), reusable at any ParkVision
   tenant (dorm, school, supermarket).
2. Closed orgs **must** give each managed person an account; TA/SM invite/link and manage
   vehicles in their tenant.
3. The same account may be managed by **multiple** orgs (e.g. school + dorm) via affiliations.
4. Public entry does not require login; find-my-car / claim uses the same MEMBER account.

Today every non-`PLATFORM_ADMIN` user has a single `users.tenant_id`, so a MEMBER cannot
belong to two orgs or visit a third tenant as themselves without duplicate accounts.

## Decision

1. **Treat `MEMBER` as a platform consumer identity.** Target: `users.tenant_id IS NULL` for
   `MEMBER` (same NULL semantics as `PLATFORM_ADMIN`, different role). Ops roles
   (`TENANT_ADMIN`, `SITE_MANAGER`) remain single-tenant.
2. **Introduce `member_affiliation(user_id, tenant_id, …)`** — N affiliations per MEMBER.
   TA/SM may invite, link, unlink, and manage vehicles only within their tenant’s
   affiliations. RLS on `member_affiliation` is tenant-scoped like `user_site`.
3. **Vehicles stay tenant-owned.** `vehicles.owner_user_id` points at the platform MEMBER.
   “My garage” for a MEMBER = union of vehicles across affiliation tenants (+ claimed
   public sessions — separate epic).
4. **JWT for MEMBER:** omit `tenant_id` (or null); carry `affiliation_tenant_ids[]` (active
   affiliations) for client convenience. Request tenant context for tenant-scoped APIs is
   taken from the **resource** (vehicle/session/site) or an explicit affiliation check — not
   from a home tenant. Public session claim does not require an affiliation with that retail
   tenant.
5. **Migration path (phased):**
   - Phase A (this change): create `member_affiliation`, backfill from existing
     `MEMBER` rows (`tenant_id` → affiliation), keep `users.tenant_id` populated for
     compatibility with current JWT/RLS.
   - Phase B: stop writing `tenant_id` on new MEMBERs; issue affiliation-aware JWT; list
     members via affiliation join.
   - Phase C: null out `users.tenant_id` for MEMBER; tighten CHECK
     `(role = 'MEMBER' AND tenant_id IS NULL) OR (role IN (…) AND tenant_id IS NOT NULL) OR
      (role = 'PLATFORM_ADMIN' AND tenant_id IS NULL)`.

## Alternatives considered

- **Per-tenant MEMBER accounts** — rejected: product requires one login across school, dorm,
  and supermarket.
- **Separate `GUEST` role** — rejected for v1; anonymous = `ParkingSession` only; after claim
  the actor is `MEMBER`.
- **Global vehicle row (one plate platform-wide)** — rejected: whitelist and billing remain
  tenant-specific; same plate may exist in two tenants under one owner.

## Consequences

- Positive: matches public + closed product; one mobile consumer app; orgs manage people
  without owning the identity forever.
- Negative / trade-offs: RLS and `TenantContext` today assume one tenant per user — MEMBER
  paths must be affiliation-aware (Phase B+); risk of over-broad reads if JWT omits tenant
  but code still sets GUC from a wrong source.
- Follow-ups: `ParkingSession` + QR claim (public epic); invite/link APIs; Phase B/C auth;
  site `accessMode` (`closed` | `open` | `mixed`).

## Schema sketch (Phase A)

```sql
member_affiliation (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id  UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  status     TEXT NOT NULL DEFAULT 'ACTIVE',  -- ACTIVE | INVITED | REVOKED
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (user_id, tenant_id)
)
-- RLS: tenant_id = current_setting('app.tenant_id')
```
