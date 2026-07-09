# ADR-0702: One-process-per-camera edge model vs multi-stream worker pool

- Status: Proposed
- Date: 2026-07-09
- Deciders: Principal Architect
- Context doc: 07_Camera_Management

## Context

Today's edge service (`edge/edge/` — `EdgeService`, `DetectionCore`, `GateClient`, `EventQueue`)
is built around a strict **1 process : 1 RTSP stream : 1 gate** relationship: `cv2.VideoCapture`
opens exactly one stream, and each gate runs as its own OS process (or its own instance of the
legacy PyQt5 desktop app). This has been fine for a single-tenant deployment with a handful of
gates, each often on its own small host. The target platform introduces multi-camera-per-site
(§8 of this doc) and an "edge appliance" concept — one on-site host expected to serve an entire
site's cameras, potentially 5–20+ streams, without provisioning a separate machine per camera.
Running today's model unchanged at that scale means N independent processes, each loading its own
YOLO model weights into memory/GPU and running its own SQLite queue and heartbeat loop — wasteful
and operationally heavier than necessary.

## Decision

Move to a **multi-stream worker pool within a single supervisor process** per edge appliance: one
Python process manages a pool of per-camera worker units (thread or asyncio task per RTSP
stream for capture/decode), while GPU-bound inference (YOLO detection, OCR) is offloaded to a
small, shared pool of inference workers so model weights are loaded once and shared across
cameras rather than once per camera. Each per-camera worker keeps its own fault isolation
(a crashed/stuck stream is restarted independently and does not take down the supervisor or other
cameras' streams), preserving today's per-gate resilience characteristic without paying for it in
full process/memory overhead per camera.

## Alternatives considered

- **Keep strict one-OS-process-per-camera** — simplest mental model, closest to today's code,
  maximum fault isolation (a crash truly cannot affect another camera) — but does not scale
  memory/GPU usage sensibly once a site has more than a few cameras per appliance, and multiplies
  the number of independent SQLite queues/heartbeat loops to operate.
- **Fully shared single-threaded loop over all cameras** — cheapest resource-wise, but one slow or
  stuck RTSP source (a real, observed failure mode with consumer IP cameras) would stall every
  other camera on the appliance; unacceptable availability trade-off.

## Consequences

- Positive: one appliance can economically serve a full site's camera count; shared model loading
  reduces memory/GPU footprint significantly versus N full processes; per-camera fault isolation
  is retained at the worker-restart level.
- Negative / trade-offs: more complex supervisor code than today's single-purpose `EdgeService`;
  debugging a stuck worker inside a shared process is harder than debugging a stuck standalone
  process; requires careful GIL/async design in Python to avoid one camera's I/O starving others.
- Follow-ups: define the exact worker-restart/backoff policy; decide whether the SQLite
  store-and-forward queue stays per-camera or becomes per-appliance (leaning per-appliance, see
  §8); load-test the shared inference pool under a realistic multi-camera frame rate.
