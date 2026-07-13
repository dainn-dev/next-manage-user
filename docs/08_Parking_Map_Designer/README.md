# Parking Map Designer

The Parking Map Designer is the visual tool operators use to turn a raw camera still (or an
uploaded lot photo) into a labeled set of parking-slot polygons — the data the AI pipeline needs
to know that "the vehicle at pixel (412, 210)" means "slot A01 is now occupied". It also captures
the camera↔ground homography reference points that `09_AI_Calibration` turns into a
pixel-to-world transform. Today none of this exists: there is no map UI, no polygon data model,
and no geospatial storage anywhere in the repo. This document is a from-scratch design.

Status: Architecture signed off (DAI-297) · Owner: Principal Architect · Last updated: 2026-07-14

## 1. Current state vs Target

### 1.1 Current state (verified from code)

| Concern | Today |
|---|---|
| Map/slot UI | **None.** No map component of any kind in `frontend/` — confirmed no map library dependency and no camera/video component either. |
| Parking-slot concept | **Does not exist.** No entity, no table, no notion of a slot anywhere in `backend/`. |
| Geospatial storage | **None.** PostgreSQL has no PostGIS extension enabled; no geometry columns anywhere in the Flyway migration history (V1–V35). |
| Camera still capture | **None.** No snapshot-on-demand endpoint for cameras; the only images persisted today are vehicle-check evidence snapshots (`uploads/snapshots`, `VehicleLog.imagePath`). |
| Homography/calibration | **None.** No calibration data is stored or computed anywhere today. |

### 1.2 Target (from the vision, §2/§4 of the shared brief)

- A Next.js page where an operator selects a site + `OVERVIEW` camera (see `07_Camera_Management`),
  captures or uploads a background image, and draws one polygon per parking slot directly over it.
- Each slot gets a human-readable `code` (A01, A02, …), an optional `Zone`, and is persisted as a
  `ParkingSlot` row with a PostGIS `polygon` geometry.
- The same tool captures homography reference points on the same image, producing the
  `calibration_json` payload that `09_AI_Calibration` consumes for pixel→world→point-in-polygon
  mapping.
- Maps are versioned per site: a draft can be edited freely; publishing snapshots it as the active
  version and archives the previous one.
- Import/export of a site's slot layout as GeoJSON, for backup and for bootstrapping a new site
  from a previous one's layout.

## 2. UX flow

1. Operator opens **Site → Parking Map Designer**.
2. Tool lists the site's cameras with `role = OVERVIEW` (from `07_Camera_Management`); operator
   picks one (a site may have more than one overview camera — e.g. two halves of a large lot —
   each gets its own map/version line; for the wide-lot multi-camera case see §4 and ADR-0803).
3. Operator requests a still frame from that camera (`POST /api/v1/cameras/{id}/snapshot`) or
   uploads a static lot image (fallback for sites without a live camera yet).
4. The image loads as the background layer of an SVG/Canvas editor (§6).
5. Operator draws a polygon (click-to-add-vertex or drag), the editor auto-closes it on
   double-click/Enter.
6. Operator types a slot code (`A01`), optionally assigns a `Zone`, and confirms.
7. Repeat for every visible slot; the editor runs live validation (§7) after every polygon.
8. Operator saves as **Draft** at any point (auto-save on every N edits, plus explicit Save).
9. Optionally, operator switches to **Calibration mode** on the same canvas and places 4+
   reference points with known real-world coordinates/spacing — this produces the homography
   input handed to `09_AI_Calibration` (§8).
10. Operator clicks **Publish** — server re-validates, marks this version `published`, archives
    the prior `published` version (only one active version per site/camera at a time).

## 3. Data model

### 3.1 `ParkingSlot` (per §4 of the shared brief)

| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | stable logical `slot_id`; retained across compatible map revisions |
| `tenant_id` | UUID FK → Tenant | denormalized isolation key; must agree with `site_id` |
| `site_id` | UUID FK → Site | |
| `zone_id` | UUID FK → Zone, nullable | optional grouping |
| `code` | string | e.g. `A01`; case-insensitively unique within the site's logical layout |
| `admin_status` | enum `enabled`, `disabled`, `retired` | administrative lifecycle, separate from runtime occupancy |
| `updated_at` | timestamp | |

### 3.2 `ParkingSlotGeometry`

| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | immutable `slot_geometry_id` |
| `slot_id` | UUID FK → ParkingSlot | stable logical slot |
| `map_version_id` | UUID FK → SiteMapVersion | published/draft geometry revision |
| `polygon` | `GEOMETRY(Polygon, 0)` | site-local Cartesian metres; `site-local-meters-v1` |
| `created_at` | timestamp | |

Runtime `SlotOccupancy` is owned by `11_Parking_Slot_Detection`; it references the stable
`slot_id` and does not mutate a historical geometry revision.

