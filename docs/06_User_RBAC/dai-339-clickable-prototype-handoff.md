# DAI-339 · Clickable Prototype and Implementation Handoff

Status: **Review ready** · Owner: Product Design / Frontend / Platform · Last updated: 2026-07-16

- Tracking: DAI-339 · Parent: DAI-331
- Prototype: [`prototype/dai-339/index.html`](prototype/dai-339/index.html)
- Authority: [DAI-332 permission matrix](permission-matrix.md) and
  [DAI-333 IA standards](ia-interaction-standards.md)
- Role inputs: [Platform Admin](dai-334-platform-admin-wireflow.md),
  [Tenant Admin](dai-335-tenant-admin-wireflow.md),
  [Site Manager](dai-336-site-manager-wireflow.md),
  [Security Guard](dai-337-security-guard-wireflow.md), and
  [Member](dai-338-member-wireflow.md)

## 1. Review instructions and prototype boundary

Open `prototype/dai-339/index.html` in a browser. Choose a role, critical path, and API state; use
the primary action or numbered steps to navigate. The prototype is static and intentionally calls
no API. `Approve prototype` and `Review` store local-only review status/change requests in browser
`localStorage`; approval is evidence for a review session, not product authorization or issue
closure.

The prototype validates shared navigation, scope language, terminology, responsive priority, and
success/pending/failure behavior. It does not claim that target DAI-337/338 APIs or audit flows are
implemented. The matrices below are the development and QA handoff.

## 2. Canonical shells, navigation, and terminology

| Shell | Roles | Primary device | Landing | Scope language |
|---|---|---|---|---|
| Platform | `PLATFORM_ADMIN` | Desktop | `/platform/overview` | `Platform-wide`; never a tenant selector |
| Tenant Operations | `TENANT_ADMIN`, `SITE_MANAGER` | Desktop, tablet secondary | `/dashboard` | `Selected site`; Manager labels assignment explicitly |
| Guard kiosk | `SECURITY_GUARD` | Landscape tablet | shift confirmation → `/gate/{gateId}` | `Locked · {gate}` inside active assigned-site shift |
| Member self-service | `MEMBER` | Mobile-first | `/me` | Personal ownership/affiliation/claimed visit; no ops selector |

Canonical nouns are `Platform`, `Tenant`, `Site`, `Zone`, physical `Camera`, logical `Gate`,
`Parking map`, `Slot`, `Access request`, `Event`, `Shift`, `Member`, and `Visit pass`. Vietnamese UI
copy uses `Site` consistently until a product-wide localization decision replaces it; do not mix
`chi nhánh`, `khu vực`, and `site` for the same selector within one journey. API enums remain in
English/code style and are translated at the UI boundary.

## 3. Screen inventory

| ID | Role / screen | Route | Device priority | Critical state coverage |
|---|---|---|---|---|
| P-01 | Platform overview | `/platform/overview` | Desktop | loading, empty, partial KPI failure, success |
| P-02 | Tenant directory/detail | `/platform/tenants`, `/platform/tenants/{id}` | Desktop | unavailable scoped ID, lifecycle pending/failure/success |
| P-03 | Platform audit outcome | `/platform/audit` | Desktop | empty, filter loading/error, durable result |
| A-01 | Tenant queue-first dashboard | `/dashboard?site={siteId}` | Desktop | no site, loading, stale/reconnecting, success |
| A-02 | Access request list/detail/decision | `/vehicles/requests` | Desktop/tablet | empty, stale conflict, pending, denied, success |
| A-03 | Users/sites/organization | `/users`, `/sites`, `/settings/organization` | Desktop | validation, conflict, pending, failure, success |
| A-04 | Commissioning editor/publish | `/parking/commissioning` | Desktop/tablet | dirty, autosaving, conflict, invalid, publishing, success |
| M-01 | Assigned-site dashboard | `/dashboard?site={siteId}` | Desktop/tablet | no assignment, disabled site, stale/live |
| M-02 | Event detail/escalation | `/events` | Desktop/tablet | empty, stale event, pending, failure, success |
| G-01 | Shift/gate confirmation | target `/guard/shifts`; kiosk `/gate/{gateId}` | Tablet | no assignment, wrong gate, expired/active shift |
| G-02 | Live monitoring/exception detail | `/gate/{gateId}` | Tablet | live, reconnecting, stale, evidence unavailable |
| G-03 | Allow-once/escalate/handover outcome | target Guard APIs | Tablet | eligibility lost, pending, command failed/acknowledged |
| U-01 | Member garage | `/me` | Mobile | empty, loading, owned rows, validation failure |
| U-02 | Registration request lifecycle | `/me/orgs` plus target request detail | Mobile | draft/upload, pending, approved/rejected/suspended |
| U-03 | Visit claim/QR | `/me/visit`, `/me/visit/{sessionId}` | Mobile | invalid/expired, offline-valid, offline-expired, success |
| U-04 | History/account | `/me/history`, `/me/account` | Mobile | empty, loading/error, privacy-safe success |

