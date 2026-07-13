# ADR-1201: Relocation Identity Key — track_id vs license_plate vs Both, and Dedup Window

- Status: Accepted by DAI-297
- Date: 2026-07-09
- Deciders: Principal Architect
- Context doc: 12_Vehicle_Relocation

## Context

None of this exists today. Today's edge "tracking" is only a per-plate-string dict of
first-seen/last-sent timestamps with cooldown/min-detection-duration confirmation — not a real
multi-object tracker — and there is no concept of a parking slot at all, so relocation detection
does not exist in any form today (brief §1).

In the target pipeline, ByteTrack assigns a `track_id` per camera stream, but `track_id` is
**not durable**: it resets on occlusion, when a vehicle leaves camera field of view, on edge
process restart, and does not span across cameras — the edge runs one process per camera/gate
(brief §1: "one process == 1 gate"). `license_plate` is durable across camera/track resets, but
OCR reads may be intermittent or wrong (partial reads, character misclassification), especially
away from the tuned `ANPR_GATE` camera angle versus an `OVERVIEW` camera used for slot coverage.

## Decision

Use **`track_id` as the primary identity key** while a track is continuous (cheapest, no OCR
dependency, works even when the plate is not legible from an overview angle), and **fall back to
`license_plate` matching** within the same site and a 30-second reconciliation window to re-bind
identity whenever the track is lost or a cross-camera handoff occurs. Exact plate match is
preferred. Edit-distance ≤ 1 is permitted only at OCR confidence ≥ 0.90 when a single unique
candidate exists; ambiguous matches are rejected. A relocation is only emitted when the
(`track_id` OR reconciled-by-plate) identity's slot assignment changes and passes the upstream
debounce (11_Parking_Slot_Detection). Apply an additional **identity-level dedup window**
(default: 60 seconds) after emitting `VehicleRelocated` for a given identity, before a
second relocation event can be emitted for it, to absorb residual jitter/oscillation at slot
boundaries.

## Alternatives considered

- **`track_id` only** — pros: simplest, no OCR dependency, cheapest. Cons: breaks on every
  occlusion, FOV exit, process restart, or camera handoff — exactly the scenarios relocation
  detection needs to survive in a real parking lot — which would under-report relocations.
- **`license_plate` only** — pros: durable, camera-independent. Cons: requires a legible plate
  read on every relevant frame, not guaranteed from overview cameras optimized for slot coverage
  rather than plate legibility; OCR noise (character confusions) could falsely merge or split
  identities; forfeits the frame-to-frame continuity ByteTrack already provides for free.
- **Both, `track_id` primary + plate fallback** (chosen) — pros: cheap in the common case,
  resilient fallback for the actual failure modes (occlusion, handoff, restart), matches how the
  two data sources are already produced by the pipeline. Cons: reconciliation logic (edit-distance
  matching, candidate time window) adds complexity and a tunable false-match risk if two visually
  similar plates are present at the same site during the reconciliation window.

## Consequences

The complete normative transition, transaction, event, and evidence contract is defined by
[ADR-1102](../../11_Parking_Slot_Detection/adr/ADR-1102-slot-runtime-and-event-contract.md).

- Positive: relocation detection survives the common tracker-loss scenarios instead of only the
  ANPR-gate case; the dedup window prevents notification spam from boundary jitter.
- Negative / trade-offs: false-match risk in plate reconciliation (rare but possible — e.g. two
  vehicles differing by one character both present at the same site); the dedup window trades
  off missing a genuine rapid re-relocation (e.g. a driver double-backs) for jitter suppression,
  and needs to be tunable per deployment.
- Follow-ups: tune the edit-distance threshold and reconciliation time window against real OCR
  error rates from the 10_AI_Pipeline eval harness (ADR-1001); define a per-tenant override for
  the dedup window; define the cross-camera handoff correlation window at the backend.
