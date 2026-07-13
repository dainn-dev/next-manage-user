# Plate detector + OCR evaluation harness (DAI-257)

Reproducible baseline eval for the VN license-plate **detector + OCR** stack that
ships on the edge (`edge/edge/detection_core.py`). Research tooling only — it
does **not** touch the backend, frontend, or edge inference code; it just loads
the same models the edge loads and measures them.

## Why this exists

DAI-257 (B1) needs a **baseline** on *real* data: detection rate, OCR accuracy,
and an error breakdown (military, 1-line vs 2-line, blur, tilt, night…). The real
corpus is generated for free by Phase 4:

- **Phase 4.2** — every check stores a cropped plate snapshot in
  `vehicle_log.image_path`.
- **Phase 4.4** — every unregistered/hard plate raises a `vehicle_access_requests`
  row (`source=GATE`, status `PENDING`/`REJECTED`) with its own `image_path`.
  These are, by definition, the cases the system found hard.

## 3-step workflow

```bash
# 1) pull the corpus into a labelling manifest (copies snapshot files + a CSV)
python export_testset.py --db "postgresql://user:pass@host/vehicledb" \
    --uploads-root /path/to/backend --out ./testset --since 2026-06-01

# 2) a HUMAN corrects the `plate` column (export pre-fills the machine read as a
#    hint, not truth) and fills `tags` (military,red,2line,1line,blur,tilt,night…).
#    Aim for >=300 rows overall and >=50 military/red before trusting the numbers.

# 3) run the eval (default = the nano pair the edge config ships at conf 0.6)
python eval_baseline.py --manifest ./testset/labels.csv --images ./testset/images \
    --out report_nano.md --json results_nano.json

# compare against the full-size weights
python eval_baseline.py --manifest ./testset/labels.csv --images ./testset/images \
    --detector ../../model/LP_detector.pt --ocr ../../model/LP_ocr.pt \
    --out report_full.md
```

`report_*.md` gives overall detection/exact/char accuracy, a per-tag breakdown,
and a stage-based error taxonomy:

| stage | means |
|---|---|
| `box+ocr` | healthy: detector box + OCR read first try |
| `box+deskew` | OCR only worked after deskew → tilt/skew pressure |
| `wholeframe` | no detector box → **detector miss** |
| `fallback` | primary OCR failed, red/tesseract path fired → military-ish |
| `no-box` | nothing detected → **detection miss** |
| `ocr-unknown` | box found, OCR never resolved → **OCR miss** |

`plate` comparison is separator-insensitive (`76M-514.43` == `76m51443`), so
labellers don't have to match the app's exact `-`/`.` formatting.

## DAI-292 same-crop OCR comparison

`compare_ocr.py` reuses the same `filename,plate,tags` manifest but evaluates already-cropped plate
images with PaddleOCR, EasyOCR, and VietOCR independently. It decodes each file once and gives each
engine an identical pixel copy. Install its isolated dependencies with
`requirements-ocr-benchmark.txt`; provide explicit local model roots so the run does not download
weights.

The JSON output records per-crop predictions, nullable confidence, threshold disposition, exact
match, edit distance/CER, latency, errors, dimensions, SHA-256, and tags. The Markdown output reports
overall plus `day`/`night` sections and says `not demonstrated` when a condition is absent. Use
`--strict-day-night` for acceptance runs. Comparator results are offline evidence only and never
replace PaddleOCR output in the edge worker.

The checked-in `labels.example.csv` demonstrates schema, not benchmark evidence. A human-labeled,
representative day/night corpus and versioned local model bundles are required before reporting
accuracy or promoting the OCR decision.

## Files
- `export_testset.py` — DB → labelling manifest (read-only; `psycopg2-binary`).
- `eval_baseline.py` — labelled set → legacy metrics + error taxonomy (`torch`, `opencv`).
- `compare_ocr.py` — identical crops → PaddleOCR/EasyOCR/VietOCR report.
- `requirements-ocr-benchmark.txt` — optional offline comparator dependencies.
- `labels.example.csv` — manifest schema example.
