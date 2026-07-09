# Multi-Tenant Design

The tenancy model for ParkVision: how one platform serves many tenants (parking operators,
e.g. supermarket chains), each with many sites (bãi đỗ xe), with strict data isolation
enforced at both the ORM and database layers.

Status: Draft · Owner: Principal Architect · Last updated: 2026-07-09

## 1. Purpose

Define the concrete multi-tenancy data model, the request-time mechanics that resolve and
enforce tenant scope, the isolation guarantees the platform can make to customers, and the
upgrade path for tenants that outgrow shared-schema isolation. This document is the detailed
expansion of the tenancy summary in `03_SaaS_Architecture` §6.

## 2. Current State vs Target

### Current state (brief §1)

The system is **single-tenant today**. All 8 entities (Employee, Vehicle, VehicleLog, User,
VehicleAccessRequest, Gate, Department, Position) have UUID PKs and **no `tenant_id` or
`site_id` column anywhere**. `Gate` models a physical gate location, not a tenant — there is
exactly one implicit "tenant" (the whole deployment). The JWT carries `role`/`email`/`userId`
only — no tenant claim exists to resolve. There is no Row-Level Security, no Hibernate
multi-tenancy filter, and no per-tenant configuration mechanism in the codebase today.

### Target

Shared-database, shared-schema multi-tenancy: every tenant-owned table gets a `tenant_id`
discriminator, most also a `site_id`; a `TenantContextFilter` resolves both from JWT claims;
a Hibernate tenant filter and PostgreSQL RLS policies jointly enforce isolation; a documented
path exists to move a specific tenant to its own schema if it outgrows shared-schema
performance or needs contractually stronger isolation.

### The gap

Every table in brief §4's domain model needs a `tenant_id` added (a large, coordinated set of
Flyway migrations, V36+); the JWT issuance path in `iam` needs to add claims; and an entirely
new `tenancy` module, filter, and set of RLS policies need to be written — none of this exists
today.

## 3. Tenant Hierarchy

```
Tenant  (parking operator, e.g. a supermarket chain)
  └─ Site        (one physical parking lot / bãi đỗ xe)
       ├─ Zone        (optional grouping, e.g. floor/section A/B)
       │    └─ ParkingSlot   (a single space, has a polygon)
       └─ Camera / Gate      (ANPR_GATE or OVERVIEW role; Gate is a logical entry/exit point)
```

This matches brief §3.3 and §4 exactly. `ParkingSlot` belongs to a `Site` and optionally a
`Zone`; `Camera` and `Gate` belong to a `Site` (today's `Gate` entity is extended with
`site_id` and a `camera_id` FK, keeping the existing register/heartbeat/health endpoints).
`Vehicle` is tenant-owned (not site-owned) since a vehicle can move between a tenant's sites;
it tracks `current_site_id` and `current_slot_id` for "where is it right now."

See `diagrams/tenancy-hierarchy.mmd` for the full entity relationship diagram including field
lists.

## 4. Tenant Resolution and Request Scoping

1. Client authenticates; `iam` issues a JWT with claims `tenant_id`, `site_ids[]` (or a
   platform-wide marker), `role`, plus today's existing `userId`/`email`.
2. `TenantContextFilter` (new, in the `tenancy` module) runs after JWT auth on every request:
   extracts `tenant_id`/`site_ids[]`, sets a request-scoped `ThreadLocal` tenant context, and
   issues `SET LOCAL app.tenant_id = '<uuid>'` on the current JDBC connection/transaction.
3. If the endpoint takes an explicit `siteId` param (brief §3.16), the filter/interceptor
   checks it against the JWT's `site_ids[]` and rejects with 403 before any query runs.
4. The Hibernate tenant filter (enabled per-session from the ThreadLocal context) appends
   `tenant_id = :tenantId` to every tenant-owned entity query — first line of defense.
5. PostgreSQL RLS policies re-check `tenant_id = current_setting('app.tenant_id')::uuid` at
   the database layer — second line of defense, holds even if step 4 is bypassed by a bug.

