# ADR-2001: Analytics via event-stream projections/materialized views vs querying OLTP directly

- Status: Proposed
- Date: 2026-07-09
- Deciders: Principal Architect
- Context doc: 20_Analytics

## Context

The vision asks for: current vehicle count, occupancy/fill rate, average parking duration, top
returning vehicles, and a location heatmap — per tenant, per site, refreshed close to real time.
Today the closest analogue is `VehicleStatisticsController` (`GET
/api/vehicles/statistics/overview`, backed by `VehicleService.getVehicleStatistics()`), which
computes counts directly from the `Vehicle`/`VehicleLog` tables at request time — fine for a
single-tenant deployment with a handful of thousand rows, but the target platform is multi-tenant
with many sites, high-frequency `ParkingEvent` writes (every detection/relocation from every
camera across every tenant), and dashboards that must not degrade OLTP write latency for the
ingest path. We need to decide whether analytics queries continue to compute aggregates
on-the-fly against operational tables, or against separately maintained read models.

## Decision

Analytics reads are served from **read models (materialized views / projection tables) built by
consuming the domain event stream**, not by querying the OLTP `ParkingEvent`/`Vehicle` tables
directly at request time:

- A dedicated **analytics projector** (module `analytics`, brief §3.15) consumes the same
  RabbitMQ domain-event bus as the notification consumer (`19_Notification`,
  `13_Event_Driven_Architecture`), maintaining Postgres materialized views/projection tables:
  `mv_site_occupancy` (current count + fill rate), `mv_avg_duration` (rolling average dwell time),
  `mv_top_returning_vehicles` (frequency count by plate over a window), and a slot-level dwell
  aggregation feeding the heatmap.
- Projections are refreshed **incrementally** on each consumed event (not full `REFRESH
  MATERIALIZED VIEW` sweeps), keeping dashboard staleness in the low seconds.
- A backfill/replay path re-derives projections from the partitioned `ParkingEvent` table (source
  of truth) when a projection needs to be rebuilt (schema change, bug fix) — this is why
  `ParkingEvent` itself is retained and partitioned by time (ADR-2002) rather than treated as
  transient.
- The existing `VehicleStatisticsController` pattern (direct query, computed at request time) is
  the model being superseded for cross-site/high-volume metrics; it remains acceptable only for
  the low-cardinality "workforce module" (Employee/Department stats) that does not scale with
  event volume.

## Alternatives considered

- **Event-stream projections / materialized views** (chosen) — analytics reads never touch the
  hot OLTP write path.
  - Pros: dashboard query load cannot degrade ingest performance (the ingest path only writes
    `ParkingEvent` + outbox row, per `13_Event_Driven_Architecture`); aggregates are precomputed,
    so dashboard latency is a simple indexed lookup regardless of total event volume; naturally
    multi-tenant scoped since projections carry `tenant_id`/`site_id`; the same event stream also
    feeds notifications (`19_Notification`), so no duplicate ingestion logic.
  - Cons: eventual consistency — a dashboard can lag the true state by however long the consumer
    takes to catch up (target: low seconds under normal load); more moving parts (a projector
    process/module, projection schema migrations) than a simple `SELECT COUNT(*)`.

- **Query OLTP tables directly at request time** (today's `VehicleStatisticsController` pattern,
  extended with more `GROUP BY` queries).
  - Pros: always strongly consistent; zero extra infrastructure; matches what the code already
    does today, so it is the lowest-effort path short-term.
  - Cons: every dashboard load runs aggregate queries against the same tables the ingest path
    writes to, competing for I/O and buffer cache exactly when load is highest (peak parking
    hours = peak camera event volume = peak dashboard usage); does not scale across many tenants'
    sites without heavy indexing/partitioning gymnastics that end up re-inventing a projection
    layer anyway; heatmap/top-returning-vehicle queries in particular are expensive scans that do
    not belong on the write-optimized event table.

- **Dedicated OLAP warehouse (e.g. ClickHouse/BigQuery) fed by CDC from day one.**
  - Pros: best long-term query performance at very large scale; purpose-built for exactly this
    workload.
  - Cons: another datastore to operate, secure (tenant isolation), and keep in sync from day one,
    for a platform that is still validating product-market fit; premature relative to the
    "evolve, don't rewrite" / modular-monolith-first principle (brief §3.1, §3.15). Deferred — see
    ADR-2002's Postgres-partitioning-now / TimescaleDB-or-OLAP-later path.

## Consequences

- Positive: ingest-path latency is protected from analytics query load; the analytics module can
  be scaled/extracted independently later (brief §3.15 "extract high-load modules... when
  justified") without touching ingest; consistent with the notification module's own
  event-consumer pattern, so the platform has one consistent way of reacting to
  `ParkingEvent`s.
- Negative / trade-offs: eventual consistency needs to be communicated in the UI (e.g. "as of
  Xs ago"); projection rebuild/backfill tooling is new operational surface; schema evolution of a
  materialized view is more involved than adding a column to a normal table.
- Follow-ups: exact projection refresh mechanism (per-event incremental update vs micro-batched)
  is an implementation detail to validate under load testing (`22_Testing`); time-series storage
  choice for `ParkingEvent` itself is ADR-2002.
