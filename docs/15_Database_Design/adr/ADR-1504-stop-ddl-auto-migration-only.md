# ADR-1504: Stop relying on ddl-auto:update — migration-only schema management

- Status: Proposed
- Date: 2026-07-09
- Deciders: Principal Architect
- Context doc: 15_Database_Design

## Context

Today the backend runs **both** Flyway migrations (V1–V35) **and** Hibernate's
`ddl-auto: update` (`application.yml`) at the same time. In practice this means Flyway is the
primary, reviewed, versioned path for schema changes, but Hibernate is also permitted to
silently add columns/tables/constraints it infers from `@Entity` classes at boot time if a
migration didn't already create them. That combination works acceptably for a single
developer team on a single-tenant schema, but it has two problems that get worse as the
platform grows: (1) `ddl-auto: update` can diverge across environments (a dev box that booted
against an entity change before the corresponding Flyway migration was written now has a
schema no migration file describes), and (2) it is fundamentally incompatible with the
precision this platform now needs — adding `tenant_id NOT NULL` with a backfill, PostGIS
geometry columns, partitioned tables, and RLS policies are all things Hibernate's
auto-schema-update either cannot express correctly or would apply unsafely (e.g. it has no
concept of "add NOT NULL after a backfill step").

## Decision

- Every schema change — new tables, new columns, constraints, indexes, RLS policies,
  partition creation — is expressed as a **Flyway migration** (continuing the existing
  `V1__...` .. `V35__...` sequence into `V36` and beyond), checked into
  `backend/src/main/resources/db/migration/`, reviewed like any other code change.
- Set **`ddl-auto: validate`** (not `none` — `validate` keeps a useful safety net: boot fails
  loudly if the JPA entity model and the actual Flyway-managed schema disagree, catching a
  missing migration immediately instead of Hibernate silently patching around it).
- The `tenant_id` rollout itself (ADR-1501) is the first migration set built this way, using
  the **expand → backfill → contract** pattern, spread across multiple migrations rather than
  one big unsafe change (see `diagrams/migration-plan.mmd`):
  1. `V36`: create `tenant` table, seed one `DEFAULT_TENANT` row.
  2. `V37`: add `tenant_id UUID NULL` to every existing tenant-owned table (nullable — safe,
     no lock contention on existing rows).
  3. `V38`: backfill `UPDATE ... SET tenant_id = <DEFAULT_TENANT.id> WHERE tenant_id IS NULL`.
  4. `V39`: `ALTER COLUMN tenant_id SET NOT NULL` + add the FK constraint, now that every row
     is populated.
  5. Subsequent migrations add the new SaaS tables, PostGIS extension/columns (ADR-1502), the
     partitioned `parking_event` table (ADR-1503), and RLS policies.

## Alternatives considered

- **Keep `ddl-auto: update` alongside Flyway (status quo)** — zero migration-authoring
  overhead for quick iteration, but cannot safely express NOT-NULL-after-backfill, partitioned
  tables, or RLS policies, and risks environment drift. Rejected once the schema needs
  correctness guarantees beyond "add a missing column."
- **`ddl-auto: none`** — fully migration-only with no safety net; a mismatch between entities
  and schema fails at query time (a confusing runtime error) instead of at boot. Rejected in
  favor of `validate`, which gives the same "migration is the only writer" guarantee but fails
  fast and clearly at startup.
- **Migration-only with `ddl-auto: validate` (chosen)** — pros: every schema change is
  reviewable, reproducible across environments, and expressible as multi-step safe rollouts
  (expand/backfill/contract); `validate` catches entity/schema drift immediately at boot.
  Cons: every entity change now requires a hand-written migration (slightly more upfront
  effort than letting Hibernate infer it) and disciplined PR review to keep entities and
  migrations in lockstep.

## Consequences

- Positive: schema changes become reviewable, reproducible, and safe to sequence
  (expand/backfill/contract) across every environment identically; `validate` gives an
  immediate, loud failure if a migration is missing rather than silent divergence.
- Negative / trade-offs: slightly slower day-to-day schema iteration during active
  development (must write a migration instead of just editing an `@Entity`); large-table
  migrations (e.g. `parking_event` partitioning) need explicit backward-compatible steps
  rather than a one-shot Hibernate update.
- Follow-ups: add a CI check that fails a PR if an `@Entity` field has no corresponding Flyway
  migration; document the expand/backfill/contract pattern as the team's standard for any
  future breaking schema change, not just the `tenant_id` rollout.
