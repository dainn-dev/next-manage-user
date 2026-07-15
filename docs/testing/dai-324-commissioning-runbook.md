# DAI-324 pilot commissioning runbook

Use this checklist for every pilot site. Preserve the generated identifiers, screenshots, and test output with the release evidence; never include plaintext camera credentials.

## Preconditions

- Tenant and site exist; the operator is a TENANT_ADMIN or an assigned SITE_MANAGER.
- At least four surveyed control points share one site-local metre frame across all overview cameras.
- Camera still dimensions and framing are final. Re-aiming or replacing a camera makes its calibration stale.

## Procedure

1. Create zones and confirm each belongs to the selected site.
2. Create each camera, assign `ANPR_GATE` or `OVERVIEW`, and assign an optional zone.
3. Issue the camera credential, copy it directly into the edge secret store, then close the one-time response.
4. Connect the camera and confirm heartbeat/last-seen becomes healthy.
5. Capture or upload the final native-resolution overview still and record its width and height.
6. For each OVERVIEW camera, submit at least four pixel/site-local control-point pairs to `POST /api/sites/{siteId}/parking-map-calibrations`.
7. Record the returned immutable calibration version and reprojection error. Reject errors above 0.50 m.
8. Draw every slot once in native image pixels. Assign each slot to exactly one camera partition and use a unique site-wide code.
9. Validate bounds, polygon simplicity/area, zone/site ownership, duplicate codes, and cross-camera overlap before publish.
10. Publish the draft tied to the exact still and calibration version. Confirm the previous version is archived and remains readable.
11. Replay enter, relocation, and exit observations. Confirm occupancy, timeline, search, and realtime dashboard state reconcile.

## Evidence checklist

- [ ] Tenant/site/zone/camera IDs and Git revision
- [ ] Camera role, health, and last-seen (credential redacted)
- [ ] Still object reference, dimensions, and checksum
- [ ] Calibration version, control-point count, matrix, and reprojection error
- [ ] Published map version and prior archived version
- [ ] Unified multi-camera preview with partition ownership
- [ ] A01/A02 enter → relocate → exit event correlation IDs
- [ ] Negative authorization and cross-tenant/site results
- [ ] Duplicate/replay result proving one converged state
- [ ] Operator, reviewer, timestamp, defect disposition

## Stop conditions

Do not publish when calibration is missing/stale, a polygon is outside image bounds or invalid, slot codes conflict, camera partitions overlap, site ownership fails, or a Blocker/Critical defect is open.
