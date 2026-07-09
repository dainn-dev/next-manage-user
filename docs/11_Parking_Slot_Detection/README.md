# 11. Parking-Slot Detection — Mapping a Tracked Vehicle to a Slot

This document defines how the platform maps a tracked vehicle (produced by the AI pipeline,
see 10_AI_Pipeline) to a physical parking slot: geometry, reference-point choice, debouncing,
confidence, the per-slot occupancy state machine, and how edge and backend computations are
reconciled. **This entire capability is greenfield** — nothing described here exists in the
codebase today.

Status: Draft · Owner: Principal Architect · Last updated: 2026-07-09

## 1. Current State vs Target

### Current

The repo has **no parking-slot or occupancy logic today** (brief §1): there is no `ParkingSlot`
entity, no polygon storage, no map component in the frontend, and no camera/video component —
`Gate.cameraRtspUrl` is data-only. "Tracking" on the edge today is a per-plate-string dict of
timestamps, not a real multi-object tracker, so there is no stable per-vehicle identity to
attach a slot to even if slot geometry existed.

### Target

A `ParkingSlot` entity (brief §4: `id, site_id, zone_id, code, polygon GEOMETRY(Polygon),
status{free,occupied,reserved,disabled}, current_vehicle_id, updated_at`) with slot polygons
authored in the Parking-Map Designer (08_Parking_Map_Designer) and evaluated against each
tracked vehicle's reference point via point-in-polygon testing (architecture decision 4:
PostGIS + on-edge shapely).

## 2. Reference Point Selection

The tracked vehicle's bounding box does not have a single unambiguous "location" — the choice of
reference point materially affects mapping accuracy, especially from angled overview cameras.

| Reference point | Pros | Cons | Use |
|---|---|---|---|
| **Footprint (bbox bottom-center)** | Approximates ground contact; most robust to camera angle/perspective distortion for overview cameras | Needs an accurate bbox bottom edge (can be noisy on partial occlusion) | **Default** for slot mapping |
| Bbox center | Simple, stable across frames | Biased toward the vehicle's roof/body under angled cameras — can appear to sit in the wrong slot | Fallback when footprint is unreliable (e.g. heavy occlusion) |
| Plate position | Precise, tied to a legible identity | Only reliably visible on `ANPR_GATE` cameras, not `OVERVIEW` cameras used for slot coverage; not usable mid-lot | Identity binding only (see 12_Vehicle_Relocation), not primary slot geometry |

## 3. Point-in-Polygon Test

Given a reference point and the set of `ParkingSlot` polygons for the site, containment is
tested with `shapely.geometry.Point.within()` on the edge (cached polygons) and PostGIS
`ST_Contains`/`ST_Within` on the backend (authoritative). See **ADR-1101** for the full
edge-vs-backend trade-off and why both run.

## 4. Overlaps and Partial Occupancy

Well-drawn slot polygons should not overlap, but boundary-adjacent polygons and large vehicles
spanning two slots do happen in practice:

1. If a reference point falls inside more than one polygon (mis-drawn/overlapping polygons),
   resolve by the polygon with the larger overlap area against an approximate vehicle footprint
   polygon (not just the point).
2. If a vehicle's approximate footprint polygon intersects a second slot beyond a configurable
   overlap-ratio threshold (proposed default 15%), mark that slot `partial` for admin review
   rather than silently flipping its state to `occupied`.
3. Persistent overlap flags for the same slot pair are a signal to correct the polygon in
   08_Parking_Map_Designer, not a runtime condition to keep resolving indefinitely.

## 5. Debouncing and Confidence

A slot assignment is **not** committed on a single frame — mirroring the existing edge pattern
of cooldown + min-detection-duration confirmation used for plate events today:

- **Debounce window**: a candidate slot must be the top match for N consecutive confirmed
  frames or T seconds before it is committed, absorbing tracker/geometry jitter near polygon
  boundaries.
- **Confidence** is a composite of: (a) vehicle-detector confidence, (b) geometric confidence
  (distance from the reference point to the polygon centroid relative to distance to the nearest
  edge — points near the centroid score higher than points near a boundary), and (c) track
  stability (number of consecutive frames the identity has been tracked).
- Assignments below the confidence threshold, or not yet stable through the debounce window,
  leave the slot's prior state unchanged (`Hold`, see the flowchart) rather than flapping.

## 6. Occupancy State Machine

| State | Meaning | Entered from | Exits to |
|---|---|---|---|
| `free` | No vehicle mapped to the slot | `occupied` (vacated), `reserved` (expired/cancelled), `disabled` (re-enabled), initial | `occupied`, `reserved`, `disabled` |
| `occupied` | A vehicle's footprint is confirmed (debounced) inside the polygon | `free`, `reserved` (reserved vehicle arrives) | `free` (vacated or relocated away), `disabled` |
| `reserved` | Slot booked ahead of arrival (app/booking flow) | `free` | `occupied` (arrival, plate match), `free` (expired/cancelled) |
| `disabled` | Administratively taken out of service | `free`, `occupied` | `free` (re-enabled) |

See `diagrams/slot-occupancy-state.mmd` for the full transition diagram.

## 7. Reconciling Edge-Computed vs Backend-Computed Slot

The edge computes a fast, provisional mapping from a cached polygon snapshot so gate-local
consumers (kiosk UI, immediate relocation flagging) don't wait on a round trip. The backend
recomputes the authoritative mapping via PostGIS on ingest and is the value that gets persisted.
On disagreement, the backend value wins and the edge cache is invalidated for resync. Full
rationale and alternatives are in **ADR-1101**.

## 8. Diagrams

- `diagrams/slot-mapping-flowchart.mmd` — end-to-end flow from tracked vehicle to committed slot
  assignment or relocation candidate.
- `diagrams/slot-occupancy-state.mmd` — per-slot state machine
  (`free → occupied → reserved → disabled`).
- `diagrams/point-in-polygon-concept.mmd` — conceptual containment test against multiple slot
  polygons, including the overlap-resolution case.
- `diagrams/vehicle-to-slot-sequence.mmd` — sequence from edge tracking through provisional
  mapping, ingest, PostGIS authoritative recomputation, and persistence.

## 9. Decisions / ADRs

- `adr/ADR-1101-slot-mapping-location.md` — on-edge (shapely) vs backend (PostGIS) vs the chosen
  hybrid, and the cache-invalidation trade-off.

## 10. Open Questions / Risks

- Overlap-ratio threshold (15% proposed) is a starting guess, not yet validated against real
  slot layouts.
- Debounce window length trades off responsiveness (how fast a slot shows as `occupied`) against
  jitter suppression; needs tuning per site density.
- Coordinate system / homography calibration (camera pixel space → site-plane coordinates) is
  owned by 09_AI_Calibration but is a hard dependency for accurate point-in-polygon testing —
  not yet specified end-to-end.
- Reserved-slot arrival matching depends on plate OCR reliability at arrival, which is still
  being evaluated (see 10_AI_Pipeline, ADR-1001).

## 11. Cross-References

- 10_AI_Pipeline — produces the `track_id`, vehicle bbox, and confidence this document consumes.
- 12_Vehicle_Relocation — consumes a committed slot change (§1 flowchart's "Relocation
  candidate" branch) to decide whether to emit `VehicleRelocated`.
- 08_Parking_Map_Designer — where slot polygons are authored and edited.
- 09_AI_Calibration — camera calibration/homography that establishes the coordinate system slot
  polygons and vehicle reference points share.
