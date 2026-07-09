#!/usr/bin/env python3
"""Baseline evaluation harness for the VN license-plate detector + OCR (DAI-257 / B1).

Runs the *exact* production inference stack used by the edge — the same YOLOv5
detector + per-character OCR model, deskew retry and OCR fallback as
``edge/edge/detection_core.py`` — over a labelled test set and reports:

  * detection rate            (detector produced >=1 plate box)
  * OCR exact-match accuracy   (predicted plate string == ground truth, normalised)
  * character accuracy         (1 - normalised Levenshtein over the best candidate)
  * a per-stage error taxonomy (detection-miss / ocr-unknown / ocr-substitution)
  * breakdowns by any label tag in the manifest (e.g. military, 2line, blur…)

It does NOT touch the backend, frontend, or edge inference code. It imports the
models the same way the edge does so the numbers reflect what ships today.

Usage
-----
    python eval_baseline.py --manifest labels.csv --images ./testset \
        --detector ../../model/LP_detector_nano_61.pt \
        --ocr      ../../model/LP_ocr_nano_62.pt \
        --conf 0.6 --out report.md

Run it twice (nano vs full weights) to compare; the default edge config ships
the *nano* pair at conf 0.6.

Manifest (CSV, UTF-8) columns — see labels.example.csv:
    filename,plate,tags
    plate_76M51443_1712664000000.jpg,76M-514.43,"1line,car"
    mil_A1234_....jpg,QA-1234,"military,red,2line"
`plate` is the human-verified ground truth. `tags` is a free-form, comma or
pipe separated set used only for breakdowns (rows with no tag still count in
the overall totals).
"""

import argparse
import csv
import json
import os
import re
import sys
import time
from collections import defaultdict

import cv2
import torch

# --- make the bundled YOLOv5 + windows package importable (mirror detection_core) ---
_HERE = os.path.dirname(os.path.abspath(__file__))
_WINDOWS = os.path.abspath(os.path.join(_HERE, "..", ".."))
_YOLOV5 = os.path.join(_WINDOWS, "model", "ultralytics_yolov5_master")
for p in (_WINDOWS, _YOLOV5):
    if os.path.isdir(p) and p not in sys.path:
        sys.path.insert(0, p)

import function.helper as helper            # noqa: E402
import function.utils_rotate as utils_rotate  # noqa: E402


# --------------------------------------------------------------------- normalise
def normalise_plate(s):
    """Uppercase and strip everything but A-Z0-9 so '76M-514.43' == '76m51443'.

    Comparison is separator-insensitive on purpose: the production string uses a
    '-' between the two lines but ground truth is often typed with dots/spaces.
    """
    return re.sub(r"[^A-Z0-9]", "", (s or "").upper())


def levenshtein(a, b):
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


# ------------------------------------------------------------------------ models
def load_models(detector_path, ocr_path, conf, device):
    torch.serialization.add_safe_globals(["models.yolo.Model"])
    detect = torch.hub.load(_YOLOV5, "custom", path=detector_path,
                            force_reload=False, source="local", device=device)
    ocr = torch.hub.load(_YOLOV5, "custom", path=ocr_path,
                         force_reload=False, source="local", device=device)
    ocr.conf = conf
    detect.to(device).eval()
    ocr.to(device).eval()
    return detect, ocr


def resolve_device(choice):
    """Map --device {auto,cpu,cuda} to a string YOLOv5's select_device accepts,
    falling back to cpu when CUDA is present in name only (0 usable devices)."""
    if choice == "cpu":
        return "cpu"
    usable = torch.cuda.is_available() and torch.cuda.device_count() > 0
    if choice == "cuda":
        if not usable:
            raise SystemExit("--device cuda requested but no usable CUDA device")
        return "0"
    return "0" if usable else "cpu"


def read_one(detect, ocr, frame):
    """Faithful single-frame inference with per-stage diagnostics.

    Mirrors ``DetectionCore._read_plates`` (detector -> crop -> OCR -> 4x deskew
    retry -> whole-frame OCR fallback) but returns *why* it produced what it did
    so the harness can bucket failures.
    Returns (plate_or_None, stage) where stage is one of:
      'box+ocr' | 'box+deskew' | 'wholeframe' | 'fallback' | 'no-box' | 'ocr-unknown'
    """
    with torch.no_grad():
        result = detect(frame, size=640)
    boxes = result.pandas().xyxy[0].values.tolist()

    if not boxes:
        lp = helper.read_plate(ocr, frame)
        if lp != "unknown":
            return lp, "wholeframe"
        return None, "no-box"

    for box in boxes:
        x1, y1 = max(int(box[0]), 0), max(int(box[1]), 0)
        x2, y2 = max(int(box[2]), x1 + 1), max(int(box[3]), y1 + 1)
        crop = frame[y1:y2, x1:x2]
        if crop.size == 0:
            continue
        lp = helper.read_plate(ocr, crop)
        if lp != "unknown":
            return lp, "box+ocr"
        for cc in range(2):
            for ct in range(2):
                lp = helper.read_plate(ocr, utils_rotate.deskew(crop, cc, ct))
                if lp != "unknown":
                    return lp, "box+deskew"
    # box existed but OCR never resolved -> try configured fallback OCR
    try:
        fb, method, _b, _p = helper.read_plate_with_fallback(frame)
        if fb != "unknown":
            return fb, "fallback"
    except Exception:
        pass
    return None, "ocr-unknown"


