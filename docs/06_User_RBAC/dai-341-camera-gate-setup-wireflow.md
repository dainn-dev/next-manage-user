# DAI-341 · Camera & Gate Setup Wireflow and Implementation Handoff

Status: **Design handoff** · Owner: Product Design / Principal Architect · Last updated: 2026-07-16

- Tracking: DAI-341 · Parent: DAI-331
- Actors: `TENANT_ADMIN`, assigned-site `SITE_MANAGER`; read-only operational health for
  `SECURITY_GUARD`
- Inputs: [DAI-332 permission matrix](permission-matrix.md),
  [DAI-333 IA standards](ia-interaction-standards.md),
  [DAI-335 Tenant Admin wireflow](dai-335-tenant-admin-wireflow.md),
  [DAI-336 Site Manager wireflow](dai-336-site-manager-wireflow.md), and
  [ADR-0602 camera credentials](adr/ADR-0602-edge-camera-credential-model.md)
- Related commissioning contract: [`../08_Parking_Map_Designer/README.md`](../08_Parking_Map_Designer/README.md)

## 1. Outcome and boundary

This document defines the end-to-end setup experience at
`Site → Thiết lập bãi đỗ → Camera & Gate`: create a physical camera, associate an ANPR camera with
a logical gate when applicable, enroll its edge appliance, prove health, validate its role-specific
output, and make an eligible `OVERVIEW` camera available to Parking Map Designer.

It is an implementation handoff, not a claim that every screen or API below exists. Existing camera
CRUD and one-time issue/rotate endpoints are reuse points; the selected-site gate model,
credential revoke/reason/audit, enrollment expiry, verification probes, replacement workflow, and
complete scoped UI remain DAI-341 runtime gaps. No permission is added here: DAI-332 remains
authoritative.

## 2. Actor and scope contract

| Actor | List / health | Configure camera or gate | Credentials | Scope rule |
|---|---|---|---|---|
| `TENANT_ADMIN` | Yes | Yes | Issue, rotate, revoke | Any active site in own tenant |
| `SITE_MANAGER` | Yes | Yes | Issue, rotate, revoke | Active site in server-resolved assignment only |
| `SECURITY_GUARD` | Assigned-site health/live preview only | No | Never | Assigned active site; operational route, no setup controls |
| `PLATFORM_ADMIN` | No tenant-ops access | No | Never | Platform role is not an implicit tenant identity |
| `MEMBER` | No | No | Never | Consumer shell only |

The browser-selected `siteId` is a request scope, never authority. The backend resolves tenant and
site access for every camera, gate, credential, snapshot, test, and audit resource. A missing,
disabled, cross-tenant, or unassigned site fails closed without issuing a downstream request. A
direct link preserves the requested resource only after access succeeds; otherwise return the actor
to its safe shell with a non-sensitive denial.

## 3. Domain language shown in the UI

| Object | Meaning | Relationship |
|---|---|---|
| **Physical camera** | Network video device plus edge enrollment and health lifecycle | Belongs to one site; optionally one zone |
| `ANPR_GATE` | Camera whose validated output is plate recognition at an entry or exit | Requires `entry` or `exit` and exactly one same-site logical gate |
| `OVERVIEW` | Camera used to validate coverage and author parking-map geometry | Has no entry/exit semantic and no gate mapping; becomes selectable only when eligible |
| **Logical gate** | Entry/exit control point used by access decisions and gate events | Same site as its mapped ANPR camera; not the camera itself |
| **Edge appliance** | Technical principal that consumes the one-time enrollment secret and emits heartbeat/snapshot | Bound to the camera credential and its immutable tenant/site/camera scope |

Changing role is not a cosmetic edit. Moving `ANPR_GATE → OVERVIEW` removes the gate association
only after confirmation; moving `OVERVIEW → ANPR_GATE` requires direction and an available same-site
gate. A gate already mapped to another active camera produces a blocking duplicate-mapping error.

## 4. Entry, list, and empty state

1. The operator chooses an allowed site from the shared selected-site control.
2. `Thiết lập bãi đỗ → Camera & Gate` opens with a site breadcrumb, health summary, filters, and
   `Thêm camera`.
3. The server returns only cameras and gates in that site. Switching site aborts old requests,
   closes any secret view, resets filters, and reloads scope.
4. With no cameras, explain the two roles and offer `Thêm camera`; do not render fabricated health.
5. Guards use the operational health destination instead. They see live/last-known state but no
   kebab menu, credential control, RTSP value, or setup CTA.

List rows show name, role, gate/direction or zone, lifecycle, snapshot freshness, last heartbeat,
and the next recovery action. RTSP credentials are always masked; the UI may display a safe host
label returned by the server, never reconstruct it from a secret URL in browser logs.

## 5. Add-camera wizard

### Step 1 — Identity and role

- Required: unique-in-site name and role `ANPR_GATE | OVERVIEW`.
- Explain role effects before proceeding.
- Preserve draft locally only while tenant/user/site match; discard it on logout or scope change.

### Step 2 — Connection and placement

