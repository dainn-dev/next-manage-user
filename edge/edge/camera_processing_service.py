"""No-side-effect DAI-290 camera pipeline scaffold and structured dry-run logs."""

from __future__ import annotations

from datetime import datetime, timezone
import json
import logging
from pathlib import Path
from typing import Any
from uuid import uuid4

import numpy as np
from PIL import Image, UnidentifiedImageError

from edge.camera_config import CameraPipelineConfig, ConfigValidationError, validate_dry_run, validate_runtime
from edge.camera_types import (
    FrameMetadata,
    PlateCandidate,
    PlateCandidateArtifacts,
    PlateOcrObservation,
    RetainedFrame,
    VehicleDetection,
)
from edge.motion_gate import MotionDecision, MotionGate, MotionState
from edge.ocr_engine import (
    LocalPaddleOcrEngine,
    OcrEngine,
    OcrEngineError,
    build_ocr_observation,
)
from edge.plate_detector import (
    LocalYoloV5PlateDetector,
    PlateDetector,
    PlateDetectorError,
)
from edge.snapshot_store import LocalSnapshotStore, SnapshotStore, SnapshotStoreError
from edge.vehicle_detector import (
    UltralyticsVehicleDetector,
    VehicleDetector,
    VehicleDetectorError,
)


STAGES = (
    "motion",
    "vehicle_detection",
    "plate_detection",
    "ocr",
    "tracking",
    "snapshot",
    "event",
    "ingest",
)


def configure_json_logging(level: str) -> logging.Logger:
    """Configure a console logger whose messages are already complete JSON records."""
    logger = logging.getLogger("camera_pipeline")
    logger.setLevel(getattr(logging, level.upper(), logging.INFO))
    logger.propagate = False
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter("%(message)s"))
        logger.addHandler(handler)
    return logger


