# ADR-2202: AI model evaluation harness & acceptance thresholds

- Status: Proposed
- Date: 2026-07-09
- Deciders: Principal Architect
- Context doc: 22_Testing

## Context

Today's edge AI pipeline (YOLOv5 plate detection + a second YOLOv5 model for character-detection
OCR, brief §1) has no automated accuracy evaluation in the repo — correctness is validated
informally (manual review of gate check-vehicle results), and the "tracking" today is just a
per-plate-string cooldown dict, not a model with a measurable accuracy metric. The target vision
replaces/extends this with several components that each have real, measurable failure modes and
no ground-truth-based regression test today: **YOLOv11 vehicle detection**, **PaddleOCR** as
primary OCR (compared against EasyOCR/VietOCR), **ByteTrack** multi-object tracking producing
`track_id`s, **parking-slot polygon mapping** (vehicle center → slot), and **relocation
detection** (same `track_id`, slot changed → `VehicleRelocated`). Each of these can silently
regress when a model version, threshold, or camera calibration changes — and because relocation
detection directly drives owner-facing notifications (`19_Notification`), a false-positive
relocation alert is a visible product-quality failure, not just an internal metric miss. We need a
harness and acceptance bar so model/pipeline changes are gated by measured accuracy, not manual
spot-checks.

## Decision

Build a standalone **AI evaluation harness** (a Python module, alongside `edge/`, not part of the
runtime edge process) that runs each pipeline stage against **labeled evaluation datasets** and
reports metrics against **fixed acceptance thresholds**, gating model/version promotion:

| Stage | Metric | Initial acceptance threshold (proposed) |
|---|---|---|
| OCR (PaddleOCR primary) | Plate string exact-match accuracy on a held-out VN-plate dataset (1-line + 2-line) | ≥ existing YOLOv5-char-detection baseline, measured before cutover |
| Vehicle detection (YOLOv11) | mAP@0.5 on a labeled vehicle-detection dataset | ≥ 0.85 (tunable per camera-angle diversity in the dataset) |
| Slot-mapping | Precision/recall of vehicle-center → correct `ParkingSlot` assignment | ≥ 0.95 precision (a wrong slot assignment directly causes a false relocation alert) |
| Relocation detection | False-positive rate: relocations flagged that a human reviewer confirms were not real | < 2% of flagged events (tunable; false positives are the most user-visible failure mode) |

Datasets are versioned and stored alongside the harness (not the runtime edge repo), with a clear
separation between the **training/dev set** (used while tuning a model) and a **held-out
evaluation set** that is never used for tuning, to avoid overfitting the acceptance metric itself.
The harness runs as part of CI/CD (`21_Deployment`, `diagrams/ci-test-stage-pipeline.mmd`) whenever
a model artifact or calibration parameter changes, and its report is retained per model version so
regressions are visible over time (`diagrams/ai-eval-flow.mmd`). A model/pipeline change that fails
its threshold blocks promotion the same way a failing unit test would.

## Alternatives considered

- **Dedicated evaluation harness with fixed acceptance thresholds** (chosen).
  - Pros: makes AI quality a first-class, gated part of the release process instead of tribal
    knowledge or manual spot-checks; per-stage metrics isolate which component regressed (OCR vs
    detection vs tracking vs slot-mapping vs relocation logic) instead of only observing an
    end-to-end failure; the relocation false-positive threshold directly protects the
    notification/mobile-app user experience (`19_Notification`) from a noisy pipeline.
  - Cons: real upfront cost to build and curate labeled datasets per stage (plates, vehicles, slot
    maps, relocation scenarios) — this is nontrivial data-engineering work, not just test code;
    thresholds need calibration against real data before they are meaningful (the proposed numbers
    above are starting points, not final commitments).

- **Manual QA / spot-check before each model rollout** (closest to today's implicit practice).
  - Pros: zero harness-building cost; fast to start.
  - Cons: not reproducible, not regression-safe (a manual reviewer cannot reliably catch a 3%
    accuracy drop across hundreds of test images), does not scale as pipeline stages multiply
    (YOLOv5 → YOLOv11, single OCR → PaddleOCR + comparators, no tracker → ByteTrack); explicitly
    what the vision's "AI calibration" and quality goals are trying to move past.

- **End-to-end accuracy only (measure final `VehicleRelocated` correctness, skip per-stage
  metrics).**
  - Pros: simpler harness — one dataset, one metric, matches "what the user actually experiences."
  - Cons: when the end-to-end metric regresses, it does not say *why* (bad OCR? bad tracking? bad
    slot mapping?), making triage slow; per-stage metrics are strictly more actionable and this
    ADR does not forbid also tracking an end-to-end number as a top-line summary metric.

## Consequences

- Positive: model/pipeline changes are gated by objective, versioned metrics instead of
  subjective review; the relocation false-positive threshold gives a concrete, product-relevant
  quality bar tied directly to notification/UX quality; per-stage breakdown speeds up debugging
  regressions.
- Negative / trade-offs: building and maintaining labeled evaluation datasets is ongoing work (new
  camera angles, new plate formats, new site conditions all need dataset coverage over time); the
  initial thresholds in the table above are placeholders that need real measurement against the
  current YOLOv5 baseline and the new YOLOv11/PaddleOCR/ByteTrack components before they can be
  trusted as gates — shipping with an uncalibrated threshold risks either blocking good models or
  passing bad ones.
- Follow-ups: baseline the current YOLOv5 pipeline's own accuracy first (so "≥ existing baseline"
  in the OCR row has a real number); assemble the initial labeled datasets as a dedicated
  data-engineering task; decide dataset governance (who can add/approve eval-set images) before
  the harness becomes release-blocking in CI.
