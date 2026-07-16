# DAI-329 commissioning acceptance report

- Run: `dai-329-20260716-051940`
- Revision: `b2fc0c4f2ce4866c389b455e1fe9b3172158bc76`
- Result: **passed**
- Started (UTC): `2026-07-15T22:19:40.4753478Z`
- Finished (UTC): `2026-07-15T22:21:50.7723087Z`

| Suite | Capability | Result | Log | Seconds |
|---|---|---:|---|---:|
| COMM-E2E | Commissioning happy path, HTTP contract, geometry/calibration, multi-camera, RLS, republish, and rollback | passed | [COMM-E2E.log](./COMM-E2E.log) | 26.26 |
| CAM-EDGE | Camera CRUD, credential, heartbeat, and idempotent/replayed ingest | passed | [CAM-EDGE.log](./CAM-EDGE.log) | 41.35 |
| PARKING-RUNTIME | Point mapping, occupancy, relocation, exit, and dashboard read models | passed | [PARKING-RUNTIME.log](./PARKING-RUNTIME.log) | 29.28 |
| TENANT-RLS | Two-tenant service and database RLS isolation | passed | [TENANT-RLS.log](./TENANT-RLS.log) | 28.28 |
| COMMISSIONING-UI | Wizard policy, calibration/publish gates, and dashboard regression | passed | [COMMISSIONING-UI.log](./COMMISSIONING-UI.log) | 1.02 |
| COMMISSIONING-LINT | Changed commissioning frontend lint | passed | [COMMISSIONING-LINT.log](./COMMISSIONING-LINT.log) | 4.09 |