Full mechanics in ADR-0402; sequence in `diagrams/request-scoping-sequence.mmd`.

### Example RLS policy SQL

```sql
-- Applied per tenant-owned table, e.g. parking_slot
ALTER TABLE parking_slot ENABLE ROW LEVEL SECURITY;
ALTER TABLE parking_slot FORCE ROW LEVEL SECURITY; -- applies even to table owner

CREATE POLICY tenant_isolation_parking_slot ON parking_slot
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Platform-admin bypass uses a dedicated DB role, NOT app-level RLS disable:
CREATE ROLE platform_admin_role BYPASSRLS;
```

`current_setting('app.tenant_id', true)` with `missing_ok = true` returns NULL (not an error)
if unset, which combined with `FORCE ROW LEVEL SECURITY` means **no session variable = no
rows**, a fail-closed default rather than fail-open.

### Hibernate tenant filter sketch

```java
@FilterDef(
    name = "tenantFilter",
    parameters = @ParamDef(name = "tenantId", type = "uuid-char")
)
@Filter(name = "tenantFilter", condition = "tenant_id = :tenantId")
@Entity
public class ParkingSlot { /* ... tenant_id column, site_id column, ... */ }

// In TenantContextFilter, after resolving tenant:
Session session = entityManager.unwrap(Session.class);
session.enableFilter("tenantFilter")
       .setParameter("tenantId", tenantContext.getTenantId());
```

## 5. Cross-Tenant Isolation Guarantees

- **Two independent enforcement layers** (ORM filter + RLS) — a bug in one does not leak data
  if the other holds. See `diagrams/isolation-model.mmd`.
- **Fail-closed**: RLS with `FORCE ROW LEVEL SECURITY` and no `missing_ok` fallback query
  means an unset tenant context returns zero rows, never "all rows."
- **Platform-wide access is a distinct, audited path** — `PLATFORM_ADMIN` operations use a
  dedicated `BYPASSRLS` database role invoked only from explicitly-marked admin service
  methods, never a blanket app-level RLS disable. Every cross-tenant read/write through this
  path is logged (see `06_User_RBAC` for the role definition).
- **Idempotency/event data is tenant-tagged at the source**: `ParkingEvent`/outbox rows carry
  `tenant_id` from the moment they're written (ADR-0302 in `03_SaaS_Architecture`), so
  RabbitMQ routing keys and downstream consumers (notification, analytics) never need to
  re-derive tenant scope from a joined table.

## 6. Noisy-Neighbor Mitigation

Shared-schema means shared table/index/connection-pool capacity. Mitigations:

- **Per-tenant rate limiting** on the edge ingest API and chatbot endpoints via Redis counters
  (`03_SaaS_Architecture` ADR-0303).
- **Per-tenant RabbitMQ routing keys** (`tenant.<id>.site.<id>.<eventType>`) so a burst from
  one tenant's cameras can be throttled/prioritized independently in queue configuration.
- **Query cost monitoring** via `pg_stat_statements` tagged by `tenant_id` (added to
  application-level slow-query logging) to detect a single tenant degrading shared indexes.
- **Partitioned high-volume tables** (`ParkingEvent`, `MotionEvent`) by time range, which
  bounds the working-set size any single tenant's history can force into cache.
- **Connection pool fairness**: cap per-request transaction time in `ai-ingest` so one
  tenant's burst can't starve the shared HikariCP pool.

## 7. Per-Tenant Configuration

A `tenant_config` table (or a `config jsonb` column on `Tenant`) holds per-tenant overrides:
branding (logo/theme for white-label console), notification channel preferences, AI
confidence thresholds, retention overrides within plan limits. Read through the Redis cache
described in `03_SaaS_Architecture` ADR-0303 (cache key `tenant:{id}:config`, invalidated on
write) to keep it off the hot-path DB read.

## 8. Data Export / Delete (GDPR)

