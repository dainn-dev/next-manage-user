# DAI-338 · Member Wireflow and Implementation Handoff

- Status: Approved UX/design handoff
- Owner: Product + UX
- Security-boundary reviewer: Principal Architect
- Date: 2026-07-16
- Tracking: DAI-338 · Parent: DAI-331
- Inputs: [DAI-332 permission matrix](permission-matrix.md),
  [ADR-0603](adr/ADR-0603-platform-member-and-affiliation.md),
  [ADR-0604](adr/ADR-0604-platform-vehicle-and-tenant-registration.md),
  [ADR-0605](adr/ADR-0605-rbac-product-decisions-and-ux-permission-contract.md),
  [DAI-333 IA](ia-interaction-standards.md)
- Diagrams: [end-to-end wireflow](diagrams/dai-338-member-wireflow.mmd) ·
  [protected lifecycle/action sequence](diagrams/dai-338-member-protected-action-sequence.mmd)

## 1. Authority, identity model, and non-goals

A `MEMBER` is one platform-level identity that may have multiple tenant/site affiliations. Member
scope is self, owned vehicles, owned registration requests, active affiliations, owned Visit passes,
and claimed parking sessions. Selecting an organization/site or holding an affiliation never grants
Tenant Operations access.

The DAI-332 permission matrix remains authoritative. The new Member mutation/API contracts in this
document are DAI-339 targets and require corresponding permission-matrix/API-policy rows before
release.

### Explicit non-goals

- No Tenant Operations or Platform chrome, no operational site selector, and no role/admin actions.
- A Member request never directly creates an active `tenant_vehicle_registration`.
- Do not reuse operator vehicle or access-request forms/APIs as Member contracts.
- No `/notifications` route and no enabled notification bell until the matrix defines the route/action.
- No offline write queue and no native application requirement for MVP.
- No account deletion, privacy export, or affiliation erasure controls until retention, legal,
  active-pass/session, organization-impact, and audit contracts exist.

## 2. Mobile Member shell and navigation

| Destination | Route | Primary responsibility |
|---|---|---|
| Xe của tôi | `/me` | Owned platform vehicles and add/edit vehicle profile. |
| Đăng ký tại org | `/me/orgs` | Registration drafts, submissions, decisions, and active registrations. |
| Visit / QR | `/me/visit` | Create/receive Visit passes, present QR, and claim a parking session. |
| Lịch sử | `/me/history` | Registration, Visit-pass, and claimed-session history. |
| Tài khoản | `/me/account` | Profile, security, preference, and privacy summary. |

The Member shell uses a mobile app header and five-item labeled bottom navigation, never the
operations sidebar. Content includes bottom safe-area padding so fixed navigation does not cover
forms/actions. On wider screens, use a constrained readable column rather than an operator workspace.

- Primary targets are at least 44×44px, with at least 8px between adjacent actions.
- Status uses text/icons in addition to color.
- Forms, drawers, dialogs, and bottom navigation are keyboard accessible with visible focus.
- State transitions use accessible announcements and respect reduced motion.
- Operators opening `/me/*` return to `/dashboard`; Platform Admin returns to `/platform/overview`;
  a Member opening another shell is replaced to `/me`.
- A future dynamic detail page such as `/me/vehicles/[id]` must add DAI-332 and DAI-333 rows in the
  same change. This handoff keeps behavior inside the existing five route families.

The current global `ProtectedLayout` still renders desktop operations chrome around Member pages;
DAI-339 owns the mobile shell correction.

## 3. Personal vehicle journey

### 3.1 Garage

1. Load only vehicles owned by the authenticated Member.
2. Show plate, vehicle type, brand/model/color/year/photo, and independent organization registrations.
3. Empty state explains that no owned vehicle exists and offers `Add vehicle`.
4. Error/offline states retain safe cached rows only when labeled; ownership is always revalidated
   before detail/edit.

### 3.2 Add and edit

Recommended Member-editable fields:

- License plate at creation.
- Vehicle type.
- Brand, model, color, and year.
- Optional vehicle photo.

The normalized plate is the platform vehicle identity key and becomes read-only after creation.

| Condition | Required result |
|---|---|
| Same normalized plate already owned by current Member | Return/open the existing owned resource safely rather than creating a duplicate. |
| Plate claimed by another principal | Generic `409 PLATE_ALREADY_CLAIMED`; do not reveal owner or tenant details. |
| Edit another Member's vehicle | Non-disclosing `404`. |
| Validation failure | Preserve form data, show field error/summary, and focus the first invalid control. |
| Photo failure | Preserve vehicle text and previous photo; show per-file Retry/Remove. |
| Session expiry | Do not replay creation/update after login; require review and explicit submit again. |

