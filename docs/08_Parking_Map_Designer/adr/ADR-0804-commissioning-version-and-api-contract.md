# ADR-0804: Parking commissioning version and API contract

- Status: Accepted
- Date: 2026-07-16
- Deciders: Principal Architect
- Issue: DAI-325
- Depends on: DAI-327 baseline, ADR-0801, ADR-0802, ADR-0803, ADR-0901, ADR-1102

## Context

DAI-324 needs one implementation contract for camera stills, calibration, map drafts,
immutable publish history, multi-camera activation, GeoJSON interchange, concurrency, and the
existing operations map. The repository already has tenant/site authorization, camera CRUD,
PostGIS slot mapping, occupancy/relocation, and an operations read path. Those are extended,
not replaced.

## Approved decisions

### Version and identity model

- `site_map_version` is scoped by `(tenant_id, site_id, camera_id)`. A draft is mutable through
  optimistic locking. Its content becomes immutable on first publish; an archived/published row
  is never edited or deleted.
- At most one published version exists per `(site_id, camera_id)`. A publish transaction validates
  the candidate together with every other camera's currently published partition, archives the
  prior version for that camera, and activates the candidate atomically.
- Per-camera activation is approved instead of a site-level release manifest. PostgreSQL MVCC
  guarantees runtime readers observe the complete old or complete new active site layout during
  a publish. A multi-camera bulk publish may be added later, but is not required for MVP.
- Rollback is an activation operation: archive the current version and reactivate a compatible
  archived version in one transaction after current site-wide validation. Geometry/calibration
  rows do not change. Publish/rollback records actor, timestamp, source version, and reason in an
  append-only activation audit row.
- `parking_slot.id` is stable logical identity. A code/zone/status/polygon edit keeps the ID;
  physical removal retires it. Active code is trim/case-insensitively unique per site. Code reuse
  after retirement creates a new ID and requires explicit confirmation.
- GeoJSON import creates new logical IDs by default. Same-site restore may preserve an existing
  `slotId` only in explicit restore mode when the ID already belongs to the site. Foreign IDs are
  ignored, never adopted.

### Images, calibration, and coordinates

- A source still is an immutable tenant-scoped object with ID, camera/site, object key, SHA-256,
  MIME type, byte size, native width/height, capture method/time, creator, and retention state.
  APIs expose an opaque ID and short-lived read URL, never a client-supplied storage key.
- MVP accepts JPEG, PNG, and WebP up to 15 MiB and 16384x16384. EXIF orientation is normalized
  before dimensions/hash are bound. Upload is guaranteed. Live capture is best effort for an
  online `OVERVIEW` camera and returns `409 capture_unavailable` when unsupported.
- Calibration versions are first-class immutable rows: 4+ non-degenerate pixel-to-site-local
  control-point pairs, 3x3 homography, source image dimensions/hash, coordinate-space tag,
  reprojection metrics, status, and audit metadata.
- `camera.calibration_json` may remain the edge sync projection, but is not historical authority.
  Publish pins `calibration_version_id`; changing active camera calibration cannot reinterpret an
  already-published map.
- The API accepts slot/coverage vertices only in native image pixels (origin top-left, x right,
  y down). Server code validates bounds and transforms with the pinned homography. PostGIS stores
  only `site-local-meters-v1`; immutable geometry also retains original pixel vertices for editor
  and history fidelity.
- Calibration acceptance: at least four finite points, no duplicate/collinear/near-singular
  configuration, matching source dimensions/hash, and reprojection RMSE <= 0.50 metres. The
  threshold is configurable but may not be relaxed without QA evidence and approval.

### Geometry and multi-camera validation

- A slot polygon has one exterior ring, at least three distinct finite vertices, no holes,
  positive area, normalized counter-clockwise winding, and lies inside the source image.
- Runtime geometry is valid/simple and has area >= 0.10 m². Normalize coordinates to millimetre
  precision. Shared boundaries may touch; interior intersection area over `1e-6 m²` is rejected.
- Each published map owns an immutable site-local coverage polygon derived from its calibrated
  authoring partition. Camera partitions must be disjoint except for touching boundaries. Every
  slot is contained by exactly one owning camera partition.
- Publish validates the candidate against all active slots/partitions at the site, not only the
  selected camera. This prevents cross-camera duplicate codes and overlap.
- Runtime queries published site-local geometry by `site_id`. No panorama, overlap merge/dedup,
  WGS84 slot geometry, or camera-winner arbitration is introduced.

## REST API contract

All resources use `/api/v1`, UUIDs, ISO-8601 timestamps, camelCase JSON, and problem details.
Cross-site/cross-tenant identifiers return `404`; validation returns `422`; stale locks return
`409`.

