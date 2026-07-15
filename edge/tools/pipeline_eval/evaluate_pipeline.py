#!/usr/bin/env python3
"""Full LPR pipeline evaluation harness for DAI-296."""

from __future__ import annotations

import argparse
from collections import Counter
from dataclasses import replace
from datetime import datetime, timedelta, timezone
import json
import logging
from pathlib import Path
import statistics
import sys
import time
from typing import Iterable
from uuid import uuid4

import cv2
import numpy as np

EDGE_ROOT = Path(__file__).resolve().parents[2]
if str(EDGE_ROOT) not in sys.path:
    sys.path.insert(0, str(EDGE_ROOT))

from edge.camera_config import load_camera_pipeline_config
from edge.camera_processing_service import CameraProcessingService
from edge.camera_types import (
    BoundingBox,
    PlateCandidate,
    PlateDetection,
    RetainedFrame,
    SnapshotDescriptor,
    StoredSnapshot,
    VehicleDetection,
)
from edge.motion_gate import ForegroundMeasurement, MotionDecision, MotionState
from edge.ocr_engine import OcrEngineRead, normalize_vietnamese_plate
from edge.vehicle_tracker import TrackedVehicle


READ_RATE_TARGETS = {
    "day": 0.95, "night": 0.90, "rain": 0.85, "glare": 0.85,
    "angle": 0.85, "motorcycle": 0.85, "difficult_vietnamese_plate": 0.80,
}


class EvaluationError(RuntimeError):
    """The evaluation manifest or one feed cannot be evaluated."""


class _JsonCapture(logging.Handler):
    def __init__(self):
        super().__init__()
        self.records: list[dict[str, object]] = []

    def emit(self, record: logging.LogRecord) -> None:
        try:
            value = json.loads(record.getMessage())
        except (TypeError, json.JSONDecodeError):
            return
        if isinstance(value, dict):
            self.records.append(value)


class _ActiveMotionGate:
    def process(self, frame: RetainedFrame) -> MotionDecision:
        total = frame.metadata.width * frame.metadata.height
        measurement = ForegroundMeasurement(total, total, 1)
        return MotionDecision(
            frame, measurement, MotionState.ACTIVE, MotionState.ACTIVE,
            1, 0, 0)


class _FixtureVehicleDetector:
    def ensure_ready(self) -> None:
        return None

    def detect(self, frame: RetainedFrame) -> list[VehicleDetection]:
        width, height = frame.metadata.width, frame.metadata.height
        return [VehicleDetection(
            "car", 0.94,
            BoundingBox(1, 1, max(2, width - 2), max(2, height - 2)))]


