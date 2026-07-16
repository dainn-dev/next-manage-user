# ADR-0901: Where calibration lives (edge config vs central backend, synced) and how it's versioned

- Status: Accepted with clarification by DAI-325
- Date: 2026-07-09
- Deciders: Principal Architect
- Approval date: 2026-07-16
- Context doc: 09_AI_Calibration

## Context

Today, calibration-adjacent tuning (`models.confidence_threshold`, `detection.cooldown`,
`detection.min_detection_duration`, `detection.frame_interval_ms`, etc. — see §1 of this doc) lives
entirely in a static, hand-edited local file, `edge/config.example.json`, per edge deployment.
There is no backend awareness of these values at all, no versioning, and no way for an operator
to change them without editing a file on the host and restarting the process. The target platform
needs per-camera calibration (ROI, motion sensitivity, OCR params, homography, day/night
profiles) that: (a) an operator sets once from a central UI (`08_Parking_Map_Designer`'s
calibration mode + this doc's wizard) rather than per-appliance file edits, (b) is consistent
across every edge worker serving that camera if the appliance model changes, and (c) still works
if the edge loses connectivity — the existing SQLite store-and-forward queue already establishes
that edge workers must tolerate being offline for extended periods.

## Decision

The **backend is the source of truth** for calibration. An immutable first-class calibration
version is the audit/history source; `Camera.calibration_json` is only the edge-facing cached
projection/pointer to the active version. A map publish pins the exact immutable calibration ID.
The **edge caches a local copy on disk** (extending today's
config-file-on-disk pattern rather than replacing it) and syncs by comparing versions on its
existing heartbeat call — pulling the full `calibration_json` only when the server's version is
newer, then hot-reloading its detection pipeline in place. If the edge is offline, it keeps
running on its last-cached calibration indefinitely; there is no hard requirement to reach the
backend to keep detecting, only to receive updates.

## Alternatives considered

- **Edge-authoritative config (today's model, kept as-is)** — simplest, zero backend changes, but
  makes centralized multi-camera/multi-site management impossible: every calibration change would
  require touching a file on a specific on-site host, which does not scale past the current
  single-tenant, few-gates deployment and gives operators no UI at all.
- **Backend-authoritative with real-time push (WebSocket/STOMP) instead of heartbeat-pull** —
  lower propagation latency for calibration changes, and STOMP already exists in the stack. But it
  adds a persistent-connection dependency to a workflow that must already tolerate the edge being
  offline for long stretches (store-and-forward queue); a pull-on-heartbeat model degrades
  gracefully to "eventually consistent, works offline" without extra machinery, which matches the
  edge's existing resilience posture better than a live push channel would.

## Consequences

- Positive: single place (backend) to audit and change calibration; edge behavior is
  deterministic and offline-tolerant by construction; versioning gives a cheap "did this change"
  check on every heartbeat with no extra round trip when nothing changed.
- Negative / trade-offs: calibration changes are not instant — propagation latency is bounded by
  the heartbeat interval (today 30s by default), which is acceptable for calibration (a
  low-frequency, operator-driven change) but would not be for anything latency-sensitive.
- Follow-ups: decide retention policy for calibration version history (this doc's wizard commits
  "current" only; whether full history is kept for audit/rollback is a `15_Database_Design`
  question); define the hot-reload contract inside the edge pipeline so applying a new
  `calibration_json` never drops in-flight detections.
