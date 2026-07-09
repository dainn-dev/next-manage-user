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