The dedicated Member DTO omits employee/directory, tenant-operator, current operational site,
approval controls, and back-office fields. Vehicle ownership and organization registration are
separate dimensions: do not map a legacy vehicle `approved/rejected` value to registration status.

Current `/api/member/vehicles` and `/me` are read-only. DAI-339 owns the dedicated Member create/edit
and photo contract.

## 4. Organization/site selection and registration requests

A Member submits a **registration request**. Approval creates or activates the tenant/site
registration. A draft or pending request never creates an active whitelist registration.

### 4.1 Eligible organization/site discovery

The option endpoint does not list every platform tenant. It returns active sites that explicitly
allow Member self-registration, plus sites reachable through an authorized invite/affiliation.
Each option provides safe public/member-facing organization/site labels and versioned requirements.
Choosing it does not create affiliation or registration.

### 4.2 Target request resource

Recommended `member_vehicle_registration_request` fields:

- `id`, `memberUserId`, `vehicleId`, `tenantId`, required `siteId`.
- Lifecycle `status`.
- `requirementsVersion`, `submissionRevision`, optimistic `version`.
- Member-visible note and rejection/suspension reason.
- Nullable resulting `registrationId`.
- `createdAt`, `updatedAt`, `submittedAt`, `decidedAt`, `suspendedAt`.
- Attachment metadata/evidence IDs, never raw paths or signed URLs.

### 4.3 Request form flow

1. Choose eligible organization/site.
2. Choose an owned vehicle.
3. Load the site's current versioned requirements.
4. Enter required information.
5. Save a server-side draft.
6. Upload required evidence and wait for READY state.
7. Review organization, site, vehicle, requirements, and evidence.
8. Submit with optimistic version and idempotency key.
9. Track authoritative lifecycle and Member-visible outcome.

## 5. Registration lifecycle and CTA matrix

| Status | Meaning | Member CTA | Member mutation rule |
|---|---|---|---|
| `DRAFT` | Saved, not submitted | Continue editing · Save draft · Submit | Owner may edit draft and attachments. |
| `PENDING` | Submitted for organization review | View status | Immutable to Member during review. |
| `APPROVED` | Review succeeded and site registration is active | View registration | Member cannot alter the active registration through the request. |
| `REJECTED` | Correction requested or request declined | Edit and resubmit | Edit creates the next draft revision; resubmit increments `submissionRevision`. |
| `SUSPENDED` | Approved registration temporarily inactive | View reason · Contact organization | No Member self-reactivation. |

Required transitions:

```text
DRAFT -> PENDING
PENDING -> APPROVED
PENDING -> REJECTED
REJECTED -> DRAFT -> PENDING
APPROVED -> SUSPENDED
SUSPENDED -> APPROVED
```

A cancelled/withdrawn state may be added only with an explicit policy update; it is not one of the
five required DAI-338 lifecycle states.

### 5.1 Approval materialization

Reviewer approval atomically:

1. Revalidates Member/request ownership, vehicle ownership, tenant/site eligibility, current
   requirements version, attachment readiness, request status/version, and reviewer scope.
2. Creates/reactivates Member affiliation when needed.
3. Creates/reactivates the **site-scoped** `tenant_vehicle_registration`.
4. Marks request `APPROVED` and links its registration.
5. Writes lifecycle audit.
6. Persists required outbox/notification event.
7. Returns registration, request version, audit reference, and correlation ID.

Audit or required outbox-enqueue failure rolls back the protected transition. Later notification
delivery failure retries asynchronously without undoing completed approval.

The existing registration primary key is `(vehicleId, tenantId)` and updating a second site can
replace the first `siteId`. DAI-339 should evolve uniqueness to `(vehicleId, tenantId, siteId)` and
support registration status `ACTIVE | SUSPENDED | REVOKED` through a new forward-only Flyway
migration. Existing migrations are immutable. Suspending one registration must not remove unrelated
registrations or an otherwise valid tenant affiliation.

## 6. Draft, validation, and upload contract

### 6.1 Server draft and concurrency

- Server draft is the source of truth; do not store Member PII/evidence in local storage.
- Autosave approximately 800ms after inactivity and on field blur, while retaining an explicit
  `Save draft` action and `Last saved <time>` feedback.
