# DAI-332 Permission Matrix

- Status: **Approved by DAI-332**
- Owner: Product
- Security-boundary reviewer: Principal Architect
- Updated: 2026-07-16
- Decision record: [ADR-0605](adr/ADR-0605-rbac-product-decisions-and-ux-permission-contract.md)
- Interaction behavior: [DAI-333 IA and interaction standards](ia-interaction-standards.md)

This is the normative **Role × Route × Action × Data Scope** contract for the current product.
It covers all implemented Next `page.tsx` routes and the API/action families they use. When a route,
handler, or action changes, update this file in the same change.

## 1. Reading the matrix

### Roles and scopes

| Code | Canonical role | Scope |
|---|---|---|
| P | `PLATFORM_ADMIN` | Platform control plane only; no implied tenant operational access. |
| A | `TENANT_ADMIN` | Whole validated tenant. Frontend compatibility alias: `ADMIN`. |
| M | `SITE_MANAGER` | Assigned sites only. |
| G | `SECURITY_GUARD` | Assigned sites only; operational read plus approved manual override only. |
| U | `MEMBER` | Self, owned records, active affiliations, and claimed sessions only. Frontend compatibility alias: `USER`. |

`—` means denied. `Public` means no authenticated human role is required for that route. `Device`
means a gate, camera, or webhook credential—not anonymous human access.

### Independent control layers

| Layer | Contract |
|---|---|
| **UI / navigation** | Displays only actions the role should discover. It is not authorization. |
| **Frontend route guard** | Redirects an authenticated person to their permitted shell and prevents a protected-content flash. |
| **Backend API enforcement** | Makes the capability decision with Spring Security and service checks. This is authoritative. |
| **Data scope** | Applies tenant RLS plus resource ownership and assigned-site validation. Client input never widens scope. |

Target responses are `401` for no/invalid authentication, `403` for a capability denial on a visible
resource, and `404` for a resource outside an authorized tenant/site/ownership scope when revealing
its existence would leak data.

## 2. Frontend route inventory

**Legend:** **Nav** is the intended visible navigation item; **Guard** is the target shell/redirect
behavior; **API policy** identifies the server capability family that must authorize the route's data.
`Legacy` is an implemented route not represented in the current navigation or route-root policy and
is intentionally listed for follow-up rather than silently accepted.