class CameraProcessingService:
    """Scaffold boundary; later DAI stages supply actual inference and ingest adapters."""

    def __init__(self, config: CameraPipelineConfig, logger: logging.Logger | None = None,
                 vehicle_detector: VehicleDetector | None = None,
                 plate_detector: PlateDetector | None = None,
                 snapshot_store: SnapshotStore | None = None,
                 ocr_engine: OcrEngine | None = None):
        self.config = config
        self.logger = logger or configure_json_logging(config.logging.level)
        self.run_id = str(uuid4())
        self.session_id = str(uuid4())
        self._frame_number = 0
        self.motion_gate = MotionGate(config.thresholds.motion)
        self.vehicle_detector = vehicle_detector or UltralyticsVehicleDetector(
            config.models.vehicle_detector, config.thresholds.vehicle)
        self.plate_detector = plate_detector or LocalYoloV5PlateDetector(
            config.models.plate_detector,
            config.thresholds.plate_confidence,
            config.thresholds.plate_padding_ratio,
            config.thresholds.min_plate_width_px,
            config.thresholds.min_plate_height_px,
        )
        self.snapshot_store = snapshot_store or LocalSnapshotStore(
            config.snapshot,
            config.camera.tenant_id,
            config.camera.site_id,
            config.camera.camera_id,
        )
        self.ocr_engine = ocr_engine or LocalPaddleOcrEngine(
            config.models.ocr, config.ocr.languages)

    def validate_runtime(self) -> None:
        self._log("configuration", "started", "validating runtime readiness")
        validate_runtime(self.config)
        issues: list[str] = []
        for adapter in (self.vehicle_detector, self.plate_detector, self.snapshot_store, self.ocr_engine):
            try:
                adapter.ensure_ready()
            except (VehicleDetectorError, PlateDetectorError, SnapshotStoreError, OcrEngineError) as exc:
                issues.append(str(exc))
        if issues:
            raise ConfigValidationError(issues)
        self._log("configuration", "ready", "runtime prerequisites are configured")

    def dry_run(self) -> FrameMetadata:
        """Read one local image and report every future stage as intentionally skipped."""
        self._log("configuration", "started", "loading dry-run profile")
        validate_dry_run(self.config)
        self._log("configuration", "ready", "dry-run profile validated")

        source_path = self.config.camera.source.path
        self._log("source", "started", "reading configured local image", source_path=str(source_path))
        try:
            with Image.open(source_path) as image:
                image.verify()
            with Image.open(source_path) as image:
                width, height = image.size
        except (OSError, UnidentifiedImageError) as exc:
            raise ConfigValidationError([
                f"camera.source.path '{source_path}' is not a readable image: {exc}"
            ]) from exc

        frame = FrameMetadata(
            captured_at=datetime.now(timezone.utc),
            width=width,
            height=height,
        )
        self._log("source", "ready", "local image metadata captured", frame=frame.to_dict())
        for stage in STAGES:
            self._log(stage, "skipped", "not executed by metadata-only dry run; no side effects performed")
        self._log("configuration", "complete", "dry run completed without model, storage, queue, or network activity")
        return frame

    def process_frame(self, pixels: np.ndarray, captured_at: datetime | None = None) -> MotionDecision:
        """Evaluate one injected BGR frame and return the internal downstream handoff."""
        self._frame_number += 1
        retained = RetainedFrame.from_bgr(
            self._frame_number,
            captured_at or datetime.now(timezone.utc),
            pixels,
        )
        decision = self.motion_gate.process(retained)
        self._log(
            "motion",
            "frame_evaluated",
            "motion gate evaluated frame",
            level="DEBUG",
            frame_number=retained.frame_number,
            motion_state=decision.state.value,
            previous_state=decision.previous_state.value,
            consecutive_active_frames=decision.consecutive_active_frames,
            warmup_remaining_frames=decision.warmup_remaining_frames,
            cooldown_remaining_frames=decision.cooldown_remaining_frames,
            **decision.measurement.to_log_dict(),
        )
        if decision.transition is not None:
            details = {
                "previous_state": decision.previous_state.value,
                "frame_number": retained.frame_number,
                "cooldown_frames": self.config.thresholds.motion.cooldown_frames,
                **decision.measurement.to_log_dict(),
            }
            if decision.motion_window is not None:
                details.update(decision.motion_window.to_log_dict())
            self._log(
                "motion",
                decision.transition,
                f"motion gate transitioned to {decision.transition}",
                **details,
            )
        if decision.state == MotionState.ACTIVE:
            vehicles = self._detect_vehicles(retained)
            candidates = self._detect_plates(retained, vehicles)
            artifacts = self._store_snapshots(retained, candidates)
            self._recognize_plates(artifacts)
        return decision

    def _detect_vehicles(self, frame: RetainedFrame) -> list[VehicleDetection]:
        try:
            detections = self.vehicle_detector.detect(frame)
            self._log(
                "vehicle_detection",
                "complete",
                "vehicle detector evaluated motion-active frame",
                **frame.to_log_dict(),
                detections=[detection.to_dict(frame.metadata) for detection in detections],
            )
            return detections
        except Exception as exc:
            self._log(
                "vehicle_detection",
                "failed",
                "vehicle detection failed; frame processing will continue",
                level="ERROR",
                **frame.to_log_dict(),
                error_type=type(exc).__name__,
                error=str(exc),
            )
            return []

    def _detect_plates(self, frame: RetainedFrame,
                       vehicles: list[VehicleDetection]) -> list[PlateCandidate]:
        candidates: list[PlateCandidate] = []
        for vehicle_index, vehicle in enumerate(vehicles):
            try:
                candidates.extend(self.plate_detector.detect(frame, vehicle))
            except Exception as exc:
                self._log(
                    "plate_detection",
                    "failed",
                    "plate detection failed for one vehicle; remaining vehicles will continue",
                    level="ERROR",
                    **frame.to_log_dict(),
                    vehicle_index=vehicle_index,
                    vehicle=vehicle.to_dict(frame.metadata),
                    error_type=type(exc).__name__,
                    error=str(exc),
                )
        self._log(
            "plate_detection",
            "complete",
            "plate detector evaluated eligible vehicle regions",
            **frame.to_log_dict(),
            vehicle_count=len(vehicles),
            candidate_count=len(candidates),
            candidates=[candidate.to_log_dict() for candidate in candidates],
        )
        return candidates

    def _store_snapshots(self, frame: RetainedFrame,
                         candidates: list[PlateCandidate]) -> list[PlateCandidateArtifacts]:
        if not candidates:
            return []
        original_frame = None
        try:
            original_frame = self.snapshot_store.store_original_frame(frame)
        except Exception as exc:
            self._log(
                "snapshot",
                "failed",
                "original-frame snapshot failed; plate crops will continue",
                level="ERROR",
                **frame.to_log_dict(),
                error_type=type(exc).__name__,
                error=str(exc),
            )

        stored: list[PlateCandidateArtifacts] = []
        for candidate in candidates:
            try:
                plate_crop = self.snapshot_store.store_plate_crop(candidate)
                artifacts = PlateCandidateArtifacts(candidate, original_frame, plate_crop)
                stored.append(artifacts)
                self._log(
                    "snapshot",
                    "complete",
                    "plate candidate snapshots stored",
                    **artifacts.to_log_dict(),
                )
            except Exception as exc:
                self._log(
                    "snapshot",
                    "failed",
                    "plate-crop snapshot failed; candidate artifact was not emitted",
                    level="ERROR",
                    **candidate.to_log_dict(),
                    error_type=type(exc).__name__,
                    error=str(exc),
                )
        return stored

    def _recognize_plates(self, artifacts: list[PlateCandidateArtifacts]) -> list[PlateOcrObservation]:
        observations: list[PlateOcrObservation] = []
        for item in artifacts:
            try:
                read = self.ocr_engine.recognize(item.candidate.plate_crop)
                observation = build_ocr_observation(
                    read,
                    item,
                    self.config.thresholds.ocr_confidence,
                    self.config.ocr.low_confidence_policy,
                )
                observations.append(observation)
                self._log(
                    "ocr",
                    "complete",
                    "PaddleOCR evaluated stored plate candidate",
                    **item.candidate.frame.to_log_dict(),
                    **observation.to_log_dict(),
                )
                self._log(
                    "ocr",
                    "debug",
                    "bounded PaddleOCR debug output",
                    level="DEBUG",
                    **item.candidate.frame.to_log_dict(),
                    **observation.to_log_dict(include_debug=True),
                )
            except Exception as exc:
                self._log(
                    "ocr",
                    "failed",
                    "OCR failed for one plate candidate; remaining candidates will continue",
                    level="ERROR",
                    **item.candidate.to_log_dict(),
                    crop_reference=item.plate_crop.storage_reference,
                    error_type=type(exc).__name__,
                    error=str(exc),
                )
        return observations

    def log_motion_summary(self, *, mode: str, frames_processed: int,
                           windows_opened: int, first_qualifying_frame: int | None,
                           activation_frame: int | None) -> None:
        delay = None if first_qualifying_frame is None or activation_frame is None \
            else activation_frame - first_qualifying_frame
        self._log(
            "motion",
            "complete",
            "synthetic motion sequence completed",
            mode=mode,
            frames_processed=frames_processed,
            windows_opened=windows_opened,
            first_qualifying_frame=first_qualifying_frame,
            activation_frame=activation_frame,
            activation_delay_frames=delay,
        )

    def _log(self, stage: str, status: str, message: str, level: str = "INFO", **details: Any) -> None:
        record: dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": level.upper(),
            "service": self.config.logging.service,
            "stage": stage,
            "status": status,
            "run_id": self.run_id,
            "session_id": self.session_id,
            "message": message,
            **self.config.safe_metadata(),
        }
        record.update(details)
        self.logger.log(getattr(logging, level.upper(), logging.INFO),
                        json.dumps(record, sort_keys=True, separators=(",", ":"), default=str))
