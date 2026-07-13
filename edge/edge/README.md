# Detection Edge Service (Phase 3.3)

A **headless** variant of the license-plate monitor. It runs the same YOLOv5 +
OCR pipeline as the desktop app (`license_plate_monitor.py`) but drops all
PyQt/UI code and runs as a long-lived service: read RTSP → detect → self-register
as a gate → heartbeat → POST confirmed plates to the backend.

The original PyQt app is **untouched** — this is an additive variant. Turning the
desktop UI into a thin client is Phase 3.4.

## Layout

| File | Responsibility |
|------|----------------|
| `../run_edge.py` | Entry point / CLI |
| `edge_service.py` | Orchestration: register, heartbeat thread, RTSP loop, dispatch |
| `detection_core.py` | Headless YOLOv5 detect + OCR + confirmation (min-duration, cooldown) |
| `gate_client.py` | HTTP client: register / heartbeat / check-vehicle (+ cache & rate limit) |
| `event_queue.py` | Durable store-and-forward SQLite queue for undelivered events (Phase 4.3) |
| `requirements.txt` | Slim dependency set (no PyQt/TTS) |

## Configuration (`config.json`)

The service reuses the existing config plus a new `gate` section:

```json
"gate": {
    "id": "",                 // filled in automatically after first registration
    "name": "Cong Chinh",     // required — backend upserts by unique name
    "location": "Cong so 1",
    "camera_rtsp": "",        // reported to backend; falls back to the device URL
    "panel_type": "entry",    // "entry" or "exit" — sent as check-vehicle `type`
    "device_id": "device_1",  // which rtsp_devices entry to stream from
    "heartbeat_interval": 30  // seconds
}
```

The gate key (`X-Gate-Key`) is read from `api.gate_key` or the `GATE_API_KEY`
environment variable. RTSP tuning, detection cooldown, `min_detection_duration`,
cache duration and rate limits are shared with the desktop app.

## Running

```bash
# Live RTSP service
python run_edge.py

# One-shot detection from a still image (great for smoke testing)
python run_edge.py --image test_image/plate.jpg

# Register the gate + one heartbeat, then exit
python run_edge.py --register-only

# Use a non-default config file
python run_edge.py --config config.gate2.json
```

Logs go to stdout, so it drops straight into a service manager
(systemd / NSSM / Docker). Run one process per gate; point each at its own
config with a distinct `gate.name` and `gate.device_id`.

## Edge resilience (Phase 4.3)

When the backend is unreachable a confirmed detection is **never dropped** — it
is written to a durable, per-gate SQLite queue (`gate.queue`) and re-sent by a
background worker with exponential backoff until it lands.

- **Store-and-forward** — `check_vehicle` failures (timeout / network / 5xx /
  401/403/408/429) are persisted to `<gate.queue.dir>/events.sqlite3` (or an
  explicit `gate.queue.path`), cropped-plate JPEG included. The queue survives an
  edge restart.
- **Retry worker** — a daemon thread scans the queue every
  `poll_interval_seconds`, re-sends each due event with backoff
  (`retry_base_seconds` → ×2 → … → `retry_max_seconds`), and deletes it on the
  first `200`. Permanent rejections (e.g. `400`/`404`) are dropped and logged.
- **Original event time** — every event carries `occurredAt` (ISO-8601 of the
  detection) so a delayed resend is recorded at the moment it happened.
- **Idempotency** — every event carries a client `eventId` (UUID). The backend
  (`GateEventDeduplicator`) returns the original result for a repeated `eventId`
  instead of creating a duplicate `VehicleLog`, so a lost-ack retry is safe.
- **Bounded** — the queue keeps at most `max_events`; the oldest are dropped
  (with a log line) once the cap is reached.
- **Heartbeat backoff** — heartbeats back off (up to `heartbeat_backoff_max`)
  while the backend is down instead of spamming every `heartbeat_interval`, and
  reset on recovery.

Config (`gate` section):

```json
"gate": {
    "heartbeat_interval": 30,
    "heartbeat_backoff_max": 300,
    "queue": {
        "enabled": true,
        "dir": "edge_queue",
        "path": "",
        "max_events": 5000,
        "retry_base_seconds": 1.0,
        "retry_max_seconds": 60.0,
        "poll_interval_seconds": 5.0,
        "batch_size": 20
    }
}
```

Offline test (no camera / models / backend):

```bash
python edge/edge/test_edge_resilience.py
```

## Behaviour carried over from the desktop app

- **Model loading** — local `ultralytics_yolov5_master` first, `ultralytics/yolov5` fallback.
- **Anti-false-positive** — a plate must be seen for `detection.min_detection_duration`
  seconds before it is sent; per-plate `detection.cooldown` suppresses repeats.
- **OCR fallback** — deskew retries then tesseract/easyocr/google-vision per `ocr.*`.
- **Resilience** — corrupted frames are dropped; the RTSP capture auto-reconnects.
- **Backend hygiene** — response caching + per-minute rate limiting.

## Acceptance test

