#!/usr/bin/env python3
"""Same-crop PaddleOCR/EasyOCR/VietOCR comparison harness for DAI-292.

The harness never votes or substitutes comparator output in production. It reports
real engine results only when explicit local models and dependencies are supplied.
"""

from __future__ import annotations

import argparse
import csv
from dataclasses import asdict, dataclass
from hashlib import sha256
import json
from pathlib import Path
import statistics
import sys
import time
from typing import Protocol

import cv2
import numpy as np

EDGE_ROOT = Path(__file__).resolve().parents[2]
if str(EDGE_ROOT) not in sys.path:
    sys.path.insert(0, str(EDGE_ROOT))

from edge.camera_config import load_camera_pipeline_config
from edge.ocr_engine import LocalPaddleOcrEngine, OcrEngineRead, normalize_vietnamese_plate


class BenchmarkEngine(Protocol):
    name: str
    version: str
    device: str

    def ensure_ready(self) -> None: ...
    def recognize(self, pixels: np.ndarray) -> OcrEngineRead: ...


@dataclass(frozen=True)
class BenchmarkRow:
    filename: str
    engine: str
    input_sha256: str
    width: int
    height: int
    ground_truth: str
    normalized_ground_truth: str
    text: str
    normalized_text: str
    confidence: float | None
    disposition: str
    exact_match: bool
    edit_distance: int
    character_error_rate: float
    latency_ms: float
    tags: tuple[str, ...]
    error_type: str | None = None
    error: str | None = None


class EasyOcrComparator:
    name = "EasyOCR"

    def __init__(self, model_root: Path, languages: tuple[str, ...], device: str):
        self.model_root = model_root
        self.languages = languages
        self.device = device
        self.version = "local"
        self._reader = None

    def ensure_ready(self) -> None:
        if self._reader is not None:
            return
        if not self.model_root.is_dir():
            raise RuntimeError(f"EasyOCR model root '{self.model_root}' does not exist")
        import easyocr
        self._reader = easyocr.Reader(
            list(self.languages),
            gpu=self.device.startswith("cuda"),
            model_storage_directory=str(self.model_root),
            download_enabled=False,
        )

    def recognize(self, pixels: np.ndarray) -> OcrEngineRead:
        self.ensure_ready()
        results = self._reader.readtext(pixels, detail=1)
        texts, weighted, chars, debug = [], 0.0, 0, []
        for box, text, confidence in results:
            normalized = normalize_vietnamese_plate(str(text))
            score = float(confidence)
            texts.append(str(text))
            if normalized:
                weighted += score * len(normalized)
                chars += len(normalized)
            debug.append({"text": str(text)[:64], "confidence": score, "polygon": box[:4]})
        display = "".join(texts)[:128]
        return OcrEngineRead(self.name, display, normalize_vietnamese_plate(display),
                             0.0 if chars == 0 else weighted / chars,
                             {"items": debug[:16], "sourceItemCount": len(debug), "truncated": len(debug) > 16})


class VietOcrComparator:
    name = "VietOCR"

    def __init__(self, config_path: Path, weights_path: Path, device: str):
        self.config_path = config_path
        self.weights_path = weights_path
        self.device = device
        self.version = weights_path.name
        self._predictor = None

    def ensure_ready(self) -> None:
        if self._predictor is not None:
            return
        if not self.config_path.is_file() or not self.weights_path.is_file():
            raise RuntimeError("VietOCR requires explicit local config and weights files")
        from vietocr.tool.config import Cfg
        from vietocr.tool.predictor import Predictor
        config = Cfg.load_config_from_file(str(self.config_path))
        config["weights"] = str(self.weights_path)
        config["device"] = self.device
        config["cnn"]["pretrained"] = False
        self._predictor = Predictor(config)

    def recognize(self, pixels: np.ndarray) -> OcrEngineRead:
        self.ensure_ready()
        from PIL import Image
        rgb = cv2.cvtColor(pixels, cv2.COLOR_BGR2RGB)
        text = str(self._predictor.predict(Image.fromarray(rgb)))[:128]
        return OcrEngineRead(self.name, text, normalize_vietnamese_plate(text), None,
                             {"confidenceAvailable": False})


