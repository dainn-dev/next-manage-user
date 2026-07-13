# 10. AI Pipeline — Edge Vision Processing

The edge AI pipeline turns an RTSP camera stream into confirmed vehicle/plate events. This
document describes the pipeline **as it exists today** in `edge/` and the **target pipeline**
the platform is evolving toward: motion-gated, multi-stage detection with tracking and
parking-slot awareness, running on-site with store-and-forward resilience.

Status: Draft · Owner: Principal Architect · Last updated: 2026-07-09

## 1. Current State vs Target

### Legacy runtime and current MVP runtime (verified from `edge/`)

The repository retains the legacy `EdgeService`/`DetectionCore` path for compatibility. The
`lpr-mvp-v1` production entry point is `run_edge.py --camera-pipeline-config <profile>`, which
runs `CameraProcessingService` for one configured file or RTSP source.

| Aspect | `lpr-mvp-v1` implementation |
|---|---|
| Capture | Configured local file or RTSP via OpenCV/FFmpeg; inference throttling, credential-safe URL construction, reconnect, and graceful shutdown |
| Motion detection | OpenCV MOG2 with warm-up, debounce, cooldown, and retained trigger frames |
| Vehicle-level detection | YOLOv11 car/motorbike adapter with explicit device policy and normalized boxes |
| Plate detection | Existing local YOLOv5 plate model applied to vehicle regions with padded crops |
| OCR | PaddleOCR primary; EasyOCR/VietOCR remain offline comparators rather than automatic fallbacks |
| Tracking | ByteTrack plus a per-track enter/relocate/plate-recognize/exit state machine |
| Parking-slot logic | **None** |
| Offline resilience | Durable bounded SQLite camera-event spool preserving envelope, snapshot, event ID, retry schedule, and idempotency key |
| Backend comms | `CameraIngestClient` with `X-Camera-Id`, `X-Camera-Key`, and `Idempotency-Key` to `POST /api/v1/parking-events` |
| Snapshots | Original frame and plate crop stored locally; typed events include evidence descriptors and upload the contract-selected binary part |

The MVP runtime now includes MOG2 motion gating, YOLOv11 vehicle detection, the existing plate
detector, PaddleOCR, ByteTrack, lifecycle evidence snapshots, typed camera ingest, and a durable
SQLite camera-event spool. Parking-slot/occupancy logic, a map UI, and a representative labeled
day/night evaluation corpus remain outside or incomplete for this milestone.

### Target

```
RTSP camera stream → MOG2 motion gate → YOLOv11 vehicle detector → plate detector → PaddleOCR → ByteTrack → camera ingest event
```

`lpr-mvp-v1` ends at the authenticated camera-ingest boundary. Slot mapping and occupancy
projection remain follow-on consumers of the track identity; they are not prerequisites for the
first typed detection events.

- **Motion Detection** (NEW) — OpenCV MOG2 background subtraction gates all downstream GPU work.
- **Vehicle Detection** (NEW) — YOLOv11, car/motorbike classes.
- **Plate Detection** (KEPT) — existing YOLOv5 plate-box model, now cropped from the vehicle box.
- **OCR** (EVOLVED) — PaddleOCR primary; EasyOCR/VietOCR/legacy-YOLOv5-char as comparators (see
  ADR-1001).
- **ByteTrack** (NEW) — real multi-object tracker producing a stable `track_id`, replacing
  today's per-plate-string timestamp dict.
- **Parking-Slot Mapping** (NEW) — see 11_Parking_Slot_Detection.
- **Event emission** (EVOLVED) — structured domain events instead of a single ad-hoc payload.
- SQLite store-and-forward queue: **kept and extended**, not replaced.

## 2. Pipeline Stages

| # | Stage | Status | Input | Output | Notes |
|---|---|---|---|---|---|
| 1 | Frame Capture | existing | RTSP stream | validated frame | 200ms throttle today, unchanged |
| 2 | Motion Detection | **new** | frame | motion/no-motion + ROI mask | OpenCV MOG2, CPU-only, see ADR-1002 |
| 3 | Vehicle Detection | **new** | motion-gated frame | vehicle bbox(es), class | YOLOv11 car/motorbike, see ADR-1002 |
| 4 | Plate Detection | existing | vehicle crop | plate bbox | existing YOLOv5 model, kept |
| 5 | Deskew Retry | existing | plate crop | up to 4 oriented crops | unchanged |
| 6 | OCR | evolved | plate crop(s) | plate string + confidence | PaddleOCR primary, comparators shadow-run, see ADR-1001 |
| 7 | Plate Assembly | existing | char boxes / OCR output | VN 1-line/2-line string | `function/helper.py` logic retained for legacy comparator path |
| 8 | ByteTrack | **new** | vehicle bbox per frame | stable `track_id` | replaces the per-plate-string timestamp dict |
| 9 | Slot Mapping | **new** | track + reference point | `slot_id` + confidence | see 11_Parking_Slot_Detection |
| 10 | Confirmation | existing, extended | raw detections | confirmed event | existing cooldown + min-detection-duration logic, extended to cover relocation (see 12_Vehicle_Relocation) |
| 11 | Event Emission | evolved | confirmed detection | typed domain event | `MotionDetected, VehicleDetected, PlateRecognized, VehicleEntered, VehicleRelocated, VehicleExited, PersonDetected, SnapshotSaved` |
| 12 | Store-and-Forward | existing | event | durable enqueue | SQLite queue, kept & extended |
| 13 | Ingest | existing endpoint, evolving payload | queued event | HTTP POST | `X-Gate-Key` to `/api/vehicles/check-vehicle` today; `lpr-mvp-v1` targets `X-Camera-Id` + `X-Camera-Key` to `POST /api/v1/parking-events` |