- Use `If-Match` or equivalent versioning. A stale edit returns `409` and requires reconciliation.
- Submit/resubmit uses `Idempotency-Key`; same key/body returns original result, changed body conflicts.
- Validate on blur and submit; focus first invalid field and show a linked error summary for multiple errors.
- When `requirementsVersion` changes, preserve compatible fields but require review of changed
  requirements before submission.

### 6.2 Attachment defaults

| Rule | Target contract |
|---|---|
| Count | Maximum 3 evidence files per request by default. |
| Size | Maximum 10MB per file. |
| Types | JPEG, PNG, and PDF only; server MIME sniffing and malware scanning. |
| States | `UPLOADING`, `SCANNING`, `READY`, `FAILED`. |
| Submission | Required files must be `READY`. |
| Failure | Keep draft text and completed files; show per-file `Retry` and `Remove`. |
| Viewing | Authorized short-lived URLs, approximately 5 minutes. |
| Audit | Store attachment IDs/checksums, not signed URLs or raw paths. |

Upload and draft are independent operations. An upload failure cannot discard form text or previously
successful evidence.

## 7. Visit passes and QR presentation

Visit passes are distinct from claimed parking sessions.

### 7.1 Target Visit-pass model

```text
status:    ISSUED | ACTIVE | USED | EXPIRED | REVOKED
source:    SELF_CREATED | ORG_ISSUED
usePolicy: ONE_VISIT
scope:     one Member + one owned vehicle + tenant/site + optional gates/direction
```

Recommended defaults:

- One entry plus its matching exit.
- Four-hour default validity; 24-hour maximum.
- Presentation available 15 minutes before `validFrom`.
- Self-create only at an eligible site; receive an organization-issued pass through an opaque,
  single-use claim code.

### 7.2 Create or receive

**Create:** choose an eligible site, owned vehicle, and permitted validity window; review site/gate/
direction scope; create online with idempotency and ownership checks.

**Receive:** enter/follow an opaque single-use organization claim code; server validates recipient,
scope, expiry, and claim state before linking it to the current Member. No arbitrary URL or tenant ID
is trusted.

### 7.3 QR presentation

| Concern | Required behavior |
|---|---|
| QR content | Opaque token only; no plate, name, email, or other PII. |
| Token lifetime | 90 seconds. |
| Online refresh | Refresh after approximately 45 seconds. |
| Clock skew | Verifier allows at most 30 seconds. |
| Scope display | Show organization, site, optional gate/direction, vehicle, valid-from/to, pass status. |
| Offline | The current token may remain visible only until its explicit `expiresAt`; display countdown and Offline label. |
| Offline expiry | Replace QR with `Expired — reconnect to refresh`; never display indefinitely. |
| Pass expiry/revocation | Disable presentation and clearly distinguish pass expiry from token expiry. |
| Verification | Wrong owner, site, gate, direction, pass version, replay, expired/revoked/used pass fails. |

There is no offline pass creation, claim, mutation, or token refresh. Internal token/JTI values are
not returned in ordinary pass/session DTOs.

## 8. Existing parking-session claim

Parking-session claim remains a separate card/flow under `/me/visit`; it is not a Visit pass.

Recommended target claim code:

- Opaque, at least 128 bits of entropy.
- Hashed at rest.
- Single claim.
- Valid until session close or 24 hours after entry, whichever happens first.
- Never interchangeable with the parking-session UUID.

Invalid, expired, already-claimed, and unavailable outcomes use non-enumerating feedback. Current
implementation accepts a session UUID or raw QR JTI and exposes `qrTokenJti`; DAI-339 must replace
that contract rather than preserve it in the Member response.

## 9. Unified history and notification deep links

### 9.1 History

Recommended cursor API:

```http
GET /api/member/history?type=&cursor=&limit=20
```

Filters: All, Registrations, Visit passes, Parking visits. Each row contains only owned-resource
context, authorized organization/site labels, vehicle, lifecycle event, timestamp, and a safe detail
target.

### 9.2 Notification deep links

- Do not add `/notifications` or enable the current bell.
- Payload uses allowlisted `targetKind` and `targetId`, never an arbitrary URL.
- Frontend maps kinds to the existing Member route families, then reauthenticates/rechecks ownership
  before showing dynamic labels.
- Deleted, revoked, cross-owner, or unavailable targets use generic feedback and safe Member parent.
- Delivery, read, acknowledgement, and domain lifecycle statuses remain separate.