## 4. Component inventory

| Component | Shared contract | Current foundation / target |
|---|---|---|
| `AppShell` | Platform, Tenant Operations, Member are distinct shells | Existing layouts; extract role-aware shell without shared nav leakage |
| `ScopeSelector` | URL-synchronized, user/tenant-keyed persistence, zero/one/many states | Dashboard scope context/topbar; add assignment/status and fail-closed changes |
| `Breadcrumbs` | Authorized labels only; safe deep-link fallback | Target shared component |
| `AsyncState` | loading, empty, error, forbidden, offline, stale, recovered | Consolidate local page states and `ErrorBoundary` |
| `ConnectionStatus` | polling/reconnecting/stale/last-updated; never false live | Extend realtime hook semantics |
| `ResourceList` | Desktop table and tablet/mobile card alternative | Reuse table/card primitives; preserve accessible headers |
| `DetailDrawer` | Route-safe detail, focus trap/return, current version/actions | Existing dialog/sheet primitives; standardize |
| `DecisionDialog` | target/scope/effect, reason policy, pending lock, server outcome | Existing approval dialog pattern |
| `RiskConfirmation` | destructive/elevated confirmation and audit result | Target shared component |
| `AuditOutcome` | result, reference, correlation, timestamp; excludes secret data | Target shared pattern |
| `EvidenceViewer` | bounded PII, snapshot unavailable state, keyboard zoom/description | Target Guard/request component |
| `MemberBottomNav` | five Member destinations only | Existing Member layout; mobile-first completion |
| `GuardKioskShell` | locked gate, shift, live health, 44px targets, no sidebar | Existing gate page; target shift/override states |
| `CommissioningEditor` | dirty/autosave/conflict/validate/publish history | Existing `/parking/commissioning`; DAI-342 completion |

## 5. Shared state matrix

Every screen resolves access, data, connection, and mutation state independently.

| State | Required presentation | Action rule |
|---|---|---|
| Loading | Stable shell and labeled skeleton/progress | No dependent action |
| Empty | Explain exact scope and what can create data | Offer only authorized recovery |
| Forbidden/unavailable | No denied resource name/details | Safe role landing or parent |
| Offline/reconnecting | Show last successful timestamp and cached-data label | Disable freshness-dependent mutations |
| Stale | Persistent warning distinct from offline | Reconcile before protected action |
| Pending mutation | Lock duplicate submission; retain context | No optimistic final/audit claim |
| Success | Server-confirmed state plus durable reference when audited | Move focus/announce outcome |
| Validation failure | Field/feature-linked, non-color-only errors | Preserve safe input |
| Server failure | Preserve prior authoritative state and retry context | No success toast |
| `409` conflict | Show current server version and reload/compare recovery | Never last-write-wins |
| Session expired | Save only allowed non-secret draft context; reauthenticate safely | Re-resolve role/scope before retry |

## 6. Critical action traceability

| ID | Screen/action | Route / target API | Permission and scope | Audit/outcome | Acceptance evidence |
|---|---|---|---|---|---|
| P-A1 | Suspend/reactivate tenant | `/platform/tenants/{id}`; target lifecycle API | P; platform control plane | Actor, tenant, reason, before/after, result | DAI-334 §4, §8 |
| A-A1 | Approve/reject access request | `/vehicles/requests`; decision API | A tenant or M assigned active site | Request/version/decision/reason/result | DAI-335 §3C; DAI-336 §4B |
| A-A2 | User role/site assignment | `/users`; user API | A tenant only | User, roles/sites, before/after/result | DAI-335 §3B |
| A-A3 | Publish/rollback map | `/parking/commissioning`; `/api/v1/sites/{site}/cameras/{camera}/maps/*` | A tenant or M assigned site | Version/action/reason/result/reference | DAI-342 §9–10 |
| M-A1 | Escalate event | `/events`; target operational escalation API | M assigned active site and eligible event | Event/site/recipient/reason/result | DAI-336 §4C |
| G-A1 | Start/end shift | target Guard shift APIs | G exact active assignment/gate | Shift/gate/times/handover/result | DAI-337 §2, §3E |
| G-A2 | Allow once | target event override API | G active shift, exact gate, eligible fresh event | Evidence ack/reason/command/event/audit | DAI-337 §3C, §8 |
| G-A3 | Escalate exception | target Guard escalation API | G active shift/event | Event/reason/recipient/outbox/result | DAI-337 §3D |
| U-A1 | Submit registration request | target `/api/v1/member/registration-requests` | U self-owned vehicle + chosen eligible scope | Request lifecycle/correlation; reviewer audit later | DAI-338 §4–6 |
| U-A2 | Claim visit | existing claim plus target visit-pass contract | U token-bound claimed session | Claim result without leaking token | DAI-338 §7–8 |
| U-A3 | Present/refresh QR | target visit-pass presentation API | U eligible claimed/issued pass | No secret in logs; expiry state | DAI-338 §7.3 |