# -------------------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser(description="VN plate detector+OCR baseline eval")
    ap.add_argument("--manifest", required=True, help="labels CSV (filename,plate,tags)")
    ap.add_argument("--images", required=True, help="dir holding the test images")
    ap.add_argument("--detector", default=os.path.join(_WINDOWS, "model", "LP_detector_nano_61.pt"))
    ap.add_argument("--ocr", default=os.path.join(_WINDOWS, "model", "LP_ocr_nano_62.pt"))
    ap.add_argument("--conf", type=float, default=0.6)
    ap.add_argument("--device", default="auto", choices=("auto", "cpu", "cuda"))
    ap.add_argument("--out", default="report.md")
    ap.add_argument("--json", default=None, help="also dump per-image results as JSON")
    args = ap.parse_args()

    device = resolve_device(args.device)
    print(f"Loading {args.detector} + {args.ocr} on {device} (conf={args.conf})")
    detect, ocr = load_models(args.detector, args.ocr, args.conf, device)

    rows = []
    with open(args.manifest, encoding="utf-8-sig") as fh:
        for r in csv.DictReader(fh):
            if r.get("filename"):
                rows.append(r)
    if not rows:
        sys.exit("manifest is empty")

    per_image = []
    # counters: overall and per-tag
    agg = lambda: {"n": 0, "det": 0, "exact": 0, "char_num": 0.0, "char_den": 0,
                   "stages": defaultdict(int)}
    overall = agg()
    by_tag = defaultdict(agg)

    t0 = time.time()
    for r in rows:
        path = os.path.join(args.images, r["filename"])
        gt = normalise_plate(r.get("plate"))
        tags = [t.strip() for t in re.split(r"[,|]", r.get("tags", "")) if t.strip()]
        frame = cv2.imread(path)
        if frame is None:
            print(f"  !! cannot read {path}; skipping")
            continue

        pred_raw, stage = read_one(detect, ocr, frame)
        pred = normalise_plate(pred_raw)
        detected = stage not in ("no-box",)
        exact = bool(pred) and pred == gt
        dist = levenshtein(pred, gt) if gt else len(pred)
        denom = max(len(gt), len(pred), 1)

        rec = {"file": r["filename"], "gt": gt, "pred": pred, "raw": pred_raw,
               "stage": stage, "detected": detected, "exact": exact,
               "char_acc": round(1 - dist / denom, 4), "tags": tags}
        per_image.append(rec)

        for bucket in (overall, *(by_tag[t] for t in tags)):
            bucket["n"] += 1
            bucket["det"] += int(detected)
            bucket["exact"] += int(exact)
            bucket["char_num"] += (1 - dist / denom)
            bucket["char_den"] += 1
            bucket["stages"][stage] += 1
    elapsed = time.time() - t0

    def fmt(b):
        n = b["n"] or 1
        return (f"{b['n']:>4}  det {b['det']/n:6.1%}  exact {b['exact']/n:6.1%}  "
                f"char {b['char_num']/(b['char_den'] or 1):6.1%}")

    lines = []
    lines.append(f"# Plate detector+OCR baseline\n")
    lines.append(f"- detector: `{os.path.basename(args.detector)}`  ocr: "
                 f"`{os.path.basename(args.ocr)}`  conf={args.conf}  device={device}")
    lines.append(f"- images: {overall['n']}   wall: {elapsed:.1f}s "
                 f"({elapsed/(overall['n'] or 1)*1000:.0f} ms/img)\n")
    lines.append("## Overall")
    lines.append("```")
    lines.append("            " + fmt(overall))
    lines.append("stages: " + ", ".join(f"{k}={v}" for k, v in sorted(overall["stages"].items())))
    lines.append("```\n")
    if by_tag:
        lines.append("## By tag")
        lines.append("```")
        for tag in sorted(by_tag):
            lines.append(f"{tag:>12}  " + fmt(by_tag[tag]))
        lines.append("```\n")
    lines.append("## Error taxonomy (overall stages)")
    lines.append("| stage | meaning | count |")
    lines.append("|---|---|---|")
    meanings = {
        "box+ocr": "detector box + OCR on first read (healthy)",
        "box+deskew": "OCR only worked after deskew (tilt/skew stress)",
        "wholeframe": "no detector box, OCR on whole frame (detector miss)",
        "fallback": "primary OCR failed, red/tesseract fallback fired (military-ish)",
        "no-box": "DETECTION MISS — nothing found",
        "ocr-unknown": "box found but OCR never resolved (OCR miss)",
    }
    for st, cnt in sorted(overall["stages"].items(), key=lambda x: -x[1]):
        lines.append(f"| {st} | {meanings.get(st, '')} | {cnt} |")
    report = "\n".join(lines)

    with open(args.out, "w", encoding="utf-8") as fh:
        fh.write(report)
    print("\n" + report)
    print(f"\nwrote {args.out}")
    if args.json:
        with open(args.json, "w", encoding="utf-8") as fh:
            json.dump(per_image, fh, ensure_ascii=False, indent=2)
        print(f"wrote {args.json}")


if __name__ == "__main__":
    main()