| Route | Nav | Allowed role(s) | Guard / shell | Permitted route actions and scope | API policy / backend enforcement |
|---|---|---|---|---|---|
| `/` | Public | Public | No app chrome | Marketing/entry; no private data | Public only; no private API calls |
| `/login` | Public | Public | No app chrome | Authenticate | `/api/auth/**` public; issue validated role/tenant/site claims |
| `/register` | Public | Public | No app chrome | Begin public registration | Public registration rate-limited; no tenant authority granted by the form |
| `/forgot-password` | Public | Public | No app chrome | Request reset | Password-reset public endpoint; rate limited and non-enumerating |
| `/reset-password` | Public | Public | No app chrome | Confirm reset token | Password-reset token validation only |
| `/platform` | Platform overview | P | P stays in platform shell; A/M/G → operator landing; U → `/me` | Redirect/summary only; Platform scope | Platform overview API; P only |
| `/platform/overview` | Overview | P | Platform shell; all others redirected | View platform tenant/billing health and recent audit; Platform | `/api/v1/platform/overview`; P only |
| `/platform/tenants` | Tenants | P | Platform shell; all others redirected | List/onboard/search tenants; Platform | `/api/v1/tenants/**`; P only; onboarding audit |
| `/platform/tenants/[id]` | Tenants | P | Platform shell; all others redirected | View/update tenant lifecycle; Platform | `/api/v1/tenants/{id}`; P only; status changes audited/confirmed |
| `/platform/billing` | Billing | P | Platform shell; all others redirected | View platform subscription summary; Platform | Platform billing API; P only |
| `/platform/admins` | Admins | P | Platform shell; all others redirected | List/create/update platform admins; Platform | `/api/v1/platform/admins/**`; P only; create/status changes audited and confirmed where security-impacting |
| `/platform/audit` | Audit | P | Platform shell; all others redirected | Read platform audit; Platform | `/api/v1/platform/audit`; P only |
| `/me` | Xe của tôi | U | Member shell; P → platform overview; A/M/G → operator landing | View owned garage; Self/owned | `/api/member/vehicles`; `MEMBER` and ownership enforced |
| `/me/orgs` | Đăng ký tại org | U | Member shell; P → platform overview; A/M/G → operator landing | View own affiliations and registrations; Self/affiliation | Member affiliation/registration read API; `MEMBER` self only |
| `/me/visit` | Visit / QR | U | Member shell; P → platform overview; A/M/G → operator landing | Claim an eligible public session; Claimed session | `/api/member/sessions/claim`; `MEMBER`, claim code, ownership check |
| `/me/visit/[sessionId]` | Visit / QR | U | Member shell; P → platform overview; A/M/G → operator landing | View one claimed visit; Claimed session | `/api/member/sessions/{id}`; `MEMBER`, owner check, out-of-scope `404` |
| `/me/history` | Lịch sử | U | Member shell; P → platform overview; A/M/G → operator landing | View own claimed history; Self/claimed session | `/api/member/sessions`; `MEMBER` self only |
| `/me/account` | Tài khoản | U | Member shell; P → platform overview; A/M/G → operator landing | View/manage personal account; Self | Auth/profile endpoint; current user only |
| `/dashboard` | Tổng quan | A, M, G | Operator shell; P → platform overview; U → `/me` | View operational snapshot; A=tenant, M/G=assigned site | Dashboard/event/camera APIs; tenant RLS + `SiteAccess` |
| `/events` | Sự kiện | A, M, G | Operator shell; P → platform overview; U → `/me` | View operational event timeline; A=tenant, M/G=assigned site; G receives only permitted operational/PII-redacted fields | Site event APIs; role + site scope + field redaction |
| `/parking/maps` | Sơ đồ bãi | A, M, G | Operator shell; P → platform overview; U → `/me` | A/M may view configured maps; G view only; A/M scope per tenant/assigned site | Parking-map preview/read API; tenant RLS + `SiteAccess` |
| `/parking/cameras` | Camera | A, M, G | Operator shell; P → platform overview; U → `/me` | View cameras in scope; only A/M may mutate camera metadata per assigned-site policy; G read-only | Camera read/write API; tenant RLS + `SiteAccess`; credentials A only |
| `/parking/commissioning` | Thiết lập bãi đỗ | A, M | Operator shell; P → platform overview; U → `/me`; G → `/dashboard` | Draft/edit/import/validate/publish/archive map data in scope | Commissioning APIs; A tenant / M assigned site; publish/archive/delete confirmed and audited; rollback needs reason |
| `/gate` | Cổng kiosk | A, M | Operator shell; P → platform overview; U → `/me`; G → `/dashboard` | List/select gates in scope; no user/role administration | Gate configuration/read API; tenant RLS + `SiteAccess` |
| `/gate/[gateId]` | Cổng kiosk | A, M, G | Full-screen kiosk; still enforce role and site before paint | A/M operate configured gate; G performs approved manual override only; A tenant / M/G assigned site | Gate event/access API; server validates gate belongs to allowed site; G override requires confirmation, reason, audit |
| `/gate/health` | None | A, M | Operator shell; P → platform overview; U → `/me`; G → `/dashboard` | View gate health in scope | Gate health API; tenant RLS + `SiteAccess` |
| `/vehicles/monitoring` | Giám sát | A, M, G | Operator shell; P → platform overview; U → `/me` | View current vehicle operations; G operational read only | Vehicle/log read API; A tenant, M/G assigned site |
| `/vehicles/search` | Tìm biển số | A, M, G | Operator shell; P → platform overview; U → `/me` | Search plate within permitted site; G uses only operational data | Plate-search API; required site scope and PII field policy |
| `/vehicles` | Danh sách xe | A, M | Operator shell; P → platform overview; U → `/me`; G → `/dashboard` | List/create/edit/delete tenant vehicle/registration data; A tenant, M assigned site as permitted | Vehicle/registration APIs; role + RLS + `SiteAccess`; sensitive changes audited/confirmed as listed below |
| `/vehicles/entry-exit` | Thông tin ra/vào | A, M | Operator shell; P → platform overview; U → `/me`; G → `/dashboard` | Review entry/exit and logs; A tenant, M assigned site | Vehicle-log APIs; role + assigned-site filtering |
| `/vehicles/requests` | Yêu cầu ra/vào | A, M | Operator shell; P → platform overview; U → `/me`; G → `/dashboard` | View/approve/reject access requests; A tenant, M assigned site | Access-request API; approval/rejection authorized and audited |
| `/statistics` | Thống kê | A, M | Operator shell; P → platform overview; U → `/me`; G → `/dashboard` | View/export metrics; A tenant, M assigned site | Analytics/export API; role + scope; export audited |
| `/sites` | Khu vực (Sites) | A | Operator shell; P → platform overview; U → `/me`; M/G → operator landing | Create/edit/delete sites; Tenant | Site API; `TENANT_ADMIN` only; destructive changes confirmed/audited |
| `/settings/organization` | Tổ chức | A | Operator shell; P → platform overview; U → `/me`; M/G → operator landing | View/update own tenant organization; Tenant | `/api/v1/tenant/**`; `TENANT_ADMIN` only; critical changes audited |
| `/billing` | Thanh toán | A | Operator shell; P → platform overview; U → `/me`; M/G → operator landing | View/manage own tenant subscription/billing; Tenant | Billing API; `TENANT_ADMIN` only for tenant mutation |
| `/users` | Quản lý người dùng | A | Operator shell; P → platform overview; U → `/me`; M/G → operator landing | Invite/manage ops users, roles, and site assignments; Tenant | Admin/user API; `TENANT_ADMIN` only; role/site/user-status changes audited, confirmed, and reasoned where removal/deactivation applies |
| `/departments` | Legacy | A only (target) | **Legacy:** add to operator guard; P/U redirect; M/G denied | Legacy department maintenance; Tenant | Department API must be explicit `TENANT_ADMIN` policy; until then conformance gap |
| `/positions` | Legacy | A only (target) | **Legacy:** add to operator guard; P/U redirect; M/G denied | Legacy position maintenance; Tenant | Position API must be explicit `TENANT_ADMIN` policy; until then conformance gap |
| `/employees` | Legacy | A only (target) | **Legacy:** add to operator guard; P/U redirect; M/G denied | Legacy employee maintenance; Tenant | Employee API must be explicit `TENANT_ADMIN` policy; until then conformance gap |

