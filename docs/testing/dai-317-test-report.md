# DAI-317 release-readiness test report

The harness writes per-run results to `artifacts/acceptance/`. CI should retain that directory rather than committing transient logs.

## Current disposition

**Not yet approved for release.** The executable gate and traceability baseline are implemented. A release owner must run the full gate on the exact release revision and attach its generated report. Production-model OCR and externally backed checkout/browser journeys require approved environment evidence.

## Approval checklist

- [ ] The full acceptance command passes on the release revision.
- [ ] TEN-01 through WEB-01 have evidence pointers.
- [ ] Governed LPR data meets approved day/night targets; fixture mode is not promotion evidence.
- [ ] Two-tenant, multi-site negative paths show no leak through API, DB, snapshots, search, or realtime.
- [ ] Duplicate/reordered ingest and billing events converge to one correct state.
- [ ] Dashboard counts, occupancy, timeline, search, and snapshots reconcile.
- [ ] No Blocker/Critical defect remains; other defects have severity, owner, disposition, and retest evidence.

| Role | Name | Revision | Decision | Timestamp (UTC) |
|---|---|---|---|---|
| QA |  |  |  |  |
| Architecture |  |  |  |  |
| Release owner |  |  |  |  |