### 3.3 `Zone` (per §4 of the shared brief)

`id, site_id, name` — an optional grouping (floor/section, e.g. "Level 2 / Section B").

### 3.4 `SiteMapVersion` (new — introduced by this doc, follows the same tenant/site-scoped
pattern as the rest of §4 of the shared brief)

| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `site_id` | UUID FK → Site | |
| `camera_id` | UUID FK → Camera, nullable | the `OVERVIEW` camera this map was drawn against, if any |
| `version_no` | int | monotonically increasing per site |
| `status` | enum `draft`, `published`, `archived` | only one `published` per `(site_id, camera_id)` |
| `source_image_url` | string | the still/upload the polygons were drawn over |
| `calibration_json` | jsonb, nullable | homography points captured in this session, handed to `Camera.calibration_json` on publish (see `09_AI_Calibration` §… for the full shape) |
| `published_at` | timestamp, nullable | |

`ParkingSlotGeometry` rows reference `map_version_id` and are never mutated after publish.
Compatible edits create a new geometry for the existing logical `slot_id`; physical deletion
retires that logical slot. Events record `slot_id`, `slot_geometry_id`, and `map_version_id`, so
history remains reconstructable without generating relocation events merely because a map was
republished. The normative runtime contract is ADR-1102.

A site with multiple `OVERVIEW` cameras carries one published `SiteMapVersion` per camera, but
runtime queries select slots by `site_id` across all of them — see the multi-camera subsection in
§4 and ADR-0803.

## 4. Coordinate systems

Three coordinate spaces are in play and must not be conflated:

1. **Image pixel space** — origin top-left, x right, y down, bounded by the captured frame's
   width/height. This is what the SVG/Canvas editor draws and stores polygon vertices in
   natively; it is camera- and even capture-specific (a re-captured still may have a different
   resolution).
2. **Site-local planar space (meters)** — a flat, camera-independent plane local to the site,
   produced by applying the homography matrix (from `09_AI_Calibration`) to an image-space point.
   `ParkingSlot.polygon` is stored in this space (or in image space with the homography applied
   at read time — see ADR-0801) so that point-in-polygon tests are meaningful in real-world units
   and are stable even if the camera is later swapped.