### Declared navigation that has no page

| Navigation key | Status | Contract |
|---|---|---|
| `/parking/slots` | Coming soon; button is disabled | It is not an implemented route and must remain non-navigable until a route, policy row, server API policy, and assigned-site scope are added. |

## 3. Action and API policy register

This table defines the target backend contract. An action must have a server-side capability check
in addition to any UI/route behavior in the route table.

| Resource/action family | Allowed role(s) and scope | Backend enforcement target | Audit | Confirm | Reason |
|---|---|---|---|---|---|
| Authenticate, reset password, public registration | Public; no tenant privilege | Public endpoints plus token/rate-limit validation | Security events | No | No |
| Platform tenant lifecycle | P; Platform | `/api/v1/tenants/**`; P only | Yes | Status/destructive changes | Status suspension/termination |
| Platform admins, billing, platform audit | P; Platform | `/api/v1/platform/**`; P only | Admin/billing mutation | Admin status/security change | Deactivation/removal |
| Own tenant profile and billing | A; Tenant | `/api/v1/tenant/**`, tenant billing APIs; A only for mutations | Material mutation | Material mutation | As required by billing policy |
| Ops user, role, and site assignment | A; Tenant | Admin/user API; reject P/M/G/U | Yes | Yes | Role/site removal and deactivation |
| Site CRUD | A; Tenant | Site API; reject M/G for mutations | Yes | Delete | Delete |
| Zone and camera metadata CRUD | A tenant; M assigned site; G read only | Site-scoped controller/service checks; `SiteAccess.assertSiteAllowed()` | Material mutation | Delete | Delete / security-impacting change |
| Camera credential issue, rotate, revoke | A; Tenant and camera site | `TENANT_ADMIN` only; never M/G; per-camera credential policy | Yes | Yes | Revoke |
| Gate configuration/health | A tenant; M assigned site; G operational read only | Server resolves gate owning site before action | Material mutation | Security-impacting change | As needed |
| Device ingest/heartbeat | Device; bound tenant/site/camera or gate | Device credential filter; never treat `permitAll` as public human authority | Device/security event | No | No |
| Dashboard, event timeline, maps, live cameras | A tenant; M/G assigned site | Tenant RLS + site validation + PII redaction for G | Read audit when sensitive policy requires | No | No |
| Parking-map draft/edit/import/validate | A tenant; M assigned site | Commissioning service validates site/camera ownership | Draft provenance | No | No |
| Parking-map publish/archive/delete | A tenant; M assigned site | Commissioning API/service; optimistic version checks | Yes | Yes | Delete/archive rationale if policy requires |
| Parking-map rollback | A tenant; M assigned site | Service rejects missing reason | Yes | Yes | **Required** |
| Vehicle/tenant registration CRUD | A tenant; M assigned site where implemented; G denied | Vehicle/registration controllers plus tenant/site checks | Material mutation | Delete/revoke | Revoke/rejection |
| Vehicle logs and access requests | A tenant; M assigned site; G operational read only | Explicit method policy; scope every row to tenant/site | Approve/reject/export | Approve/reject | Reject |
| Plate search | A tenant; M/G assigned site | Required `siteId`, server validates allowed site and redacts fields | Sensitive lookup policy | No | No |
| Guard manual access override | G assigned site; A/M may perform their operational equivalent | New DAI-337 endpoint; validate guard, event, gate, and same-site assignment | **Required in same transaction** | **Required** | **Required** |
| Member affiliations and registrations | U self/affiliation read; A and M manage the current closed-org tenant workflow; G denied | Member ownership/affiliation service checks; never use a member affiliation as ops authority; future M write scope must be explicitly site-safe | Invite/link/revoke | Revoke | Revoke |
| Member garage, visits, QR claim, history, account | U self/owned/claimed session | `@PreAuthorize(MEMBER)` plus owner/session checks | Claim/security-relevant changes | Claim handoff as UX requires | No |
| Notifications/preferences | Own notification or assigned-site preference; delivery records A/M assigned site | User ownership plus `SiteAccess` for `siteId` | Delivery/ack policy | No | No |
| WebSocket/STOMP connect and subscribe | Authenticated human plus matching tenant/site topic | Authenticate `CONNECT`; authorize every `SUBSCRIBE`; redact before publish | Subscription/security events | No | No |
| Webhooks, health, docs, static assets | Webhook/device/public as explicitly classified | Dedicated signature/device filter or minimal public policy; no human role inference | Webhook/security events | No | No |

