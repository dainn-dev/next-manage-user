"""Deterministic checks for the DAI-296 full-pipeline evaluation harness."""

from __future__ import annotations

import json
from pathlib import Path
import tempfile
from types import SimpleNamespace

from evaluate_pipeline import EvaluationError, main, run_evaluation
from run_camera_pipeline import _run_feed


HERE = Path(__file__).resolve().parent
SAMPLE = HERE / "sample-evaluation.json"


def test_sample_day_night_report_contains_required_metrics_and_payloads() -> None:
    with tempfile.TemporaryDirectory() as raw:
        output = Path(raw) / "evaluation.json"
        report = run_evaluation(SAMPLE, output)

        assert report["evidenceMode"] == "fixture"
        assert report["promotionEligible"] is False
        assert report["conditions"]["day"]["target"] == 0.95
        assert report["conditions"]["night"]["target"] == 0.90
        assert report["conditions"]["day"]["readRate"] == 1.0
        assert report["conditions"]["night"]["readRate"] == 1.0
        assert output.is_file() and output.with_suffix(".md").is_file()

        for feed in report["feeds"]:
            assert feed["vehicleDetections"] == 3
            assert feed["plateDetections"] == 3
            assert feed["ocrAttempts"] == 3
            assert feed["recognizedPlateCount"] == 1
            assert feed["eventCounts"] == {
                "PlateRecognized": 1, "VehicleDetected": 1}
            assert feed["stageFailures"] == {}
            assert feed["processing"]["fps"] > 0
            assert feed["processing"]["latencyMs"]["p95"] >= 0
            assert feed["confidenceDistributions"]["ocr"]["count"] == 3
            assert feed["ocrQuality"]["precision"] == 1.0
            assert feed["ocrQuality"]["recall"] == 1.0

        event_types = {item["eventType"] for item in report["sampleEmittedPayloads"]}
        assert event_types == {"VehicleDetected", "PlateRecognized"}


def test_manifest_requires_both_conditions() -> None:
    value = json.loads(SAMPLE.read_text(encoding="utf-8"))
    value["feeds"] = [value["feeds"][0]]
    with tempfile.TemporaryDirectory() as raw:
        manifest = Path(raw) / "invalid.json"
        manifest.write_text(json.dumps(value), encoding="utf-8")
        try:
            run_evaluation(manifest, Path(raw) / "report.json")
        except EvaluationError as exc:
            assert "missing required conditions" in str(exc)
        else:
            raise AssertionError("expected missing-night validation failure")


def test_fixture_cannot_pass_promotion_enforcement() -> None:
    with tempfile.TemporaryDirectory() as raw:
        code = main([
            "--manifest", str(SAMPLE),
            "--output-json", str(Path(raw) / "report.json"),
            "--enforce-targets",
        ])
        assert code == 3


def test_bounded_image_feed_repeats_only_requested_frames() -> None:
    class RecordingService:
        config = SimpleNamespace(
            pipeline=SimpleNamespace(frame_interval_ms=200))

        def __init__(self):
            self.frames = []

        def process_frame(self, pixels, captured_at):
            self.frames.append((pixels.shape, captured_at))

    service = RecordingService()
    processed = _run_feed(service, HERE / "samples/day.ppm", 2)

    assert processed == 2
    assert [shape for shape, _ in service.frames] == [(8, 8, 3), (8, 8, 3)]


def run() -> None:
    tests = (
        test_sample_day_night_report_contains_required_metrics_and_payloads,
        test_manifest_requires_both_conditions,
        test_fixture_cannot_pass_promotion_enforcement,
        test_bounded_image_feed_repeats_only_requested_frames,
    )
    for test in tests:
        test()
        print(f"  ok: {test.__name__}")
    print("\nAll DAI-296 pipeline evaluation checks passed.")


if __name__ == "__main__":
    run()
