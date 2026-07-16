# DAI-329 commissioning acceptance evidence

## Result

Automated Stage 4 acceptance passed on 2026-07-16 (Asia/Saigon).

- Run ID: `dai-329-20260716-051940`
- Revision under test: `b2fc0c4f2ce4866c389b455e1fe9b3172158bc76` plus the current DAI-324/325/326/328/329 working-tree changes
- Result: `passed`
- Automated checks: 56 backend tests, 12 frontend tests, and changed-file frontend lint
- Critical code blockers: none remaining after the run

The machine-readable report is in `artifacts/commissioning/commissioning-report.json`; the human-readable report and full suite logs are in the same directory.

## Exact command and output

Run from the repository root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-commissioning-acceptance.ps1
```

Final output:

```text
Commissioning acceptance: passed
Evidence: C:\Users\hoang\Projects\next-manage-user\artifacts\commissioning
```

| Suite | Scope | Tests/check | Result | Seconds |
|---|---|---:|---:|---:|
| COMM-E2E | Happy path, HTTP/ETag, geometry/calibration negatives, multi-camera, RLS, republish, rollback/archive | 13 backend tests | passed | 26.26 |
| CAM-EDGE | Camera CRUD/key/heartbeat and replay-safe ingest | 17 backend tests | passed | 41.35 |
| PARKING-RUNTIME | Mapping, occupancy, relocation, exit, dashboard read models | 17 backend tests | passed | 29.28 |
| TENANT-RLS | Service and raw-SQL two-tenant isolation | 9 backend tests | passed | 28.28 |
| COMMISSIONING-UI | Wizard policy and dashboard regressions | 12 frontend tests | passed | 1.02 |
| COMMISSIONING-LINT | Changed commissioning frontend files | lint | passed | 4.09 |

## Acceptance coverage

| Criterion | Evidence |
|---|---|
| Tenant and role isolation | Controller authorization test plus service and raw-SQL RLS tests; foreign site/zone/camera access is rejected. |
| Happy path | Site, zones, overview/ANPR cameras, one-time key, heartbeat, source still, calibration, A01/A02 draft, validate, publish, ingest, mapping, relocate, exit, and dashboard state are exercised. |
| Invalid geometry | Out-of-bounds, self-intersecting, overlapping, outside-coverage, and case-insensitive duplicate slot codes are rejected. |
| Calibration and publish gates | Missing/stale calibration and unauthorized publish paths are rejected. |
| Replay safety | Duplicate ingest is idempotent; republish preserves logical slot IDs and does not create a false relocation. |
| Multi-camera layout | Overlapping camera partitions and cross-camera slot ownership are rejected; disjoint partitions publish into one site-local layout with distinct active slots and correct mappings. |
| Version lifecycle | Removed slots retire on republish, archived geometry rolls back with an audit reason, and archiving the active map removes its slots from runtime. |
| HTTP contract | Mutations carry `If-Match`, publish returns the new ETag, GeoJSON import/export is available in the UI, and the legacy direct-replace writer returns `410 Gone`. |
| UI regression | Wizard calibration requirements, safe zone deletion, draft validation gate, slot copy behavior, role-scoped routes, and dashboard calculations pass. |

## Defects found and resolved during commissioning

| ID | Severity | Finding | Resolution |
|---|---:|---|---|
| DAI-329-D1 | Critical | UI emitted `active`/`reserved` while the backend contract validates `enabled`/`disabled`/`retired`. | Normalize UI aliases at the contract boundary and map published backend states back into the editor model. |
| DAI-329-D2 | Critical | Republishing a draft without explicit slot IDs generated new IDs, risking a site-code uniqueness conflict and false occupancy relocation. | Reuse the existing logical slot by tenant/site/code before allocating a new ID; automated republish test verifies stable ID and no relocation event. |
| DAI-329-D3 | Test reliability | Relocation snapshot assertion was not scoped by site and could read fixtures from another test class. | Add the site predicate to the evidence query. |
| DAI-329-D4 | Test reliability | Dashboard `today` fixture used a fixed date and later crossed the application timezone boundary. | Derive the fixture from the application local date and persist it at UTC noon. |
| DAI-329-D5 | Evidence tooling | Windows PowerShell treated harmless JVM stderr warnings as suite failures and skipped useful logs. | Run each native process with explicit stdout/stderr capture and use its real exit code. |
| DAI-329-D6 | Critical | Frontend expected uppercase lifecycle states while backend returned lowercase values. | Normalize map and slot status values at the API boundary and cover the wire contract with a frontend test. |
| DAI-329-D7 | Critical | A slot could outlive its camera map or be referenced by another camera partition. | Persist authoring camera ownership, enforce composite same-scope foreign keys, retire removed/archived slots, and test both service and DB rejection paths. |
| DAI-329-D8 | Critical | Unified preview mixed per-camera pixel coordinates and there was no audited rollback path. | Build preview only from published PostGIS site-local geometry and add optimistic, reason-audited rollback with UI controls. |

## Pilot evidence still required

The automated run uses real PostgreSQL/PostGIS and application services, but mocks object storage and does not connect to physical OVERVIEW/ANPR cameras. Before production go-live, execute the manual flow in `docs/testing/dai-324-commissioning-runbook.md` in the pilot environment and attach:

- screenshots for source still, four calibration control pairs, A01/A02 draft, validation success, published layout, mapped occupancy, relocation, exit, and dashboard;
- camera heartbeat and ingest logs with timestamps and correlation IDs;
- tenant/site/camera identifiers with secrets redacted;
- any pilot-only defects and their triage status.

This is an environment evidence gate, not an untriaged critical code blocker. Production pilot sign-off remains pending until those artifacts are attached to DAI-329.
