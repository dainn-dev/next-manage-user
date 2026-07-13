# 11. Parking-Slot Detection — Mapping a Tracked Vehicle to a Slot

This document defines how the platform maps a tracked vehicle (produced by the AI pipeline,
see 10_AI_Pipeline) to a physical parking slot: geometry, reference-point choice, debouncing,
confidence, the per-slot occupancy state machine, and how edge and backend computations are
reconciled. **The runtime capability is greenfield**; this document and its schemas define the
contract the implementation must follow.

Status: Runtime contract signed off (DAI-297) · Owner: Principal Architect · Last updated: 2026-07-14

## 1. Current State vs Target

### Current

The repository now has a signed-off runtime contract and versioned event schemas, but the
parking-slot projector and occupancy persistence remain implementation work for the child tasks.
The existing edge tracking path is still a per-plate-string timestamp dictionary rather than a
stable multi-object tracker, so runtime slot assignment still depends on the AI tracking work.

### Target

A stable logical `ParkingSlot` identity plus immutable, map-versioned `ParkingSlotGeometry`
records authored in the Parking-Map Designer. Runtime occupancy is stored separately. A tracked
vehicle reference point is mapped provisionally on the edge and authoritatively by PostGIS on
the backend, as specified by ADR-1102.

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
tested with `shapely` `covers()` on the edge (cached polygons) and PostGIS `ST_Covers` on the
backend (authoritative). Boundary points therefore have identical containment semantics on both
sides. See **ADR-1101** for the full
edge-vs-backend trade-off and why both run.

This site-scoped selection (polygons by `site_id`, not per-camera) is also what unifies a
multi-camera site: slots authored over several `OVERVIEW` cameras' images appear as one set — see
`08_Parking_Map_Designer` §4 and ADR-0803.

## 4. Overlaps and Partial Occupancy

Well-drawn slot polygons should not overlap, but boundary-adjacent polygons and large vehicles
spanning two slots do happen in practice:

1. If a reference point falls inside more than one polygon (mis-drawn/overlapping polygons),
   resolve by the polygon with the larger overlap area against an approximate vehicle footprint
   polygon (not just the point).
2. If a vehicle's approximate footprint polygon intersects a second slot beyond a configurable
   overlap-ratio threshold (proposed default 15%), record an overlap-review flag and hold the
   prior occupancy rather than inventing a third `partial` occupancy state.
3. Persistent overlap flags for the same slot pair are a signal to correct the polygon in
   08_Parking_Map_Designer, not a runtime condition to keep resolving indefinitely.

## 5. Debouncing and Confidence

A slot assignment is **not** committed on a single frame — mirroring the existing edge pattern
of cooldown + min-detection-duration confirmation used for plate events today:

- **Debounce window**: a candidate slot must be the top match for N consecutive confirmed
  frames or T seconds before it is committed, absorbing tracker/geometry jitter near polygon
  boundaries.
- **Signed-off defaults**: enter after 3 consecutive frames or 600 ms; relocate after 5 frames
  or 1 second; exit after tracker TTL plus 5 seconds. Deployments may tune these values without
  changing the event contract.
- **Confidence** is a composite of: (a) vehicle-detector confidence, (b) geometric confidence
  (distance from the reference point to the polygon centroid relative to distance to the nearest
  edge — points near the centroid score higher than points near a boundary), and (c) track
  stability (number of consecutive frames the identity has been tracked).
- Assignments below the confidence threshold, or not yet stable through the debounce window,
  leave the slot's prior state unchanged (`Hold`, see the flowchart) rather than flapping.

## 6. Occupancy State Machine

Runtime `SlotOccupancy.status` has exactly two values:

| State | Meaning | Transition |
|---|---|---|
| `free` | No authoritative vehicle identity is assigned. | To `occupied` after the entry guard commits. |
| `occupied` | One authoritative vehicle identity owns the slot. | To `free` after exit, or atomically with another slot during relocation. |

Administrative lifecycle is a separate `ParkingSlot.admin_status` dimension
(`enabled | disabled | retired`). Disabled/retired slots are excluded from candidate mapping;
changing this flag does not masquerade as a vehicle transition event. Reservation belongs to the
booking domain and may gate assignment, but it is not an occupancy state. See
`diagrams/slot-occupancy-state.mmd` and ADR-1102.

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
  (`free ↔ occupied`) with the independent administrative guard.
- `diagrams/point-in-polygon-concept.mmd` — conceptual containment test against multiple slot
  polygons, including the overlap-resolution case.
- `diagrams/vehicle-to-slot-sequence.mmd` — sequence from edge tracking through provisional
  mapping, ingest, PostGIS authoritative recomputation, and persistence.
- `diagrams/slot-runtime-sequence.mmd` — signed-off map loading, authoritative transition,
  transactional outbox, and best-effort evidence capture.
- `diagrams/slot-transition-state.mmd` — per-identity transition guards and event boundaries.

## 9. Decisions / ADRs

- `adr/ADR-1101-slot-mapping-location.md` — on-edge (shapely) vs backend (PostGIS) vs the chosen
  hybrid, and the cache-invalidation trade-off.
- `adr/ADR-1102-slot-runtime-and-event-contract.md` — accepted source, coordinate, identity,
  transition, event-boundary, snapshot, reconciliation, and failure-handling contract.

## 10. Open Questions / Risks

- Overlap-ratio threshold (15% proposed) is a starting guess, not yet validated against real
  slot layouts.
- Debounce window length trades off responsiveness (how fast a slot shows as `occupied`) against
  jitter suppression; needs tuning per site density.
- Calibration quality remains a deployment concern, but the interface is resolved: both slot
  polygons and projected vehicle points use `site-local-meters-v1`; raw image observations use
  `original-frame-pixels` and must be transformed before containment testing (ADR-1102).
- Reserved-slot arrival matching depends on plate OCR reliability at arrival, which is still
  being evaluated (see 10_AI_Pipeline, ADR-1001).

## 11. Cross-References

- 10_AI_Pipeline — produces the `track_id`, vehicle bbox, and confidence this document consumes.
- 12_Vehicle_Relocation — consumes a committed slot change (§1 flowchart's "Relocation
  candidate" branch) to decide whether to emit `VehicleRelocated`.
- 08_Parking_Map_Designer — where slot polygons are authored and edited.
- 09_AI_Calibration — camera calibration/homography that establishes the coordinate system slot
  polygons and vehicle reference points share.