1. `python run_edge.py --register-only` → gate appears in `GET /api/gates`,
   `lastHeartbeatAt` refreshes.
2. `python run_edge.py --image <plate.jpg>` (or a live stream) → backend receives
   `POST /api/vehicles/check-vehicle` with the correct `gateId`, and pushes
   `/topic/gate/{id}/check`.
3. Wrong/missing `X-Gate-Key` → backend returns 401 and the edge logs the error.

## Camera pipeline scaffold (DAI-290)

`run_edge.py` remains the legacy gate service above. The additive camera pipeline scaffold is a
separate entry point for the future `lpr-mvp-v1` contract; it does not register a gate, open RTSP,
write snapshots, queue events, or call the backend. Model loading is isolated to runtime readiness
or motion-active vehicle frames; the plain file metadata dry run remains model-free.

```bash
# Safe local smoke test: validates the JSON profile, reads one image, and emits JSON stage logs.
python edge/run_camera_pipeline.py \
  --config edge/camera-pipeline.dry-run.example.json \
  --dry-run

# Future deployment readiness only: checks the configured artifacts, camera key, source, and
# snapshot-output parent without opening the source or sending an ingest request.
python edge/run_camera_pipeline.py \
  --config edge/camera-pipeline.dry-run.example.json \
  --validate-runtime
```

The committed profile intentionally leaves the camera key empty and references future model
artifacts, so it succeeds in `--dry-run` and fails descriptively in `--validate-runtime`. Override
deployment values through environment variables rather than committing secrets:

| Variable | Overrides |
|---|---|
| `DAI_CAMERA_SOURCE` | `camera.source.path` (file) or `camera.source.url` (RTSP) |
| `DAI_CAMERA_SOURCE_USERNAME`, `DAI_CAMERA_SOURCE_PASSWORD` | Future RTSP credentials |
| `DAI_TENANT_ID`, `DAI_SITE_ID`, `DAI_CAMERA_ID` | Local operational camera identity |
| `DAI_INGEST_URL`, `DAI_CAMERA_KEY` | `POST /api/v1/parking-events` destination and per-camera key |
| `DAI_SNAPSHOT_OUTPUT_DIR` | Future local snapshot-output directory |

Tenant and site values are local operational metadata only. Outbound events echo only the camera
ID; the backend derives tenant/site from `X-Camera-Id` plus `X-Camera-Key`.

### Motion-gate diagnostic (DAI-289)

The scaffold now contains a CPU-only OpenCV MOG2 gate before future expensive inference. It is
configured under `thresholds.motion` and applies to every injected frame, while no-motion frames
produce no downstream `MotionWindow` handoff:

```json
"motion": {
  "history": 500,
  "var_threshold": 16,
  "detect_shadows": false,
  "min_foreground_area_ratio": 0.005,
  "min_consecutive_active_frames": 2,
  "warmup_frames": 30,
  "cooldown_frames": 10
}
```

`warmup_frames` adapts the background model without emitting motion. The debounce setting requires
consecutive above-threshold frames before one internal window opens; `cooldown_frames` suppresses
flicker-driven retriggers after movement ends. The gate retains the original BGR debounce frames
in memory for DAI-291, but does not write or upload snapshots.

Use deterministic, in-memory smoke sequences without opening the configured file/RTSP source:

```bash
python edge/run_camera_pipeline.py \
  --config edge/camera-pipeline.dry-run.example.json \
  --dry-run-sequence static

python edge/run_camera_pipeline.py \
  --config edge/camera-pipeline.dry-run.example.json \
  --dry-run-sequence moving-vehicle
```

The static sequence reports `windows_opened: 0`; the moving sequence reports exactly one motion
window plus structured `active`, `inactive`, and per-frame counter records. Both commands remain
offline diagnostics with no queue, RTSP source, or ingest HTTP request. Static and other non-active
frames never load or invoke AI/storage adapters; motion-active frames exercise the configured stages
and contain any unavailable-model/inference failure in a structured log record. If real vehicle and
plate artifacts are provisioned, the moving sequence may write to the configured local snapshot root.

### Motion-gated vehicle detection (DAI-291)

The new camera scaffold loads a configured Ultralytics YOLOv11 vehicle model and evaluates only
frames whose final motion-gate state is `active`. It accepts logical `car` and `motorbike` results
(`motorcycle` model labels map to `motorbike`), applies the configured confidence/NMS thresholds,
and normalizes clipped boxes to original-frame `{x, y, width, height}` coordinates. Model or
per-frame inference errors are logged and do not abort frame processing.

Configure execution explicitly under `models.vehicle_detector`:

```json
{
  "name": "yolo11n",
  "artifact_path": "model/yolo11n.pt",
  "artifact_version": "2026.07.0",
  "image_size": 640,
  "device": "cpu"
}
```

`device` supports `cpu`, `cuda`, or `cuda:<index>`. CUDA readiness fails descriptively when the
configured device is unavailable; it never silently switches to CPU. Runtime readiness also
requires the model artifact to exist and expose a `car` or `motorcycle`/`motorbike` class. The
repository intentionally does not bundle/download `yolo11n.pt`. This stage produces normalized
vehicle results for the plate-candidate, tracking, OCR, and ingest stages.