3. **Geographic space (lat/lon)** — `Site.geo` from the shared domain model, used only for
   locating the site on a map-of-all-sites view (not in scope for this tool — "no map library
   today" per the brief, and the designer itself never needs geographic coordinates).

The designer works entirely in (1); the handoff to `09_AI_Calibration` is what establishes the
transform into (2). (3) is out of scope for this document.

### Multi-camera wide-lot maps

A wide lot that no single `OVERVIEW` camera can cover is handled by **partitioned coverage**:
each camera owns a disjoint region of the lot, and the operator draws each slot exactly once, on
whichever camera sees it best. No slot is drawn against two cameras, so there is no overlap
region and no merge/dedup step at the map-design level.

This works only because of the coordinate-system decision above: every `OVERVIEW` camera
covering the site is homography-calibrated to the **same site-local planar frame** (shared origin,
scale, and orientation — established from common ground control points in `09_AI_Calibration`),
so polygons authored over camera A's image and camera B's image both land in plane (2) and form
one coherent set. `SiteMapVersion` stays per-camera for editing (one published version per
`(site_id, camera_id)` per §3.3), but the runtime point-in-polygon query in
`11_Parking_Slot_Detection` §3 selects slots by `site_id` across all published versions, so the
AI pipeline sees a single unified map regardless of how many cameras authored it.

The trade-off is a disciplined partitioning convention: the operator must not draw a slot in a
neighboring camera's region, and a camera whose coverage changes (re-aimed, added, removed) may
need its partition — and any slots re-assigned across the boundary — re-drawn. Areas visible to
no camera simply have no slots; if a true blind spot forces overlapping coverage, fall back to
the merge/dedup alternative (not designed here — would warrant its own ADR). Full rationale and
alternatives are in [ADR-0803](adr/ADR-0803-multi-camera-map-strategy.md).

## 5. Import / export & versioning

- **Export**: a published (or draft) map version can be exported as **GeoJSON**
  (`FeatureCollection` of `Polygon` features, each with `code`/`zone`/`status` properties) for
  backup, offline review, or migrating a layout to a similar site.
- **Import**: GeoJSON can be imported to bootstrap a new draft version — useful when duplicating a
  layout across near-identical sites (e.g. a supermarket chain's standard lot template).
- **Versioning**: every publish creates an immutable `SiteMapVersion`; the previous published
  version transitions to `archived` (kept for history, not deleted — needed to interpret past
  `ParkingEvent` rows correctly). Drafts can be discarded freely; only publishing is durable.

## 6. Frontend approach: SVG/Canvas polygon editor

There is no map or canvas library in the frontend today (`frontend/` has recharts for charts and
nothing else drawing-related). The editor is genuinely new:

- Render the background still as an `<image>`/`<img>` layer, polygons as absolutely-positioned
  SVG `<polygon>` elements with draggable vertex handles.
- Coordinate mapping: image is displayed at a CSS-scaled size; vertex events are converted back
  to native image pixel coordinates before being sent to the backend, so stored polygons are
  resolution-independent of the viewport.
- Consistent with the rest of the frontend's "hand-rolled, no heavy dependency" style (no
  react-query/SWR, no global store — see `07_Camera_Management`/repo facts) — see ADR-0802 for
  the build-vs-library decision on the editor itself.

## 7. Validation

Enforced both client-side (fast feedback while drawing) and server-side (source of truth):

| Rule | Client | Server |
|---|---|---|
| Polygon has ≥ 3 vertices | yes | yes |
| Polygon is simple (no self-intersection) | best-effort | yes (PostGIS `ST_IsValid`) |
| Polygon lies within the source image bounds | yes (canvas clamp) | yes (`ST_Within` against frame bbox) |
| No two slots in the same map version overlap | best-effort (bbox check) | yes (PostGIS `ST_Overlaps` pairwise) |
| Slot `code` unique within the site's active logical layout | yes | yes (case-insensitive DB constraint) |

Server-side validation runs on every save, not just publish, so a draft can never silently
persist an invalid polygon.

## 8. Handoff to AI Calibration

Publishing a map version does two things relevant to `09_AI_Calibration`:

1. It freezes the slot polygons other systems will point-in-polygon test against.
2. If homography reference points were captured in the same session (§2 step 9), the resulting
   transform is written into the owning `Camera.calibration_json` (via the backend, not directly
   by the frontend) so the edge pipeline can start mapping detected vehicle positions to slots
   using the same reference frame the polygons were drawn in. The detailed `calibration_json`
   shape and the edge/backend sync mechanism are owned by `09_AI_Calibration` — this doc is only
   responsible for producing the raw reference-point pairs.

## 9. Diagrams

- `diagrams/designer-workflow.mmd` — flowchart of the operator UX flow in §2, from camera
  selection through publish.
- `diagrams/slot-map-data.mmd` — ER diagram of `Site`, `Zone`, `Camera`, `SiteMapVersion`,
  `ParkingSlot`, and the optional `Vehicle` occupancy link.
- `diagrams/editor-interaction.mmd` — sequence diagram of a single draw-and-save interaction
  between operator, editor, backend, and PostGIS.
- `diagrams/multi-camera-partitioning.mmd` — how two `OVERVIEW` cameras covering a wide lot each
  own a disjoint partition, share one site-local frame, and surface as one unified map at runtime
  (per ADR-0803).

## 10. Decisions / ADRs

- [ADR-0801](adr/ADR-0801-polygon-storage.md) — Polygon storage: PostGIS geometry vs JSON.
- [ADR-0802](adr/ADR-0802-editor-build-vs-library.md) — SVG/Canvas editor: build vs adopt a
  library.
- [ADR-0803](adr/ADR-0803-multi-camera-map-strategy.md) — Multi-camera wide-lot map strategy:
  partitioned coverage + runtime query by site vs merge/dedup.
- [ADR-1102](../11_Parking_Slot_Detection/adr/ADR-1102-slot-runtime-and-event-contract.md) —
  signed-off published-map handoff, stable slot identity, coordinate and validation contract.

## 11. Open questions / risks

- Re-captured stills change resolution/framing over time (camera physically bumped, replaced) —
  need a policy for detecting a "stale" map version and prompting re-draw.
- Multi-camera wide-lot coverage is **resolved** by partitioned coverage (each `OVERVIEW` camera
  owns a disjoint region, no overlapping slots) plus the existing site-scoped runtime slot query —
  see §4 and [ADR-0803](adr/ADR-0803-multi-camera-map-strategy.md). The merge/dedup alternative
  remains undesigned and is deferred until a site has a blind spot that forces overlapping
  coverage.
- Concurrent editing (two operators drafting the same site) is not addressed — likely needs
  simple optimistic locking on `SiteMapVersion` at minimum.
- GeoJSON import does not yet define how conflicting slot codes from a different site's export are
  reconciled.

## 12. Cross-references

- `07_Camera_Management` — `OVERVIEW` camera selection and still-frame capture consumed in §2/§3.
- `09_AI_Calibration` — owns the homography/`calibration_json` shape this doc hands off in §8.
- `15_Database_Design` — full ERD, PostGIS extension setup, and migration ordering.
- `03_SaaS_Architecture` — `site_id`/`tenant_id` scoping and RLS applied to `ParkingSlot`/`Zone`.