Recommended target kinds:

- `MEMBER_VEHICLE`
- `MEMBER_REGISTRATION_REQUEST`
- `MEMBER_VISIT_PASS`
- `MEMBER_PARKING_SESSION`
- `MEMBER_ACCOUNT_SECURITY`
- `MEMBER_PRIVACY`

Current notification storage/recipient selection is tenant/operator oriented and has no Member UI.
DAI-339 must add owner-aware Member delivery and matching matrix policy before deep links ship.

## 10. Account and privacy

Target `/me/account` sections:

- Profile: full name, locale, and timezone.
- Email change using a verified pending-email flow; current email remains until verification.
- Password/security handoff to the existing reset flow.
- Notification preferences only after Member delivery/policy exists.
- Privacy summary: active affiliations, registrations, data categories visible to each organization,
  and applicable privacy/retention links.
- Logout.

Do not render account deletion, personal-data export, or affiliation erasure controls until the
server can handle retention, active requests/passes/sessions, registration consequences, legal
requirements, and audit.

## 11. PII and multi-tenant boundary

| Data/action | Boundary |
|---|---|
| Profile/full plate | Current Member and explicitly authorized organization review workflow only. |
| Organization/site labels | Only from an authorized option, request, registration, pass, or session. |
| Reasons/notes | Member-visible rejection/suspension reason is allowed; internal reviewer note and privileged identity are omitted. |
| Attachments/photos | Ownership-scoped, short-lived access; never public paths. |
| Affiliation claim | JWT affiliation IDs are convenience data only; server checks target ownership/resource. |
| Tenant isolation | One tenant's rejection/suspension cannot alter another tenant/site request, registration, or affiliation. |
| Notifications | Minimal target context and allowlisted target kind; no arbitrary redirect. |

## 12. Recommended DAI-339 API handoff

These are target contracts, not shipped endpoints.

```text
GET    /api/member/vehicles
POST   /api/member/vehicles
GET    /api/member/vehicles/{vehicleId}
PATCH  /api/member/vehicles/{vehicleId}
POST   /api/member/vehicles/{vehicleId}/photo
DELETE /api/member/vehicles/{vehicleId}/photo

GET    /api/member/registration-options
GET    /api/member/registration-options/{siteId}/requirements
GET    /api/member/registration-requests
POST   /api/member/registration-requests
GET    /api/member/registration-requests/{requestId}
PATCH  /api/member/registration-requests/{requestId}
POST   /api/member/registration-requests/{requestId}/submit
POST   /api/member/registration-requests/{requestId}/resubmit
POST   /api/member/registration-requests/{requestId}/attachments
DELETE /api/member/registration-requests/{requestId}/attachments/{attachmentId}

GET    /api/member/visit-passes
POST   /api/member/visit-passes
POST   /api/member/visit-passes/claim
GET    /api/member/visit-passes/{passId}
POST   /api/member/visit-passes/{passId}/presentation

GET    /api/member/sessions
GET    /api/member/sessions/{sessionId}
POST   /api/member/sessions/claim

GET    /api/member/history
GET    /api/member/account
PATCH  /api/member/account
POST   /api/member/account/email-change
GET    /api/member/privacy-summary
```

Reviewer lifecycle targets:

```text
GET  /api/tenant-vehicle-registration-requests?siteId=&status=
POST /api/tenant-vehicle-registration-requests/{id}/approve
POST /api/tenant-vehicle-registration-requests/{id}/reject
POST /api/tenant-vehicle-registration-requests/{id}/suspend
POST /api/tenant-vehicle-registration-requests/{id}/reactivate
```

### Error semantics

| Response | Member behavior |
|---|---|
| `401` | Clear protected content, login, reauthorize target; never replay mutation. |
| `403` | Capability unavailable; safe Member landing. |
| Non-disclosing `404` | Resource not owned/reachable; no target details. |
| `409` | Stale version, changed idempotent request, duplicate/claimed plate, or lifecycle conflict. |
| `413` | File exceeds limit; draft remains safe. |
| `415` | Unsupported or mismatched media type. |
| `422` | Field, requirements, attachment, reason, or pass-window validation. |
| `503` | Required scan, audit, outbox, or authoritative dependency unavailable; no false completion. |

## 13. Shared states, risky actions, and handoff register

### 13.1 Screen states

