# AI Calibration

For a detection to become a correct "vehicle is in slot A01" fact, several per-camera parameters
must be tuned: what part of the frame to even look at (ROI/mask), how sensitive motion detection
should be, how confident a plate read must be before it's trusted, and — critically — the
homography that turns a pixel coordinate into a point that can be tested against a
`ParkingSlot` polygon from `08_Parking_Map_Designer`. Today this tuning is a **static, per-
deployment JSON config file** edited by hand; there is no per-camera scoping, no UI, and no
concept of ROI, motion detection, or homography at all. This document designs the calibration
data, the wizard UI that produces it, and how it flows between the backend (source of truth) and
the edge (runtime consumer).

Status: Draft · Owner: Principal Architect · Last updated: 2026-07-09

## 1. Current state vs Target

### 1.1 Current state (verified from `edge/config.example.json` and `edge/` code)

Today's tunables live in a single static config file per edge deployment, not per camera, not
synced from a backend, and not exposed in any UI:

| Config path | Value in `config.example.json` | Meaning today |
|---|---|---|
| `models.confidence_threshold` | `0.6` | minimum detection confidence accepted from the YOLOv5 models |
| `detection.min_detection_duration` | `1.0` (seconds) | how long a plate string must be stably observed before it's confirmed/sent |
| `detection.cooldown` | `2.0` (seconds) | minimum gap before the same plate is reported again |
| `detection.frame_interval_ms` | `200` | frame processing throttle (5 fps) |
| `detection.cache_duration` | `600` (seconds) | how long a seen-plate entry is cached before eviction |
| `detection.max_cameras` | `10` | a config ceiling in the legacy multi-device desktop app, unrelated to actual per-camera tuning |
| `ocr.fallback_method` / `ocr.easyocr_min_confidence` | `easyocr` / `0.4` | fallback OCR engine + its own confidence floor, only used if the primary YOLOv5 char model fails |
| `rtsp_optimization.*` | buffer/frame-skip/resolution knobs | stream-level, not detection-level, tuning |

What is explicitly **absent** today (do not imply otherwise):
- **No motion detection** (no MOG2/OpenCV background subtraction) — every frame within the
  throttle interval goes straight to the YOLO models.
- **No ROI/mask setup** — the whole frame is processed.
- **No homography/perspective calibration** — there is no parking-slot logic at all, so there is
  nothing to project a point onto.
- **No day/night or weather profiles** — one static config regardless of conditions.
- **No calibration wizard UI** — the frontend has no camera/video/calibration screen at all.
- **No per-camera scoping** — `config.example.json` is one file for the whole edge deployment
  (historically, one gate); it is not associated with a `Camera` row in any backend database,
  because no such row exists today.

### 1.2 Target (from the vision, §2/§3.8/§4 of the shared brief)

- Per-camera calibration covering: ROI/exclusion mask, motion-detection (MOG2) sensitivity,
  plate-read confidence thresholds, per-camera OCR engine/params, homography for point-in-polygon
  accuracy, and day/night/weather profile variants.
- A **calibration wizard** in the frontend that walks an operator through each of these steps
  against a live or captured preview.
- `Camera.calibration_json` (defined in `07_Camera_Management`) as the **backend source of
  truth**, versioned, synced down to the edge appliance — extending, not replacing, today's
  local-JSON-config pattern (the edge keeps a local cache for offline resilience, consistent with
  the existing SQLite store-and-forward design).

## 2. Calibration parameters

