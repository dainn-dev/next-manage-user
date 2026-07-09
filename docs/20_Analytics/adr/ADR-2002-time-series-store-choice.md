# ADR-2002: Time-series store choice (Postgres partitioning now, TimescaleDB/OLAP later)

- Status: Proposed
- Date: 2026-07-09
- Deciders: Principal Architect
- Context doc: 20_Analytics

## Context

`ParkingEvent` (brief §4) is the append-only, high-volume log every camera writes to on every
detection/relocation/exit across every tenant and site — the source of truth the analytics
projections in ADR-2001 are derived from and can be replayed against. Today's database is
**PostgreSQL 15** (per `docker-compose.yml`, `postgres:15-alpine`) with Flyway-managed schema
(V1-V35) and no partitioning of any table (today's `VehicleLog` is a flat, unpartitioned table —
adequate at single-tenant, single-site volume). At multi-tenant, multi-site scale, `ParkingEvent`
row counts grow roughly linearly with camera-count x detection-rate x tenant-count, and this
table needs efficient time-range queries (dashboards ask "last 24h", "this week"), efficient
retention/purge (billing plans cap retention days per brief §3.10), and must not blow out index
sizes or vacuum times on a single unpartitioned table.

## Decision

Adopt a **two-phase time-series strategy**:

**Phase 1 (now, ships with multi-tenancy):** `ParkingEvent` is a **native PostgreSQL
declarative-partitioned table**, partitioned by `occurred_at` (monthly or weekly partitions,
tuned to expected volume), with `tenant_id`/`site_id`/`type`/`occurred_at` indexes on each
partition. Retention enforcement (per plan entitlement) becomes a cheap `DROP PARTITION` instead
of a row-by-row `DELETE`. This requires no new infrastructure — it stays on the Postgres instance
already used for everything else, keeping ops surface area flat while multi-tenancy, RLS, and the
event bus are being built out (all bigger-risk items in this phase).

**Phase 2 (later, load-triggered):** if/when partition-level query latency or write throughput
becomes a bottleneck under real tenant load, migrate `ParkingEvent` (and any derived raw
telemetry, e.g. `MotionEvent`) to **TimescaleDB** (a Postgres extension, so the migration is
additive rather than a rewrite — hypertables layer on top of the same partitioning concept) or,
if OLAP-style cross-tenant analytics workloads emerge (e.g. platform-wide usage reporting for
billing/metering), a **columnar OLAP store** (ClickHouse) fed by CDC from Postgres. This decision
is explicitly deferred, not designed in detail now, because it should be driven by real
measured load, not speculation.

## Alternatives considered

- **Postgres native partitioning now, Timescale/OLAP later** (chosen) — incremental,
  infrastructure-flat path.
  - Pros: zero new operational dependency in the phase where the team is already absorbing
    multi-tenancy + RLS + RabbitMQ + Redis (brief §3.2, §3.5, §3.6) — do not stack a new datastore
    on top of that; native partitioning solves the two most urgent problems (retention purge cost,
    time-range query performance) without new tooling; PostgreSQL is already the team's
    operational expertise (Flyway migrations, `ddl-auto`, existing backup tooling).
  - Cons: native partitioning does not give the specialized time-series query optimizations
    (continuous aggregates, compression) that TimescaleDB provides out of the box; a future
    migration, while additive, is still a real migration that needs to be planned and tested.

- **TimescaleDB from day one.**
  - Pros: purpose-built continuous aggregates could subsume some of the ADR-2001 projection work;
    better compression for cold partitions; hypertable partitioning is more automatic than manual
    Postgres partition management.
  - Cons: another extension to install/operate/upgrade across every environment (dev via Compose,
    prod via managed Postgres — brief §3.14) before load actually demands it; managed-Postgres
    providers vary in TimescaleDB support, constraining the "managed vs self-hosted" choice made
    in `21_Deployment` ADR-2103 prematurely; violates "evolve, don't rewrite" by front-loading
    infrastructure risk.

- **OLAP warehouse (ClickHouse/BigQuery) from day one.**
  - Pros: best raw analytical query performance at very large scale; natural fit if/when
    cross-tenant platform analytics (billing/usage reporting) becomes a first-class product
    surface.
  - Cons: requires a CDC/ETL pipeline to keep in sync, a second query language/tooling surface,
    and a second place to enforce tenant isolation — too much operational cost to justify before
    proven load; explicitly the "later" option in this ADR's phase 2, not a phase-1 choice.

- **No partitioning — flat table with aggressive indexing.**
  - Pros: simplest, matches today's `VehicleLog` pattern exactly.
  - Cons: retention purge becomes a slow `DELETE` competing with writes; index bloat and vacuum
    cost grow unbounded with tenant/camera count; rejected as not viable past a small number of
    tenants.

## Consequences

- Positive: retention-by-plan (brief §3.10) is a cheap operation; time-range dashboard queries hit
  small, well-indexed partitions instead of scanning the whole table; no new datastore to operate
  during the highest-risk phase of the platform buildout.
- Negative / trade-offs: partition management (creating future partitions ahead of time, e.g. via
  `pg_partman` or a scheduled job) is new operational discipline that must be automated, not
  manual; a future TimescaleDB/OLAP migration is deferred work that will eventually need to be
  scheduled, not avoided.
- Follow-ups: define the partition interval and automated partition-creation job as an
  implementation ticket; define concrete load thresholds (events/sec, table size) that trigger
  re-evaluating Phase 2, and track them via the observability stack (`21_Deployment`).
