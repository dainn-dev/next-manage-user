"""Headless license-plate detection core.

Reuses the exact YOLOv5 + OCR pipeline and anti-false-positive machinery from
``license_plate_monitor.WebcamThread`` (model loading, deskew retry, OCR
fallback, min-detection-duration and cooldown) but exposes it as a plain,
UI-free class. ``process_frame`` returns the plates that are *confirmed* on this
frame (seen continuously for the configured minimum duration and past their
cooldown) so the caller can forward them to the backend.
"""

import os
import sys
import time

import torch

# Ensure the bundled YOLOv5 sources are importable (matches the desktop app).
_YOLOV5_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)),
                            "model", "ultralytics_yolov5_master")
if os.path.exists(_YOLOV5_PATH) and _YOLOV5_PATH not in sys.path:
    sys.path.insert(0, _YOLOV5_PATH)

import function.helper as helper          # noqa: E402  (path set above)
import function.utils_rotate as utils_rotate  # noqa: E402
from config_manager import config_manager  # noqa: E402


class DetectionCore:
    """Loads the models once and confirms plates across successive frames."""

    def __init__(self, config=config_manager):
        self.config = config
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.min_detection_duration = config.get_min_detection_duration()

        # Per-plate tracking state (identical semantics to the desktop thread).
        self.plate_detection_start = {}   # plate -> first-seen timestamp
        self.last_detection_time = {}     # plate -> last time we forwarded it

        self.yolo_lp_detect = None
        self.yolo_license_plate = None
        self.load_models()

    # -------------------------------------------------------------- models
    def load_models(self):
        detector_path, ocr_path = self.config.get_model_paths()
        confidence = self.config.get_confidence_threshold()
        print(f"Loading models on {self.device}: {detector_path}, {ocr_path}")

        try:
            import torch.serialization
            torch.serialization.add_safe_globals(["models.yolo.Model"])
        except Exception as exc:  # pragma: no cover - best effort
            print(f"Warning: could not add safe globals: {exc}")

        try:
            self.yolo_lp_detect = torch.hub.load(
                _YOLOV5_PATH, "custom", path=detector_path, force_reload=False, source="local")
            self.yolo_license_plate = torch.hub.load(
                _YOLOV5_PATH, "custom", path=ocr_path, force_reload=False, source="local")
        except Exception as local_error:
            print(f"Local YOLOv5 load failed ({local_error}); trying ultralytics/yolov5 ...")
            self.yolo_lp_detect = torch.hub.load(
                "ultralytics/yolov5", "custom", path=detector_path, force_reload=False, trust_repo=True)
            self.yolo_license_plate = torch.hub.load(
                "ultralytics/yolov5", "custom", path=ocr_path, force_reload=False, trust_repo=True)

        self.yolo_license_plate.conf = confidence
        self.yolo_lp_detect.to(self.device).eval()
        self.yolo_license_plate.to(self.device).eval()
        print("Models loaded successfully")

    @property
    def models_ready(self):
        return self.yolo_lp_detect is not None and self.yolo_license_plate is not None

    # ----------------------------------------------------------- inference
    def _read_plates(self, frame):
        """Run detection + OCR and return the set of raw plate strings on this frame."""
        plates = set()

        with torch.no_grad():
            result = self.yolo_lp_detect(frame, size=640)
        boxes = result.pandas().xyxy[0].values.tolist()

        if not boxes:
            lp = helper.read_plate(self.yolo_license_plate, frame)
            if lp != "unknown":
                plates.add(lp)
        else:
            for box in boxes:
                x1, y1 = max(int(box[0]), 0), max(int(box[1]), 0)
                x2, y2 = max(int(box[2]), x1 + 1), max(int(box[3]), y1 + 1)
                crop = frame[y1:y2, x1:x2]
                if crop.size == 0:
                    continue
                lp = helper.read_plate(self.yolo_license_plate, crop)
                if lp == "unknown":
                    # Retry with the four deskew orientations before giving up.
                    for cc in range(2):
                        for ct in range(2):
                            lp = helper.read_plate(
                                self.yolo_license_plate, utils_rotate.deskew(crop, cc, ct))
                            if lp != "unknown":
                                break
                        if lp != "unknown":
                            break
                if lp != "unknown":
                    plates.add(lp)

        # Whole-frame OCR fallback (tesseract / easyocr / google vision).
        if not plates and self.config.get_ocr_fallback_enabled():
            fallback_lp, method, _bbox, _poly = helper.read_plate_with_fallback(frame)
            if fallback_lp != "unknown":
                print(f"{method or 'FALLBACK'} OCR detected plate: {fallback_lp}")
                plates.add(fallback_lp)

        return plates

    def process_frame(self, frame):
        """Detect plates in ``frame`` and return the list confirmed on this frame.

        A plate is confirmed once it has been seen continuously for at least
        ``min_detection_duration`` seconds and is past its per-plate cooldown.
        Tracking for plates that disappear is cleared so re-entry starts fresh.
        """
        if not self.models_ready:
            return []

        current = self._read_plates(frame)
        now = time.time()
        cooldown = self.config.get_detection_cooldown()
        confirmed = []

        for lp in current:
            self.plate_detection_start.setdefault(lp, now)
            duration = now - self.plate_detection_start[lp]
            if duration < self.min_detection_duration:
                continue
            last = self.last_detection_time.get(lp)
            if last is not None and (now - last) <= cooldown:
                continue
            self.last_detection_time[lp] = now
            confirmed.append(lp)

        # Forget plates that left the frame so their duration timer resets.
        for lp in [p for p in self.plate_detection_start if p not in current]:
            del self.plate_detection_start[lp]

        return confirmed
