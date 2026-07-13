"""Model-free same-crop OCR comparison harness checks."""

from __future__ import annotations

import csv
from pathlib import Path
import sys
import tempfile

import cv2
import numpy as np

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))
EDGE_ROOT = HERE.parents[1]
if str(EDGE_ROOT) not in sys.path:
    sys.path.insert(0, str(EDGE_ROOT))

from compare_ocr import read_manifest, run_benchmark, summarize
from edge.ocr_engine import OcrEngineRead


class _Engine:
    version = "fake-v1"
    device = "cpu"

    def __init__(self, name, outputs, confidence=0.9):
        self.name = name
        self.outputs = iter(outputs)
        self.confidence = confidence
        self.inputs = []

    def ensure_ready(self):
        return None

    def recognize(self, pixels):
        self.inputs.append(np.array(pixels, copy=True))
        text = next(self.outputs)
        normalized = "".join(character for character in text.upper() if character.isalnum())
        confidence = None if self.name == "VietOCR" else self.confidence
        return OcrEngineRead(self.name, text, normalized, confidence, {"fake": True})


def _write_image(path: Path, value: int):
    pixels = np.full((20, 60, 3), value, dtype=np.uint8)
    ok, encoded = cv2.imencode(".jpg", pixels)
    assert ok
    path.write_bytes(encoded.tobytes())


def test_same_crop_metrics_and_day_night_reporting():
    with tempfile.TemporaryDirectory() as raw:
        root = Path(raw)
        images = root / "images"
        images.mkdir()
        _write_image(images / "day.jpg", 80)
        _write_image(images / "night.jpg", 20)
        manifest_path = root / "labels.csv"
        with manifest_path.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.writer(handle)
            writer.writerow(["filename", "plate", "tags"])
            writer.writerow(["day.jpg", "51A-123.45", "day,car"])
            writer.writerow(["night.jpg", "30A-999.99", "night|blur"])

        manifest = read_manifest(manifest_path)
        paddle = _Engine("PaddleOCR", ["51A-123.45", "30A-999.98"])
        easy = _Engine("EasyOCR", ["51A12345", "30A99999"], confidence=0.7)
        viet = _Engine("VietOCR", ["51A12345", ""], confidence=1.0)
        rows = run_benchmark(manifest, images, [paddle, easy, viet], threshold=0.8)

        assert len(rows) == 6
        for image_index in range(2):
            inputs = [engine.inputs[image_index] for engine in (paddle, easy, viet)]
            assert all(np.array_equal(inputs[0], value) for value in inputs[1:])
        paddle_rows = [row for row in rows if row.engine == "PaddleOCR"]
        assert paddle_rows[0].exact_match is True
        assert paddle_rows[1].exact_match is False
        assert paddle_rows[1].edit_distance == 1
        easy_rows = [row for row in rows if row.engine == "EasyOCR"]
        assert all(row.disposition == "low_confidence" for row in easy_rows)
        viet_rows = [row for row in rows if row.engine == "VietOCR"]
        assert viet_rows[0].confidence is None
        assert viet_rows[0].disposition == "confidence_unavailable"
        report = summarize(rows, {"note": "fake-engine harness test; not benchmark evidence"})
        assert "PaddleOCR — day" in report and "PaddleOCR — night" in report
        assert "fake-engine harness test" in report


def test_corrupt_image_is_counted_without_hiding_other_rows():
    with tempfile.TemporaryDirectory() as raw:
        root = Path(raw)
        images = root / "images"
        images.mkdir()
        _write_image(images / "good.jpg", 90)
        (images / "broken.jpg").write_bytes(b"not-an-image")
        manifest_path = root / "labels.csv"
        manifest_path.write_text(
            "filename,plate,tags\ngood.jpg,51A12345,day\nbroken.jpg,30A99999,night\n",
            encoding="utf-8",
        )
        rows = run_benchmark(read_manifest(manifest_path), images,
                             [_Engine("PaddleOCR", ["51A12345"])], 0.8)
        assert len(rows) == 2
        assert rows[0].exact_match is True
        assert rows[1].disposition == "error"
        assert rows[1].error_type == "ValueError"


def test_missing_condition_is_reported_not_demonstrated():
    with tempfile.TemporaryDirectory() as raw:
        root = Path(raw)
        images = root / "images"
        images.mkdir()
        _write_image(images / "one.jpg", 100)
        manifest_path = root / "labels.csv"
        manifest_path.write_text("filename,plate,tags\none.jpg,51A12345,day\n", encoding="utf-8")
        rows = run_benchmark(read_manifest(manifest_path), images,
                             [_Engine("PaddleOCR", ["51A12345"])], 0.8)
        report = summarize(rows, {})
        assert "PaddleOCR — night" in report
        assert "not demonstrated (0 labeled samples)" in report


def run():
    for test in (test_same_crop_metrics_and_day_night_reporting,
                 test_corrupt_image_is_counted_without_hiding_other_rows,
                 test_missing_condition_is_reported_not_demonstrated):
        test()
        print(f"  ok: {test.__name__}")
    print("\nAll DAI-292 OCR comparator checks passed.")


if __name__ == "__main__":
    run()