def read_manifest(path: Path) -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    with path.open(encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            filename = (row.get("filename") or "").strip()
            plate = (row.get("plate") or "").strip()
            if not filename or not plate:
                continue
            tags = tuple(sorted({tag.strip() for tag in (row.get("tags") or "").replace("|", ",").split(",") if tag.strip()}))
            rows.append({"filename": filename, "plate": plate, "tags": tags})
    if not rows:
        raise ValueError("manifest contains no labeled rows")
    return rows


def run_benchmark(manifest: list[dict[str, object]], images: Path,
                  engines: list[BenchmarkEngine], threshold: float) -> list[BenchmarkRow]:
    output: list[BenchmarkRow] = []
    for item in manifest:
        filename = str(item["filename"])
        truth = str(item["plate"])
        tags = tuple(item["tags"])
        path = images / filename
        normalized_truth = normalize_vietnamese_plate(truth)
        try:
            encoded = path.read_bytes()
            pixels = cv2.imdecode(np.frombuffer(encoded, dtype=np.uint8), cv2.IMREAD_COLOR)
            if pixels is None:
                raise ValueError("image decoder returned no pixels")
        except Exception as exc:
            for engine in engines:
                output.append(BenchmarkRow(
                    filename=filename,
                    engine=engine.name,
                    input_sha256="",
                    width=0,
                    height=0,
                    ground_truth=truth,
                    normalized_ground_truth=normalized_truth,
                    text="",
                    normalized_text="",
                    confidence=None,
                    disposition="error",
                    exact_match=False,
                    edit_distance=len(normalized_truth),
                    character_error_rate=1.0 if normalized_truth else 0.0,
                    latency_ms=0.0,
                    tags=tags,
                    error_type=type(exc).__name__,
                    error=f"unable to read image '{path}': {exc}",
                ))
            continue
        height, width = pixels.shape[:2]
        input_hash = sha256(encoded).hexdigest()
        for engine in engines:
            started = time.perf_counter()
            read = None
            error = None
            try:
                read = engine.recognize(np.array(pixels, copy=True))
            except Exception as exc:
                error = exc
            latency = (time.perf_counter() - started) * 1000
            normalized = "" if read is None else read.normalized_text
            confidence = None if read is None else read.confidence
            if read is None or not normalized:
                disposition = "error" if error else "no_text"
            elif confidence is None:
                disposition = "confidence_unavailable"
            elif confidence < threshold:
                disposition = "low_confidence"
            else:
                disposition = "accepted"
            distance = levenshtein(normalized, normalized_truth)
            output.append(BenchmarkRow(
                filename=filename,
                engine=engine.name,
                input_sha256=input_hash,
                width=width,
                height=height,
                ground_truth=truth,
                normalized_ground_truth=normalized_truth,
                text="" if read is None else read.text,
                normalized_text=normalized,
                confidence=confidence,
                disposition=disposition,
                exact_match=normalized == normalized_truth,
                edit_distance=distance,
                character_error_rate=distance / max(1, len(normalized_truth)),
                latency_ms=latency,
                tags=tags,
                error_type=None if error is None else type(error).__name__,
                error=None if error is None else str(error),
            ))
    return output


def summarize(rows: list[BenchmarkRow], metadata: dict[str, object]) -> str:
    lines = ["# OCR same-crop benchmark", "", "> Real model evidence only; comparator output is never a production fallback.", ""]
    lines.append("## Run metadata")
    lines.append("")
    lines.append("```json")
    lines.append(json.dumps(metadata, indent=2, sort_keys=True))
    lines.append("```")
    for engine in sorted({row.engine for row in rows}):
        subset = [row for row in rows if row.engine == engine]
        lines.extend(_summary_section(engine, subset))
        for condition in ("day", "night"):
            tagged = [row for row in subset if condition in row.tags]
            if tagged:
                lines.extend(_summary_section(f"{engine} — {condition}", tagged, level=3))
            else:
                lines.extend([f"### {engine} — {condition}", "", "not demonstrated (0 labeled samples)", ""])
    return "\n".join(lines) + "\n"


def _summary_section(title: str, rows: list[BenchmarkRow], level: int = 2) -> list[str]:
    exact = sum(row.exact_match for row in rows) / max(1, len(rows))
    errors = sum(row.error_type is not None for row in rows)
    accepted = [row for row in rows if row.disposition == "accepted"]
    selective = sum(row.exact_match for row in accepted) / len(accepted) if accepted else None
    latencies = sorted(row.latency_ms for row in rows)
    p95 = latencies[min(len(latencies) - 1, max(0, int(len(latencies) * 0.95) - 1))] if latencies else 0
    values = [
        ("samples", len(rows)),
        ("exact match", f"{exact:.3f}"),
        ("mean CER", f"{statistics.fmean(row.character_error_rate for row in rows):.3f}" if rows else "n/a"),
        ("accepted coverage", f"{len(accepted) / max(1, len(rows)):.3f}"),
        ("selective accuracy", "n/a" if selective is None else f"{selective:.3f}"),
        ("errors", errors),
        ("median latency ms", f"{statistics.median(latencies):.2f}" if latencies else "n/a"),
        ("p95 latency ms", f"{p95:.2f}" if latencies else "n/a"),
    ]
    return [f"{'#' * level} {title}", "", *[f"- {key}: {value}" for key, value in values], ""]


def levenshtein(left: str, right: str) -> int:
    if not left:
        return len(right)
    previous = list(range(len(right) + 1))
    for row, char_left in enumerate(left, 1):
        current = [row]
        for column, char_right in enumerate(right, 1):
            current.append(min(previous[column] + 1, current[-1] + 1,
                               previous[column - 1] + (char_left != char_right)))
        previous = current
    return previous[-1]


def main() -> int:
    parser = argparse.ArgumentParser(description="Compare OCR engines on identical labeled plate crops")
    parser.add_argument("--config", required=True)
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--images", required=True)
    parser.add_argument("--engines", default="paddle,easyocr,vietocr")
    parser.add_argument("--easyocr-model-root")
    parser.add_argument("--vietocr-config")
    parser.add_argument("--vietocr-weights")
    parser.add_argument("--json-out", required=True)
    parser.add_argument("--markdown-out", required=True)
    parser.add_argument("--strict-day-night", action="store_true")
    args = parser.parse_args()

    config = load_camera_pipeline_config(args.config)
    requested = {name.strip().lower() for name in args.engines.split(",") if name.strip()}
    engines: list[BenchmarkEngine] = []
    if "paddle" in requested:
        paddle = LocalPaddleOcrEngine(config.models.ocr, config.ocr.languages)
        paddle.name = "PaddleOCR"  # Protocol metadata for the harness.
        paddle.version = config.models.ocr.artifact_version
        paddle.device = config.models.ocr.device or "cpu"
        engines.append(paddle)
    if "easyocr" in requested:
        if not args.easyocr_model_root:
            raise SystemExit("--easyocr-model-root is required for EasyOCR")
        engines.append(EasyOcrComparator(Path(args.easyocr_model_root), config.ocr.languages,
                                         config.models.ocr.device or "cpu"))
    if "vietocr" in requested:
        if not args.vietocr_config or not args.vietocr_weights:
            raise SystemExit("--vietocr-config and --vietocr-weights are required for VietOCR")
        engines.append(VietOcrComparator(Path(args.vietocr_config), Path(args.vietocr_weights),
                                         config.models.ocr.device or "cpu"))
    for engine in engines:
        engine.ensure_ready()

    manifest_path = Path(args.manifest)
    manifest = read_manifest(manifest_path)
    tags = {tag for row in manifest for tag in row["tags"]}
    if args.strict_day_night and not {"day", "night"}.issubset(tags):
        raise SystemExit("strict day/night mode requires labeled day and night samples")
    results = run_benchmark(manifest, Path(args.images), engines, config.thresholds.ocr_confidence)
    metadata = {
        "manifest": str(manifest_path.resolve()),
        "manifestSha256": sha256(manifest_path.read_bytes()).hexdigest(),
        "threshold": config.thresholds.ocr_confidence,
        "policy": config.ocr.low_confidence_policy,
        "engines": [{"name": engine.name, "version": engine.version, "device": engine.device}
                    for engine in engines],
        "note": "Real model results are required for acceptance; fake-engine tests validate harness mechanics only.",
    }
    Path(args.json_out).write_text(json.dumps([asdict(row) for row in results], indent=2), encoding="utf-8")
    Path(args.markdown_out).write_text(summarize(results, metadata), encoding="utf-8")
    if args.strict_day_night and any(row.error_type for row in results):
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
