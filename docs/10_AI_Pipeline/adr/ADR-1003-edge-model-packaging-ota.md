# ADR-1003: Edge Model Packaging and OTA Update Strategy

- Status: Proposed
- Date: 2026-07-09
- Deciders: Principal Architect
- Context doc: 10_AI_Pipeline

## Context

Today, edge model weights (the vendored `ultralytics_yolov5_master` plus trained plate/char
weight files) ship as part of the edge deployment; the code has no versioning, registry, remote
update, or rollback mechanism — updating a model means redeploying the edge process/host. The
target pipeline adds more models (YOLOv11 vehicle, PaddleOCR plus EasyOCR/VietOCR comparators,
ByteTrack config) and, per the target vision, many on-site edge appliances across many tenants
and sites, each connecting **outbound only** (architecture decision 14). Manual per-site
redeploys do not scale and carry real risk — a bad model pushed everywhere at once with no
rollback path.

## Decision

Introduce a lightweight **model registry** (backend-hosted, versioned artifacts in object
storage per decision 7) that distributes **signed model bundles** (model file + metadata:
version, task, framework, checksum). Edge appliances **poll** (outbound-only, consistent with
decision 14) for new bundle versions, download and verify the checksum/signature, stage the
bundle locally, and hot-swap it only after passing a local health-check/warm-up inference.
Rollout is **staged** — canary a subset of sites/gates first, then widen — with automatic
rollback to the last-known-good bundle on health-check failure or an elevated error rate.

## Alternatives considered

- **Manual redeploy per site (today's implicit approach)** — pros: zero new infrastructure.
  Cons: does not scale past a handful of sites, no rollback safety net, blocks the eval/promotion
  workflow that ADR-1001 depends on.
- **Push-based update (backend pushes to edge)** — pros: faster propagation. Cons: requires
  inbound connectivity to on-site edge appliances, which conflicts with decision 14's
  outbound-only constraint for agents typically sitting behind NAT/firewalls.
- **Full container-image redeploy per model change** — pros: reuses the existing deployment
  pipeline, simpler mental model. Cons: couples unrelated model updates to full software
  releases, slows the OCR/vehicle-detector eval iteration loop, larger update payloads for
  bandwidth-constrained sites.

## Consequences

- Positive: safe, incremental model rollout decoupled from edge software releases; directly
  supports the shadow-eval/promotion workflow from ADR-1001; a rollback safety net limits
  blast radius of a bad model.
- Negative / trade-offs: new backend surface (registry API, artifact storage, signing); edge
  needs local staging storage and a health-check harness; staged rollout adds an operational
  approval process (who promotes canary to wide rollout, and when).
- Follow-ups: define the bundle manifest schema; define health-check/warm-up criteria that
  trigger auto-rollback; define canary site-selection policy; integrate per-site model config
  overrides with 07_Camera_Management and 09_AI_Calibration.