- Required: supported RTSP/connection configuration; optional same-site zone.
- `ANPR_GATE`: require `entry | exit` and an unmapped, same-site logical gate. Creating a new gate
  may be offered inline only if the same authorization and audit rules apply.
- `OVERVIEW`: hide direction and gate fields; explain Parking Map eligibility requirements.
- Validate syntax client-side for fast feedback, then validate ownership, reachability policy, and
  uniqueness server-side. Never fetch arbitrary RTSP URLs from the browser.

### Step 3 — Review and provision

The review names the site, role, placement, and gate association. `Tạo & cấp thông tin enrollment`
creates an atomic `provisioned` camera/config draft and issues the first credential. If creation
succeeds but credential issuance fails, retain the camera in `provisioned` and offer `Cấp lại thông
tin enrollment`; do not silently create a duplicate camera.

### Step 4 — One-time credential reveal

Show the plaintext only in the successful issue/rotate response, in a modal that cannot be reopened:

- warning: `Chỉ hiển thị một lần`;
- camera/site fingerprint and expiry, never unrelated secrets;
- copy fields individually or download a narrowly scoped config only after an explicit action;
- `Tôi đã lưu an toàn` closes the view; closing early requires confirmation;
- clipboard success is not proof of enrollment, and the secret never enters toast text, URL,
  analytics, logs, persisted browser state, screenshots, or support payloads.

After dismissal, render only fingerprint, issued time, expiry/revocation state, and audit reference.

### Step 5 — Connect and verify

Display ordered progress driven by server facts:

1. Credential accepted by the expected camera principal.
2. Stream probe succeeds and a recent snapshot exists.
3. First heartbeat arrives within the enrollment window.
4. Role test passes: OCR sample for `ANPR_GATE`, coverage preview for `OVERVIEW`.

The state becomes `online` only from an authenticated heartbeat/health transition, not from a client
button. The operator may leave and resume from health detail without losing server progress.

## 6. Lifecycle and recovery

| State / fault | User-facing evidence | Recovery |
|---|---|---|
| Empty | No cameras in selected site | Start wizard |
| `provisioned` | Waiting for edge enrollment; expiry countdown | Copy during initial reveal, verify install, or issue a replacement after expiry |
| `online` | Fresh heartbeat and snapshot; last role test | Preview/test, edit safe metadata, open map setup when eligible |
| `offline` | Last heartbeat and timeout threshold | Check appliance/network/RTSP, retry probes, rotate only if compromise/mismatch is suspected |
| `disabled` | Explicit actor/time/reason; no active processing | Confirm re-enable; require fresh health before declaring online |
| Invalid RTSP | Sanitized probe category, timestamp, correlation ID | Edit connection and retry; never echo embedded credentials |
| Enrollment expired | Credential unusable; no secret reveal | Confirm and issue replacement; invalidate expired credential |
| Heartbeat timeout | Snapshot/heartbeat ages shown independently | Appliance checklist, retry, then escalation |
| No snapshot | Stream or decoder diagnostic without secret data | Retry probe or edit connection |
| Duplicate gate mapping | Conflicting gate name and safe camera reference | Select another gate or complete audited replacement |

Refreshing while a secret modal is open must not recover the plaintext. A `409` stale/config conflict
reloads current server state and preserves only non-secret draft fields for review.

## 7. Health detail and role tests

Health detail contains status, heartbeat age, snapshot age, sanitized stream diagnosis, edge version,
credential fingerprint/state, gate association, recent tests, and an operational event timeline.
Preview URLs must be short-lived and site-authorized. `Test OCR` shows a bounded sample and detection
result for ANPR cameras; it is absent for Overview. `Test coverage` shows a snapshot with coverage
guidance and commissioning resolution for Overview; it is absent for ANPR.

`SECURITY_GUARD` sees the subset needed to operate: status, fresh preview, direction/gate label,
last heartbeat and recovery/escalation guidance. It does not see RTSP configuration, credentials,
audit reasons unrelated to operations, edit controls, or map commissioning actions.

## 8. Sensitive and destructive actions

| Action | Confirmation and outcome |
|---|---|
| Rotate credential | Require nonblank reason and camera/site fingerprint; show replacement once; display previous-key overlap expiry; audit success/failure |
| Revoke credential | Require nonblank reason and explicit loss-of-connectivity warning; revoke before reporting success; audit in same transaction |
| Disable | Require reason and impact summary; stop processing while retaining history/mapping; audit |
| Re-enable | Confirm target; return to `provisioned`/health verification until fresh heartbeat, never directly claim online |
| Replace camera | Choose replacement in same site, review role/gate/map impact, provision replacement, validate it, then atomically transfer association and disable predecessor; rollback leaves predecessor active |

Deletion is not the normal lifecycle control. A camera referenced by a published map, access history,
or audit record is disabled/retired according to backend retention policy rather than hard-deleted.

## 9. Parking Map Designer eligibility

Only an `OVERVIEW` camera from the selected site is selectable as a map input when the server marks
it eligible. Minimum evidence is `online`, a fresh snapshot, successful coverage test, supported
resolution/stream metadata, and no disabled/replaced state. The map picker displays name, current
snapshot, freshness, resolution, zone/coverage label, and the reason for every ineligible row.

