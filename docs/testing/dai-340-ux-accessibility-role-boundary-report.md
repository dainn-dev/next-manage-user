# DAI-340 · UX Validation, Accessibility, and Role-Boundary Report

Status: **Conditional GO for implementation · NO-GO for production release**

Review date: 2026-07-16 · Timezone: Asia/Ho_Chi_Minh

Scope: DAI-334–339 design artifacts and the DAI-339 static prototype

## 1. Executive result

The five-role design is coherent enough to enter implementation. No unresolved **design-level**
blocker remains in role ownership, shell navigation, tenant/site scope language, or protected-action
confirmation. The prototype has explicit success, pending, and failure variants and a traceable
route/API/permission/audit handoff.

Production release is **NO-GO** because this review does not replace representative-user sessions,
and several target Guard/Member resources and shared route/state controls are not implemented. Those
are implementation gaps, not permission decisions to improvise during development.

| Gate | Result | Evidence / condition |
|---|---|---|
| Critical journey walkthrough | Pass by stakeholder proxy | Scenario matrix below; DAI-339 clickable prototype |
| RBAC/data-scope design | Pass | DAI-332 matrix remains authority; role/shell/scope negatives are explicit |
| Static accessibility audit | Pass with high follow-ups | Keyboard/focus/touch/reduced-motion foundations pass automated checks; representative AT review pending |
| Security UX | Pass at design level | Forbidden, cross-scope, stale, destructive, and audit behavior specified |
| Representative users | Pending | Recruit 1–2 representatives or authorized proxies per role before production sign-off |
| Runtime enforcement | Pending | DAI-339 implementation plus DAI-340 automated/integration verification required |

## 2. Method and evidence limits

The review used:

1. Scenario walkthrough of DAI-334–338 against the DAI-339 prototype, performed as a stakeholder
   proxy review rather than claiming human usability participants.
2. Cross-check against DAI-332 permissions and DAI-333 route/scope/state standards.
3. Static accessibility inspection covering keyboard structure, focus visibility, labels, touch
   targets, responsive rules, and absence of required motion.
4. Security-UX negative review for forbidden routes, cross-tenant/site identifiers, session expiry,
   destructive confirmation, stale conflicts, and non-disclosing errors.
5. Automated contract checks in `frontend/tests/dai-340-prototype.test.mjs`.
6. Headless Chrome DOM render verification of the initialized prototype (dynamic journey, steps,
   navigation, state banner, content, and actions rendered successfully).

This report does **not** claim screen-reader/browser combinations, live API enforcement, real camera/
gate behavior, network degradation, or participant task timing. Owners and due dates for that
evidence are in the issue log.

## 3. Participant/proxy plan

| Role | Proxy review completed | Required representative evidence before release |
|---|---:|---|
| Platform Admin | 1 design/security proxy | 1 SaaS/platform operator |
| Tenant Admin | 1 product/operations proxy | 1–2 parking/tenant administrators |
| Site Manager | 1 operations proxy | 1–2 multi-site/site managers |
| Security Guard | 1 safety/operations proxy | 2 guards across day/night or normal/degraded conditions |
| Member | 1 consumer UX proxy | 2 participants, including one mobile/accessibility-sensitive user |

Use the DAI-339 local review dialog to capture notes during a session, then transfer the durable
decision and issue IDs into this report/tracking issue. Do not treat browser `localStorage` as
research evidence storage.

## 4. Critical scenario completion

`Completed` below means the proxy reached a truthful terminal prototype state with the correct
scope and recovery; it does not mean the target backend already exists.

