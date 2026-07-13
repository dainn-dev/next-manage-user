# ADR-0803: Multi-camera wide-lot map strategy — partitioned coverage vs merge/dedup

- Status: Accepted by DAI-297
- Date: 2026-07-09
- Deciders: Principal Architect
- Context doc: 08_Parking_Map_Designer

## Context

A wide lot cannot always be covered by a single `OVERVIEW` camera, so a site may carry two or
more. The obvious worry is the overlap zone: if two cameras both see the same row of slots, the
same physical slot could be drawn twice (once per camera image), producing duplicate polygons,
double-counted occupancy, and a "which camera wins" arbitration problem at runtime.

The existing design already removes most of the difficulty without anything new:

- Per [ADR-0801](ADR-0801-polygon-storage.md) and §4 of this doc, `ParkingSlot.polygon` is stored
  in a **camera-independent site-local planar frame** (meters), not in any camera's pixel space.
- Each `OVERVIEW` camera gets its own `homography.matrix` (`09_AI_Calibration`) that maps *that*
  camera's pixels into that shared site-local frame.
- The runtime point-in-polygon query (`11_Parking_Slot_Detection` §3) selects slots **by
  `site_id`** across all published versions, not per-camera — so slots authored over several
  cameras already surface as one set.

So the data model and runtime already assemble one unified map from multiple cameras. The only
open question (formerly listed in §11) is the **operator/dedup strategy**: when two cameras'
fields of view meet, do they overlap (and need merging) or not?

## Decision

Adopt **partitioned coverage** (phân vùng rạch ròi) plus the existing **runtime query by site**:

1. Each `OVERVIEW` camera owns a **disjoint region** of the lot. The operator draws each slot
   exactly once, on whichever camera sees it best. No slot is drawn against two cameras.
2. Every `OVERVIEW` camera covering the site is homography-calibrated to the **same site-local
   world frame** (shared origin, scale, and orientation, established from common ground control
   points in `09_AI_Calibration`), so polygons authored over different camera images all land in
   one plane.
3. Because the partition has no overlap by construction, there is **no merge/dedup logic** at the
   map-design level and no "which camera wins" arbitration.
4. `SiteMapVersion` remains per-camera for editing (one published version per `(site_id,
   camera_id)`); the unified runtime view comes from the existing site-scoped slot query — no
   site-level "merged" version is required.

## Alternatives considered

- **Merge/dedup overlapping coverage** — allow cameras' fields of view to overlap, then detect and
  merge duplicate polygons (by `code` or overlap-area) into one. Rejected as the default: it needs
  overlap detection, conflict resolution, a double-counting guard in the overlap zone, and a
  policy for which camera's homography/geometry wins. It is only justified when a true blind spot
  *forces* overlapping coverage; deferred until such a case exists (then it gets its own ADR).
- **One unified `SiteMapVersion` per site (`camera_id = null`) holding all slots** — would make the
  single-map view explicit in the data model. Rejected for now: it requires a merge step across
  per-camera capture sessions, loses the clean "one camera → one version → one source image"
  editing model, and buys nothing the site-scoped runtime query does not already provide.
- **Stitch camera images into one panorama and draw over that** — rejected. Image stitching is
  fragile (parallax across viewpoints, varying exposure/white balance), and the stored geometry
  must be in site-local space anyway; the homography already unifies coordinates, so stitching adds
  cost and fragility with no benefit.

## Consequences

- Positive: no dedup/merge code; each camera's map is independently editable and versionable;
  the unified runtime view is free; adding a third camera later is just another partition plus a
  version, with no change to the query path.
- Negative / trade-offs: requires a disciplined partitioning convention — the operator must assign
  each slot to exactly one camera and avoid drawing into a neighboring camera's region. A camera
  whose coverage changes (re-aimed, added, removed) may need its partition — and any slots
  straddling the new boundary — re-drawn. Areas visible to no camera simply have no slots; a
  genuine blind spot that must be covered forces the merge/dedup alternative instead.
- Follow-ups: the editor should make partition boundaries explicit (e.g. a per-camera coverage
  polygon or boundary line) and warn when an operator draws a slot better covered by another
  camera; `09_AI_Calibration` must document the shared-site-local-frame requirement for
  multi-camera sites (see its §5 note); per-camera homography drift detection (already an open
  question in `09_AI_Calibration` §10) matters more here — one drifted camera corrupts only its
  partition, but the unified view will show inconsistent occupancy in that region.