| Group | Parameter | Today's equivalent | Notes |
|---|---|---|---|
| ROI | `roi.mask_polygon` | none | pixel polygon(s) excluding irrelevant frame regions (sky, street traffic outside the lot) from both motion and detection |
| Motion | `motion.mog2_var_threshold`, `motion.min_contour_area` | none (no motion detection today) | gates YOLOv11 vehicle detection to save GPU — only run inference when motion inside the ROI exceeds these thresholds |
| Detection | `detection.confidence_threshold` | `models.confidence_threshold` (0.6, global) | becomes per-camera; same meaning, new scope |
| Detection | `detection.min_detection_duration` | `detection.min_detection_duration` (1.0s, global) | unchanged meaning, becomes per-camera |
| Detection | `detection.cooldown` | `detection.cooldown` (2.0s, global) | unchanged meaning, becomes per-camera |
| Detection | `detection.frame_interval_ms` | `detection.frame_interval_ms` (200ms, global) | unchanged meaning, becomes per-camera (a busy overview camera vs a narrow gate camera may want different throttles) |
| OCR | `ocr.engine`, `ocr.min_confidence` | `ocr.fallback_method`/`ocr.easyocr_min_confidence` (fallback-only today) | target makes engine choice (PaddleOCR primary, EasyOCR/VietOCR comparators — brief §3.8) and its confidence floor an explicit per-camera setting, not just a fallback path |
| Homography | `homography.image_points`, `homography.world_points`, `homography.matrix` | none | reference-point pairs and the derived 3×3 transform matrix; produced in `08_Parking_Map_Designer`'s calibration mode (§8 of that doc) |
| Profiles | `profiles.day` / `profiles.night` / `profiles.rain` (each overrides a subset of the above) | none | switched by time-of-day/weather signal, or manually |

## 3. `calibration_json` shape (proposal)

```
{
  "version": 3,
  "roi": { "mask_polygon": [[x,y], ...] },
  "motion": { "mog2_var_threshold": 16, "min_contour_area": 500 },
  "detection": {
    "confidence_threshold": 0.6,
    "min_detection_duration": 1.0,
    "cooldown": 2.0,
    "frame_interval_ms": 200
  },
  "ocr": { "engine": "paddleocr", "min_confidence": 0.5 },
  "homography": {
    "image_points": [[x1,y1], [x2,y2], [x3,y3], [x4,y4]],
    "world_points": [[X1,Y1], [X2,Y2], [X3,Y3], [X4,Y4]],
    "matrix": [[..], [..], [..]]
  },
  "profiles": {
    "night": { "motion": { "mog2_var_threshold": 24 }, "detection": { "confidence_threshold": 0.5 } }
  }
}
```

Field names for `detection.*` are kept identical to today's `config.example.json` keys
deliberately, so the edge's existing config-parsing code can be extended rather than replaced.
`homography.image_points`/`world_points` are the raw reference pairs captured in
`08_Parking_Map_Designer`; `matrix` is the derived transform, recomputed server-side so the edge
never has to run the homography solve itself.

## 4. Calibration wizard

A step-by-step frontend flow (new — no calibration UI exists today), operating on a captured
still from the target camera (reusing the same snapshot capability as `08_Parking_Map_Designer`):

1. Select Site + Camera.
2. Capture a reference still frame.
3. Draw ROI / exclusion mask.
4. Tune motion sensitivity (`mog2_var_threshold`, `min_contour_area`) against a short live/replayed
   preview clip, if available, or a static heuristic default otherwise.
5. Set detection thresholds (`confidence_threshold`, `min_detection_duration`, `cooldown`,
   `frame_interval_ms`) — pre-filled with today's config defaults (0.6 / 1.0s / 2.0s / 200ms) as
   starting points.
6. Choose OCR engine + `min_confidence` for this camera.
7. Enter homography reference points — this step is shared UI with `08_Parking_Map_Designer`'s
   calibration mode; the wizard can deep-link into it or embed the same canvas component.
8. Capture day/night/weather profile variants (repeat steps 4–6 under a labeled profile, e.g. by
   re-running against a night-time sample frame).
9. Run a test pass against sample frames and review detection/OCR results before committing.
10. Publish — persists `Camera.calibration_json` and bumps its version.

See `diagrams/calibration-workflow.mmd`.

## 5. Homography & point-in-polygon accuracy

The point of calibrating homography is downstream accuracy of slot assignment:

1. AI pipeline detects a vehicle bounding box in image-pixel space.
2. The box's base-center point (where the vehicle meets the ground, more stable than the box
   centroid for perspective distortion) is computed.