| ID | Scenario / role | Expected completion | Result | Observations / issue IDs |
|---|---|---|---|---|
| UX-01 | Platform onboarding/lifecycle | Find tenant → detail → confirm suspension → audit outcome | Completed | Clear control-plane boundary; no tenant selector or tenant-ops impersonation |
| UX-02 | Tenant Admin onboarding/site readiness | Tenant landing → selected site → queue/readiness | Completed | Zero/one/many-site state must be implemented by UX340-03 |
| UX-03 | Tenant/Site Manager approval | Queue → evidence → approve/reject → durable outcome | Completed | Pending/failure preserve prior state; stale request requires refresh |
| UX-04 | Guard gate exception | Confirm shift/gate → evidence → allow once → command/audit outcome | Completed | Target API absent; implementation blocker tracked as UX340-01 |
| UX-05 | Member rejected request | Request status → public reason → eligible correction/resubmit | Completed | Target request lifecycle absent; implementation blocker UX340-02 |
| UX-06 | Expired Member visit/session | QR/visit detail → expired/offline-expired → safe recovery | Completed | No stale QR presented as valid; target pass API in UX340-02 |
| UX-07 | Site Manager/Guard no assignment | Login/direct link → no-assignment state; no protected request | Completed | Distinct from disabled site and empty data |
| UX-08 | Forbidden wrong shell | Any role opens another shell | Completed | Safe role landing; denied resource details omitted |
| UX-09 | Cross-tenant/site deep link | Foreign site/resource ID | Completed | Generic unavailable/404 semantics; browser scope never grants authority |
| UX-10 | Destructive/high-risk action | Review target/scope/impact/reason → pending → audit outcome | Completed | Shared confirmation component still required by UX340-04 |

Task completion result: **10/10 proxy walkthroughs completed**. Representative-user completion
rates, errors, time-on-task, and qualitative findings remain pending; production acceptance requires
those raw session results.

## 5. Accessibility audit

### 5.1 Automated/static result

| Check | Result | Evidence |
|---|---|---|
| Keyboard entry and skip link | Pass | Skip link targets focusable main; controls are native button/select/textarea |
| Visible focus | Pass | 3px semantic focus outline with offset |
| Labels/names | Pass | Role/journey/review inputs labeled; navigation regions named |
| Status announcement | Pass foundation | Screen stage is polite live region; state includes text, not color alone |
| Touch target | Pass | Interactive controls use 44px minimum in shared rules |
| Responsive variants | Pass foundation | Desktop/tablet/mobile breakpoints; Member bottom nav; collapsed tablet nav |
| Reduced motion | Pass | Prototype uses no animation or transition; no essential motion exists |
| Contrast | Manual pass for semantic palette | Primary text/state combinations reviewed; production tokens still require automated rendered audit |
| Dialog focus trap/return | Native foundation | Native `dialog`; browser/AT focus order and close/return require manual matrix |
| Dynamic step focus | Follow-up | Screen changes announce, but primary action does not move focus to the new heading |

### 5.2 Required manual matrix

| Surface | Viewport/input | Assistive check |
|---|---|---|
| Platform/Tenant | 1440×900 keyboard | Tab order, skip link, table/card names, confirmation focus return |
| Tenant/Manager tablet | 1024×768 touch + keyboard | Drawer focus, persistent scope, sticky action occlusion |
| Guard kiosk | 1280×800 landscape touch | 44px targets, high contrast, evidence alternative, degraded-state announcement |
| Member | 390×844 touch + VoiceOver/TalkBack proxy | Bottom-nav labels, QR expiry announcement, form errors and focus |
| All | 200% zoom and Windows high contrast | Reflow, no clipped controls, non-color status |

## 6. Role-boundary and security-UX tests

| Test | Expected UX | Design result | Runtime owner |
|---|---|---|---|
| `PLATFORM_ADMIN` opens `/dashboard` | Redirect `/platform/overview`; no tenant data request | Pass | Frontend platform guard + backend tenant API |
| `MEMBER` or Guard opens `/users` | Safe role landing; no forbidden name/details | Pass | Shared route guard + users policy |
| Manager selects unassigned site ID | No option/request; scoped API returns non-enumerating denial | Pass | `SiteAccess`, repository/RLS, selector |
| Guard URL gate differs from active shift | Stop workflow; active shift or unavailable state | Pass | Guard shift/event service |
| Member reads another user/session | Generic unavailable; no ownership hint | Pass | Member ownership/RLS |
| Tenant A supplies Tenant B IDs | `404`/unavailable at every relationship boundary | Pass | Service predicates + forced RLS |
| Site disabled/revoked mid-action | Cancel protected work/subscriptions and re-resolve scope | Pass | Scope context + API transaction |
| Session expires during form/action | Reauthenticate; re-resolve access/version before retry | Pass | Auth boundary + draft policy |
| Destructive action submitted twice | Lock UI; idempotency/version protects server | Pass | Shared confirmation + API |
| Audit/outbox write fails | Mutation fails atomically; prior state remains | Pass | Transactional backend |

