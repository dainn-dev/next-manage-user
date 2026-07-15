# DAI-260 MVP acceptance matrix

This is the DAI-317 release contract. Stable IDs map each MVP capability to automated evidence.

| ID | Capability | Assertion | Evidence |
|---|---|---|---|
| TEN-01 | Tenancy/auth/RBAC | Tenant/site isolation and RLS fail closed | Backend test log |
| BILL-01 | Billing | Lifecycle converges and entitlements are enforced | Backend test log |
| CAM-01 | Cameras | Enrollment, keys, heartbeat, snapshots, and dedupe | Backend test log |
| LPR-01 | LPR | Day/night fixtures cross OCR, tracking, and ingest serialization | Evaluation JSON/log |
| EDGE-01 | Edge resilience | Tracking, durable retry, and runtime behavior | Edge test log |
| SLOT-01 | Occupancy | Polygon mapping and transitions remain scoped | Backend test log |
| UI-01 | Dashboard | Scope, metrics, search, and realtime reconcile | Frontend test log |
| API-01 | Regression | Complete backend suite passes | Backend test log |
| WEB-01 | Dashboard build | Production build passes | Build log |

## Release rules

- Run `pwsh scripts/run-release-acceptance.ps1 -Mode full`.
- Retain `artifacts/acceptance/` as CI evidence.
- Missing required suites are not passes.
- Blocker/Critical defects cannot be waived; High defects require explicit disposition.
- Fixture LPR results prove the contract only. Model promotion requires the governed labelled corpus and approved numeric thresholds.
- Do not commit secrets, credentials, or customer plate imagery as evidence.
