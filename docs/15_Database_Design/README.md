# 15. Database Design

The ParkVision data model: the target schema's full ERD, tenant/site scoping, PostGIS slot
geometry, time-partitioned event storage, the Flyway migration strategy (including how the
existing single-tenant schema gets `tenant_id` retrofitted), and DDL sketches for the key new
tables.

Status: Draft · Owner: Principal Architect · Last updated: 2026-07-09

## 1. Current state vs Target

### Current state (verified in code)

- **PostgreSQL** (`vehicle_management` db), Spring Data JPA, **Flyway migrations V1–V35**,
  `ddl-auto: update`, `open-in-view: false`.
- **8 entities**, all UUID PKs, **no `tenant_id`/`site_id` anywhere** (single-tenant):
  `Employee`, `Vehicle`, `VehicleLog`, `User`, `VehicleAccessRequest`, `Gate`, `Department`,
  `Position`.
  - `Employee`: `employee_id` (unique), `name`, `department` (free-text string, not yet an FK
    everywhere), `position_id` (FK), `status` (enum `HOAT_DONG/TRANH_THU/PHEP/LY_DO_KHAC`),
    `access_level`, `permissions` (jsonb), salary/HR fields.
  - `Vehicle`: `employee` FK (**required**, not nullable), `license_plate` (unique),
    `vehicle_type` (car/motorbike/truck/bus), `status`
    (approved/rejected/exited/entered), `fuel_type`, `image_path`.
  - `Gate`: `name` (unique), `location`, `camera_rtsp_url`, `status`
    (online/offline/disabled), `last_heartbeat_at`. Gates model physical gate locations, not
    tenants or cameras as separate concepts.
  - `User`: `username`/`email` (unique), `role` (`USER/APPROVER/SECURITY_OFFICER/ADMIN`),
    `status`, optional 1:1 `employee` link.
  - `Department`/`Position`: flat, globally-unique `name`, self-referencing `parent_id` for
    hierarchy — no tenant scope today.
- No PostGIS, no partitioning, no object storage — snapshots live on local disk
  (`uploads/snapshots`, served at `/uploads/**`).
- Tests already use **Testcontainers** (`postgres`, `1.21.4`) — the PostGIS variant of this
  needs to swap image (see ADR-1502).

### Target

- Every tenant-owned table gets `tenant_id`; site-scoped tables also get `site_id`.
- New entities: `Tenant`, `Site`, `Zone`, `Camera`, `ParkingSlot`, `VehicleTrack`,
  `ParkingEvent`, `ParkingHistory`, `MotionEvent`, `Snapshot`, `Subscription`, `Plan`,
  `UsageRecord`, `Notification`. `Gate` is kept, now `site_id`-scoped and referencing
  `Camera`. `Employee`/`Department`/`Position` are kept as an optional tenant-scoped
  "workforce" module. `Vehicle`'s required `employee` FK becomes an optional `owner_user_id`.
- PostGIS for slot polygons and site location; native time-partitioning for `ParkingEvent`;
  Flyway becomes the **only** schema authority (`ddl-auto: validate`).

## 2. Full target ERD

See `diagrams/erd-core.mmd` for the complete entity-relationship diagram (19 entities, all
FKs and key attributes). Entity/field names are exactly as specified in the architecture
brief §4 so this document, the OpenAPI spec (`14_Backend_API`), and the event schema
(`13_Event_Driven_Architecture`) stay in lockstep. Summary of the new/evolved entities:

| Entity | Scope | Key fields | Notes |
|---|---|---|---|
| `Tenant` | root | id, name, slug, status, plan_id, created_at | Root of isolation |
| `Site` | tenant | id, tenant_id, name, address, geo, timezone, status | A physical parking location |
| `Zone` | site | id, site_id, name | Optional grouping (floor/section) |
| `Camera` | site | id, site_id, name, rtsp_url, role, panel_type, status, last_heartbeat_at, calibration_json | Supersedes/extends today's `Gate` as the device record |
| `Gate` | site | id, site_id, name, camera_id, direction | Today's `Gate`, now site-scoped, references `Camera` |
| `ParkingSlot` | site+zone | id, site_id, zone_id, code, polygon (PostGIS), status, current_vehicle_id, updated_at | See ADR-1502 |
| `Vehicle` | tenant | id, tenant_id, owner_user_id (nullable), license_plate, type, make/model/color, current_slot_id, current_site_id, last_seen_at, snapshot_url | Evolves today's `Vehicle`; `employee` FK → optional `owner_user_id` |
| `VehicleTrack` | site+camera | id, site_id, camera_id, track_id, license_plate (nullable), first_seen_at, last_seen_at | ByteTrack tracklet |
| `ParkingEvent` | tenant+site | id, tenant_id, site_id, camera_id, type, license_plate, track_id, slot_id, old_slot_id, new_slot_id, person_present, confidence, snapshot_id, occurred_at, event_id, payload | Event-sourced log, partitioned by time — see ADR-1503 |
| `ParkingHistory` | tenant | id, tenant_id, plate, old_slot, new_slot, occurred_at | Relocation trail |
| `MotionEvent` | site+camera | id, site_id, camera_id, person_present, occurred_at | |
| `Snapshot` | tenant+site | id, tenant_id, site_id, kind, object_url, event_id, captured_at | Object storage pointer |
| `User` | tenant (nullable) | id, tenant_id, username, email, role, status | Platform admins have null tenant_id |
| `Subscription` | tenant | id, tenant_id, plan_id, stripe_customer_id, stripe_subscription_id, status, current_period_end | |
| `Plan` | global | id, name, limits (jsonb), price | |
| `UsageRecord` | tenant | tenant_id, metric, qty, period | Usage metering off the event stream |
| `Notification` | tenant | id, tenant_id, user_id, channel, type, payload, read_at, sent_at | |
| `Employee`/`Department`/`Position` | tenant | (existing fields) + tenant_id | Optional workforce module |