- **Export**: a `tenancy` module admin endpoint (`PLATFORM_ADMIN` or `TENANT_ADMIN` scoped to
  their own tenant) that streams all rows across tenant-owned tables filtered by `tenant_id`
  into a downloadable archive (JSON/CSV per table) plus a manifest of associated object-storage
  snapshot keys.
- **Delete**: a soft-delete flag (`Tenant.status = 'pending_deletion'`) that stops new writes
  and hides the tenant from active use, followed by a scheduled hard-delete job (respecting
  any legal/billing hold) that removes rows across all tenant-owned tables by `tenant_id` in
  dependency order, plus a corresponding object-storage prefix delete (`tenant/{id}/**`).
- Because every tenant-owned table already carries `tenant_id` (ADR-0401), both operations are
  a single predictable filter across a known table set rather than a bespoke query per table.

## 9. Upgrade Path: Schema-per-Tenant for Enterprise Tenants

For a tenant that needs stronger isolation or independent performance tuning:

1. Provision a new Postgres schema (`tenant_<slug>`) with the same table DDL (Flyway can
   replay the same migration history against the new schema).
2. Backfill: copy that tenant's rows (`WHERE tenant_id = :id`) from every shared table into
   the new schema's tables (drop the now-redundant `tenant_id` column there, or keep it for
   consistency with tooling — recommendation: keep it, cheaper to keep application code
   uniform).
3. Switch that tenant's connection routing: the `tenancy` module's `TenantContextFilter` gains
   a lookup (`tenant_id → schema name`, cached) and sets `search_path` instead of relying on
   shared-table RLS for that tenant; RLS policies remain harmless no-ops in the dedicated
   schema (still enabled, just always true within that schema's own rows).
4. Cut over reads/writes, verify row counts match, decommission the shared-schema copy after a
   retention window.

This path is intentionally **not built until a real enterprise tenant needs it** — building it
speculatively now would be premature complexity (see ADR-0401 alternatives).

## 10. Diagrams

- `diagrams/tenancy-hierarchy.mmd` — entity relationship diagram of Tenant → Site → Zone →
  ParkingSlot/Camera/Gate plus Vehicle, User, Subscription ownership.
- `diagrams/request-scoping-sequence.mmd` — sequence diagram of JWT → tenant filter → Hibernate
  filter → RLS on a single request.
- `diagrams/isolation-model.mmd` — flowchart of the two-layer isolation enforcement and the
  distinct platform-admin bypass path.

## 11. Decisions / ADRs

- [`adr/ADR-0401-shared-schema-rls.md`](adr/ADR-0401-shared-schema-rls.md) — Shared-schema + RLS vs schema-per-tenant vs DB-per-tenant.
- [`adr/ADR-0402-tenant-context-propagation.md`](adr/ADR-0402-tenant-context-propagation.md) — Tenant context propagation via JWT claim + ThreadLocal/RLS session var.

## 12. Open Questions / Risks

- `site_ids[]` as an inline JWT claim may not scale for roles with access to many sites within
  a large tenant — may need to move to a cached lookup (see ADR-0402 follow-ups).
- No decision yet on token refresh/revocation strategy for mid-lifetime site-membership
  changes (86400s expiry is inherited from today's single-tenant JWT and not yet re-evaluated
  for multi-tenant risk).
- Schema-per-tenant migration tooling (§9) is designed but not prototyped — first real use
  should be treated as a spike, not a routine operation.
- RLS + Hibernate filter must be added to *every* new tenant-owned table as the domain model
  grows (brief §4 lists 15+ new entities) — needs a CI check, not just documentation.

## 13. Cross-References

- `03_SaaS_Architecture` — module decomposition and where `tenancy` sits in the request
  lifecycle.
- `05_Subscription_Billing` — entitlements keyed by `tenant_id`, retention days feeding the
  partition strategy in §6.
- `06_User_RBAC` — role/site-scope claims carried alongside `tenant_id` in the JWT.
- `15_Database_Design` (sibling doc) — full DDL for every tenant-owned table including RLS
  policy definitions.