| State | Required behavior |
|---|---|
| Loading | Preserve Member shell; local skeleton/progress with accessible announcement. |
| Empty | Explain no vehicles/requests/passes/history and show only authorized CTA. |
| Offline | Show cached owned data with label; no create/edit/submit/claim/presentation refresh mutation. |
| Upload failure | Preserve draft and successful evidence; per-file Retry/Remove. |
| Forbidden/non-disclosing | No resource detail; safe Member parent. |
| Stale/conflict | Reconcile server version before continuing; preserve safe local input. |
| Session expiry | Clear protected content; validated return path; no mutation replay. |
| QR token expired | Hide/replace QR; reconnect to issue a new presentation token if pass is still valid. |
| Pass expired/revoked/used | Disable presentation and show lifecycle-specific CTA/status. |

### 13.2 Protected actions

| Action | Confirmation / concurrency | Durable result |
|---|---|---|
| Create/edit vehicle | Ownership, normalized plate, optimistic version | Owned vehicle + version; no operator fields |
| Save request draft | Optimistic version/autosave | Draft/version/last-saved time |
| Submit/resubmit | Review + idempotency + requirements/version/READY files | `PENDING`, revision, audit/correlation outcome |
| Reviewer approve | Reviewer confirmation and scope | Atomic request + affiliation + site registration + audit/outbox |
| Reviewer reject/suspend/reactivate | Reason and current state/version | Lifecycle result + public reason + audit/correlation |
| Create/claim Visit pass | Ownership/site/window/code/idempotency | Pass status/scope/version; no raw credential |
| Issue presentation token | Active pass/owner/scope/version | Opaque token + explicit expiry |
| Claim parking session | Opaque single-use code | Owned session; no raw JTI in response |

### 13.3 Existing foundation and gaps

| Concern | Existing base | DAI-339 gap |
|---|---|---|
| Member shell | `/me` routes and sidebar groups | Mobile header/bottom nav; remove operations chrome |
| Garage | Member portal garage query | Member create/edit/photo and ownership-safe DTO |
| Registration | Affiliation and active tenant registration; access-request UI pattern | Distinct request model/states/drafts/site approval/atomic materialization |
| Visit/session | Session claim/history | Visit-pass model, safe claim code, presentation QR/expiry/offline |
| Notifications | Owner-like inbox primitives for operator notifications | Member recipient/resource/deep-link policy and frontend mapping |
| Account | Read-only profile and logout | Verified updates, security/privacy summary |
| Upload | Operator vehicle photo UI | Mobile draft attachments, scanning, per-file retry, no data loss |

## 14. DAI-340 validation handoff

DAI-340 must cover:

- Member wrong-shell redirects, safe deep links, expiry, and malicious return target rejection.
- Cross-Member vehicle/request/pass/session denial and cross-tenant/site status isolation.
- No affiliation/active registration at Draft or Pending; approval atomicity and audit/outbox rollback.
- Same vehicle across two tenants and two sites in one tenant without overwriting unrelated state.
- Rejected revision/edit/resubmit and suspended no-self-reactivation.
- Autosave/manual save/stale version/requirements change/session expiry.
- Upload count/size/type/MIME/scan failure, retry/remove, short-lived access, orphan cleanup.
- Visit create/receive eligibility, QR rotation/expiry/replay/site/gate/direction/version, offline-valid
  countdown, and offline-expired state.
- Parking-session code entropy/hash/single claim/expiry and rejection of session UUID credential.
- Notification target allowlist, ownership reauthorization, and absence of notification route/bell.
- Account email verification and owner-only privacy summary.
- 375px phone, landscape phone, tablet, safe area, 44px targets, focus order, first-error focus,
  `aria-live`, status contrast, and reduced motion.

## 15. Acceptance checklist

- [ ] Draft, Pending, Approved, Rejected, and Suspended each have clear meaning and Member CTAs.
- [ ] Member submission is a request and never directly activates tenant registration.
- [ ] Add/edit vehicle, server draft, validation, save, upload failure/retry, rejected edit/resubmit,
  and suspension are complete.
- [ ] Multi-tenant affiliation is created only through approved lifecycle and one tenant/site cannot
  alter another.
- [ ] Visit pass and parking-session claim are distinct; QR scope, expiry, offline-valid, offline-expired,
  pass expiry, and reconnect states are explicit.
- [ ] Notification deep links use target allowlists and ownership checks without a notification route.
- [ ] Account/privacy does not promise unsupported deletion/export.
- [ ] All target APIs/migrations are marked DAI-339 work, and existing Flyway migrations remain immutable.