### `lpr-mvp-v1` configuration and emission contract

This is the normative configuration profile for the MVP architecture. Future edge configuration
must expose every value below as a per-deployment/per-camera override; these defaults are not a
claim that the current YOLOv5 edge implementation already executes the new stages.

| Stage | Default | Contract |
|---|---|---|
| Capture | `frameIntervalMs: 200` | At most 5 frames/s enter the heavy pipeline, retaining the current edge cadence. |
| Motion gate | OpenCV MOG2; `history: 500`, `varThreshold: 16`, `detectShadows: false`, `minForegroundAreaRatio: 0.005`, `minConsecutiveActiveFrames: 2` | CPU gate; a no-motion frame does not run vehicle/plate/OCR inference. |
| Vehicle detector | YOLOv11 `yolo11n`; `imageSize: 640`, `confidenceThreshold: 0.40`, `nmsIouThreshold: 0.50` | Emit only logical classes `car` and `motorbike`; a COCO `motorcycle` result maps to platform `motorbike`. |
| Plate detector | YOLO plate detector; `confidenceThreshold: 0.60` | Runs within the associated vehicle crop; returned boxes are translated back to original-frame pixels. |
| OCR | PaddleOCR mobile profile; `minRecognitionConfidence: 0.80` | PaddleOCR is the only latency-path OCR engine. EasyOCR and VietOCR are disabled-by-default sampled benchmark comparators, never automatic production fallbacks. |
| Tracker | ByteTrack; `highConfidenceThreshold: 0.40`, `lowConfidenceThreshold: 0.10`, `matchThreshold: 0.80`, `trackBufferFrames: 30`, `minTrackHits: 3` | `trackId` is scoped to one `sessionId` and camera stream; it is not a global vehicle identity. |

Every emitted typed event records the profile ID, a non-secret resolved configuration hash, and
model artifact versions. This makes downstream interpretation reproducible without exposing RTSP
URLs, credentials, or edge-host details.

**Emission policy.** The tracker and confirmation layer suppress per-frame floods: emit one
`VehicleDetected` only after a track reaches `minTrackHits`, and emit one `PlateRecognized` once
OCR consensus is stable for that track. A later recognition may supersede a prior low-confidence
result only with a distinct event ID and an explicit causal relationship.

### Day/night promotion gates

A candidate `lpr-mvp-v1` model/configuration may be promoted only after a held-out,
condition-tagged evaluation set. Day means at least 50 lux; night means below 50 lux and includes
IR-assisted captures. Values are minimums, not expected averages.

| Metric | Day minimum | Night minimum |
|---|---:|---:|
| Vehicle detection mAP@0.5 | 0.90 | 0.85 |
| Vehicle detection recall at IoU ≥ 0.5 | 0.95 | 0.90 |
| Normalized plate exact-match accuracy among ground-truth-readable plates | 0.95 | 0.90 |
| Tracker IDF1 | 0.90 | 0.85 |

Camera-specific calibration overrides must produce a new configuration hash and meet the same
condition split before promotion.

## 3. Model Management

Today, model weights ship bundled with the edge deployment (vendored `ultralytics_yolov5_master`
plus trained weight files) with no version registry, no OTA update path, and no rollback — a
model change requires redeploying the edge host. The target introduces a model registry with
signed, versioned bundles, staged (canary) rollout, and automatic rollback on health-check
failure — see **ADR-1003**. Per-site model overrides (e.g. camera-specific fine-tunes) are
expected to integrate with 07_Camera_Management and 09_AI_Calibration.

## 4. GPU/CPU Strategy & Latency Budget

Today's pipeline runs every throttled frame (5 fps effective, from the 200ms interval) through
both YOLOv5 passes with no gating — GPU cost is constant regardless of scene activity. The
target pipeline makes GPU spend proportional to activity: MOG2 motion detection (cheap, CPU)
decides whether the rest of the pipeline runs at all for a given frame.

