# 20. Analytics

Analytics & reporting for ParkVision: turning the raw event stream from every site's cameras
into occupancy metrics, duration stats, returning-vehicle patterns, and location heatmaps —
rendered on per-tenant/per-site dashboards and exportable as reports.

Status: Draft · Owner: Principal Architect · Last updated: 2026-07-09

## 1. Current state vs Target

**Current state (verified in code, brief §1).** The only analytics-shaped endpoint today is
`GET /api/vehicles/statistics/overview` (`VehicleStatisticsController` →
`VehicleService.getVehicleStatistics()`, returns `VehicleStatisticsDto`) — a single-tenant,
request-time aggregate over `Vehicle`/`VehicleLog` (counts, entry/exit requests, time-based
figures). There are **no materialized views, no read models, no event stream to project from**
(no RabbitMQ, no domain events) — everything is a live SQL aggregate against OLTP tables. Export
exists today in a different, adjacent form: `VehicleLogExportController`
(`GET /api/vehicle-logs/export`) builds Excel (`.xlsx`, Apache POI `XSSFWorkbook`) and UTF-8 CSV
exports of the full filtered vehicle-log result set via `VehicleLogExportService`/
`SpreadsheetExportUtil`; the same POI-based export pattern also exists for `VehicleController`
(`/api/vehicles/export`, `/api/vehicles/export/template`) and `EmployeeController`
(`/api/employees/export`). On the frontend, **recharts** is already a dependency and already used
— `frontend/components/vehicles/vehicle-statistics-dashboard.tsx` renders the statistics overview,
served from the `/statistics` route. There is **no time-series partitioning, no heatmap, no
occupancy/fill-rate concept, no per-tenant/per-site scoping** (single-tenant, no `tenant_id`
anywhere) today.

**Target.** Metrics from the vision — current vehicle count, occupancy/fill rate, average parking
duration, top returning vehicles, location heatmap — served from read models/materialized views
projected off the domain event stream (`13_Event_Driven_Architecture`), scoped per tenant/site,
time-series data stored in a partitioned `ParkingEvent` table (optionally TimescaleDB later),
rendered via recharts (extending the existing pattern, `17_Dashboard`), with export continuing to
use the existing POI-based Excel/CSV pattern generalized to analytics reports.

| Aspect | Current | Target |
|---|---|---|
| Query path | Live aggregate on `Vehicle`/`VehicleLog` | Read from projected materialized views |
| Scope | Single-tenant, implicit | Per tenant + per site (RLS) |
| Metrics | Vehicle counts, entry/exit stats | + occupancy/fill rate, avg duration, top-returning, heatmap |
| Data source | OLTP tables directly | `ParkingEvent` stream (partitioned) |
| Rendering | recharts (`vehicle-statistics-dashboard.tsx`) | recharts, extended, tenant/site-scoped |
| Export | POI Excel/CSV (`VehicleLogExportController`) | Same pattern, generalized to analytics reports |

## 2. Metrics (from the vision)

| Metric | Definition | Source projection |
|---|---|---|
| Current vehicle count | Vehicles with `status = entered` at a site, right now | `mv_site_occupancy` |
| Occupancy / fill rate | `occupied_slots / total_slots` per site (or zone) | `mv_site_occupancy` joined to `ParkingSlot` count |
| Average parking duration | Mean `(exited_at - entered_at)` over a rolling window | `mv_avg_duration` |
| Top returning vehicles | Distinct-visit count per `license_plate`, ranked, over a window | `mv_top_returning_vehicles` |
| Location heatmap | Per-slot cumulative/normalized dwell time | slot-level dwell aggregation (see diagram) |

All metrics are computed from `ParkingEvent` rows of type `VehicleEntered`, `VehicleExited`,
`VehicleRelocated` (brief §2 domain events) plus the `ParkingSlot.polygon` geometry (brief §4,
PostGIS) for slot attribution.

## 3. Read models / materialized views

Per ADR-2001, analytics reads never touch the OLTP write path. An **analytics projector** (module
`analytics`, brief §3.15) consumes the same RabbitMQ bus as everything else in
`13_Event_Driven_Architecture` and maintains:

- `mv_site_occupancy(tenant_id, site_id, occupied_count, total_slots, fill_rate, updated_at)`
- `mv_avg_duration(tenant_id, site_id, window, avg_duration_seconds)`
- `mv_top_returning_vehicles(tenant_id, site_id, license_plate, visit_count, window)`
- slot-level dwell aggregation feeding the heatmap overlay in the Parking-Map Designer
  (`08_Parking_Map_Designer`)

