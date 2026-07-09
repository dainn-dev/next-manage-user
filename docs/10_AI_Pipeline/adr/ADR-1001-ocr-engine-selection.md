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

Adopt **PaddleOCR** (detector + recognizer) as the **primary** OCR engine, replacing YOLOv5-char
as the default path. Keep the existing YOLOv5-char model and add **EasyOCR** and **VietOCR** as
**comparators** running in shadow mode against PaddleOCR to (a) build a labeled accuracy/eval
dataset continuously and (b) provide a confidence-based fallback vote when PaddleOCR's
confidence is below threshold. Retire YOLOv5-char as a runtime dependency only once PaddleOCR
demonstrably reaches parity or better on the eval harness (see README "Accuracy & Evaluation").

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

- Positive: a single well-supported OCR core going forward; shadow-mode comparators produce
  continuously labeled eval data; confidence-based fallback preserves accuracy while PaddleOCR
  is being fine-tuned.
- Negative / trade-offs: running comparators in shadow mode costs extra CPU/GPU cycles
  (mitigated by motion gating, see ADR-1002, and by sampling comparators at a reduced rate
  rather than every frame); migration effort to fine-tune PaddleOCR on VN plate data; temporary
  complexity of up to four OCR paths running concurrently during the transition.
- Follow-ups: define the eval harness and metrics (character error rate, exact plate-match
  accuracy, per-orientation accuracy); assemble a VN plate fine-tuning dataset; define the
  promotion threshold for making PaddleOCR sole primary and the retirement criteria for
  YOLOv5-char; decide the comparator sampling rate in production.