## 4. Technical principals and exemptions

`SecurityConfig` contains `permitAll` entries that are filter entry points or intentionally public
routes. They must not be read as a broad anonymous human permission.

| Endpoint family | Principal | Required proof / scope |
|---|---|---|
| `/api/auth/**`, password reset, public registration | Public human | Route-specific validation, rate limits, reset token where applicable |
| `POST /api/gates/register`, gate heartbeat | Gate device | `X-Gate-Key` compatibility filter; transition to fail-closed scoped device credentials |
| Camera heartbeat and parking-event ingest | Camera device | `X-Camera-Id` + `X-Camera-Key`, resolved camera tenant/site context |
| Billing and parking webhooks | External service | Signature/secret verification and idempotency; no browser role |
| `/actuator/health` | Public health probe | Health only; all other actuator access is P-only |
| API docs / Swagger | Public documentation | No application data authority |
| `/images/**`, `/uploads/**` | Authenticated principal | Resource-level URL/data authorization remains required |
| `/uploads/snapshots/**` | None | Explicitly denied |
| `/ws/**` | Authenticated human (target) | Authenticate STOMP `CONNECT` and authorize every topic subscription |

## 5. Current conformance gaps

These are documented gaps, not exceptions to the approved policy. They become implementation
acceptance cases for DAI-337, DAI-339, and DAI-340.

| Gap | Current observation | Required follow-up |
|---|---|---|
| Guard override and operational audit | DAI-332 approves a narrow override, but no endpoint, mandatory-reason validation, or tenant/site append-only audit model exists. | DAI-337 implements the flow; audit failure must fail the protected action. |
| Guard route/actions | Current navigation exposes several operational pages to G; target policy is read-only except approved override. | DAI-339 aligns controls and server capability checks; DAI-340 exercises direct-route/API denials. |
| Route-root coverage | `ProtectedLayout` does not classify `/departments`, `/positions`, or `/employees` in its tenant-ops roots. | Add policy-driven frontend guarding and explicit server authorization before treating them as protected admin pages. |
| Request matcher fall-through | `SecurityConfig` ends with broad authenticated fall-through rules; not every human handler is represented by a role-specific matcher or controller annotation. | Inventory every handler and move human APIs to explicit default-deny policy. |
| WebSocket authorization | `/ws/**` is currently permitted at the HTTP matcher layer; the approved contract requires authenticated CONNECT and site/tenant-authorized subscriptions. | Implement and test STOMP CONNECT/SUBSCRIBE authorization. |
| Camera credential boundary | ADR-0602 says only A may issue/rotate credentials; service site checks alone can permit broader site-scoped callers if the endpoint policy is not explicit. | Enforce A-only credentials and test M/G denial. |
| Historical RBAC documentation | The old 06_User_RBAC matrix omitted G and said G was retired. | This matrix and ADR-0605 supersede that matrix. |

## 6. Verification checklist

- [ ] Every `frontend/app/**/page.tsx` entry appears in section 2.
- [ ] Every sidebar item appears as an implemented route or an explicit coming-soon row.
- [ ] Every API/action family states server capability, scope, audit, confirmation, and reason policy.
- [ ] Public, device, webhook, static, and WebSocket exemptions have a named principal and proof.
- [ ] New role/action/API changes update this document and its implementation tests together.
