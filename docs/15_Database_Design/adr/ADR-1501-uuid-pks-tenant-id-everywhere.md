# ADR-1501: Keep UUID primary keys; add tenant_id to every tenant-owned table

- Status: Proposed
- Date: 2026-07-09
- Deciders: Principal Architect
- Context doc: 15_Database_Design

## Context

All 8 current entities (Employee, Vehicle, VehicleLog, User, VehicleAccessRequest, Gate,
Department, Position) already use **UUID primary keys**
(`@GeneratedValue(strategy = GenerationType.UUID)`), and **none of them carry a `tenant_id`
or `site_id`** column today — the system is single-tenant. The multi-tenancy model chosen at
the platform level (brief §3.2) is shared-database, shared-schema with a `tenant_id`
discriminator plus PostgreSQL Row-Level Security (RLS), resolved from JWT claims, with a
documented upgrade path to schema-per-tenant for large tenants. That model only works if
`tenant_id` is present, indexed, and enforced (not optional/nullable-by-omission) on every
row that belongs to a tenant.

## Decision

- **Keep UUID PKs** for every table, existing and new — no change to the current strategy.
  UUIDs avoid cross-tenant ID collisions if we ever split to schema-per-tenant or shard, and
  they are already the established convention across the whole codebase and API.
- **Add `tenant_id UUID NOT NULL REFERENCES tenant(id)`** to every tenant-owned table: the
  existing `employees`, `vehicles`, `users`, `departments`, `positions`, `gate`,
  `vehicle_log`, `vehicle_access_request`, plus every new SaaS table (`site`, `zone`,
  `camera`, `parking_slot`, `vehicle_track`, `parking_event`, `parking_history`,
  `motion_event`, `snapshot`, `subscription`, `usage_record`, `notification`). `User` is the
  one documented exception: `tenant_id` is **nullable** there, to represent
  `PLATFORM_ADMIN` users who are not scoped to any tenant.
- Tables that are also site-scoped (e.g. `parking_slot`, `camera`, `parking_event`) carry
  **both** `tenant_id` and `site_id` — `tenant_id` is not derivable-only-via-join from
  `site_id` in the RLS policy, so it stays denormalized on every row for cheap, single-column
  RLS predicates without a join.
- Every `tenant_id` column gets a **B-tree index** (usually a composite
  `(tenant_id, <natural query column>)`, e.g. `(tenant_id, license_plate)` on `vehicle`) —
  RLS turns every query into an implicit `tenant_id = current_setting(...)` filter, so an
  unindexed `tenant_id` is a guaranteed full-tenant-table scan.

## Alternatives considered

- **Switch to bigint/sequence PKs** — smaller index footprint and faster joins than UUID, but
  breaks the existing API contract (every current DTO and the frontend already assume UUID
  string IDs), and loses the collision-free property that matters if we ever shard or go
  schema-per-tenant. Rejected — no material benefit outweighs the churn.
- **Derive tenant scope only from `site_id` (no direct `tenant_id` column)** — normalized, one
  less column to keep in sync, but forces a join (or a stored/generated column) into every RLS
  policy and every service-layer query, and doesn't work at all for tables with no `site_id`
  (e.g. `vehicle`, `subscription`, `usage_record`). Rejected — direct `tenant_id` is cheaper
  and simpler to enforce uniformly.
- **Nullable `tenant_id` everywhere, enforced only in application code** — fastest to ship,
  but re-creates exactly the class of bug RLS exists to prevent (a missing `WHERE tenant_id =
  ?` in one query path leaks cross-tenant data). Rejected except for the single documented
  `User.tenant_id` platform-admin case.

## Consequences

- Positive: uniform, indexable, RLS-enforceable tenant scoping across the whole schema;
  UUID PKs remain a non-breaking, zero-churn choice for every existing API consumer.
- Negative / trade-offs: every existing table needs a migration (see
  `adr/ADR-1504-stop-ddl-auto-migration-only.md` and the migration-plan diagram) to add,
  backfill, and NOT-NULL-constrain `tenant_id`; UUID PKs are wider on disk/index than bigint
  and marginally slower to compare, which is an accepted, already-paid cost.
- Follow-ups: schema-per-tenant (documented upgrade path per brief §3.2) is out of scope for
  this ADR — it would be a separate follow-up ADR triggered by a specific large-tenant
  isolation or performance requirement, not a default.
