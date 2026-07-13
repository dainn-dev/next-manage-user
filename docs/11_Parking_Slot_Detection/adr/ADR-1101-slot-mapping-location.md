# ADR-1101: Where Parking-Slot Mapping Runs — On-Edge vs Backend PostGIS

- Status: Accepted by DAI-297
- Date: 2026-07-09
- Deciders: Principal Architect
- Context doc: 11_Parking_Slot_Detection

## Context

None of this exists today — the current codebase has **no parking-slot or occupancy logic**
(brief §1) and no `ParkingSlot` entity. The target domain model (brief §4) defines
`ParkingSlot.polygon` as a PostGIS `GEOMETRY(Polygon)`, and architecture decision 4 calls for
adding PostGIS for slot polygons and vehicle-center point-in-polygon testing. Edge devices run
**one process per camera/gate** (today: "one process == 1 gate"), connect **outbound only**
(decision 14), and rely on a SQLite store-and-forward queue for resilience against connectivity
loss — so slot mapping needs to keep working through a temporary disconnect. At the same time,
the Parking-Map Designer (08_Parking_Map_Designer) lets tenant admins edit slot polygons live
from the web app, and that edit must be a single source of truth so the edge and backend never
silently disagree about occupancy.

## Decision

The exact source, coordinate, containment, transition, and event semantics are normative in
[ADR-1102](ADR-1102-slot-runtime-and-event-contract.md).

**Hybrid.** The edge computes a **provisional** point-in-polygon slot mapping using `shapely`
against a locally cached snapshot of the site's slot polygons (refreshed on gate heartbeat/poll),
so gate-local logic (relocation-candidate flagging, kiosk UI feedback) works with low latency and
while offline. The backend recomputes the **authoritative** mapping via PostGIS
`ST_Covers` on every ingested event, and that authoritative value is what gets
persisted to `ParkingSlot`/`Vehicle.current_slot_id` and used to write `ParkingHistory`. If the
edge's provisional `slot_id` and the backend's authoritative `slot_id` disagree, the backend
value wins and the edge's polygon cache is invalidated so it resyncs on the next poll.

## Alternatives considered

- **Pure on-edge** (shapely only; backend stores whatever the edge sends) — pros: lowest
  latency, works fully offline, a single geometry engine. Cons: polygon edits from the
  Parking-Map Designer must be pushed to every edge process before they take effect; a drifting
  or stale cache produces silently wrong occupancy with no authoritative check; harder to
  reconcile multi-camera overlap at a site since each edge process only sees its own camera.
- **Pure backend/PostGIS** (edge sends only raw vehicle center + camera_id) — pros: single
  source of truth, polygon edits take effect instantly, PostGIS is well-optimized for
  point-in-polygon at scale. Cons: adds a network round-trip to the critical path before slot
  state is known; breaks entirely offline (no provisional local state during a queued/offline
  stretch, so gate-local UX has nothing to show); backend read load scales with every frame's
  worth of events instead of only confirmed transitions.
- **Hybrid** (chosen) — pros: low-latency local UX plus offline resilience, backend remains
  authoritative and reconciles Parking-Map Designer edits centrally, the disagreement path gives
  an explicit signal to refresh stale edge caches. Cons: two geometry implementations must stay
  semantically aligned (shapely vs PostGIS boundary-inclusion rules, coordinate system
  consistency); added complexity of a cache-invalidation protocol; brief windows of edge/backend
  disagreement are possible right after a polygon edit.

## Consequences

- Positive: slot mapping keeps working offline, consistent with the existing SQLite
  store-and-forward design; the backend remains the single source of truth for persisted
  occupancy; live polygon editing works without redeploying edge configuration.
- Negative / trade-offs: shapely and PostGIS containment semantics (boundary handling,
  coordinate/projection system) must be kept aligned; requires a polygon-cache sync protocol
  with versioning/etag; disagreement-rate monitoring is needed to catch calibration drift early.
- Follow-ups: define the polygon cache refresh interval and invalidation payload; define the
  coordinate system/homography calibration handoff from 09_AI_Calibration; define
  disagreement-rate monitoring and alerting thresholds.
