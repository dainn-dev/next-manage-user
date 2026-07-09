# ADR-1502: PostGIS for parking-slot geometry

- Status: Proposed
- Date: 2026-07-09
- Deciders: Principal Architect
- Context doc: 15_Database_Design

## Context

Today there is **no parking-slot or occupancy concept at all** — the edge does no
parking-slot/occupancy logic (brief §1), and no entity models a physical slot or a polygon.
The target platform needs to: (1) let an operator draw slot boundaries over a camera still or
lot image in the **Parking-Map Designer** (brief §3.12), (2) store each slot's boundary as a
polygon, and (3) at runtime, given a detected vehicle's pixel/world position, determine which
slot (if any) it is inside — a point-in-polygon test — to drive `ParkingSlot.status` and the
`VehicleEntered`/`VehicleRelocated`/`VehicleExited` event payloads.

## Decision

Add the **PostGIS** extension to the Postgres database and give `ParkingSlot.polygon` the
type `GEOMETRY(Polygon, 4326)` (planar, calibration-defined local coordinate system per site,
not literal lat/lon — SRID 4326 is used as a neutral, well-supported default rather than a
geographic claim). Point-in-polygon resolution (`ST_Contains(slot.polygon, vehicle_point)`)
runs as a **GiST-indexed spatial query** in Postgres, invoked by the backend when processing a
`VehicleDetected`/tracking update from the edge. `Site.geo` (the site's map location) also
becomes a PostGIS `geometry(Point, 4326)` for map-view display.

## Alternatives considered

- **Store polygons as plain JSON arrays of points, do point-in-polygon in application code** —
  no new DB extension, but every consumer of slot geometry (backend, and potentially the
  chatbot/analytics tools) has to reimplement or share a point-in-polygon library, there is no
  spatial index (a linear scan per detection at multi-camera scale), and rendering GIS-style
  overlays or "nearest slot" queries later would still require moving to real geometry types
  eventually. Rejected — defers cost rather than removing it, and loses index support at
  exactly the query pattern (many detections/sec across a site) that needs it most.
- **A dedicated geospatial service/database next to Postgres** — over-engineered for the
  current per-site slot-count scale (tens to low hundreds of slots per site); adds an
  operational component and a second source of truth to keep in sync with `ParkingSlot`.
  Rejected as premature for a modular monolith (brief §3.15).
- **PostGIS extension on the existing Postgres instance (chosen)** — pros: mature,
  battle-tested, ships as a standard extension (`CREATE EXTENSION postgis`), integrates with
  Hibernate via `org.hibernate.spatial` (Hibernate Spatial), keeps geometry co-located and
  transactionally consistent with the rest of the tenant/site/slot data, GiST index makes
  point-in-polygon and "vehicles near X" queries fast at our scale. Cons: adds an extension
  dependency to every environment (dev/CI/prod) and a spatial-aware ORM mapping layer the team
  has not used before.

## Consequences

- Positive: slot polygons and point-in-polygon resolution are first-class, indexed, and
  transactionally consistent with the rest of the schema; the Parking-Map Designer can persist
  and query geometry with standard SQL rather than a bespoke format.
- Negative / trade-offs: Testcontainers-based tests (already in use, `1.21.4`) need a
  PostGIS-enabled Postgres image (`postgis/postgis`) instead of the plain `postgres` image;
  local dev setup (docker-compose) needs the same image swap; Hibernate Spatial adds a new
  dependency and mapping type the team must learn.
- Follow-ups: pick and document the calibration/homography convention that maps camera pixel
  coordinates to the site-local polygon coordinate system used by `polygon` (owned by the AI
  calibration doc, `09_AI_Calibration`, not this one).
