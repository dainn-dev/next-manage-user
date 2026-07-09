# ADR-1503: Time-partition ParkingEvent (native Postgres now, TimescaleDB later)

- Status: Proposed
- Date: 2026-07-09
- Deciders: Principal Architect
- Context doc: 15_Database_Design

## Context

`ParkingEvent` is the event-sourced log for all nine domain events, one row per event, across
every camera on every site of every tenant — by far the highest-volume table in the target
schema (motion/vehicle/plate detections at multiple frames/detections per second per camera,
multiplied across every camera in every tenant). Nothing like it exists today: `VehicleLog`
is the closest analog and is a comparatively low-volume, un-partitioned table (one row per
gate check, not per detection). At ParkingEvent's expected volume, an un-partitioned table
degrades on: index bloat, vacuum time, and — critically — query and retention patterns that
are almost always time-bounded (recent activity for the live dashboard, a date range for
history/analytics/chatbot queries).

## Decision

Create `parking_event` as a **native PostgreSQL declarative partitioned table**, `PARTITION
BY RANGE (occurred_at)`, with monthly partitions created ahead of time by a scheduled job
(mirroring the existing `VehicleSchedulerService` pattern of a daily/periodic backend job).
Each partition inherits the same indexes: `(tenant_id, site_id, occurred_at)`,
`(event_id)` unique, `(track_id)`, `(type)`. Old partitions can be detached and archived
(e.g. to object storage / a cold table) once outside a tenant's plan-defined retention window
(brief §3.10 — `retention_days` is a metered entitlement), which is a cheap `DETACH
PARTITION` rather than a slow bulk `DELETE`.

## Alternatives considered

- **No partitioning, one flat table with good indexes** — least implementation effort today,
  but retention/cleanup becomes a slow, lock-contending bulk `DELETE`, and index bloat grows
  unbounded with tenant/camera count. Rejected once retention-by-plan (brief §3.10) is a
  requirement, not an afterthought.
- **TimescaleDB hypertables from day one** — purpose-built for exactly this workload
  (automatic partitioning/"chunking", continuous aggregates, compression), and is explicitly
  named as the eventual target in brief §3.7. Rejected **for now** only because it requires
  the TimescaleDB extension to be available in every environment (dev, CI Testcontainers,
  prod) before the team has validated it operationally; native partitioning gets 80% of the
  operational benefit (retention via partition drop, time-bounded query pruning) with zero new
  extension dependency, on top of the PostGIS extension already added by ADR-1502.
- **Native Postgres range partitioning now, TimescaleDB later (chosen)** — pros: ships with
  stock Postgres, no new extension risk stacked on top of PostGIS, retention becomes a cheap
  `DETACH`/`DROP PARTITION`, query planner prunes partitions for time-bounded queries (the
  dominant access pattern). Cons: partition management (creating future partitions, alerting
  if the job fails to keep ahead) is manual/scripted rather than automatic like Timescale's
  chunking; migrating to TimescaleDB later requires a data-migration step, not just an
  extension flip.

## Consequences

- Positive: retention-by-plan becomes a cheap partition-drop operation; time-bounded
  dashboard/analytics/chatbot queries get partition pruning for free; no new extension
  dependency beyond what ADR-1502 already introduces.
- Negative / trade-offs: a partition-maintenance job (create next month's partition ahead of
  time) is new operational surface with a failure mode (if it silently stops, inserts for a
  future month start failing) that needs monitoring; `event_id` uniqueness must be enforced
  per-partition-aware unique index (Postgres requires partition keys to be considered in
  unique constraints on partitioned tables) — plan the index definition accordingly.
- Follow-ups: revisit TimescaleDB once the team has operational confidence and the analytics
  module needs continuous aggregates/compression beyond what manual partitioning + materialized
  views can reasonably provide; instrument partition count/size to catch a stalled
  maintenance job early.
