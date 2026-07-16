# DAI-337 · Security Guard Wireflow and Implementation Handoff

- Status: Approved UX/design handoff
- Owner: Product + UX
- Security-boundary reviewer: Principal Architect
- Date: 2026-07-16
- Tracking: DAI-337 · Parent: DAI-331
- Inputs: [DAI-332 permission matrix](permission-matrix.md),
  [ADR-0605](adr/ADR-0605-rbac-product-decisions-and-ux-permission-contract.md),
  [DAI-333 IA and interaction standards](ia-interaction-standards.md),
  [ADR-1703 realtime contract](../17_Dashboard/adr/ADR-1703-dashboard-rbac-realtime-contracts.md),
  [DAI-336 escalation precedent](dai-336-site-manager-wireflow.md)
- Diagrams: [end-to-end wireflow](diagrams/dai-337-security-guard-wireflow.mmd) ·
  [risky-action sequence](diagrams/dai-337-security-guard-risky-action-sequence.mmd)

## 1. Authority, role boundary, and non-goals

`SECURITY_GUARD` is an assigned-site, active-shift, locked-gate operational role. It may monitor
live gate activity, inspect and verify a named access exception, perform a server-authorized one-time
allow or deny override, escalate an unresolved event, and end the shift with an audited handover.

The DAI-332 permission matrix remains authoritative. This document defines target UX, state, API,
evidence, audit, and handoff defaults for DAI-339; it does not claim that the missing runtime
capabilities already exist.

### Guard authority

| Allowed | Explicitly prohibited |
|---|---|
| Assigned-site/gate live monitoring during an active shift | User, role, or site-assignment administration |
| Review operational exception evidence and recent same-site history | Vehicle or registration CRUD, approval, whitelist, or “remember this plate” |
| One-time `Allow once` or `Deny once` for one eligible access event | Gate, camera, zone, credential, map, billing, or configuration CRUD |
| Escalate an unresolved event through server-selected supervisors | Browsing Tenant Admin/Site Manager user directories or choosing privileged recipients |
| End shift with server-generated audited handover | Reusing an override for a future visit or changing access policy |

An override is not access-request approval. It affects exactly one named event/attempt. UI visibility,
the gate URL, a selected event, browser storage, or a realtime message never establishes authority;
the server verifies the current shift, site, gate, event version/state, and eligible action.

## 2. Route, shift, and locked-gate scope

### 2.1 Route model

- Guard lands at `/dashboard`, which contains a server-backed **Start or resume shift** surface.
- The management-oriented `/gate` discovery page remains Tenant Admin/Site Manager only.
- A confirmed shift enters `/gate/[gateId]` full-screen kiosk mode.
- The server-resolved active shift session determines tenant, site, and gate. A URL cannot switch
  the guard to another gate.
- A direct `/gate/[gateId]` URL succeeds only when it matches the active authoritative shift. A
  mismatch is unavailable without disclosing the other gate.
- Guard Back returns to `/dashboard`, not `/gate`.

The current frontend route policy blocks Guard gate routes and the kiosk Back link targets `/gate`.
These are DAI-339 conformance gaps, not the target behavior.

### 2.2 Recommended shift default

- One active gate shift session per guard.
- A guard never self-assigns an arbitrary gate. The start/resume surface displays only eligible
  server-returned assignments.
- Starting requires a review of shift window, site, gate, and locked operational scope.
- Reload/login recovery resolves the active session from the server; local storage is not proof.
- Gate scope is immutable for the session. Changing gate requires ending/handing over the current
  session and starting another eligible assignment.

### 2.3 Shift and assignment states

| State | Required behavior |
|---|---|
| No site assignment | Show `Chưa được gán site`; no shift, event, subscription, override, escalation, or handover mutation. Contact Tenant Admin guidance only. |
| Assigned site, no eligible shift | Explain that no shift/gate is currently assigned. Do not display tenant gate inventory. |
| One eligible shift | Show a fixed shift/site/gate review; confirm to start. |
| Multiple eligible assignments | Show only server-returned eligible shifts/gates with time/site/gate context. |
| Active shift | Offer Resume; revalidate site/gate/assignment before entering kiosk. |
| Shift not started or already ended | Show its current lifecycle state and eligible next action only. |
| Site or gate disabled | Stop subscriptions, clear event detail, and disable start/resume/override/escalation/handover submission as appropriate. |
| Assignment revoked during shift | Stop protected activity and return to unavailable/no-assignment state; do not preserve an executable pending action. |
| URL gate mismatch | Non-disclosing unavailable state, then active-shift context or `/dashboard`. |
| Session expiry | Stop realtime, clear protected detail, redirect to login, then reauthorize the shift; never auto-replay a mutation. |

