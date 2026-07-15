# LPR full-pipeline evaluation and operations

This directory contains the DAI-296 evaluation harness for the complete `lpr-mvp-v1` path:
frame input, motion gate, vehicle detection, ByteTrack, plate detection, snapshots, PaddleOCR,
lifecycle policy, typed events, and Camera Management ingest serialization.

## Quick reviewer run

From the repository root:

```powershell
python edge/tools/pipeline_eval/evaluate_pipeline.py `
  --manifest edge/tools/pipeline_eval/sample-evaluation.json
```

The command writes JSON and Markdown reports beneath `edge/tools/pipeline_eval/reports/`. The
checked-in day/night PPM inputs and deterministic adapters exercise the full orchestration without
model downloads, credentials, or network traffic. This fixture run validates the harness and
payload contract only. Its report always sets `promotionEligible` to `false`, even when its
synthetic read rates meet the target.

## Metrics and promotion targets

Every feed reports:

- processed frames, vehicle detections, plate detections, and OCR attempts;
- unique recognized plates and normalized exact-match read rate;
- vehicle, plate, and OCR confidence distributions (`min`, mean, p50, p95, `max`);
- `VehicleDetected` and `PlateRecognized` event counts;
- TrackIds observed per normalized plate plus an ID-switch count (a plate moving to a second
  TrackId in one feed counts as a switch);
- wall-clock FPS plus mean, p50, p95, and maximum frame latency;
- sample dry-run ingest payloads, including TrackId, boxes, model provenance, and snapshots.

The architecture promotion gates are 95% normalized exact-match read rate for day feeds (at least
50 lux) and 90% for night feeds (below 50 lux, including IR-assisted captures). Only `models` mode
with a declared dataset version and every `required_conditions` target met is promotion-eligible.
The model example requires day, night, rain, glare, angle, motorcycle, and difficult Vietnamese
plate cohorts; each is gated independently so averages cannot hide a weak cohort. Fixture numbers are
deliberately
not representative of real edge hardware.

## Real model evaluation

1. Install the headless edge requirements and PaddleOCR production dependencies:

   ```powershell
   pip install -r edge/edge/requirements.txt
   pip install -r edge/edge/requirements-ocr-production.txt
   ```

2. Place the configured local artifacts without downloading at runtime:

   ```text
   edge/model/yolo11n.pt
   edge/model/LP_detector_nano_61.pt
   edge/model/paddleocr/
     det/
     rec/
   ```

3. Copy `model-evaluation.example.json`, set the dataset version, replace every cohort feed path, list every
   ground-truth-readable normalized plate once per feed, and point `pipeline_config` at a local
   profile. Keep evaluation data outside the runtime repository when it contains personal data.

4. Run without promotion enforcement while calibrating:

   ```powershell
   python edge/tools/pipeline_eval/evaluate_pipeline.py `
     --manifest D:/lpr-eval/model-evaluation.json `
     --output-json D:/lpr-eval/reports/site-a.json
   ```

5. After the held-out set and thresholds are approved, use `--enforce-targets`. Exit code `3`
   means the run is incomplete, is a fixture, or missed a required cohort target.

The evaluator always forces ingest dry-run. It captures payloads but never sends evaluation data to
the backend.

## Pipeline configuration

Start from `edge/camera-pipeline.dry-run.example.json`. Important production fields are:

```json
{
  "models": {
    "vehicle_detector": {"artifact_path": "model/yolo11n.pt", "device": "cuda:0"},
    "plate_detector": {"artifact_path": "model/LP_detector_nano_61.pt", "device": "cuda:0"},
    "ocr": {"artifact_path": "model/paddleocr", "device": "cpu"}
  },
  "ingest": {
    "dry_run": false,
    "max_attempts": 3,
    "retry_base_seconds": 0.5,
    "retry_max_seconds": 5.0,
    "queue_enabled": true,
    "queue_path": "camera-event-queue.sqlite3",
    "queue_max_events": 5000,
    "queue_retry_seconds": 5.0
  }
}
```

Keep `camera_key` empty in committed profiles and provide it through `DAI_CAMERA_KEY`.

## Local dry-runs

Validate configuration and one local image without loading models or sending HTTP:

```powershell
python edge/run_camera_pipeline.py `
  --config edge/camera-pipeline.dry-run.example.json `
  --dry-run
```

Exercise motion behavior without a camera:

```powershell
python edge/run_camera_pipeline.py `
  --config edge/camera-pipeline.dry-run.example.json `
  --dry-run-sequence moving-vehicle