## 3. Tenant/site scoping and RLS

`diagrams/erd-tenancy-scoping.mmd` isolates the scoping backbone: `Tenant → Site → Zone /
Camera / ParkingSlot`, and shows which FK on each table is the Row-Level Security predicate.
Rules (full rationale in `03_SaaS_Architecture` / `04_Multi_Tenant_Design`, restated here for
the schema-level view):

- Every tenant-owned table has `tenant_id UUID NOT NULL` (except `User.tenant_id`, nullable
  for `PLATFORM_ADMIN`).
- Site-scoped tables (`Camera`, `ParkingSlot`, `MotionEvent`, `VehicleTrack`, `Gate`) also
  carry `site_id`, and — where relevant — `tenant_id` too, denormalized, so RLS policies never
  need a join to enforce isolation.
- A Postgres `CREATE POLICY` per tenant-owned table restricts rows to
  `tenant_id = current_setting('app.current_tenant')::uuid`, set per-request from the JWT's
  `tenant_id` claim by a Hibernate/JPA interceptor (or a `SET LOCAL` at the start of each
  transaction) — full mechanism belongs to `03_SaaS_Architecture`; this document only defines
  which column the policy is keyed on.
- Full ADR on the PK/tenant_id decision: `adr/ADR-1501-uuid-pks-tenant-id-everywhere.md`.

## 4. PostGIS geometry

`Site.geo` is `geometry(Point, 4326)`; `ParkingSlot.polygon` is `geometry(Polygon, 4326)`.
Point-in-polygon resolution (`ST_Contains`) determines which slot a detected vehicle occupies;
a GiST index on `polygon` keeps this fast per-camera at real-time detection rates. Rationale
and alternatives: `adr/ADR-1502-postgis-slot-geometry.md`.

## 5. Time-partitioning ParkingEvent

`ParkingEvent` is declared `PARTITION BY RANGE (occurred_at)` with monthly partitions created
ahead of schedule by a maintenance job. Retention-by-plan (brief §3.10) becomes a cheap
`DETACH PARTITION` instead of a bulk `DELETE`. Full rationale and the TimescaleDB-later path:
`adr/ADR-1503-time-partitioning-parking-event.md`.

## 6. Flyway migration strategy

Continuing from **V1–V35** today. Two changes going forward:

1. **Stop relying on `ddl-auto: update`** — every schema change becomes a reviewed Flyway
   migration; `ddl-auto` moves to `validate` so entity/schema drift fails loudly at boot
   instead of being silently patched. Full rationale:
   `adr/ADR-1504-stop-ddl-auto-migration-only.md`.
2. **Migration plan to add `tenant_id` to existing tables**, using expand → backfill →
   contract so no migration locks or breaks a running system (`diagrams/migration-plan.mmd`):
   - `V36` — create `tenant` table, seed one `DEFAULT_TENANT` row (and, for `Gate`, a
     `DEFAULT_SITE` under it, since `Gate` becomes site-scoped).
   - `V37` — add `tenant_id UUID NULL` (and `site_id UUID NULL` where applicable) to every
     existing tenant-owned table: `employees`, `vehicles`, `users`, `departments`,
     `positions`, `gate`, `vehicle_log`, `vehicle_access_request`.
   - `V38` — backfill: `UPDATE ... SET tenant_id = <DEFAULT_TENANT.id> WHERE tenant_id IS
     NULL` (and `site_id = <DEFAULT_SITE.id>` for `gate`).
   - `V39` — `ALTER COLUMN tenant_id SET NOT NULL` + FK constraint, now safe since every row
     is populated.
   - `V40+` — create the new SaaS tables, enable PostGIS, create `parking_event` as a
     partitioned table, add RLS policies.

## 7. DDL sketch — key new tables

Illustrative, not exhaustive (omits some audit columns for brevity); full DDL lives in the
actual Flyway migration files once implementation starts.