## 3. Required journeys

### A. Login → confirm shift/gate → Live Monitoring

1. Authenticate and refresh canonical role, account status, tenant, assigned sites, and guard shift
   context.
2. If an active session exists, offer Resume after validating its active site/gate/assignment.
3. Otherwise show only eligible server-provided shift/gate assignments.
4. Confirm shift time, site, gate, and locked scope. Submit start with an idempotency key and pending
   lock.
5. Navigate to `/gate/[gateId]` only after the server returns the active shift session.
6. REST-bootstrap shift access events.
7. Connect authenticated STOMP and authorize the shift/session destination.
8. Subscribe, then immediately reconcile REST to close the bootstrap/subscription race.
9. Show `Live` only after reconciliation. Until then show Connecting/Reconnecting/Polling/Stale.

| State | Required behavior |
|---|---|
| Initial load | Stable dashboard shell; shift-context loading announcement. |
| No assignment / no shift | Distinct empty states from section 2.3. |
| Start conflict | Refresh authoritative shift context; same guard cannot silently create a second active shift. |
| Disabled/revoked | Stop workflow and show non-disclosing unavailable/recovery state. |
| REST/STOMP failure | Keep truthful degraded status; no override/escalation/handover mutation until authoritative state is fresh. |

### B. Live exception → authoritative detail drawer

The live feed distinguishes these states without conflating them:

- Automatically allowed.
- Automatically denied.
- Review required.
- Resolved by one-time override.
- Escalated and still open/acknowledged/closed.
- Unknown/stale and not safely actionable.

Selecting a review-required event opens a drawer/sheet without leaving kiosk mode. The drawer fetches
current detail by shift session and event ID; it does not trust only the realtime summary.

#### Exception detail content contract

| Field | Required behavior |
|---|---|
| Snapshot | Authorized short-lived/same-origin image, or explicit `No snapshot available`. |
| Plate | Observed text and normalized plate; do not silently replace one with the other. |
| OCR confidence | Numeric percentage plus informational label; never the source of action eligibility. |
| Direction/time | Entry/exit direction, occurred/received time where available. |
| Access status | `ALLOWED`, `DENIED`, `REVIEW_REQUIRED`, or `UNKNOWN`, with safe policy reason code/message. |
| Scope | Locked site and gate from the active server shift. |
| Resolution/escalation | Current resolution, override, and escalation state. |
| Recent history | Five recent same-normalized-plate events at the same assigned site within 24 hours by default. |
| References | Event ID, correlation ID, evidence IDs, version, gate sequence. |
| Actions | Render only server-returned `eligibleActions`; the browser does not infer them. |

Recent history shows time, gate, direction, access status, and resolution status. It excludes owner or
member contact data, employee directory fields, and registration-administration links.

### C. Verify → one-time manual override

1. Guard reviews evidence and selects `Allow once` or `Deny once` only when returned in
   `eligibleActions`.
2. Open elevated confirmation with event, observed/normalized plate, direction, current status,
   locked site/gate, selected final action, and evidence summary.
3. Require a trimmed nonblank reason and explicit evidence acknowledgement.
4. Lock duplicate submission; send expected event version and idempotency key.
5. Server verifies Guard role, active shift, site assignment, exact gate, event ownership/state,
   action eligibility, evidence references, and version.
6. In one transaction, persist final decision, immutable evidence references, one-time gate-command
   or outbox record when needed, and append-only tenant/site operational audit.
7. Return updated event, decision outcome, gate-command state, audit reference, correlation ID, and
   version. Show durable inline feedback only after this response.

A physical action has separate outcomes:

- Override recorded.
- Gate command queued.
- Gate command acknowledged.
- Gate command failed.

The UI must not say `Gate opened` merely because an allow override was recorded. Stale/already
resolved events return conflict and must refresh before another action. Audit or required outbox
failure fails the protected action and cannot produce success feedback.

### D. Escalate an unresolved event

Escalation never allows or denies access.

