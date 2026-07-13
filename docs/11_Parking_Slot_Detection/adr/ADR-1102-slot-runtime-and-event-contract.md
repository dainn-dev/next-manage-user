# ADR-1102: Parking-slot runtime and transition-event contract

- Status: Accepted
- Date: 2026-07-14
- Deciders: Principal Architect
- Issue: DAI-297
- Context docs: 08_Parking_Map_Designer, 11_Parking_Slot_Detection,
  12_Vehicle_Relocation, 13_Event_Driven_Architecture

## Context

Parking Map Designer, the edge tracking pipeline, PostGIS occupancy projection, and downstream
event consumers need one contract before schema and runtime work can start. The contract must
prevent cross-tenant geometry access, survive map publication without changing logical slot
identity, use identical edge/backend boundary semantics, and distinguish observations from
authoritative occupancy transitions.

## Decision summary

1. A published Parking Map Designer snapshot is the only runtime source of slot polygons.
2. Polygons and mapped vehicle points use a site-local Cartesian plane measured in metres,
   represented as PostGIS `geometry(..., 0)` plus an explicit `site-local-meters-v1` coordinate
   space tag. Geographic latitude/longitude is never used for slot containment.
3. `slot_id` is a stable logical slot identity. `slot_geometry_id` identifies one immutable
   polygon revision in one `map_version_id`. Events use `slot_id` and also record the geometry
   and map versions used for the decision.
4. Edge mapping is provisional. The backend recomputes the authoritative assignment with
   PostGIS and is the only producer of `VehicleEntered`, `VehicleExited`, and
   `VehicleRelocated` domain events.
5. Edge and backend use boundary-inclusive containment: Shapely `covers(point)` and PostGIS
   `ST_Covers(polygon, point)`. A shared boundary tie does not cause a transition.
6. Occupancy row changes, parking history, the domain event, and its outbox row are committed in
   one database transaction.
7. Relocation captures old-slot and new-slot evidence when available, but snapshot-storage
   failure never rolls back a valid occupancy transition.

## Published slot-map source contract

The backend exposes the currently published snapshot for a camera as
`GET /api/v1/cameras/{cameraId}/slot-map`. Authentication determines tenant and site. The edge
must not send or select a tenant ID. The response supports `ETag`; `If-None-Match` may return
`304`.

```json
{
  "siteId": "20000000-0000-0000-0000-000000000001",
  "cameraId": "30000000-0000-0000-0000-000000000001",
  "mapVersionId": "40000000-0000-0000-0000-000000000001",
  "versionNumber": 7,
  "coordinateSpace": "site-local-meters-v1",
  "calibrationVersion": "sha256:73c9...",
  "etag": "\"slot-map-7-73c9\"",
  "publishedAt": "2026-07-14T08:00:00Z",
  "slots": [
    {
      "slotId": "50000000-0000-0000-0000-000000000001",
      "slotGeometryId": "60000000-0000-0000-0000-000000000001",
      "zoneId": "70000000-0000-0000-0000-000000000001",
      "code": "A01",
      "polygon": {
        "type": "Polygon",
        "coordinates": [[[1.0, 1.0], [3.5, 1.0], [3.5, 6.0], [1.0, 6.0], [1.0, 1.0]]]
      }
    }
  ]
}
```

The cache key is `(tenant_id, site_id, camera_id, map_version_id, calibration_version)`. A
publish operation changes both `map_version_id` and `ETag`. A calibration change invalidates the
cache even when polygons are unchanged.

### Stable identity across map versions

- `parking_slot` owns stable `slot_id`, `tenant_id`, `site_id`, optional `zone_id`, and `code`.
- `parking_slot_geometry` owns `slot_geometry_id`, `slot_id`, `map_version_id`, polygon, and
  audit metadata.
- A compatible map edit creates a new geometry revision for the existing `slot_id`.
- Deleting/replacing a physical slot retires its logical ID; importing an unrelated layout
  creates new logical IDs.
- Historical events retain `map_version_id` and `slot_geometry_id`, so old decisions remain
  reproducible after publication.

## Coordinate and polygon invariants

