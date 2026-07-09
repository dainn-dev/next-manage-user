# ADR-0701: Live-view transport (WebRTC vs HLS vs MJPEG)

- Status: Proposed
- Date: 2026-07-09
- Deciders: Principal Architect
- Context doc: 07_Camera_Management

## Context

Today the platform has **no live video path to the browser at all**: `Gate.cameraRtspUrl` is a
data-only field, and no frontend component consumes it. The target platform needs operators to
watch a camera's live feed from `/gate/[gateId]` (kiosk), a site dashboard, and eventually the
parking-map designer's "live overlay" mode. Requirements differ by consumer: the kiosk wants low
latency to correlate audio/TTS confirmation with what's on screen; a dashboard showing many
cameras at once cares more about scalability and bandwidth cost than sub-second latency; and some
clients (old browsers, constrained networks, embedded displays) may not support modern streaming
at all. RTSP itself cannot be played directly by a browser, so some gateway/transcode step is
mandatory regardless of the chosen transport.

## Decision

Use **HLS as the default transport**, delivered through a media gateway that re-packages each
camera's RTSP stream (the same stream the edge worker already opens for AI inference) into HLS
segments. Offer **WebRTC as an opt-in low-latency mode** specifically for the gate kiosk view,
where sub-second latency materially improves the operator experience. Keep **MJPEG as a
guaranteed-to-work fallback** for constrained clients or when the gateway/WebRTC path is
unavailable. The frontend Live-View player picks a transport based on the view context (kiosk
prefers WebRTC, dashboards prefer HLS) and falls back to MJPEG on failure.

## Alternatives considered

- **WebRTC everywhere** — lowest latency across the board, but higher operational complexity
  (SFU/TURN infrastructure, NAT traversal) and worse horizontal scalability for "many viewers, one
  camera" dashboard scenarios; overkill for non-kiosk views.
- **HLS everywhere** — simplest to scale (cacheable segments, works behind any CDN), but 2–6s
  latency is a poor fit for the kiosk's real-time confirmation use case.
- **MJPEG everywhere** — trivial to implement (already how many cheap IP cameras expose a
  browser-viewable stream) but high bandwidth per viewer and no adaptive bitrate; unsuitable as
  the sole transport at multi-tenant scale.

## Consequences

- Positive: each view picks the transport that matches its actual latency/scale trade-off instead
  of a one-size-fits-all compromise; MJPEG guarantees the feature degrades gracefully rather than
  failing outright.
- Negative / trade-offs: the frontend and media gateway must support three code paths instead of
  one, increasing implementation and testing surface.
- Follow-ups: pick and pin a concrete media-gateway product (e.g. MediaMTX) during
  implementation; define bandwidth/cost budgets per plan tier (ties into `10_Billing` /
  `03_SaaS_Architecture` limits such as "AI minutes"/site count).