1. Open escalation from an eligible unresolved event.
2. Show event/site/gate/severity/evidence/current-state context.
3. Require a nonblank reason; safe note is optional.
4. Confirm with idempotency and pending lock.
5. Server verifies active shift, assigned active site, exact gate, source ownership, and escalation
   eligibility.
6. Server selects active Site Manager recipients first, with Tenant Admin fallback, without exposing
   a privileged user directory.
7. Persist escalation plus tenant/site audit and delivery/outbox handoff atomically.
8. Return escalation ID/status/outcome, audit reference, correlation ID, and time. Keep unresolved
   escalation in the final handover summary.

This reuses the DAI-336 operational escalation concept but requires a guard-specific eligibility and
shift linkage. Release requires a corresponding DAI-332 action/API-policy row.

### E. End shift → audited handover

1. Request a versioned, server-generated handover preview.
2. Show shift start/end target, site, gate, total events, exceptions, allow overrides, deny overrides,
   escalations, unresolved events, and references.
3. Counts and unresolved membership are authoritative and not editable.
4. Require a handover note when unresolved events/open escalations remain; otherwise note is optional.
5. Confirm end shift with preview version and idempotency key.
6. Server detects any event added/changed after preview. If stale, return conflict and require a new
   preview.
7. Atomically end shift, persist handover, append operational audit, and return handover ID, end time,
   final summary, audit reference, and correlation ID.
8. Stop subscriptions, clear kiosk detail, and return to `/dashboard`.

Audit failure leaves the shift active and does not show a completed handover.

## 4. Recommended DAI-339 target API contracts

These endpoints are **target contracts**, not current runtime endpoints.

| Concern | Recommended endpoint / behavior |
|---|---|
| Shift bootstrap | `GET /api/v1/guard/shift-context` returns current session and eligible assigned shift/gate records only. |
| Start shift | `POST /api/v1/guard/shifts/{shiftId}/start` with `Idempotency-Key`; shift determines site/gate. |
| Event bootstrap/replay | `GET /api/v1/guard/shift-sessions/{sessionId}/access-events?afterSequence=&size=30`; includes allowed, denied, review-required, escalated, and resolved events. |
| Event detail | `GET /api/v1/guard/shift-sessions/{sessionId}/access-events/{eventId}` with evidence, history, states, versions, and `eligibleActions`. |
| Override | `POST /api/v1/guard/shift-sessions/{sessionId}/access-events/{eventId}/override`. |
| Escalation | `POST /api/v1/sites/{siteId}/operational-escalations` with shift session and `sourceType=GATE_ACCESS_EVENT`. |
| Handover preview | `GET /api/v1/guard/shift-sessions/{sessionId}/handover-preview`. |
| End shift | `POST /api/v1/guard/shift-sessions/{sessionId}/end` with preview version, note, and idempotency key. |
| Realtime | Authenticated per-user/session destination such as `/user/queue/guard-shifts/{sessionId}/access-events`; authorize every subscription and redact before publication. |

### 4.1 Event states

Use independent dimensions rather than overloading one status:

```text
accessStatus:     ALLOWED | DENIED | REVIEW_REQUIRED | UNKNOWN
resolutionStatus: OPEN | RESOLVED
escalationStatus: NONE | OPEN | ACKNOWLEDGED | CLOSED
overrideDecision: ALLOW | DENY | null
eligibleActions:  OVERRIDE_ALLOW | OVERRIDE_DENY | ESCALATE
version:          integer resource version
gate sequence:    monotonically increasing value for gap detection
```

The server returns `eligibleActions`. OCR confidence, local UI state, or a role string does not create
an action.

### 4.2 Override request/result

Recommended request fields:

- `decision`: `ALLOW` or `DENY`.
- `reason`: trimmed 10–500 characters.
- `reviewedEvidenceIds`: immutable server-issued evidence references.
- `evidenceAcknowledged`: explicit true value.
- `expectedVersion`.
- `Idempotency-Key` header.

Recommended result fields:

- Updated event and version.
- Override ID and final decision.
- Gate command state: `NOT_REQUIRED`, `QUEUED`, `ACKNOWLEDGED`, or `FAILED`.
- `auditReference`, `correlationId`, actor/time, and safely returned evidence references.

The same idempotency key/body returns the original result; a changed body conflicts.

### 4.3 Evidence and confidence defaults

- MVP evidence normally uses immutable server-issued recognition snapshot/event references; no guard
  file upload.
