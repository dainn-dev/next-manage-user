# ADR-1002: Add YOLOv11 Vehicle Detection Stage with Motion-Gating

- Status: Proposed
- Date: 2026-07-09
- Deciders: Principal Architect
- Context doc: 10_AI_Pipeline

## Context

Today the edge pipeline runs plate detection (YOLOv5) directly on every throttled frame
(`frame_interval_ms` ~200ms) with no upstream vehicle-presence or motion filter — the GPU/CPU
pays the plate-detector + char-detector cost on every frame even when the scene is empty or
unchanged (e.g. an idle gate at night). There is also no dedicated vehicle-level bounding box
(car/motorbike) today — only plate boxes — so nothing in the current pipeline identifies
vehicle presence independent of a legible plate, which the target pipeline needs as the anchor
for ByteTrack tracking and parking-slot mapping (see 11_Parking_Slot_Detection). Architecture
decision 8 (brief §3) calls for OpenCV MOG2 motion detection as a GPU-saving gate plus a new
YOLOv11 vehicle-detection stage.

## Decision

Insert two new stages ahead of plate detection: (1) an **OpenCV MOG2** background-subtraction
motion detector runs on every captured frame (cheap, CPU-only) and only forwards frames with
motion above an ROI-configurable threshold; (2) a **YOLOv11** vehicle detector (car/motorbike
classes) runs only on motion-gated frames, producing vehicle bounding boxes that anchor plate
detection crops, ByteTrack tracking, and parking-slot mapping.

## Alternatives considered

- **No motion gate, run YOLOv11 on every frame** — pros: simplest, no missed detections from a
  misconfigured ROI. Cons: wastes GPU on empty scenes, does not scale to always-on lot-overview
  cameras (versus today's gate-triggered use case), higher device cost/thermal load for 24/7
  on-site appliances.
- **Skip YOLOv11, keep the plate-detection-only pipeline** — pros: no new model, no extra
  latency. Cons: no vehicle-level anchor for ByteTrack/slot-mapping when the plate isn't visible
  from an overview angle, no car/motorbike classification for occupancy analytics, no path to a
  `PersonDetected` event.
- **YOLOv8 instead of YOLOv11** — pros: more mature/battle-tested. Cons: the target vision
  (brief §2/§3) explicitly specifies YOLOv11; no material benefit identified to deviate.

## Consequences

- Positive: GPU spend scales with actual scene activity instead of a fixed frame rate;
  vehicle-level bounding boxes give a stable tracking anchor independent of plate legibility;
  unlocks parking-slot mapping and person-presence detection.
- Negative / trade-offs: MOG2 needs per-camera ROI/sensitivity tuning (risk of false negatives
  on slow-moving vehicles, false positives on lighting changes/shadows/rain); adds a pipeline
  stage and latency; two GPU-resident detection models (YOLOv11 + YOLOv5 plate) plus OCR now
  share the same edge process's memory/compute budget.
- Follow-ups: define the per-camera MOG2 tuning procedure (coordinate with
  09_AI_Calibration), define ROI/ignore-zone configuration, measure false-negative rate on
  slow-entry vehicles before relying on the gate for production traffic.
