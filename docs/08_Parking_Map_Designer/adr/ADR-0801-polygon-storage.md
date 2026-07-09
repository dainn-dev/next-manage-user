# ADR-0801: Polygon storage as PostGIS geometry vs JSON

- Status: Proposed
- Date: 2026-07-09
- Deciders: Principal Architect
- Context doc: 08_Parking_Map_Designer

## Context

Today PostgreSQL has no PostGIS extension and there is no polygon/geometry data anywhere in the
schema (V1–V35 migrations). The target platform needs to store one polygon per `ParkingSlot` and,
on every detection event, answer "which slot (if any) contains this vehicle-center point" —
i.e. a point-in-polygon query, running per detection event across potentially hundreds of slots
per site, at platform scale across many tenants/sites. The shared brief (§3.4) already commits
the platform to adding PostGIS for exactly this purpose, but the concrete column-level decision —
geometry type vs a plain JSON array of points — belongs to this doc.

## Decision

Store `ParkingSlot.polygon` as a **PostGIS `GEOMETRY(Polygon, SRID)`** column, using a
site-local planar SRID (not geographic WGS84) so distances/areas behave in ordinary Euclidean
terms after the homography transform. Point-in-polygon tests use `ST_Contains`/`ST_Within` with a
**GiST spatial index** on the column. A denormalized JSON copy of the same vertices is included in
API responses to the frontend editor purely as a convenience for rendering (the editor works in
image-pixel space, not the stored planar space) — but the column itself, and all server-side
validation/queries, are PostGIS geometry.

## Alternatives considered

- **Plain JSON array of `[x, y]` points** — trivial to implement, no new extension dependency, and
  matches the frontend's native representation exactly. But every point-in-polygon test, overlap
  check, or spatial index would have to be hand-rolled in application code (or a stored
  procedure), with no index support — unacceptable once slot counts and event volume scale across
  many tenants/sites.
- **PostGIS geometry, but geographic SRID (WGS84 lat/lon)** — natural if slots had real-world
  GPS coordinates, but slot polygons are derived from a camera homography into a local planar
  frame, not GPS; forcing lat/lon would require an unnecessary and lossy extra projection step.

## Consequences

- Positive: point-in-polygon, overlap validation (§7 of this doc), and future spatial queries
  (e.g. "slots within N meters of gate X") are native, indexed, and fast; PostGIS is a mature,
  widely-operated extension with strong Postgres compatibility.
- Negative / trade-offs: adds an infrastructure dependency (PostGIS extension must be enabled on
  every environment, including CI/Testcontainers per §1's testing stack); the frontend must
  convert between its native pixel-space vertex arrays and the stored planar geometry, which needs
  care to avoid drift between the "display" JSON and the "source of truth" geometry.
- Follow-ups: confirm Testcontainers Postgres image used in `backend/` tests supports PostGIS (or
  pin a `postgis/postgis` image) so slot validation logic is testable in CI; define the site-local
  SRID convention in `09_AI_Calibration`'s homography design.
