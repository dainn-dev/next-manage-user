# DAI-314 performance and AI calibration gate

## Decision

Pilot promotion requires two reproducible artifacts from pilot-equivalent infrastructure: a passing
ingest capacity report and a passing real-model AI cohort report. The checked-in fixture validates
the tooling only and can never approve promotion.

## Workload model and initial SLO

Copy `tools/performance/pilot-workload.example.json` and replace the camera IDs. Secrets stay in the
named environment variables. Record actual camera count, event rate, concurrent dashboard users,
retention, peak factor, duration, and concurrency in the manifest retained with the evidence.

The initial pilot envelope is 5 events/second sustained, 15 events/second for 30 seconds, 10
concurrent dashboard users, and 30-day retention. The ingest gate is p95 <= 500 ms, <= 1% request
errors, throughput >= 4.8 events/second, and no missing client response. Do not extrapolate beyond
the last passing run.

Prometheus exposes `camera_ingest_requests_total`, `camera_ingest_latency_seconds`, and
`camera_ingest_outbox_pending`, alongside JVM, HTTP, database-pool, CPU, and memory metrics. Retain
dashboard exports for queue depth, PostgreSQL saturation, object-store errors, websocket delivery,
CPU, memory, and disk. A passing HTTP report with a growing outbox queue or occupancy reconciliation
errors is a failure.

## AI evidence and thresholds

Use a human-labelled, versioned, held-out dataset. It must include day, night, rain, glare, angle,
motorcycle, and difficult Vietnamese plate cohorts. The evaluator records exact-match OCR
precision/recall/F1, confidence distributions, tracker ID switches, event counts, failures, latency,
and FPS per cohort. Default minimum read rates are 95% day, 90% night, 85% rain/glare/angle/
motorcycle, and 80% difficult plates. Overrides require review in the versioned manifest; every
required cohort passes independently.

Low-confidence OCR is manual-review evidence, not an occupancy fact. Any threshold change must be
evaluated on the same held-out version, with false positives and false negatives reviewed. Known
limitations: unique-plate scoring is not occurrence-level mAP/IDF1, slot mapping and relocation need
separately labelled lifecycle evidence, and fixture FPS is not edge-hardware FPS.

## Reproducible gate

```powershell
scripts/run-performance-ai.ps1 `
  -WorkloadManifest D:/pilot/pilot-workload.json `
  -AiManifest D:/pilot/model-evaluation.json `
  -EvidenceDirectory D:/pilot/reports/dai-314
```

Approval requires both reports, dataset version, model/configuration hash, hardware and deployment
version, metrics export, occupancy reconciliation result, and named reviewer. Unexplained event
loss, sustained queue growth, occupancy corruption, missing cohorts, or unapproved thresholds block
release.