class _FixturePlateDetector:
    def ensure_ready(self) -> None:
        return None

    def detect(self, frame: RetainedFrame,
               vehicle: VehicleDetection) -> list[PlateCandidate]:
        width, height = frame.metadata.width, frame.metadata.height
        box = BoundingBox(max(1, width // 4), max(1, height // 2),
                          max(2, width // 2), max(1, height // 4))
        crop = np.array(frame.pixels[
            box.y:box.y + box.height, box.x:box.x + box.width], copy=True)
        return [PlateCandidate(uuid4(), frame, vehicle,
                               PlateDetection(0.92, box), crop)]


class _FixtureSnapshotStore:
    def ensure_ready(self) -> None:
        return None

    def store_original_frame(self, frame: RetainedFrame) -> StoredSnapshot:
        return StoredSnapshot(
            SnapshotDescriptor(
                "original_frame", "image/jpeg", frame.metadata.width,
                frame.metadata.height, "sha256:12345678", frame.metadata.captured_at),
            f"fixture/frame-{frame.frame_number}/original.jpg")

    def store_plate_crop(self, candidate: PlateCandidate) -> StoredSnapshot:
        return StoredSnapshot(
            SnapshotDescriptor(
                "plate_crop", "image/jpeg", candidate.plate_crop.shape[1],
                candidate.plate_crop.shape[0], "sha256:87654321",
                candidate.frame.metadata.captured_at, candidate.plate.bounding_box),
            f"fixture/frame-{candidate.frame.frame_number}/plate.jpg")


class _FixtureOcr:
    def __init__(self, plate: str, confidence: float):
        self.plate = plate
        self.confidence = confidence

    def ensure_ready(self) -> None:
        return None

    def recognize(self, _pixels: np.ndarray) -> OcrEngineRead:
        return OcrEngineRead(
            "PaddleOCR", self.plate, normalize_vietnamese_plate(self.plate),
            self.confidence, {"fixture": True})


class _FixtureTracker:
    def __init__(self, track_id: str):
        self.track_id = track_id

    def ensure_ready(self) -> None:
        return None

    def update(self, detections: list[VehicleDetection]) -> list[TrackedVehicle]:
        return [TrackedVehicle(self.track_id, item) for item in detections]


def _load_manifest(path: Path) -> dict[str, object]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise EvaluationError(f"unable to read evaluation manifest '{path}': {exc}") from exc
    if not isinstance(value, dict) or value.get("mode") not in {"fixture", "models"}:
        raise EvaluationError("manifest mode must be 'fixture' or 'models'")
    feeds = value.get("feeds")
    if not isinstance(feeds, list) or not feeds:
        raise EvaluationError("manifest requires at least one feed")
    for index, feed in enumerate(feeds):
        if not isinstance(feed, dict):
            raise EvaluationError(f"feeds[{index}] must be an object")
        for key in ("id", "condition", "source", "expected_plates"):
            if key not in feed:
                raise EvaluationError(f"feeds[{index}].{key} is required")
        if not isinstance(feed["condition"], str) or not feed["condition"].strip():
            raise EvaluationError(f"feeds[{index}].condition must be a non-empty string")
        if not isinstance(feed["expected_plates"], list):
            raise EvaluationError(f"feeds[{index}].expected_plates must be an array")
    required = value.get("required_conditions", ["day", "night"])
    if not isinstance(required, list) or not required or not all(isinstance(item, str) for item in required):
        raise EvaluationError("required_conditions must be a non-empty string array")
    conditions = {str(feed.get("condition")) for feed in feeds if isinstance(feed, dict)}
    missing = set(required) - conditions
    if missing:
        raise EvaluationError(f"evaluation manifest is missing required conditions: {', '.join(sorted(missing))}")
    if value["mode"] == "models" and not value.get("dataset_version"):
        raise EvaluationError("models mode requires dataset_version")
    return value


def _frames(source: Path, max_frames: int) -> Iterable[np.ndarray]:
    image = cv2.imread(str(source))
    if image is not None:
        for _ in range(max_frames):
            yield np.array(image, copy=True)
        return
    capture = cv2.VideoCapture(str(source))
    if not capture.isOpened():
        raise EvaluationError(f"feed source '{source}' is not a readable image or video")
    try:
        for _ in range(max_frames):
            ok, frame = capture.read()
            if not ok:
                break
            yield frame
    finally:
        capture.release()


def _service(config, mode: str, feed: dict[str, object], logger: logging.Logger):
    config = replace(config, ingest=replace(config.ingest, dry_run=True))
    if mode == "models":
        return CameraProcessingService(config, logger)
    plate = str(feed.get("fixture_plate") or next(iter(feed["expected_plates"]), "51A12345"))
    confidence = float(feed.get("fixture_confidence", 0.95))
    service = CameraProcessingService(
        config, logger,
        vehicle_detector=_FixtureVehicleDetector(),
        plate_detector=_FixturePlateDetector(),
        snapshot_store=_FixtureSnapshotStore(),
        ocr_engine=_FixtureOcr(plate, confidence),
        vehicle_tracker=_FixtureTracker(f"fixture-{feed['id']}"),
    )
    service.motion_gate = _ActiveMotionGate()
    return service


def _percentile(values: list[float], fraction: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    index = max(0, min(len(ordered) - 1, int(np.ceil(len(ordered) * fraction)) - 1))
    return ordered[index]


def _distribution(values: list[float]) -> dict[str, object]:
    return {
        "count": len(values),
        "min": min(values) if values else None,
        "mean": statistics.fmean(values) if values else None,
        "p50": _percentile(values, 0.50),
        "p95": _percentile(values, 0.95),
        "max": max(values) if values else None,
    }


def _feed_metrics(feed: dict[str, object], records: list[dict[str, object]],
                  latencies: list[float], elapsed: float) -> dict[str, object]:
    vehicle_records = [item for item in records
                       if item.get("stage") == "vehicle_detection"
                       and item.get("status") == "complete"]
    plate_records = [item for item in records
                     if item.get("stage") == "plate_detection"
                     and item.get("status") == "complete"]
    ocr_records = [item for item in records if item.get("stage") == "ocr"
                   and item.get("status") in {"complete", "failed"}]
    ocr_complete = [item for item in ocr_records if item.get("status") == "complete"]
    payloads = [item["event"] for item in records
                if item.get("stage") == "ingest" and item.get("status") == "dry_run"
                and isinstance(item.get("event"), dict)]
    event_counts = Counter(str(item.get("eventType")) for item in payloads)
    stage_failures = Counter(str(item.get("stage")) for item in records
                             if item.get("status") == "failed")
    recognized = sorted({
        str(item.get("payload", {}).get("plate", {}).get("normalizedText"))
        for item in payloads if item.get("eventType") == "PlateRecognized"
    } - {"None"})
    expected = sorted({normalize_vietnamese_plate(str(item))
                       for item in feed.get("expected_plates", [])})
    matched = sorted(set(expected).intersection(recognized))
    plate_track_ids: dict[str, set[str]] = {}
    for item in payloads:
        if item.get("eventType") != "PlateRecognized":
            continue
        payload = item.get("payload", {})
        plate = str(payload.get("plate", {}).get("normalizedText"))
        track_id = str(payload.get("tracker", {}).get("trackId"))
        if plate not in {"", "None"} and track_id not in {"", "None"}:
            plate_track_ids.setdefault(plate, set()).add(track_id)
    id_switches = sum(max(0, len(track_ids) - 1) for track_ids in plate_track_ids.values())
    read_rate = len(matched) / len(expected) if expected else None
    true_positive = len(matched)
    false_positive = len(set(recognized) - set(expected))
    false_negative = len(set(expected) - set(recognized))
    precision = true_positive / (true_positive + false_positive) if true_positive + false_positive else None
    recall = true_positive / (true_positive + false_negative) if true_positive + false_negative else None
    f1 = (2 * precision * recall / (precision + recall)
          if precision is not None and recall is not None and precision + recall else None)
    vehicle_confidences = [float(detection["confidence"])
                           for item in vehicle_records
                           for detection in item.get("detections", [])]
    plate_confidences = [float(candidate["plate"]["confidence"])
                         for item in plate_records
                         for candidate in item.get("candidates", [])]
    ocr_confidences = [float(item["recognitionConfidence"])
                       for item in ocr_complete
                       if item.get("recognitionConfidence") is not None]
    frame_count = len(latencies)
    return {
        "id": feed["id"],
        "condition": feed["condition"],
        "source": feed["source"],
        "framesProcessed": frame_count,
        "vehicleDetections": sum(len(item.get("detections", [])) for item in vehicle_records),
        "plateDetections": sum(int(item.get("candidate_count", 0)) for item in plate_records),
        "ocrAttempts": len(ocr_records),
        "recognizedPlateCount": len(recognized),
        "recognizedPlates": recognized,
        "expectedReadablePlates": expected,
        "matchedReadablePlates": matched,
        "readRate": read_rate,
        "ocrQuality": {
            "truePositive": true_positive, "falsePositive": false_positive,
            "falseNegative": false_negative, "precision": precision,
            "recall": recall, "f1": f1,
        },
        "trackerIdentity": {
            "trackIdsByPlate": {plate: sorted(ids) for plate, ids in sorted(plate_track_ids.items())},
            "idSwitches": id_switches,
            "stable": id_switches == 0,
        },
        "confidenceDistributions": {
            "vehicle": _distribution(vehicle_confidences),
            "plate": _distribution(plate_confidences),
            "ocr": _distribution(ocr_confidences),
        },
        "eventCounts": dict(sorted(event_counts.items())),
        "stageFailures": dict(sorted(stage_failures.items())),
        "processing": {
            "elapsedSeconds": elapsed,
            "fps": frame_count / elapsed if elapsed > 0 else None,
            "latencyMs": {
                "mean": statistics.fmean(latencies) if latencies else None,
                "p50": _percentile(latencies, 0.50),
                "p95": _percentile(latencies, 0.95),
                "max": max(latencies) if latencies else None,
            },
        },
        "sampleEmittedPayloads": payloads[:2],
    }


def _condition_summary(feeds: list[dict[str, object]], condition: str, target: float) -> dict[str, object]:
    selected = [item for item in feeds if item["condition"] == condition]
    expected = sum(len(item["expectedReadablePlates"]) for item in selected)
    matched = sum(len(item["matchedReadablePlates"]) for item in selected)
    rate = matched / expected if expected else None
    return {
        "expectedReadablePlates": expected,
        "matchedReadablePlates": matched,
        "readRate": rate,
        "target": target,
        "targetMet": None if rate is None else rate >= target,
        "status": "not demonstrated" if rate is None else "measured",
    }


def run_evaluation(manifest_path: str | Path,
                   output_json: str | Path | None = None) -> dict[str, object]:
    manifest_path = Path(manifest_path).resolve()
    manifest = _load_manifest(manifest_path)
    base = manifest_path.parent
    config_path = (base / str(manifest["pipeline_config"])).resolve()
    config = load_camera_pipeline_config(config_path, environ={})
    mode = str(manifest["mode"])
    feed_reports: list[dict[str, object]] = []

    for raw_feed in manifest["feeds"]:
        feed = dict(raw_feed)
        source = (base / str(feed["source"])).resolve()
        max_frames = int(feed.get("max_frames", manifest.get("max_frames", 30)))
        if max_frames < 1:
            raise EvaluationError(f"feed '{feed['id']}' max_frames must be positive")
        capture = _JsonCapture()
        logger = logging.Logger(f"pipeline-eval-{feed['id']}", level=logging.DEBUG)
        logger.addHandler(capture)
        service = _service(config, mode, feed, logger)
        latencies: list[float] = []
        started = time.perf_counter()
        captured_at = datetime.now(timezone.utc)
        interval = timedelta(milliseconds=config.pipeline.frame_interval_ms)
        for index, pixels in enumerate(_frames(source, max_frames)):
            frame_started = time.perf_counter()
            service.process_frame(pixels, captured_at + interval * index)
            latencies.append((time.perf_counter() - frame_started) * 1000)
        elapsed = time.perf_counter() - started
        if not latencies:
            raise EvaluationError(f"feed '{feed['id']}' produced no frames")
        feed["source"] = source.as_posix()
        feed_reports.append(_feed_metrics(feed, capture.records, latencies, elapsed))

    configured_targets = {**READ_RATE_TARGETS,
                          **{str(k): float(v) for k, v in dict(manifest.get("condition_targets", {})).items()}}
    required_conditions = [str(item) for item in manifest.get("required_conditions", ["day", "night"])]
    evaluated_conditions = sorted({str(item["condition"]) for item in feed_reports})
    conditions = {condition: _condition_summary(
        feed_reports, condition, configured_targets.get(condition, 0.85))
        for condition in evaluated_conditions}
    no_stage_failures = all(not item["stageFailures"] for item in feed_reports)
    report: dict[str, object] = {
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "evidenceMode": mode,
        "datasetVersion": manifest.get("dataset_version", "fixture-sample-v1"),
        "configurationHash": config.configuration_hash,
        "promotionEligible": (mode == "models" and no_stage_failures
                              and all(conditions[name]["targetMet"] is True
                                      for name in required_conditions)),
        "note": ("Synthetic fixture run validates harness/orchestration only; it is not model-quality evidence."
                 if mode == "fixture" else
                 "Model run uses configured local artifacts and supplied feeds."),
        "requiredConditions": required_conditions,
        "readRateTargets": configured_targets,
        "conditions": conditions,
        "feeds": feed_reports,
        "sampleEmittedPayloads": [payload for feed in feed_reports
                                  for payload in feed["sampleEmittedPayloads"]][:4],
    }
    destination = Path(output_json).resolve() if output_json else (
        base / str(manifest.get("output_json", "reports/evaluation.json"))).resolve()
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(report, indent=2, sort_keys=True), encoding="utf-8")
    markdown = destination.with_suffix(".md")
    markdown.write_text(render_markdown(report), encoding="utf-8")
    report["outputJson"] = str(destination)
    report["outputMarkdown"] = str(markdown)
    return report


def _format_metric(value: object, digits: int = 2) -> str:
    return "n/a" if value is None else f"{float(value):.{digits}f}"


def render_markdown(report: dict[str, object]) -> str:
    lines = [
        "# LPR full-pipeline evaluation",
        "",
        f"- Evidence mode: `{report['evidenceMode']}`",
        f"- Dataset version: `{report['datasetVersion']}`",
        f"- Configuration: `{report['configurationHash']}`",
        f"- Promotion eligible: **{str(report['promotionEligible']).lower()}**",
        f"- Note: {report['note']}",
        "",
        "## Condition read-rate targets",
        "",
        "| Condition | Read rate | Target | Result |",
        "|---|---:|---:|---|",
    ]
    for condition in report["conditions"]:
        item = report["conditions"][condition]
        rate = "n/a" if item["readRate"] is None else f"{item['readRate']:.3f}"
        result = "not demonstrated" if item["targetMet"] is None else (
            "pass" if item["targetMet"] else "fail")
        lines.append(f"| {condition} | {rate} | {item['target']:.2f} | {result} |")
    lines.extend(["", "## Feed metrics", ""])
    for feed in report["feeds"]:
        processing = feed["processing"]
        confidences = feed["confidenceDistributions"]
        lines.extend([
            f"### {feed['id']} ({feed['condition']})",
            "",
            f"- Frames: {feed['framesProcessed']}",
            f"- Vehicle detections: {feed['vehicleDetections']}",
            f"- Plate detections: {feed['plateDetections']}",
            f"- OCR attempts: {feed['ocrAttempts']}",
            f"- Recognized plates: {', '.join(feed['recognizedPlates']) or 'none'}",
            f"- OCR precision/recall/F1: {_format_metric(feed['ocrQuality']['precision'], 3)} / "
            f"{_format_metric(feed['ocrQuality']['recall'], 3)} / "
            f"{_format_metric(feed['ocrQuality']['f1'], 3)}",
            f"- Event counts: `{json.dumps(feed['eventCounts'], sort_keys=True)}`",
            f"- Confidence means (vehicle/plate/OCR): "
            f"{_format_metric(confidences['vehicle']['mean'], 3)} / "
            f"{_format_metric(confidences['plate']['mean'], 3)} / "
            f"{_format_metric(confidences['ocr']['mean'], 3)}",
            f"- FPS: {_format_metric(processing['fps'])}",
            f"- Latency mean/p95: {_format_metric(processing['latencyMs']['mean'])} / "
            f"{_format_metric(processing['latencyMs']['p95'])} ms",
            "",
        ])
    lines.extend([
        "## Sample emitted payloads",
        "",
        "```json",
        json.dumps(report["sampleEmittedPayloads"], indent=2, sort_keys=True),
        "```",
        "",
    ])
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Evaluate the full LPR pipeline by labelled condition")
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--output-json")
    parser.add_argument("--enforce-targets", action="store_true")
    args = parser.parse_args(argv)
    try:
        report = run_evaluation(args.manifest, args.output_json)
    except EvaluationError as exc:
        print(f"evaluation failed: {exc}", file=sys.stderr)
        return 2
    print(json.dumps({
        "outputJson": report["outputJson"],
        "outputMarkdown": report["outputMarkdown"],
        "promotionEligible": report["promotionEligible"],
    }, indent=2))
    if args.enforce_targets and not report["promotionEligible"]:
        return 3
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
