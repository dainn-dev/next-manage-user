# DAI-324 / DAI-329 pilot commissioning runbook

Use this procedure for every pilot site. Store the completed checklist, generated report, screenshots, and redacted logs with the release evidence. Never record plaintext camera credentials.

## 1. Preconditions and stop conditions

- The operator is a `TENANT_ADMIN` or an assigned `SITE_MANAGER`.
- The site survey provides at least four non-collinear control points in one site-local metre frame.
- OVERVIEW camera framing and native image dimensions are final.
- Stop immediately if a Blocker/Critical defect is open or any publish validation fails.
- Re-aiming/replacing a camera invalidates the calibration and requires a new still, calibration version, and map version.

## 2. Automated release gate

From the repository root on a host with Java 21, Maven, pnpm, and Docker Desktop:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-commissioning-acceptance.ps1
```

The command writes repeatable logs plus `commissioning-report.json` and `commissioning-report.md` under `artifacts/commissioning/`. A non-zero exit code blocks the pilot.

To run the core PostGIS/RLS scenario alone:

```powershell
Set-Location backend
mvn -q "-Dtest=CommissioningE2EIntegrationTest" test
```

## 3. Manual commissioning procedure

1. Open **Bãi đỗ xe → Thiết lập bãi đỗ** and select the target site.
2. Create zones. Confirm every zone appears only under the selected site.
3. Create the `OVERVIEW` and `ANPR_GATE` cameras. For ANPR, set the correct entry/exit panel.
4. As Tenant Admin or assigned Site Manager, issue the credential once, copy it directly into the edge secret store, close the dialog, and verify it cannot be revealed again.
5. Start the edge worker and confirm camera status/last heartbeat becomes healthy.
6. For every OVERVIEW camera, upload a final native-resolution still through `POST /api/v1/sites/{siteId}/cameras/{cameraId}/stills:upload`.
7. Place at least four pixel/site-local control-point pairs, run `POST .../calibrations:validate`, and save the immutable calibration with `POST .../calibrations`.
8. Record the calibration version and reprojection error in pixels. Reject degenerate points or any result outside the site survey tolerance.
9. Draw each physical slot exactly once, using site-wide unique codes (`A01`, `A02`, ...). Keep camera coverage partitions disjoint in the site-local plane.
10. Save the draft with `If-Match`, run `POST .../maps/{mapId}:validate`, and resolve every duplicate, invalid polygon, bounds, calibration, ownership, and overlap error.
11. Publish with a unique `Idempotency-Key`. Repeating the same key must return the same version without duplicating slots or audit rows.
12. Replay A01 enter → A02 relocation → exit. Confirm the operations map, occupancy metrics, event timeline, and plate search converge to the same state.
13. Republish an unchanged map while a track is active. The logical slot ID and occupancy must remain stable and no false relocation may be emitted.
14. Export one version as `site-local-meters-v1` GeoJSON, import it into a camera with its exact still/calibration, and confirm validation produces the same site-local polygons.
15. Roll back an archived version with a reason, confirm its predecessor is archived and the activation audit records the reason. Archive the active version and confirm its slots disappear from runtime.

## 4. Multi-camera verification

- Publish camera A with the left partition and camera B with the right partition.
- Confirm the two coverage polygons do not overlap by positive area; a shared boundary is allowed.
- Confirm unified preview shows all published partitions and each active slot exists once.
- Map one point inside each partition and verify the expected slot/camera ownership.
- Deliberately attempt an overlapping partition and duplicate code; validation must block publish.

## 5. Negative and authorization checklist

- [ ] Zone/camera from another site is rejected.
- [ ] Tenant B cannot list/read Tenant A commissioning rows; raw SQL under `app_rls` sees only the bound tenant.
- [ ] Security Guard, Member, and Platform Admin cannot open or publish through commissioning APIs.
- [ ] Duplicate slot code (case-insensitive) is rejected.
- [ ] Self-intersecting, too-small, overlapping, and out-of-image polygons are rejected.
- [ ] Missing, stale, invalid, or wrong-image calibration blocks publish.
- [ ] Missing/stale `If-Match` rejects draft overwrite/delete.
- [ ] Missing/replayed `Idempotency-Key` does not create duplicate map activation.
- [ ] Duplicate/concurrent ingest produces one ledger/outbox/usage result.
- [ ] Republish preserves logical slot IDs and does not emit a false relocation.
- [ ] A slot outside camera coverage or owned by another camera is rejected by service and database constraints.
- [ ] Legacy `PUT /api/sites/{siteId}/parking-slots` returns `410 Gone` and changes no map state.
- [ ] Rollback requires a current `If-Match`, restores the archived geometry, and writes the operator reason.

## 6. Pilot evidence checklist

- [ ] Git revision, report run ID, operator, reviewer, and UTC timestamps
- [ ] Tenant/site/zone/camera IDs (no secrets)
- [ ] Camera role, health, and last-seen screenshot
- [ ] Still reference, dimensions, SHA-256, and capture method
- [ ] Calibration version, point count, matrix, and reprojection error
- [ ] Published map versions, archived predecessor, and activation audit rows
- [ ] Unified multi-camera preview with partition ownership
- [ ] A01/A02 enter → relocate → exit correlation IDs and redacted snapshots
- [ ] Dashboard occupancy, timeline, and plate-search screenshots after exit
- [ ] Negative authorization, cross-site, cross-tenant/RLS, geometry, and replay results
- [ ] Defect ID, severity, owner, disposition, and retest evidence for every failure

## 7. Pilot decision

The reviewer may mark Stage 1 ready only when every required automated suite passes, every manual evidence item is attached or explicitly not applicable, and no Blocker/Critical defect remains untriaged.
