# ADR-0401: Shared-Schema + Row-Level Security vs Schema-per-Tenant vs DB-per-Tenant

- Status: Proposed
- Date: 2026-07-09
- Deciders: Principal Architect
- Context doc: 04_Multi_Tenant_Design

## Context

Today's database (`vehicle_management`, PostgreSQL, Flyway V1–V35) has **no tenant concept at
all** — 8 entities, all single-tenant, no `tenant_id` column anywhere (brief §1). The target
vision requires strict isolation between tenants (e.g. supermarket chain A must never see
chain B's vehicles, sites, or billing data) across a growing entity set (brief §4: Tenant,
Site, Zone, Camera, Gate, ParkingSlot, Vehicle, VehicleTrack, ParkingEvent, ParkingHistory,
MotionEvent, Snapshot, User, Subscription, Plan, UsageRecord, Notification). The team must
pick one multi-tenancy data model to build against, knowing some tenants (large enterprise
chains) may eventually need stronger isolation or dedicated performance than others.

## Decision

Adopt **shared-database, shared-schema** multi-tenancy: every tenant-owned table carries a
`tenant_id` column (and most also `site_id` as a second-level scope, per the Tenant → Site →
Zone → ParkingSlot/Camera hierarchy in brief §3.3). Isolation is enforced in **two layers**:
(1) a **Hibernate tenant filter**, enabled per-session from the resolved tenant context, that
appends `tenant_id = :tenantId` to every query as the primary, ORM-level guard; (2)
**PostgreSQL Row-Level Security (RLS)** policies on every tenant-owned table as
defense-in-depth, keyed off a session variable (`current_setting('app.tenant_id')`) set by
the `tenancy` module's request filter — see ADR-0402. RLS ensures isolation holds even if a
future query bypasses the Hibernate filter (raw SQL, a new module written by someone
unfamiliar with the convention, a JPA `@Query` that forgets the filter). A documented upgrade
path to **schema-per-tenant** is kept open for large/enterprise tenants that need stronger
isolation or independent performance tuning (see §6 of the README for the migration
mechanics).

## Alternatives considered

- **Database-per-tenant** — pros: strongest isolation, independent backup/restore/scaling per
  tenant, no risk of cross-tenant query bugs; cons: operationally expensive at this stage —
  N tenants means N connection pools, N migration runs, N monitoring targets; Flyway
  migrations (already at V35) would need to run per-database; not justified before the
  platform has proven product-market fit with a handful of tenants.
- **Schema-per-tenant** — pros: better isolation than shared-schema without full DB
  duplication, single Postgres instance to operate; cons: still requires per-schema migration
  orchestration and connection routing (`search_path` switching or a schema-aware connection
  pool), and Postgres has practical limits on schema count that get uncomfortable well before
  thousands of tenants; adds complexity today's zero-tenant codebase does not yet need.
- **Shared-schema + RLS (chosen)** — pros: simplest operational model (one schema, one
  migration path, Flyway continues to work as-is), cheapest per-tenant marginal cost, fastest
  to build from today's zero-tenant baseline; cons: a single noisy tenant can affect shared
  table/index performance (mitigated in §"Noisy-neighbor mitigation" of the README); requires
  discipline (RLS policies + Hibernate filter on every new table, enforced by a migration
  checklist/test) to avoid isolation bugs.

## Consequences

- Positive: fastest path from today's single-tenant schema to a working multi-tenant MVP;
  every new Flyway migration (V36+) that adds a tenant-owned table follows one repeatable
  pattern (add `tenant_id`, add RLS policy, register Hibernate filter); RLS provides a
  hard safety net independent of application code correctness.
- Negative / trade-offs: large tenants share index and I/O capacity with all others on the
  same tables — requires monitoring (`pg_stat_statements`, per-tenant query cost) to detect
  noisy neighbors before customers do; every new entity added to the domain model must
  remember both the Hibernate filter registration and the RLS policy, or isolation silently
  degrades to filter-only.
- Follow-ups: write a Flyway migration checklist / lint rule that fails CI if a new table with
  `tenant_id` lacks a matching RLS policy; define the concrete trigger conditions (row count,
  QPS, contractual SLA) for offering schema-per-tenant to an enterprise tenant; prototype the
  schema-per-tenant migration tooling before it is needed under deadline pressure.