### Plate candidates and local evidence (DAI-293)

For every motion-active vehicle result, the scaffold expands and clamps the vehicle box, runs the
configured local YOLOv5 plate model inside that crop, and translates valid crop-local boxes back to
original-frame pixels. It never uses the legacy network fallback. Configure the plate model with
explicit image size/device and tune candidate filtering under `thresholds`:

```json
"plate_detector": {
  "name": "lp-detector-nano",
  "artifact_path": "model/LP_detector_nano_61.pt",
  "artifact_version": "61",
  "image_size": 640,
  "device": "cpu"
},
"plate_confidence": 0.6,
"plate_padding_ratio": 0.1,
"min_plate_width_px": 20,
"min_plate_height_px": 8
```

`plate_padding_ratio` expands both the detector's vehicle-region crop and the final plate evidence
crop, always clamped to the original frame. Candidates smaller than the configured pixel dimensions
or outside frame bounds are discarded without failing other vehicles.

The MVP `snapshot.backend` is `local`. Once a frame has at least one plate candidate, the store
writes one shared original-frame JPEG and one padded plate-crop JPEG per candidate beneath:

```text
<output>/<tenant>/<site>/<camera>/<yyyy>/<mm>/<dd>/
  frame-<number>-<timestamp>/original-frame.jpg
  frame-<number>-<timestamp>/candidate-<uuid>/plate-crop.jpg
```

Writes use temporary files plus atomic replacement. Metadata records capture timestamp, stored image
dimensions, SHA-256, parent vehicle box, original-frame plate box, and the local opaque reference.
A failed original-frame write leaves successful plate crops marked incomplete; a failed plate-crop
write drops only that candidate artifact. This stage detects plate candidates and evidence only; the
following OCR stage consumes successfully stored crop artifacts.

### PaddleOCR and offline comparison (DAI-292)

PaddleOCR is the only production-path OCR engine. The edge recognizes the in-memory padded crop
after its JPEG artifact is stored, attaches the local crop reference, and records raw text,
separator-insensitive normalized text, character-weighted confidence, and one disposition:
`accepted`, `low_confidence`, or `no_text`. Accepted observations are associated with confirmed
ByteTrack identities and may emit one de-duplicated `PlateRecognized` event per track/plate pair.

### Camera ingest transport (DAI-294)

The camera pipeline emits the documented `VehicleDetected` and `PlateRecognized` envelopes to
`POST /api/v1/parking-events`. Requests carry `X-Camera-Id`, `X-Camera-Key`, and an
`Idempotency-Key` equal to the event UUID. Plate evidence uses multipart form data with an `event`
JSON part and the configured `snapshot` binary part. Retryable network, timeout, `408`, `425`,
`429`, and `5xx` failures use bounded exponential backoff and preserve the original event UUID.
Other `4xx` responses are permanent failures and are logged with the complete non-secret event
context. Set `ingest.dry_run` to log contract payloads without sending HTTP.

### Full-pipeline evaluation (DAI-296)

See [`../tools/pipeline_eval/README.md`](../tools/pipeline_eval/README.md) for the runnable day/night
fixture, real-model manifest, metrics/report format, bounded ingest-enabled feed command,
troubleshooting, current limitations, and promotion guidance.

The configured local bundle must be laid out without runtime downloads:

```text
<models.ocr.artifact_path>/
  det/
  rec/
```

Configure `models.ocr.device` as `cpu`, `cuda`, or `cuda:<index>`. Install the CPU production
baseline separately from the core edge dependencies:

```bash
pip install -r edge/edge/requirements-ocr-production.txt
```

`thresholds.ocr_confidence` is the single production threshold. With
`ocr.low_confidence_policy: reject`, low-confidence observations remain available for logs/debugging
but are ineligible downstream. `accept_flagged` keeps them eligible while retaining the warning.
`ocr.automatic_fallback` must remain `false`.

EasyOCR and VietOCR are available only in the offline same-crop harness:

```bash
pip install -r edge/tools/plate_eval/requirements-ocr-benchmark.txt
python edge/tools/plate_eval/compare_ocr.py \
  --config edge/camera-pipeline.dry-run.example.json \
  --manifest /path/to/labels.csv \
  --images /path/to/crops \
  --easyocr-model-root /path/to/easyocr-models \
  --vietocr-config /path/to/vietocr-config.yml \
  --vietocr-weights /path/to/vietocr.pth \
  --json-out ocr-results.json \
  --markdown-out ocr-report.md \
  --strict-day-night
```

Every engine receives an identical decoded crop. Reports include exact normalized match, CER,
threshold coverage, selective accuracy, latency, errors, and explicit day/night sections. The
repository currently has neither the local OCR model bundles nor a representative labeled day/night
corpus, so real comparative accuracy is not demonstrated yet; fake-engine tests validate only the
harness mechanics. Comparator output never votes on or replaces PaddleOCR in production.