Design result `Pass` means the intended behavior is unambiguous. DAI-340 cannot certify runtime
isolation until implementation tests exercise direct HTTP calls and database/RLS paths.

## 7. Issue log and prioritization

Severity: **Blocker** prevents implementation/release due to unsafe ambiguity; **High** can cause
scope/accessibility/task failure; **Medium** harms recovery/comprehension; **Low** is polish.

| ID | Severity | Finding / recommendation | Owner | Due | Status |
|---|---:|---|---|---|---|
| UX340-01 | High | Guard shift, event detail, override, escalation, command outcome, and audit APIs are target-only. Implement transactionally with exact gate/site/version eligibility before Guard pilot. | Backend/Security | 2026-07-24 | Open |
| UX340-02 | High | Member registration-request and visit-pass lifecycle APIs are target-only. Implement ownership/scope, expiry, draft/upload, and non-disclosing errors before Member pilot. | Backend/Product | 2026-07-24 | Open |
| UX340-03 | High | Shared selector must distinguish no assignment, disabled assignment, one/many active sites, URL reconciliation, and mid-session revocation. | Frontend/Backend | 2026-07-21 | Open |
| UX340-04 | High | Standardize destructive/elevated confirmation, pending lock, stale conflict, and audit outcome rather than page-local confirms/toasts. | Frontend/Security | 2026-07-22 | Open |
| UX340-05 | High | Run keyboard + VoiceOver/TalkBack/NVDA proxy matrix and fix any blocker/high; dynamic step changes should focus/announce the screen heading predictably. | Accessibility/Frontend | 2026-07-23 | Open |
| UX340-06 | High | Run 1–2 representative sessions per role and record completion/errors/timing; current evidence is proxy-only. | Product/UX Research | 2026-07-25 | Open |
| UX340-07 | Medium | Add rendered contrast/zoom/high-contrast automation when browser tooling is available in CI. | Frontend/QA | 2026-07-23 | Open |
| UX340-08 | Medium | Persist review decisions in the issue/report; localStorage review capture is not durable collaboration evidence. | Product | 2026-07-18 | Open |
| UX340-09 | Medium | Add route/API integration tests for every wrong-shell/cross-site row in §6, including direct calls that bypass UI. | QA/Security | 2026-07-24 | Open |

Blocker findings: **0 design blockers**. Open High findings: **6**. Acceptance requires each High
to be fixed or retain the named owner/date; production release remains blocked while UX340-05 and
UX340-06 lack evidence or if any runtime role-boundary test fails.

## 8. Go/no-go decision

### Conditional GO — implementation

Engineering may implement against DAI-332–342. Role, navigation, scope, protected-action, and state
semantics are sufficiently explicit. No implementation may weaken the permission matrix or treat
prototype data as backend authority.

### NO-GO — production/pilot sign-off

Release remains blocked until:

1. UX340-01 through UX340-06 are closed or re-reviewed with accepted evidence.
2. Representative sessions record per-role task completion and issues.
3. Accessibility blocker/high findings from the manual matrix are fixed.
4. Direct-route, API, service, and RLS tests show no cross-tenant/site/ownership leakage.
5. Protected mutations prove idempotency/version handling and atomic audit/outbox behavior.

## 9. Re-run commands and evidence template

Static automated checks:

```bash
cd frontend
node --test tests/dai-340-prototype.test.mjs
```

Representative session record:

| Field | Required value |
|---|---|
| Session ID / date | Non-PII identifier and timestamp |
| Role / proxy status | Role and whether representative or stakeholder proxy |
| Device / input / AT | Viewport, pointer/keyboard, assistive technology |
| Scenario IDs | IDs from §4 |
| Completion | Complete / partial / failed; time and wrong turns |
| Issues | Exact step, expected/observed, severity, safe screenshot/reference |
| Review decision | Approved or specific change requests |

## 10. Acceptance checklist

- [x] Critical journeys have stakeholder-proxy task-completion results and an issue log.
- [x] No design-level RBAC/data-scope blocker remains; runtime certification is explicitly gated.
- [x] Accessibility Highs have owners and deadlines; no known accessibility Blocker is open.
- [x] Conditional implementation GO and production NO-GO criteria are explicit.
- [ ] Complete 1–2 representative/proxy sessions per role and attach durable raw results.
- [ ] Close or re-review the prioritized High follow-ups before production/pilot sign-off.