```sql
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE tenant (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(255) NOT NULL,
    slug        VARCHAR(100) NOT NULL UNIQUE,
    status      VARCHAR(30)  NOT NULL DEFAULT 'ACTIVE',
    plan_id     UUID REFERENCES plan(id),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE site (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenant(id),
    name        VARCHAR(255) NOT NULL,
    address     VARCHAR(500),
    geo         geometry(Point, 4326),
    timezone    VARCHAR(64)  NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    status      VARCHAR(30)  NOT NULL DEFAULT 'ACTIVE'
);
CREATE INDEX idx_site_tenant ON site(tenant_id);

CREATE TABLE parking_slot (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id            UUID NOT NULL REFERENCES site(id),
    zone_id            UUID REFERENCES zone(id),
    code               VARCHAR(20) NOT NULL,
    polygon            geometry(Polygon, 4326) NOT NULL,
    status             VARCHAR(20) NOT NULL DEFAULT 'free',
    current_vehicle_id UUID REFERENCES vehicle(id),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (site_id, code)
);
CREATE INDEX idx_parking_slot_polygon ON parking_slot USING GIST (polygon);
CREATE INDEX idx_parking_slot_site ON parking_slot(site_id);

CREATE TABLE parking_event (
    id             UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id      UUID NOT NULL REFERENCES tenant(id),
    site_id        UUID NOT NULL REFERENCES site(id),
    camera_id      UUID REFERENCES camera(id),
    type           VARCHAR(30) NOT NULL,
    license_plate  VARCHAR(20),
    track_id       VARCHAR(64),
    slot_id        UUID REFERENCES parking_slot(id),
    old_slot_id    UUID REFERENCES parking_slot(id),
    new_slot_id    UUID REFERENCES parking_slot(id),
    person_present BOOLEAN,
    confidence     REAL,
    snapshot_id    UUID,
    occurred_at    TIMESTAMPTZ NOT NULL,
    event_id       UUID NOT NULL,
    payload        JSONB NOT NULL DEFAULT '{}',
    PRIMARY KEY (id, occurred_at),
    UNIQUE (event_id, occurred_at)
) PARTITION BY RANGE (occurred_at);

CREATE INDEX idx_parking_event_tenant_site_time
    ON parking_event (tenant_id, site_id, occurred_at DESC);
CREATE INDEX idx_parking_event_track ON parking_event (track_id);

-- Example monthly partition, created ahead of time by a maintenance job:
CREATE TABLE parking_event_2026_07 PARTITION OF parking_event
    FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');

ALTER TABLE tenant ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON site
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid);
```

## 8. Diagrams

- `diagrams/erd-core.mmd` — full target ERD, all 19 entities with key attributes and
  relationships.
- `diagrams/erd-tenancy-scoping.mmd` — the tenant/site scoping subset, annotated with which
  column is the RLS predicate on each table.
- `diagrams/migration-plan.mmd` — the expand/backfill/contract Flyway sequence from today's
  V35 to a fully tenant-scoped, PostGIS-enabled, partitioned schema with `ddl-auto: validate`.

## 9. Decisions / ADRs

- `adr/ADR-1501-uuid-pks-tenant-id-everywhere.md` — keep UUID PKs; add `tenant_id` to every
  tenant-owned table.
- `adr/ADR-1502-postgis-slot-geometry.md` — PostGIS for slot polygons and point-in-polygon.
- `adr/ADR-1503-time-partitioning-parking-event.md` — native Postgres partitioning now,
  TimescaleDB considered later.
- `adr/ADR-1504-stop-ddl-auto-migration-only.md` — Flyway becomes the sole schema authority.

## 10. Open questions / risks

- **Per-partition uniqueness**: Postgres requires the partition key in any unique constraint
  on a partitioned table, so `parking_event`'s natural `event_id` uniqueness has to be
  expressed as `UNIQUE (event_id, occurred_at)` (see DDL sketch) — the ingest API's dedupe
  check must include `occurred_at` in its lookup, not `event_id` alone; worth validating this
  doesn't reopen a duplicate-window edge case before implementation.
- **Partition maintenance job** (creating future months' partitions, alerting on failure) is
  named in ADR-1503 but not yet designed/owned.
- **`Department`/`Employee.department` free-text field**: today's `Employee.department` is a
  free-text string, not consistently an FK to `Department.id` — the tenant-scoping migration
  should decide whether to normalize this at the same time or leave it as follow-up debt.
- **RLS + connection pooling**: `current_setting('app.current_tenant')` must be set per
  transaction/request under a pooled connection (e.g. HikariCP) without leaking one tenant's
  setting into the next request on a reused connection — needs a concrete interceptor design,
  owned by `03_SaaS_Architecture`.

## 11. Cross-references

- `13_Event_Driven_Architecture` — how `ParkingEvent` rows are produced (transactional
  outbox) and consumed off RabbitMQ.
- `14_Backend_API` — the `/api/v1` resources this schema backs, and the ingest endpoint that
  writes `ParkingEvent`.
- `03_SaaS_Architecture`, `04_Multi_Tenant_Design` — RLS enforcement mechanism, tenant
  resolution from JWT, and the schema-per-tenant upgrade path for large tenants.
- `08_Parking_Map_Designer` — the UI that authors `ParkingSlot.polygon`.