- Audits store evidence IDs, not temporary signed URLs or raw filesystem paths.
- OCR confidence labels are informational:
  - High: `≥ 90%`
  - Review: `75–89%`
  - Low: `< 75%`
- Thresholds do not determine override eligibility.

### 4.4 Error semantics

| Response | Meaning and UI behavior |
|---|---|
| `401` | Session expired/invalid; stop realtime and reauthenticate. |
| `403` | Authenticated principal lacks a visible capability. |
| Non-disclosing `404` | Shift, gate, event, site, or evidence is outside assignment/current session. |
| `409` | Stale event version, already-resolved event, active-shift conflict, duplicate changed idempotent request, or stale handover preview. Refresh authoritative state. |
| `422` | Reason or evidence acknowledgement is invalid. Keep dialog open and focus the invalid control. |
| `503` | Required audit, outbox/command, or authoritative dependency unavailable. Do not present action as completed. |

## 5. Realtime and degraded-state contract

| State | Meaning and permitted behavior |
|---|---|
| Connecting | REST bootstrap or STOMP setup in progress. No final mutation. |
| Live | Healthy authorized subscription plus successful reconciliation. |
| Reconnecting | Subscription unavailable; current data marked non-live. |
| Polling | REST fallback active; show cadence/freshness. |
| Stale — updated `<time>` | Disconnect, sequence gap, or failed reconciliation. No action until selected event/preview is freshly reconciled. |
| Offline | No authoritative REST or realtime connection. Override, escalation, and handover submission disabled. |
| Reconciled | REST caught up and versions/sequences are consistent; may return to Live after subscription health. |

Required sequence:

1. REST bootstrap.
2. Authenticated STOMP `CONNECT` and authorized shift subscription.
3. Immediate REST reconciliation after subscribe.
4. Deduplicate by event ID and ignore older versions.
5. Detect gate-sequence gaps.
6. On disconnect/gap, mark stale; use 15-second visible/60-second hidden polling if REST works.
7. Restore `Live` only after healthy subscription and reconciliation.

There is no offline write queue. Session expiry or reconnect never replays an unsubmitted/pending
allow, deny, escalation, or handover automatically.

## 6. Guard PII and evidence boundary

### Operationally permitted

- Full observed/normalized plate for the active exception.
- Authorized recognition snapshot/evidence.
- OCR confidence, gate, direction, access/policy status, event state, and same-site recent history.
- Event/version/sequence/correlation/audit references needed for safe action and handover.

### Omitted

- Owner/member/employee phone, email, contact, department, rank, position, or directory profile.
- Registration/whitelist administration, vehicle CRUD links, or tenant user links.
- Raw RTSP URLs, camera/gate credentials/API keys, raw storage paths, unrestricted media URLs.

Snapshots use authorized short-lived or same-origin access. The current kiosk/legacy monitoring model
includes driver/unit and broader employee fields; it is not the target Guard redaction contract.

## 7. Kiosk/tablet, keyboard, and accessibility behavior

- Landscape tablet and kiosk desktop are primary; small phone is recovery-only.
- Touch targets are at least 44px; statuses use high contrast, text/icons, and not color alone.
- Locked gate/site/shift and connection freshness remain visible.
- Event feed and drawer support Tab, Shift+Tab, Enter, Space, and Escape.
- Opening drawer focuses its heading. Closing/cancelling/failure returns focus to the originating event.
- Confirmation traps focus and returns it appropriately. No single key or unconfirmed shortcut can
  execute allow/deny.
- Drawer becomes full-height tablet sheet while preserving field/action order.
- `aria-live` announces loading, reconnecting/stale, reconciliation/recovery, action outcome, and
  expiry without repeatedly interrupting the operator.
- Reduced-motion users receive status updates without animation dependency.

## 8. Risk, confirmation, evidence, and audit matrix