Backfill/rebuild replays from the partitioned `ParkingEvent` table (ADR-2002), which remains the
source of truth even though dashboards never query it directly.

## 4. API & rendering

Analytics is exposed under `/api/v1/analytics/*` (REST, per brief §3.16 versioned API,
tenant-scoped implicitly from JWT + explicit `siteId` where relevant): `GET
/api/v1/analytics/occupancy`, `.../duration`, `.../top-vehicles`, `.../heatmap`, `.../export`. The
frontend renders these with **recharts** (already a dependency, brief §1, already used in
`vehicle-statistics-dashboard.tsx`) — bar/line charts for time-series metrics, a custom
polygon-colored overlay on the Parking-Map Designer canvas for the heatmap (not a recharts chart
type; see `08_Parking_Map_Designer`). Dashboard components live under the frontend's dashboard
area (`17_Dashboard`), not duplicated here.

## 5. Export

Reports export using the **same pattern already proven in the backend** —
`VehicleLogExportService`/`SpreadsheetExportUtil` (Apache POI `XSSFWorkbook` for `.xlsx`, UTF-8
CSV, full filtered result set up to a bounded row limit, guarded by role) — generalized to
analytics aggregates: `GET /api/v1/analytics/export?siteId=...&range=...&format=xlsx|csv`. No new
export library is introduced; this is an extension of existing, working code, consistent with
"evolve, don't rewrite" (brief §3.1).

## 6. Diagrams

- [`diagrams/analytics-data-flow.mmd`](diagrams/analytics-data-flow.mmd) — flowchart from edge
  events through ingest/outbox/RabbitMQ into `ParkingEvent`, the analytics projector, materialized
  views, the REST API, and finally recharts/export on the frontend.
- [`diagrams/occupancy-heatmap-concept.mmd`](diagrams/occupancy-heatmap-concept.mmd) — flowchart
  showing how per-slot dwell time is bucketed and normalized into a heatmap overlay, alongside the
  simpler occupancy/fill-rate KPI computation.
- [`diagrams/reporting-sequence.mmd`](diagrams/reporting-sequence.mmd) — sequence diagram for a
  site manager viewing a dashboard and exporting a report, showing the materialized-view read path
  and the POI-based export path.

## 7. Decisions / ADRs

- [`adr/ADR-2001-analytics-projections-vs-oltp.md`](adr/ADR-2001-analytics-projections-vs-oltp.md) —
  analytics served from event-stream projections/materialized views, not live OLTP queries.
- [`adr/ADR-2002-time-series-store-choice.md`](adr/ADR-2002-time-series-store-choice.md) —
  native Postgres partitioning for `ParkingEvent` now, TimescaleDB/OLAP evaluated later under
  measured load.

## 8. Open questions / risks

- **Staleness communication.** Projections are eventually consistent; the UI must indicate
  "as of" freshness rather than implying real-time truth.
- **Heatmap performance at scale.** Slot-level dwell aggregation across sites with hundreds of
  slots and long retention windows needs a concrete aggregation strategy (pre-bucketed by
  hour/day) validated under load (`22_Testing`).
- **Cross-tenant platform reporting** (usage for billing/metering, brief §3.10) may eventually
  need a separate, platform-scoped read path distinct from per-tenant dashboards — noted but out
  of scope here; likely lives in the billing doc (`05_Subscription_Billing`).
- **Metric definitions need product sign-off** — e.g. whether "average parking duration" excludes
  outliers (a vehicle left for days due to a stuck "entered" state, the same class of bug today's
  `VehicleSchedulerService` 1AM reset job works around).

## 9. Cross-references

- `13_Event_Driven_Architecture` — the event bus and outbox pattern the analytics projector
  consumes from.
- `19_Notification` — `NotificationSent` domain event, also consumed by this module for delivery
  analytics.
- `08_Parking_Map_Designer` — the canvas the heatmap overlay renders on.
- `17_Dashboard` — frontend dashboard composition and recharts usage.
- `15_Database_Design` — `ParkingEvent`, `ParkingSlot`, materialized view schemas.
- `04_Multi_Tenant_Design` — RLS/`tenant_id`/`site_id` scoping applied to every projection.
- `21_Deployment` — observability stack (Prometheus/Grafana) used to monitor projector lag.