| Concern | Signed-off rule |
|---|---|
| Pixel origin | Original-frame top-left, x right, y down. |
| Runtime plane | Site-local Cartesian metres, x east/right and y north/up relative to the site's declared origin. |
| Transform | Versioned camera homography; input frame dimensions must match the calibration profile. |
| PostGIS | `geometry(Polygon, 0)` and `geometry(Point, 0)`; every query is additionally scoped by tenant/site. |
| Polygon shape | One exterior ring, at least three distinct vertices, explicitly closed, finite coordinates, non-zero area, no holes in MVP. |
| Winding | GeoJSON right-hand rule: exterior ring counter-clockwise; backend normalizes on import. |
| Validity | `ST_IsValid`, `ST_IsSimple`, and containment inside the published camera coverage polygon. |
| Overlap | Slot interiors in the same published site map may not overlap. Shared boundaries may touch. |
| Slot code | Unique within `(site_id, active logical layout)`; comparison is trimmed and case-insensitive. |
| Zone | Optional, but a supplied zone must belong to the same site and tenant. |

Map publication is rejected atomically if any invariant fails. Drafts may report validation
errors, but invalid geometry is never available through the runtime endpoint.

## Observation and authoritative mapping flow

1. ByteTrack provides `(session_id, track_id)`, vehicle bounding box, confidence, frame time,
   and camera ID.
2. Edge selects bbox bottom-centre as the ground-contact point and applies the versioned
   homography. Bbox centre is allowed only when the bottom edge is marked unreliable.
3. Edge calls Shapely `covers` against the cached published polygons and produces an optional
   provisional `slotObservation` inside the existing `VehicleDetected` transport payload.
4. Edge sends a candidate-change observation immediately and a heartbeat at least every two
   seconds while the track is assigned. Store-and-forward preserves the original event ID and
   observation time.
5. Camera ingest derives tenant/site from the camera credential and rejects mismatched camera,
   site, map, or calibration scope.
6. Backend transforms/recomputes the point against the currently published map using
   `ST_Covers`; this result is authoritative. A stale edge map is accepted as an observation,
   recomputed against current data, and returned as a cache-refresh signal.
7. The occupancy state machine consumes the authoritative assignment. Only a committed state
   transition creates a domain event.

The additive `slotObservation` shape is:

```json
{
  "mapVersionId": "40000000-0000-0000-0000-000000000001",
  "calibrationVersion": "sha256:73c9...",
  "referencePoint": {
    "method": "bbox_bottom_center",
    "pixel": {"x": 950.5, "y": 801.0},
    "siteMeters": {"x": 2.31, "y": 4.87}
  },
  "provisionalSlotId": "50000000-0000-0000-0000-000000000001",
  "mappingConfidence": 0.91,
  "observedAt": "2026-07-14T08:01:10.123Z"
}
```

## Occupancy state transitions

Identity means `(camera_id, session_id, track_id)` while continuous, or a backend-reconciled
vehicle/plate identity. Slot state and identity state are updated together.

| Current | Observation | Guard | Commit and event |
|---|---|---|---|
| `UNASSIGNED` | slot S | same authoritative S for 3 frames and at least 600 ms | occupy S; `VehicleEntered` |
| `OCCUPIED(S)` | S | any valid observation | update last-seen only; no event |
| `OCCUPIED(S)` | slot T | T != S for 5 frames and at least 1 s; S vacated | free S, occupy T; `VehicleRelocated` |
| `OCCUPIED(S)` | no slot/track missing | no valid S observation for 5 s after tracker TTL | free S; `VehicleExited` |
| any | ambiguous/invalid/stale observation | scope, calibration, or tie check fails | hold current state; no event |

All timing values are deployment-configurable; the values above are mandatory MVP defaults.
The 60-second relocation dedup window suppresses duplicate notifications but does not suppress
the authoritative occupancy update. Observations older than the identity's last committed
transition are stored for audit and ignored for state mutation.

### Concurrency and conflicts

- The transaction locks affected slot rows in sorted UUID order to avoid deadlocks.
- A new slot already occupied by another identity is an `occupancy_conflict`; neither occupant
  is evicted and no transition event is emitted.