| Action | Scope / target | Confirmation / reason / evidence | Concurrency / server checks | Durable result |
|---|---|---|---|---|
| Start shift | Eligible assigned shift/gate | Review shift/site/gate; confirm | Idempotency; role/assignment/site/gate/lifecycle; one active session | Shift session, scope, start time, correlation reference |
| Allow once | One eligible open event | Elevated confirm; required reason; evidence acknowledgement | Event version/idempotency; active shift/exact gate/eligibility | Override/event outcome, gate-command state, audit/correlation reference |
| Deny once | One eligible open event | Elevated confirm; required reason; evidence acknowledgement | Event version/idempotency; active shift/exact gate/eligibility | Override/event outcome, audit/correlation reference |
| Escalate | One eligible unresolved event | Confirm + required reason | Idempotency; active shift/site/source eligibility; recipient selection server-side | Escalation status, audit/correlation reference |
| End shift/handover | Active shift and versioned preview | Confirm; note required with unresolved/open escalations | Preview version/idempotency; active shift; audit atomicity | Handover ID/summary/end time/audit/correlation reference |

For protected mutations, audit/outbox failure fails the transaction and preserves the prior state. A
toast may supplement but cannot prove completion.

## 9. DAI-339 route/API/component handoff

| Surface / action | Target route/API | Permission and scope | Existing base | Runtime gap |
|---|---|---|---|---|
| Shift start/resume | `/dashboard`; guard shift-context/start APIs | G; eligible assigned shift only | Auth/site scope foundation | No shift/gate assignment/session model or safe return path |
| Kiosk | `/gate/[gateId]`; shift event APIs | G; active session exact gate | Existing GateKiosk | Current route/API blocks G, wrong Back target, insufficient data/redaction |
| Event feed/replay | Shift access-events API + user/session STOMP | G; active session | Gate recent replay, dashboard events | Replay excludes pending/denied; no secure STOMP/session sequence contract |
| Exception drawer | Event detail API | G; active shift event | Event page and request evidence patterns | No exception state/detail/confidence/history/eligible actions |
| Override | Event override API | G; one eligible event | Dialog/decision pattern | No endpoint, state machine, evidence/outbox/audit/command outcome |
| Escalation | Operational escalation API | G; eligible active-shift source | DAI-336 design | No matrix policy row, resource, recipients, outbox, audit outcome |
| Handover | Preview/end APIs | G; active shift | None | No server summary/version/handover/audit model |
| Realtime status | Authenticated session destination | G; active session | `useWebSocket`, dashboard realtime | Empty auth headers, open WS matcher, no subscription auth/stale reconciliation |
| Operational audit | Tenant/site audit result/read contract | G actor; assigned site | Platform/billing audit examples only | No append-only operational audit for override/handover |

### Current gaps to expose, not mask

- Guard frontend route policy does not allow the target kiosk path.
- Gate metadata/health/recent-check APIs are Tenant Admin/Site Manager only.
- Existing replay contains approved log rows only, not pending/denied/review-required exceptions.
- Existing kiosk event lacks event/site/gate/snapshot/confidence/access reason/resolution/version/action
  eligibility/history/correlation fields.
- No shift assignment/session, start/resume/end, or handover model exists.
- No override or guard escalation endpoint, gate-command outcome, or operational audit exists.
- Legacy kiosk STOMP sends no auth headers; `/ws/**` and subscriptions are not authoritatively secured.
- Connected/disconnected does not satisfy explicit stale/reconciliation semantics.
- Current event/monitoring data does not enforce the target Guard PII boundary.

DAI-339 owns runtime/API/schema/component implementation. Any required migration must be new and
forward-only; existing Flyway migrations remain immutable. DAI-340 owns direct-link, cross-site,
shift/gate, realtime, keyboard/touch, redaction, conflict, audit-failure, and handover validation.

## 10. Acceptance checklist

- [ ] Login, shift/gate confirmation, monitoring, drawer verification, override, escalation, and
  handover have happy, empty, unavailable, stale/conflict, failure, expiry, and recovery paths.
- [ ] Drawer includes snapshot, observed/normalized plate, OCR confidence, access status/reason,
  recent same-site history, event/correlation/version, and server-returned actions.
- [ ] Allow/deny are one-event, one-time, confirmed, reasoned, evidence-bound, versioned,
  idempotent, and audited atomically.
- [ ] Handover is server-generated/versioned, requires unresolved-note when necessary, and is audited.
- [ ] Disconnect, Reconnecting, Polling, Stale, Offline, Reconciled, and Live are distinct; no offline
  mutation path exists.
- [ ] Kiosk/tablet/keyboard/focus/44px/contrast/`aria-live` requirements are explicit.
- [ ] Guard has no CRUD/configuration/access-request approval or privileged-directory access.
- [ ] Target APIs are clearly marked DAI-339 contracts rather than shipped behavior.
