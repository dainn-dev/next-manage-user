# 12. Vehicle Relocation — Detecting a Parked Vehicle That Moved Slots

This document defines how the platform detects that a vehicle already mapped to a parking slot
has moved to a different slot, and what happens once that is confirmed: a `VehicleRelocated`
domain event, an updated `Vehicle.current_slot_id`, a `ParkingHistory` record, and a
notification. **The runtime capability is greenfield**; the transition and event contract is now
defined for implementation.

Status: Runtime contract signed off (DAI-297) · Owner: Principal Architect · Last updated: 2026-07-14

## 1. Current State vs Target

### Current

The relocation runtime is not yet implemented, but its source data, identity rules, transition
guards, event fields, and evidence policy are now signed off in ADR-1102. The current edge path
still lacks the stable multi-object tracking needed to exercise this contract at runtime.

### Target

Rule (from the target vision, brief §2): **same reconciled identity but stable logical
`slot_id` changed ⇒ the backend emits `VehicleRelocated`**, updates `Vehicle.current_slot_id`, writes
`ParkingHistory(old_slot, new_slot)`, and save snapshots at both the old and new slot. This
depends directly on 11_Parking_Slot_Detection for the committed slot assignment and on
ByteTrack (10_AI_Pipeline) for track continuity.

## 2. Relocation Rule

For the current authoritative slot (`Vehicle.current_slot_id`), when a new slot assignment is
confirmed (post-debounce, above confidence threshold, per 11_Parking_Slot_Detection §5) for the
same identity, and the new `slot_id` differs from the current one, the event pipeline treats it
as a **relocation candidate**. It is only promoted to an emitted `VehicleRelocated` event once:

1. The new slot has been stable through the slot-mapping debounce window, **and**
2. The old slot is confirmed vacated (vehicle no longer detected there), **and**
3. It falls outside the identity-level dedup window since the last relocation for that identity
   (see ADR-1201).

See `diagrams/relocation-detection-flowchart.mmd` for the full decision tree.

## 3. Identity: track_id vs license_plate

| Signal | Durability | Availability | Role |
|---|---|---|---|
| `track_id` (ByteTrack) | Resets on occlusion, FOV exit, process restart; does not span cameras | Available every frame while tracked | **Primary** identity while continuous |
| `license_plate` | Durable across resets/cameras | Only when a legible OCR read exists (harder from `OVERVIEW` cameras than `ANPR_GATE`) | **Fallback** to re-bind identity when track is lost |

The identity-key choice and its trade-offs are formalized in **ADR-1201**, including the
proposed 60-second dedup window.

## 4. False Positives at Slot Boundaries

A vehicle parked near a slot boundary can cause the tracked footprint point to flicker between
two adjacent polygons frame-to-frame. Mitigations (building on 11_Parking_Slot_Detection's
debounce):

- Require the **new** slot to be stable for the full debounce window before considering it a
  candidate (not just a single-frame excursion).
- Require the **old** slot to be confirmed vacated — a simultaneous "occupied in both slots"
  reading is treated as jitter, not a relocation, until one clearly wins.
- This is effectively hysteresis: entering a new state requires more evidence than staying in
  the current one.

## 5. Track/Plate Reconciliation (track_id loss)

When ByteTrack loses a track (occlusion, the vehicle leaves the camera's field of view, or the
edge process restarts), the system attempts re-identification by plate:

1. Look at recent detections at the same site within a 30-second reconciliation window.
2. If the lost track had a legible plate read, search new/candidate tracks for an exact match.
   Fuzzy edit-distance ≤ 1 is allowed only when OCR confidence is at least 0.90 and there is one
   unique candidate in the window; otherwise the match is ambiguous and rejected.
3. On a match at the **same camera**, re-bind the identity and continue relocation logic under
   the new `track_id`.
4. On a match at a **different camera at the same site**, this is a cross-camera handoff — since
   each edge process only sees its own camera (brief §1: "one process == 1 gate"), this
   correlation happens at the **backend**, not on the edge.
5. If no plate is available or no match is found, the next detection is treated as a new,
   distinct identity — no relocation is inferred from thin air.

See `diagrams/track-plate-reconciliation-flowchart.mmd`.

## 6. Multi-Camera Handoff

Because the edge is architected as one process per RTSP stream (one camera/gate per process,
brief §1), a vehicle track can never be "the same track_id" across two cameras — track
continuity is strictly per-camera. Cross-camera identity continuity is therefore a **backend**
responsibility: the backend correlates two edge-reported tracks at the same site by matching
`license_plate` within a short handoff time window (adjacent zone traversal), not by any shared
`track_id`. This is a hard architectural constraint from how the edge is deployed today, and it
shapes the reconciliation design in §5 rather than being a simplification we chose for
convenience.

## 7. Data Written on Relocation

| Write | Target | Notes |
|---|---|---|
| `Vehicle.current_slot_id` | updated to new slot | Read model for "where is my car" |
| `ParkingHistory(old_slot, new_slot, occurred_at)` | inserted | Relocation trail, per brief §4 |
| Snapshot (old slot) | object storage | Evidence of vacated state |
| Snapshot (new slot) | object storage | Evidence of new occupied state |
| `VehicleRelocated` domain event | published to event bus | Drives history write + notification (transactional outbox, architecture decision 5) |

## 8. Notification Trigger

A confirmed `VehicleRelocated` event is the trigger for the driver-facing "your car moved / is
this expected?" notification flow — see 19_Notification for channel selection (push/email/WS)
and message composition. This document is only responsible for producing a trustworthy,
deduplicated `VehicleRelocated` event; notification delivery semantics live in 19_Notification.

## 9. Diagrams

- `diagrams/relocation-detection-flowchart.mmd` — full decision tree from a new confirmed slot
  assignment through identity resolution, debounce/dedup checks, to event emission and its
  side-effects.
- `diagrams/relocation-sequence.mmd` — edge → ingest → transactional outbox → event bus →
  `ParkingHistory` write + notification dispatch.
- `diagrams/track-plate-reconciliation-flowchart.mmd` — how a lost `track_id` is re-identified
  by plate, including the same-camera vs cross-camera-handoff branches.

## 10. Decisions / ADRs

- `adr/ADR-1201-relocation-identity-key.md` — identity key choice (`track_id` primary,
  `license_plate` fallback), reconciliation guard, and 60-second default dedup window.
- `../11_Parking_Slot_Detection/adr/ADR-1102-slot-runtime-and-event-contract.md` — normative
  relocation transition, event payload, transaction, and snapshot policy.

## 11. Open Questions / Risks

- The signed-off 60-second dedup default still needs validation against real reparking behavior;
  it is deployment-tunable and does not change the event schema.
- Cross-camera handoff is limited to the same site and a 30-second window. Camera adjacency can
  be added as a stricter deployment filter without weakening tenant/site isolation.
- Plate-based reconciliation quality is bounded by OCR accuracy, which is still under evaluation
  (10_AI_Pipeline, ADR-1001); a higher OCR error rate directly increases false-match risk here.
- "Stolen vehicle" framing for the notification (§8) needs a product decision on severity/copy
  that is out of scope for this document — flagged for 19_Notification.

## 12. Cross-References

- 11_Parking_Slot_Detection — supplies the committed slot assignment (and its debounce/
  confidence guarantees) that this document reacts to.
- 10_AI_Pipeline — supplies `track_id` (ByteTrack) and plate OCR reads used for identity
  resolution.
- 19_Notification — delivery of the "vehicle moved" notification once `VehicleRelocated` is
  emitted.