Eligibility is server-calculated and rechecked when a draft is opened, validated, and published.
Taking a source camera offline does not silently rewrite published geometry; the editor shows a stale
source warning and requires recovery or an explicit replacement workflow.

## 10. Responsive wireframes

The canonical screen composition is in
[`diagrams/dai-341-camera-gate-wireflow.mmd`](diagrams/dai-341-camera-gate-wireflow.mmd).

### Desktop — list and health detail

```text
┌ Tenant ops / Site A / Camera & Gate ─────────────── [Site A ▾] [Thêm camera] ┐
│ 2 online  ·  1 waiting  ·  1 offline        [Role ▾] [Status ▾] [Search]     │
├──────────────────────────────────────────────┬────────────────────────────────┤
│ Cam Entry 1  ANPR · Entry · Gate Bắc  Online│ Health: Cam Entry 1            │
│ heartbeat 18s · snapshot 25s             [⋯]│ Preview          [Test OCR]     │
│ Lot Overview  OVERVIEW · Zone A       Online│ Heartbeat 18s · Snapshot 25s    │
│ Map eligible                              [⋯]│ Credential ••••A91 · active     │
│ Cam Exit 2  ANPR · Exit · Gate Nam   Offline│ Timeline / diagnostics          │
│ heartbeat 14m                           [⋯]│ [Edit] [Rotate] [Disable]        │
└──────────────────────────────────────────────┴────────────────────────────────┘
```

### Tablet — list, wizard, credential, health

```text
┌ Site A ▾   Camera & Gate                         [+] ┐
│ [All] [ANPR] [Overview] [Needs attention]           │
│ Cam Entry 1 · Gate Bắc       Online · 18s        >  │
│ Lot Overview · Map eligible  Online · 25s        >  │
│ Cam Exit 2 · Gate Nam        Offline · 14m       >  │
└─────────────────────────────────────────────────────┘

Wizard/health opens as a full-height sheet: sticky Back/Close, one step per view, large touch
targets, persistent summary, and sticky primary action. Credential reveal is full-screen with no
background content or screenshot-friendly notification. Landscape may use list/detail split view;
portrait never compresses the form into a desktop table.
```

## 11. Runtime/API/component handoff

| Need | Existing foundation | Required target contract |
|---|---|---|
| Scoped inventory | `GET /api/cameras?siteId=...`; gate list is tenant-wide | Selected-site camera **and gate** query with server assignment checks and safe health summary |
| Create/update | Camera CRUD supports role, direction, zone and lifecycle | Atomic role validation, same-site gate mapping, connection secret handling, optimistic version |
| Credential | Issue and rotate return plaintext once | Enrollment expiry/fingerprint, reasoned rotate, revoke, audit reference, idempotency and no replay |
| Verify | Heartbeat/snapshot fields exist | Enrollment status and authorized server-side stream/snapshot probe; first-heartbeat transition |
| Tests | Pipeline and snapshots exist in separate flows | Bounded OCR/coverage test jobs with status, sanitized failure, correlation ID and retention |
| Lifecycle | Camera status exists | Reasoned disable/re-enable/replace; dependency-aware retirement; auditable state transitions |
| Gate model | Legacy Gate APIs and shared `X-Gate-Key` exist | Site-scoped logical gate resource and unique active ANPR mapping; no shared-key dependency |
| Map handoff | Commissioning accepts camera-owned drafts | Server eligibility projection and picker filtered to selected-site Overview cameras |
| Guard view | Camera read currently includes full DTO fields | Least-privilege operational DTO that omits RTSP/credential/config details |

Every mutation returns a durable outcome and audit reference. Audit records include actor, tenant,
site, camera/gate, action, reason when required, before/after non-secret metadata, result, timestamp,
and correlation/idempotency key. Secret material is excluded.

## 12. Acceptance checklist

- [ ] Happy path covers create → one-time reveal → edge connect → snapshot → first heartbeat →
  role test → online.
- [ ] Recovery covers invalid RTSP, expired enrollment, heartbeat timeout, missing snapshot, stale
  update, and duplicate gate mapping.
- [ ] Physical camera, `ANPR_GATE`, `OVERVIEW`, direction, logical gate, and edge appliance are not
  conflated in labels or data contracts.
- [ ] Tenant Admin and Site Manager scope is enforced by UI, route, service, repository/RLS, preview,
  test job, credential, and audit layers; Guard is read-only and least-privilege.
- [ ] Desktop and tablet list, wizard, one-time credential, and health detail states are covered.
- [ ] Rotate/revoke/disable/replace require the defined confirmation, reason, audit, and rollback
  behavior.
- [ ] Eligible Overview output is selectable in map/slot setup; ineligible reasons and stale source
  behavior are explicit.
- [ ] DAI-340 validates direct-link, cross-tenant/site, no-site, disabled-site, expiry, stale conflict,
  one-time secret, responsive, keyboard, focus, and accessible-status outcomes after implementation.