`SECURITY_GUARD` has no configuration mutation. `PLATFORM_ADMIN` has no implicit tenant-operations
mutation. `MEMBER` has no back-office action. UI visibility never replaces backend enforcement.

## 7. Design tokens

The prototype defines implementation-neutral tokens in `prototype/dai-339/styles.css`:

| Family | Contract |
|---|---|
| Color | Brand 700/600/100; surface/default/muted; text/default/muted; border; positive/warning/danger; visible focus |
| Spacing | 4, 8, 12, 16, 24, 32 px scale |
| Radius | 8 px controls, 14 px cards, 16–18 px large surfaces |
| Target | Minimum 44×44 px for tablet/mobile interactive controls |
| Typography | System sans; 12 px eyebrow/status minimum, 15 px body, 22–26 px screen headings |
| State | Status always includes text/icon semantics; color is supplemental |
| Elevation | Shadow only for modal/floating review or prototype frame, not state meaning |

Production should map these semantic names to the existing Tailwind/shadcn token system rather than
copy literal values into components.

## 8. Copy conventions (Vietnamese UI / English technical)

- Use sentence case: `Phê duyệt yêu cầu`, not title case on every word.
- Primary actions are verb + object: `Phê duyệt yêu cầu`, `Publish version`, `Cho phép một lần`.
- Pending describes work: `Đang phê duyệt…`; success states the result: `Đã phê duyệt yêu cầu`.
- Failure states what did not happen and a recovery: `Không thể publish. Bản đang active không thay đổi.`
- Never translate identifiers/enums in payloads; translate their display labels.
- Avoid `Có lỗi xảy ra` when a safe actionable cause is known. Never echo secrets or denied names.
- Use `Bạn` only in Member self-service. Operator copy is task-oriented and neutral.
- `Site`, `Zone`, `Camera`, and `Gate` remain distinct. `Gate` is logical; a camera is physical.
- Timestamps show timezone/relative freshness where operationally relevant.

## 9. Responsive behavior

| Surface | Desktop | Tablet | Mobile |
|---|---|---|---|
| Platform | Primary; fixed navigation and dense comparison | Review/card fallback | Recovery only |
| Tenant Admin / Site Manager | Primary; table/detail split | Drawer/cards, persistent scope/actions | Recovery/simple approvals only |
| Guard | Secondary | Primary landscape kiosk; large evidence/actions | Recovery/escalation only |
| Member | Constrained centered layout | Touch layout | Primary; bottom navigation |

At narrow widths the prototype turns the role controls into a top section, collapses application
navigation, stacks detail/evidence, makes actions sticky, and enables Member bottom navigation.

## 10. Implementation sequence

1. Ship shared route guard, safe return path, role landing, `ScopeSelector`, and shell separation.
2. Ship `AsyncState`, connection freshness, breadcrumbs, and standardized confirmation/audit outcome.
3. Close Tenant Admin/Site Manager route/API scope gaps using existing APIs before new workflows.
4. Implement Guard shift/event/override/escalation/audit resources transactionally.
5. Implement Member request/visit-pass resources and mobile shell completion.
6. Complete DAI-341/342 commissioning UX on the same scope/state components.
7. Run DAI-340 cross-role, direct-link, tenant/site, expiry, realtime, responsive, accessibility,
   and protected-action validation.

Any schema work uses new forward-only Flyway migrations. Runtime work must update the DAI-332
matrix whenever a new route/action is introduced; this prototype itself grants no permission.

## 11. Review record

| Reviewer | Date | Decision | Approved scope / specific change requests |
|---|---|---|---|
| Product | Pending | Pending | Review terminology, critical paths and Vietnamese copy |
| Engineering | Pending | Pending | Review API feasibility, component boundaries and migration order |
| Security | Pending | Pending | Review scope, evidence/PII, protected actions and audit atomicity |
| QA | Pending | Pending | Review state/traceability matrix and DAI-340 coverage |

A reviewer must replace `Pending` with `Approved` or list concrete change requests. Local prototype
review capture is convenient evidence; the durable review decision belongs in this table or the
tracking issue.

## 12. Acceptance checklist

- [x] Five role critical paths are clickable and share one canonical shell/scope terminology model.
- [x] Responsive variants reflect desktop operations, tablet Guard kiosk, and mobile Member strategy.
- [x] Screen inventory, component inventory, and shared state matrix are explicit.
- [x] Critical screens/actions map to route/API, permission/scope, audit outcome, and source acceptance sections.
- [x] Success, pending, and failure can be reviewed at every prototype step.
- [x] Design tokens and Vietnamese/English copy conventions are defined.
- [ ] Product, Engineering, Security, and QA review decisions are recorded as approval or concrete change requests.

