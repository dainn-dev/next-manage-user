"""Camera LPR pipeline orchestration, lifecycle events, and ingest delivery."""

from __future__ import annotations

from datetime import datetime, timezone
import json
import logging
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4

import numpy as np
from PIL import Image, UnidentifiedImageError

from edge.camera_ingest_client import (
    CameraIngestClient,
    CameraIngestError,
    CameraIngestTransport,
)
from edge.camera_config import CameraPipelineConfig, ConfigValidationError, validate_dry_run, validate_runtime
from edge.camera_types import (
    FrameMetadata,
    ModelProvenance,
    OutboundEvent,
    PlateCandidate,
    PlateCandidateArtifacts,
    PlateOcrObservation,
    RetainedFrame,
    StoredSnapshot,
    TrackIdentity,
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
from edge.vehicle_tracker import (
    TrackLifecycleEvent,
    TrackStateManager,
    TrackedVehicle,
    UltralyticsByteTracker,
    VehicleTracker,
    VehicleTrackerError,
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
    """Coordinate frame processing through tracking, OCR, events, and ingest."""

    def __init__(self, config: CameraPipelineConfig, logger: logging.Logger | None = None,
                 vehicle_detector: VehicleDetector | None = None,
                 plate_detector: PlateDetector | None = None,
                 snapshot_store: SnapshotStore | None = None,
                 ocr_engine: OcrEngine | None = None,
                 vehicle_tracker: VehicleTracker | None = None,
                 track_state_manager: TrackStateManager | None = None,
                 ingest_client: CameraIngestTransport | None = None):
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
        frame_rate = max(1, round(1000 / config.pipeline.frame_interval_ms))
        self.vehicle_tracker = vehicle_tracker or UltralyticsByteTracker(
            config.thresholds.tracker, frame_rate=frame_rate)
        self.track_state_manager = track_state_manager or TrackStateManager(
            config.thresholds.tracker.buffer_frames)
        self.ingest_client = ingest_client or CameraIngestClient(
            config.ingest, config.camera.camera_id)
        self._vehicle_event_ids: dict[str, UUID] = {}
        self._last_track_frames: dict[str, RetainedFrame] = {}
        self._latest_track_artifacts: dict[str, PlateCandidateArtifacts] = {}

    def validate_runtime(self) -> None:
        self._log("configuration", "started", "validating runtime readiness")
        validate_runtime(self.config)
        issues: list[str] = []
        for adapter in (self.vehicle_detector, self.plate_detector, self.snapshot_store,
                        self.ocr_engine, self.vehicle_tracker, self.ingest_client):
            try:
                adapter.ensure_ready()
            except (VehicleDetectorError, PlateDetectorError, SnapshotStoreError, OcrEngineError,
                    VehicleTrackerError, CameraIngestError) as exc:
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
        self.flush_ingest_queue()
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
        vehicles = self._detect_vehicles(retained) if decision.state == MotionState.ACTIVE else []
        tracks = self._track_vehicles(retained, vehicles)
        observations = []
        artifacts_by_candidate: dict[UUID, PlateCandidateArtifacts] = {}
        if decision.state == MotionState.ACTIVE:
            candidates = self._detect_plates(retained, vehicles)
            artifacts = self._store_snapshots(retained, candidates)
            artifacts_by_candidate = {
                item.candidate.candidate_id: item for item in artifacts}
            recognized = self._recognize_plates(artifacts)
            by_candidate = {item.candidate.candidate_id: item.candidate for item in artifacts}
            observations = [(by_candidate[item.candidate_id], item) for item in recognized
                            if item.candidate_id in by_candidate]
        lifecycle_events = self.track_state_manager.update(
            retained.frame_number, retained.metadata.captured_at, tracks, observations)
        for track in tracks:
            self._last_track_frames[track.track_id] = retained
            artifact = next((
                item for item in artifacts_by_candidate.values()
                if item.candidate.vehicle == track.detection), None)
            if artifact is not None:
                self._latest_track_artifacts[track.track_id] = artifact
        for event in lifecycle_events:
            self._log("event", "emitted", "track lifecycle event emitted", **event.to_log_dict())
            lifecycle_snapshots = self._store_lifecycle_snapshots(event, retained)
            self._emit_ingest_event(
                event, retained, tracks, observations, artifacts_by_candidate,
                lifecycle_snapshots)
            if event.event_type.value == "exit":
                self._last_track_frames.pop(event.track_id, None)
                self._latest_track_artifacts.pop(event.track_id, None)
        return decision

    def _emit_ingest_event(self, lifecycle_event: TrackLifecycleEvent, frame: RetainedFrame,
                           tracks: list[TrackedVehicle],
                           observations: list[tuple[PlateCandidate, PlateOcrObservation]],
                           artifacts: dict[UUID, PlateCandidateArtifacts],
                           lifecycle_snapshots: list[StoredSnapshot] | None = None) -> None:
        lifecycle_snapshots = lifecycle_snapshots or []
        track = next(
            (item for item in tracks if item.track_id == lifecycle_event.track_id), None)
        if lifecycle_event.event_type.value == "exit":
            self._vehicle_event_ids.pop(lifecycle_event.track_id, None)
            return
        if lifecycle_event.event_type.value == "relocate" or track is None:
            return

        identity = TrackIdentity(UUID(self.session_id), track.track_id)
        vehicle_model = ModelProvenance(
            self.config.models.vehicle_detector.name,
            self.config.models.vehicle_detector.artifact_version,
            confidence_threshold=self.config.thresholds.vehicle.confidence,
        )
        if lifecycle_event.event_type.value == "enter":
            outbound = OutboundEvent.vehicle_detected(
                camera_id=UUID(self.config.camera.camera_id),
                occurred_at=frame.metadata.captured_at,
                pipeline_id=self.config.pipeline.profile_id,
                configuration_hash=self.config.configuration_hash,
                frame=frame.metadata,
                track=identity,
                vehicle=track.detection,
                vehicle_model=vehicle_model,
                snapshots=[item.descriptor for item in lifecycle_snapshots],
            )
            self._vehicle_event_ids[track.track_id] = outbound.event_id
            original = next((
                item for item in lifecycle_snapshots
                if item.descriptor.kind == "original_frame"), None)
            snapshot_path = None if original is None else (
                self.config.snapshot.output_dir / original.storage_reference)
            self._send_ingest(outbound, snapshot_path)
            return

        if lifecycle_event.event_type.value != "plate-recognize":
            return
        match = next((
            (candidate, observation)
            for candidate, observation in observations
            if candidate.vehicle == track.detection
            and observation.accepted_for_downstream
            and observation.normalized_text == lifecycle_event.plate
        ), None)
        causation_event_id = self._vehicle_event_ids.get(track.track_id)
        if match is None or causation_event_id is None:
            self._log(
                "ingest", "skipped",
                "plate event lacks a confirmed candidate or causation event",
                level="ERROR", track_id=track.track_id, plate=lifecycle_event.plate,
                candidate_found=match is not None,
                causation_event_found=causation_event_id is not None,
            )
            return

        candidate, observation = match
        artifact = artifacts.get(candidate.candidate_id)
        snapshot_descriptors = []
        snapshot_path = None
        if artifact is not None:
            if artifact.original_frame is not None:
                snapshot_descriptors.append(artifact.original_frame.descriptor)
            snapshot_descriptors.append(artifact.plate_crop.descriptor)
            snapshot_path = (
                self.config.snapshot.output_dir / artifact.plate_crop.storage_reference)
        outbound = OutboundEvent.plate_recognized(
            camera_id=UUID(self.config.camera.camera_id),
            occurred_at=frame.metadata.captured_at,
            causation_event_id=causation_event_id,
            pipeline_id=self.config.pipeline.profile_id,
            configuration_hash=self.config.configuration_hash,
            frame=frame.metadata,
            track=identity,
            vehicle=track.detection,
            plate=candidate.plate,
            ocr=observation.to_ocr_result(),
            vehicle_model=vehicle_model,
            plate_model=ModelProvenance(
                self.config.models.plate_detector.name,
                self.config.models.plate_detector.artifact_version,
                confidence_threshold=self.config.thresholds.plate_confidence,
            ),
            ocr_model=ModelProvenance(
                self.config.models.ocr.name,
                self.config.models.ocr.artifact_version,
                recognition_confidence_threshold=self.config.thresholds.ocr_confidence,
            ),
            snapshots=snapshot_descriptors,
        )
        self._send_ingest(outbound, snapshot_path)

    def _store_lifecycle_snapshots(self, event: TrackLifecycleEvent,
                                   current_frame: RetainedFrame) -> list[StoredSnapshot]:
        frame = (self._last_track_frames.get(event.track_id)
                 if event.event_type.value == "exit" else current_frame)
        if frame is None:
            self._log("snapshot", "failed", "lifecycle frame evidence is unavailable",
                      level="ERROR", **event.to_log_dict())
            return []
        artifact = self._latest_track_artifacts.get(event.track_id)
        snapshots: list[StoredSnapshot] = []
        if artifact is not None and artifact.candidate.frame.frame_number == frame.frame_number:
            if artifact.original_frame is not None:
                snapshots.append(artifact.original_frame)
            else:
                try:
                    snapshots.append(self.snapshot_store.store_original_frame(frame))
                except Exception as exc:
                    self._log(
                        "snapshot", "failed", "lifecycle original-frame snapshot failed",
                        level="ERROR", **event.to_log_dict(),
                        error_type=type(exc).__name__, error=str(exc))
            snapshots.append(artifact.plate_crop)
        else:
            try:
                snapshots.append(self.snapshot_store.store_original_frame(frame))
            except Exception as exc:
                self._log(
                    "snapshot", "failed", "lifecycle original-frame snapshot failed",
                    level="ERROR", **event.to_log_dict(),
                    error_type=type(exc).__name__, error=str(exc))
            if artifact is not None:
                snapshots.append(artifact.plate_crop)
        self._log(
            "snapshot", "complete", "lifecycle snapshot evidence linked",
            **event.to_log_dict(),
            snapshots=[item.to_dict() for item in snapshots],
            artifacts_complete={item.descriptor.kind for item in snapshots}
            >= {"original_frame", "plate_crop"},
        )
        return snapshots

    def flush_ingest_queue(self) -> None:
        flush = getattr(self.ingest_client, "flush_pending", None)
        if not callable(flush):
            return
        try:
            stats = flush()
        except Exception as exc:
            self._log("ingest", "failed", "durable ingest queue flush failed",
                      level="ERROR", error_type=type(exc).__name__, error=str(exc))
            return
        if stats.get("attempted", 0):
            self._log("ingest", "queue_flush", "durable ingest queue processed",
                      **stats)

    def close(self) -> None:
        close = getattr(self.ingest_client, "close", None)
        if callable(close):
            close()

    def _send_ingest(self, event: OutboundEvent,
                     snapshot_path: Path | None = None) -> None:
        envelope = event.to_ingest_envelope()
        try:
            result = self.ingest_client.send(event, snapshot_path)
        except Exception as exc:
            self._log(
                "ingest", "failed", "unexpected ingest transport failure",
                level="ERROR", event=envelope,
                snapshot_path=str(snapshot_path) if snapshot_path else None,
                retryable=True, attempts=0, status_code=None,
                error_type=type(exc).__name__, error=str(exc))
            return
        if result.dry_run:
            self._log(
                "ingest", "dry_run", "ingest payload validated without sending",
                event=envelope, snapshot_path=str(snapshot_path) if snapshot_path else None)
        elif result.delivered:
            self._log(
                "ingest", "delivered", "ingest API accepted event",
                event_id=str(event.event_id), event_type=event.event_type,
                attempts=result.attempts, status_code=result.status_code)
        else:
            self._log(
                "ingest", "failed", "ingest API did not accept event",
                level="ERROR", event=envelope,
                snapshot_path=str(snapshot_path) if snapshot_path else None,
                retryable=result.retryable, attempts=result.attempts,
                status_code=result.status_code, error=result.error)

    def _track_vehicles(self, frame: RetainedFrame,
                        vehicles: list[VehicleDetection]) -> list[TrackedVehicle]:
        try:
            tracks = self.vehicle_tracker.update(vehicles)
            self._log(
                "tracking", "complete", "ByteTrack evaluated vehicle detections",
                **frame.to_log_dict(),
                input_count=len(vehicles),
                tracks=[{"trackId": track.track_id,
                         "vehicle": track.detection.to_dict(frame.metadata)} for track in tracks],
            )
            return tracks
        except Exception as exc:
            self._log(
                "tracking", "failed", "vehicle tracking failed; frame processing will continue",
                level="ERROR", **frame.to_log_dict(), error_type=type(exc).__name__, error=str(exc),
            )
            return []

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
