# ADR-1001: OCR Engine Selection — PaddleOCR vs Keep YOLOv5-Char vs EasyOCR/VietOCR

- Status: Proposed
- Date: 2026-07-09
- Deciders: Principal Architect
- Context doc: 10_AI_Pipeline

## Context

Today's OCR step is **not** a text-recognition model at all: it is a **second YOLOv5 model
that detects individual characters as bounding boxes** ("OCR-by-detection"), whose boxes are
then sorted left-to-right/top-to-bottom and assembled into VN 1-line or 2-line plate strings
by heuristics in `function/helper.py`. A 4-orientation deskew retry compensates for skewed
crops. Optional fallback engines — **EasyOCR, Tesseract, Google Vision** — exist behind guarded
imports but are not the default path.

The target pipeline needs an OCR step that is accurate on Vietnamese plate formats (1-line and
2-line), robust to blur/angle/lighting from lot-overview cameras (not just tuned gate cameras),
and fast enough to run within the per-stage latency budget on mixed CPU/GPU edge hardware
(see 10_AI_Pipeline README, "GPU/CPU Strategy & Latency Budget").

## Decision

Adopt **PaddleOCR** (detector + recognizer) as the **only production latency-path OCR engine**,
replacing YOLOv5-char as the default path. A configurable confidence threshold retains
low-confidence observations for debugging while the policy either rejects them from downstream
event consideration or explicitly accepts them as flagged. **EasyOCR** and **VietOCR** are
benchmark-only comparators run through the offline same-crop harness; their output never replaces,
votes on, or automatically falls back from PaddleOCR in production. Retire YOLOv5-char as a
runtime dependency only once PaddleOCR demonstrably reaches parity or better on the eval harness
(see README "Accuracy & Evaluation").

## Alternatives considered

- **Keep YOLOv5-char as primary** — pros: zero migration risk, already tuned to VN plates,
  single YOLO runtime shared with plate detection. Cons: character-by-character detection is
  brittle to skew/occlusion, requires bespoke assembly heuristics instead of a calibrated
  recognizer, no native confidence scoring beyond box scores, doesn't generalize well to noisier
  overview-camera shots the target pipeline must also handle.
- **PaddleOCR as sole/primary** (chosen) — pros: purpose-built detection+recognition OCR,
  strong recognition head, pretrained + fine-tunable on VN plates, active community, mobile/CPU
  inference variants available. Cons: new dependency and runtime, needs a VN-plate fine-tuning
  dataset, unproven accuracy vs the in-house-tuned YOLOv5-char until the eval harness runs.
- **EasyOCR or VietOCR as primary** — pros: EasyOCR is already an optional fallback today
  (lowest integration lift); VietOCR is purpose-built for Vietnamese text. Cons: EasyOCR is a
  heavier general-purpose PyTorch OCR not optimized for short plate strings (slower); VietOCR
  targets running/document text, not blocky plate glyphs; neither has VN-plate benchmarks here.

### Comparison table

| Engine | Type | VN plate tuning | Edge GPU speed | Edge CPU speed | Target role |
|---|---|---|---|---|---|
| YOLOv5-char (today) | detection + heuristic assembly | tuned in-house | fast | medium | keep as comparator / fallback |
| **PaddleOCR (PP-OCR)** | detector + recognizer | needs fine-tune | fast | fast (mobile models) | **new primary** |
| EasyOCR | general OCR | none | slow | slow | comparator only |
| VietOCR | seq2seq OCR (documents) | Vietnamese text, not plates | medium | slow | comparator only |
| Tesseract / Google Vision (today's other fallbacks) | general OCR | none | n/a | n/a | out of scope for target — Google Vision is a cloud dependency unsuitable for on-prem edge, Tesseract accuracy is too low for plates |

## Consequences

- Positive: a single well-supported production OCR core; deterministic low-confidence handling;
  offline comparators produce reproducible evidence without adding latency or divergent decisions
  to the edge worker.
- Negative / trade-offs: migration effort to package/fine-tune PaddleOCR on VN plate data;
  comparator benchmarks require separately provisioned dependencies, local model bundles, and a
  human-labeled day/night crop corpus.
- Follow-ups: assemble the VN plate corpus, run exact-match/CER/latency reports, define the
  promotion threshold and YOLOv5-char retirement criteria, and revisit runtime comparator policy
  only through a new approved ADR if benchmark evidence justifies it.