- The same ingest `event_id` is idempotent. Domain transition events get a new event ID and carry
  the observation event as `causation_id`.
- A per-identity monotonic `transition_sequence` lets consumers order transitions despite
  at-least-once/out-of-order delivery.

## Domain-event boundaries

These are backend domain events, not edge authority. They use the canonical envelope from
`13_Event_Driven_Architecture`: `event_id`, `event_type`, `event_version`, `tenant_id`,
`site_id`, `occurred_at`, `correlation_id`, `causation_id`, and `payload`.

| Event | Exact boundary | Required slot fields |
|---|---|---|
| `VehicleEntered` | First authoritative `UNASSIGNED -> OCCUPIED(S)` commit for an identity. It is not a raw gate authorization event. | `slot_id`, `slot_geometry_id`, `map_version_id`, optional `zone_id` |
| `VehicleExited` | Authoritative `OCCUPIED(S) -> UNASSIGNED` after exit grace or explicit site-exit correlation. | prior `slot_id`, `slot_geometry_id`, `map_version_id`, `exit_reason` |
| `VehicleRelocated` | One atomic `OCCUPIED(S) -> OCCUPIED(T)` commit for the same resolved identity, S != T. | old/new slot, geometry, map and optional zone IDs |

Every payload also carries tracker identity, optional normalized plate/vehicle ID, assignment
confidence, reference-point method, `transition_sequence`, and snapshot evidence status. The
normative JSON Schemas live under
`backend/src/main/resources/events/schemas/<event-type>/v1.json`.

## Relocation snapshot policy

- `VehicleEntered`: save the committed new-slot frame when available.
- `VehicleRelocated`: reference the last confirmed old-slot frame and save the committed
  new-slot frame. Evidence kinds are `relocation_old` and `relocation_new`.
- `VehicleExited`: reference the last confirmed old-slot frame.
- Snapshot objects are written under backend-trusted tenant/camera/event scope. Events carry
  opaque `snapshot_id` values and evidence kind/status, never URLs or client-supplied object keys.
- Occupancy/history/outbox commit is not blocked by unavailable image bytes or object storage.
  The event uses `evidence_status = complete | partial | unavailable`; retrying evidence linkage
  is idempotent on `(event_id, kind)`.
- Snapshot failure raises an operational alert but never fabricates, delays, or rolls back a
  geometrically valid transition.

## Identity reconciliation

- Continuous `track_id` is primary.
- After track loss, exact normalized-plate matching is allowed within 30 seconds at the same
  site. Edit distance 1 is allowed only with OCR confidence at least 0.90 and exactly one
  candidate in the window.
- Ambiguous matches produce a new identity and no relocation.
- Cross-camera reconciliation runs only in the backend and cannot cross a site boundary.

## Failure handling

| Failure | Required behavior |
|---|---|
| Missing/invalid calibration or frame-size mismatch | Reject mapping, hold occupancy, alert calibration drift. |
| No published map | Accept raw observation for audit, do not mutate slot state, report `map_unavailable`. |
| Stale map/calibration version | Recompute on current version, record disagreement, request edge cache refresh. |
| Multiple covering slots | Apply footprint-overlap score; exact tie holds prior state and raises `ambiguous_mapping`. |
| Backend unavailable | Edge SQLite spool retries the original observation idempotently. |
| Snapshot/object storage unavailable | Commit transition with partial/unavailable evidence and retry linkage. |
| Duplicate event | Return prior result; do not repeat state transition or outbox publication. |
| Out-of-order observation | Persist for audit, ignore for occupancy mutation. |
| New-slot occupancy conflict | Hold both current states, emit metric/admin review record, no domain transition. |

## Consequences

- Backend schema tasks can implement stable logical slots and immutable geometry revisions
  without revisiting identity semantics.
- Mapping tasks have exact coordinate, containment, tie, debounce, and cache rules.
- Occupancy/event tasks have transactional boundaries and normative schema locations.
- Real-feed tuning may change configurable thresholds, but it does not change the contract.