| Stage | Hardware (target) | Rationale |
|---|---|---|
| Motion Detection (MOG2) | CPU | Cheap background subtraction; must run on every frame to gate GPU stages |
| Vehicle Detection (YOLOv11) | GPU (CPU fallback, degraded) | Real-time detection at multiple objects/frame |
| Plate Detection (YOLOv5) | GPU | Small crop, low marginal cost once GPU is warmed |
| OCR (PaddleOCR primary) | GPU (mobile/CPU model as fallback) | PP-OCR mobile variants are CPU-viable when GPU is unavailable |
| OCR comparators (shadow) | CPU preferred, sampled rate | Avoid doubling GPU load; not on the latency-critical path |
| ByteTrack | CPU | Lightweight association algorithm, no neural inference |
| Slot Mapping (point-in-polygon) | CPU | Geometry test against a small cached polygon set |

Indicative end-to-end latency budget per gated frame (target, GPU-equipped edge box):
motion 5ms → vehicle detection 40ms → plate detection 15ms → OCR 30ms → tracking 5ms → slot
mapping 5ms ≈ **~100ms** compute, well inside the existing 200ms capture interval, leaving
headroom for comparator sampling and multi-vehicle frames.

## 5. Accuracy & Evaluation

The shadow-mode comparators (EasyOCR, VietOCR, legacy YOLOv5-char) exist specifically to build a
labeled evaluation dataset without blocking production traffic on PaddleOCR's accuracy. Target
metrics: character error rate (CER), exact plate-match accuracy, accuracy broken out by
1-line vs 2-line format and by deskew orientation, and per-engine latency. These metrics drive
the promotion/retirement thresholds referenced in ADR-1001.

## 6. Snapshot Capture

The legacy `check-vehicle` path only retains snapshots transiently. The `lpr-mvp-v1` runtime stores
original-frame and plate-crop evidence locally under the configured camera hierarchy. Camera
multipart ingest stores its one optional uploaded snapshot in S3-compatible object storage under a
server-generated tenant/camera/event key; the event ledger stores that opaque key, never image
bytes or a public URL. `lpr-mvp-v1` treats that one part as the plate crop. The event profile also
describes original-frame metadata, but uploading a second binary object and persisting multiple
snapshot references is a later additive API/schema extension. Relocation events will eventually
need evidence at both the old and new slot (see 12_Vehicle_Relocation).

## 7. Diagrams

- `diagrams/pipeline-flowchart.mmd` — end-to-end pipeline from motion detection through event
  emission, with existing stages shaded green and new stages shaded orange.
- `diagrams/per-frame-sequence.mmd` — sequence diagram of one frame's journey through
  motion gate, detection, OCR, tracking, slot mapping, confirmation, and the store-and-forward
  queue.
- `diagrams/model-inference-flowchart.mmd` — model registry, OTA loading, GPU/CPU device
  selection, and the shadow-eval hook that feeds the OCR comparison dataset.

## 8. Decisions / ADRs

- `adr/ADR-1001-ocr-engine-selection.md` — OCR engine choice: PaddleOCR (new primary) vs keep
  YOLOv5-char vs EasyOCR/VietOCR, with a comparison table.
- `adr/ADR-1002-yolov11-vehicle-detection-motion-gating.md` — adding the YOLOv11 vehicle
  detection stage gated by OpenCV MOG2 motion detection.
- `adr/ADR-1003-edge-model-packaging-ota.md` — model registry, signed bundles, and staged OTA
  rollout strategy for on-site edge appliances.

## 9. Open Questions / Risks

- MOG2 tuning is per-camera and lighting-sensitive; a bad ROI/threshold could silently drop real
  detections (false negative) rather than fail loudly.
- Running up to four OCR paths concurrently (PaddleOCR + three comparators) during the
  evaluation window has a real compute cost; sampling strategy is not yet defined.
  PaddleOCR needs a VN-plate fine-tuning dataset before it can be trusted as sole primary.
- Edge hardware heterogeneity (some sites may be CPU-only) means the latency budget in §4 is
  optimistic for non-GPU deployments; needs a CPU-only budget pass.
- The ingest boundary intentionally exposes only typed `VehicleDetected` and `PlateRecognized`
  payloads today. Relocate/exit lifecycle evidence remains local until an additive backend event
  contract is approved.

## 10. Cross-References

- 11_Parking_Slot_Detection — how the `track_id` and reference point produced here become a
  `slot_id`.
- 12_Vehicle_Relocation — how a confirmed slot change on the same identity becomes a
  `VehicleRelocated` event.
- 07_Camera_Management — camera/RTSP registration and lifecycle that this pipeline consumes.
- 09_AI_Calibration — per-camera calibration (motion ROI, homography) referenced by ADR-1002
  and ADR-1003.