### Source stills

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/v1/sites/{siteId}/cameras/{cameraId}/stills:upload` | Multipart still upload |
| `POST` | `/api/v1/sites/{siteId}/cameras/{cameraId}/stills:capture` | Best-effort live capture |
| `GET` | `/api/v1/sites/{siteId}/cameras/{cameraId}/stills` | List metadata |
| `GET` | `/api/v1/sites/{siteId}/cameras/{cameraId}/stills/{stillId}` | Metadata + short-lived URL |

### Calibration

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/v1/sites/{siteId}/cameras/{cameraId}/calibrations:validate` | Validate without persisting |
| `POST` | `/api/v1/sites/{siteId}/cameras/{cameraId}/calibrations` | Create immutable version |
| `GET` | `/api/v1/sites/{siteId}/cameras/{cameraId}/calibrations` | List history |
| `GET` | `/api/v1/sites/{siteId}/cameras/{cameraId}/calibrations/{id}` | Read one version |
| `POST` | `/api/v1/sites/{siteId}/cameras/{cameraId}/calibrations/{id}:invalidate` | Mark unusable |

Corrections create a new version. Referenced calibration history cannot be hard-deleted.

### Map drafts, publication, and interchange

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/v1/sites/{siteId}/cameras/{cameraId}/maps` | Create draft bound to still/calibration |
| `GET` | `/api/v1/sites/{siteId}/cameras/{cameraId}/maps` | List version history |
| `GET` | `/api/v1/sites/{siteId}/cameras/{cameraId}/maps/{mapId}` | Read editor representation |
| `PUT` | `/api/v1/sites/{siteId}/cameras/{cameraId}/maps/{mapId}` | Replace draft using `If-Match` |
| `DELETE` | `/api/v1/sites/{siteId}/cameras/{cameraId}/maps/{mapId}` | Delete draft only |
| `POST` | `/api/v1/sites/{siteId}/cameras/{cameraId}/maps/{mapId}:validate` | Site-aware validation |
| `POST` | `/api/v1/sites/{siteId}/cameras/{cameraId}/maps/{mapId}:publish` | Validate and atomically activate |
| `POST` | `/api/v1/sites/{siteId}/cameras/{cameraId}/maps/{mapId}:rollback` | Reactivate compatible archive |
| `POST` | `/api/v1/sites/{siteId}/cameras/{cameraId}/maps:import` | GeoJSON into new draft |
| `GET` | `/api/v1/sites/{siteId}/cameras/{cameraId}/maps/{mapId}/export` | Export GeoJSON |
| `GET` | `/api/v1/sites/{siteId}/maps/preview` | Unified published site preview |

Draft reads return native pixel vertices, derived site-local GeoJSON, and validation issues.
`ETag` is derived from `mapId:lockVersion`; mutations require `If-Match` and increment the lock.
Publish also requires an idempotency key.

GeoJSON is a `FeatureCollection` in `site-local-meters-v1`. Features include `slotId`, `code`,
`zoneId`, `adminStatus`, `cameraId`, and map-version metadata. Import never trusts tenant/site/
camera fields in the document.

### Runtime compatibility

- Keep `GET /api/sites/{siteId}/parking-slots` and `/parking/maps` operations UI compatible.
- Keep/add ADR-1102 `GET /api/v1/cameras/{cameraId}/slot-map` with `ETag`/`304`; published
  site-local geometry only.
- Deprecate and disable the legacy direct replace-published endpoint after the new APIs ship; it
  cannot bypass calibration, bounds, optimistic locking, or site-wide validation.

## Authorization and isolation

- `TENANT_ADMIN`: configure any site in its tenant.
- `SITE_MANAGER`: configure assigned sites through `SiteAccess`.
- `SECURITY_GUARD`/operator: published operations reads only.
- `PLATFORM_ADMIN`: no implicit tenant geometry access through tenant APIs.
- All tenant-owned tables carry `tenant_id`; site-owned tables carry `site_id`; RLS is enabled and
  forced; application queries also use explicit scope. Camera, zone, still, calibration, slot,
  and map relationships must share tenant/site.
- Zone/camera deletion is soft-disable or reject while referenced. Historical map/calibration/
  geometry is never cascade-deleted.

## Implementation sequence

1. Add immutable still/calibration/coverage/activation history, constraints, RLS, and migration
   compatibility. Correct the existing draft schema before external exposure.
2. Implement still/calibration APIs and validation tests.
3. Implement draft CRUD, locking, GeoJSON, site-aware validate/publish/rollback, and compatible
   runtime reads.
4. Build the approved custom SVG editor and commissioning wizard against APIs, not table shapes.
5. Run two-tenant, multi-camera, republish-without-false-relocation, full E2E, and pilot runbook.

## Required changes and risks

- Existing direct `PUT /api/sites/{siteId}/parking-slots` is insufficient: no camera/still/
  calibration binding, pixel bounds, optimistic locking, or cross-camera validation. Route all
  publishing through this contract before Stage 1 exit.
- Existing V74 calibration/map additions are a useful start but still need immutable still rows,
  pixel vertices, coverage ownership, activation audit, CRUD/history, and DB same-scope invariants.
- Camera capture varies by deployment; upload is the guaranteed MVP fallback.
- No unresolved architecture blocker remains. Accepted thresholds require pilot evidence and must
  not be changed silently.

## Consequences

Backend and frontend can proceed independently against stable boundaries. History stays
reproducible, multi-camera publication cannot create duplicate active geometry, and the existing
occupancy/runtime path remains intact. The cost is additional audit/version schema and stricter
publish orchestration, justified by the Stage 1 safety gate.