```

## Bounded ingest-enabled run

Use a local feed first, with an enrolled camera ID/key and `ingest.dry_run=false` in the profile:

```powershell
$env:DAI_CAMERA_KEY = "<per-camera-secret>"
$env:DAI_INGEST_URL = "http://localhost:8080/api/v1/parking-events"
python edge/run_camera_pipeline.py `
  --config D:/lpr/config/site-a.json `
  --run-feed D:/lpr-eval/site-a-day.mp4 `
  --max-frames 300
```

`--run-feed` calls runtime readiness checks before opening the feed. Start with a small frame bound;
events are real when ingest dry-run is disabled. The backend derives tenant/site from the camera
credential, so they must not be added to request payloads.

## Production file/RTSP runtime

Set `camera.source.type` to `rtsp`, provide its URL through `DAI_CAMERA_SOURCE`, and run:

```powershell
python edge/run_edge.py `
  --camera-pipeline-config D:/lpr/config/site-a.json
```

This entry point runs `CameraProcessingService`, throttles inference using `frame_interval_ms`,
reconnects a failed RTSP capture, and flushes the durable SQLite camera-event spool. RTSP username
and password may be supplied separately through `DAI_CAMERA_SOURCE_USERNAME` and
`DAI_CAMERA_SOURCE_PASSWORD`; source credentials are not written to logs.

## Troubleshooting

| Symptom | Action |
|---|---|
| Model artifact does not exist | Check paths relative to the pipeline config, not the shell working directory. |
| CUDA unavailable | Select `cpu` for the affected model or install matching PyTorch/CUDA builds; there is no silent fallback. |
| PaddleOCR reports missing models | Ensure both `det/` and `rec/` exist beneath the configured OCR root. |
| No detections | Confirm motion thresholds/ROI, source frame dimensions, detector confidence, and class labels (`car`, `motorcycle`/`motorbike`). |
| Plate events absent | Check `min_hits`, OCR confidence policy, plate crop logs, and per-track duplicate suppression. |
| HTTP 401 | Verify the camera UUID and its per-camera key; do not use `X-Gate-Key`. |
| HTTP 400/413 | Compare the dry-run event with `docs/openapi/openapi.yaml`; verify snapshot size and multipart part name. |
| Retryable failures | Inspect structured ingest logs and the configured SQLite queue; `408`, `425`, `429`, network failures, and `5xx` are spooled after bounded immediate retries. |
| Report says “not demonstrated” | Add ground-truth-readable plates and both day/night conditions to the held-out manifest. |

## Known limitations and recommended next iteration

- The repository does not contain a representative, human-labeled day/night video corpus or the
  production model bundles. Therefore no real day/night quality claim is made by the checked-in
  fixture report.
- OCR exact-match precision, recall, and F1 use unique expected/recognized plate strings. Repeated visits by the
  same plate need occurrence-level annotations in the next manifest schema.
- Vehicle/plate metrics are operational counts and confidence summaries, not mAP/recall. Add
  frame-level bounding-box ground truth and COCO-style scoring next.
- The harness does not yet calculate tracker IDF1. Add per-frame object identity annotations before
  enforcing the architecture's day/night IDF1 gates.
- Latency is measured around synchronous `process_frame`; stage-level timers, GPU warm-up exclusion,
  memory, temperature, and sustained multi-camera load should be added next.
- Lighting condition is manifest metadata. Add measured lux/IR metadata and dataset governance so
  day/night labels are auditable.
- The durable SQLite spool is single-device/local-disk resilience. Monitor queue depth and disk
  health; replicated delivery across failed edge hardware remains outside the MVP.

## Evidence and tracker durability

Production ingest uploads `original_frame` and `plate_crop` as separate multipart parts. Retryable
delivery stores both binaries in the SQLite spool, so reconnect does not silently discard one
artifact. The backend links the resulting object keys to the same ingest event by evidence kind.
Enter and plate-recognize events carry their evidence directly; relocate and exit lifecycle frames
are delivered as `SnapshotSaved` evidence events causally linked to the original vehicle event.

The edge also maintains `tracker-state.sqlite3`, an upserted audit projection of
`session_id + track_id -> plate + bounding box + observed_at`. This survives process restart for
diagnostics and reconciliation; ByteTrack itself intentionally starts a new stream session after a
restart rather than pretending its in-memory Kalman state survived.

For backend handoff, the emitted samples are the approved `/api/v1/parking-events` contract. For
edge handoff, retain the manifest, report, configuration hash, model artifact versions, hardware,
and dataset version together for every promotion decision.