3. The camera's `homography.matrix` (from `calibration_json`) transforms that pixel point into
   site-local planar coordinates — the same coordinate space `ParkingSlot.polygon` is stored in
   (per `08_Parking_Map_Designer` ADR-0801).
4. A PostGIS `ST_Contains` point-in-polygon test against the site's published slot polygons
   determines which slot, if any, the vehicle occupies.
5. A match emits `VehicleEntered`/`VehicleRelocated`; no match leaves the detection unassigned
   (logged, not discarded — useful for spotting a mis-calibrated camera).

Calibration quality directly bounds slot-assignment accuracy: a coarse or stale homography (e.g.
after a camera is physically bumped) produces systematically wrong slot matches even when
detection/OCR themselves are perfect. See `diagrams/homography-point-in-polygon.mmd`.

## 6. Data flow: edge ↔ backend

`Camera.calibration_json` lives on the backend (owned by `07_Camera_Management`'s `Camera`
entity) and is the source of truth. The edge does not compute or persist calibration changes
itself; it only consumes:

1. Operator publishes calibration from the wizard → `PUT /api/v1/cameras/{id}/calibration` →
   backend stores `calibration_json` and increments `calibration_version`.
2. On its existing heartbeat call (extended, not replaced — same endpoint pattern as today's
   `POST /api/gates/{id}/heartbeat`), the edge reports the `calibration_version` it is currently
   running.
3. If the backend's version is newer, it tells the edge to fetch
   `GET /api/v1/cameras/{id}/calibration`, applies the new `calibration_json` to the running
   pipeline (reload ROI mask, motion params, thresholds, homography matrix) without a restart,
   and caches it to local disk.
4. The local disk cache is what keeps detection running with the last-known-good calibration if
   connectivity drops — the same offline-first principle behind today's SQLite store-and-forward
   queue (brief §1: "keep & extend this").

See `diagrams/calibration-data-flow.mmd`.

## 7. Day/night & weather profiles

A `calibration_json.profiles` map holds partial overrides keyed by condition (`night`, `rain`,
…), applied on top of the base calibration. Profile selection can be manual (operator-set
schedule) or automatic (site local time, or a light-level heuristic computed from the frame
itself) — this doc specifies the data shape and does not mandate which selection strategy ships
first; start with manual/time-of-day, since it needs no new sensing capability.

## 8. Diagrams

- `diagrams/calibration-workflow.mmd` — flowchart of the calibration wizard steps in §4.
- `diagrams/homography-point-in-polygon.mmd` — flowchart of the pixel → homography → world point →
  point-in-polygon slot-assignment concept in §5.
- `diagrams/calibration-data-flow.mmd` — sequence diagram of the publish → heartbeat-driven sync →
  local-cache flow in §6.

## 9. Decisions / ADRs

- [ADR-0901](adr/ADR-0901-calibration-source-of-truth.md) — Where calibration lives (edge config
  vs central backend, synced) and how it's versioned.

## 10. Open questions / risks

- No sample "replay clip" mechanism exists today to let an operator test motion/detection
  sensitivity live during the wizard without standing in front of the camera — needs design.
- Automatic day/night profile switching (vs manual) is deferred; picking the wrong default could
  degrade accuracy at dawn/dusk transitions.
- Homography accuracy degrades if a camera is physically moved after calibration; no drift-
  detection mechanism is designed yet (candidate: periodic recheck using known static reference
  points, or an admin alert on camera re-mount).
- `detection.frame_interval_ms`/`cooldown`/`min_detection_duration` today are tuned empirically per
  deployment by the team maintaining `config.example.json`; the wizard's "pre-filled defaults"
  step (§4.5) should capture that institutional knowledge as the initial per-camera default
  rather than a generic guess.

## 11. Cross-references

- `07_Camera_Management` — owns the `Camera.calibration_json` column this doc defines the
  contents and sync mechanism for.
- `08_Parking_Map_Designer` — produces the homography reference points and the `ParkingSlot`
  polygons this doc's point-in-polygon test relies on.
- `15_Database_Design` — schema/versioning details for storing calibration history if an audit
  trail beyond "current + previous version" is required.
