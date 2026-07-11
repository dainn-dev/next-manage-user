# ADR-0402: Tenant Context Propagation via JWT Claim + ThreadLocal/RLS Session Variable

- Status: Proposed
- Date: 2026-07-09
- Deciders: Principal Architect
- Context doc: 04_Multi_Tenant_Design

## Context

Today's JWT (jjwt 0.11.5, HS256, 86400s expiry) carries only `role`, `email`, `userId` — no
tenant or site information (brief §1), because the system is single-tenant. Once `tenant_id`
and `site_id` exist in the data model (ADR-0401), every request handler, service method, and
repository query needs access to "which tenant is this request for" without every method
signature growing a `tenantId` parameter — that would be invasive and error-prone (easy to
forget on a new endpoint, easy to pass the wrong value). The mechanism must also reach the
database layer, since the RLS policies from ADR-0401 key off a Postgres session variable, not
an application-level value.

## Decision

Carry `tenant_id` (and a `site_ids` array, or a scope indicator for platform-wide roles) as
**JWT claims**, added at login/token-issuance time by the `iam` module. A single servlet
filter in the `tenancy` module (`TenantContextFilter`, runs immediately after JWT auth) reads
these claims once per request and: (1) sets a request-scoped `ThreadLocal<TenantContext>`
that application code reads via a small `TenantContextHolder.getTenantId()` accessor —
this is what the Hibernate tenant filter is enabled from; (2) issues
`SET LOCAL app.tenant_id = '<uuid>'` on the JDBC connection for the current transaction, which
is what the Postgres RLS policies read via `current_setting('app.tenant_id')`. Both are
cleared in a `finally` block at request end so pooled connections/threads never leak tenant
context into the next request. Edge ingest requests (no user JWT, authenticated via
`X-Gate-Key` instead) resolve tenant/site from the camera/gate's registration record and set
the same context explicitly inside the `ai-ingest` module before calling into `parking`.

## Alternatives considered

- **Explicit `tenantId` parameter threaded through every method call** — pros: no hidden
  state, easy to trace in code; cons: invasive rewrite of every existing service/repository
  method, high risk of a call site omitting or mis-passing the parameter with no compiler
  safety net, doesn't solve the RLS session-variable problem anyway (still needs a `SET LOCAL`
  step somewhere).
- **Tenant ID embedded in the URL path** (`/api/v1/tenants/{tenantId}/...`) — pros: visible,
  cacheable, RESTful; cons: duplicates what the JWT already asserts (client could put a
  different tenant in the URL than their token grants — needs the same claim-matching check
  anyway), and doesn't fit machine-to-machine edge ingest calls that don't carry a
  per-request URL structured this way; brief §3.16 specifies tenant scoping is implicit from
  JWT with explicit `siteId` params only where needed, not full tenant-in-path.
- **JWT claim + ThreadLocal/RLS session var (chosen)** — pros: single choke point
  (`TenantContextFilter`) to get right, reaches both the ORM layer (Hibernate filter) and the
  database layer (RLS) from one resolved value, matches brief §3.16's stated convention; cons:
  `ThreadLocal` requires care with async/reactive code paths (must propagate explicitly if the
  platform ever adopts WebFlux or virtual-thread-per-request patterns that hop threads
  mid-request).
- **`site_ids` as JWT claim (Adopted)** — Because Users may be scoped to a subset of sites
  within a tenant (reserved for a future role split; today `TENANT_ADMIN` acts tenant-wide —
  see `06_User_RBAC`), tenant_id alone is
  insufficient for that future case; a `site_ids` array (or `"*"` for tenant/platform-wide roles) is included so
  site-level authorization (`06_User_RBAC`) is available at the same claim-resolution point.

## Consequences

- Positive: one filter to audit for the entire isolation guarantee's request-side half; RLS
  session variable and Hibernate filter always derive from the same resolved value, so they
  cannot disagree; edge ingest reuses the identical `TenantContext` abstraction even though it
  resolves tenant differently, keeping downstream module code (`parking`, `events`) agnostic
  to how tenant was determined.
- Negative / trade-offs: JWTs grow (tenant_id + site_ids + role vs today's role/email/userId)
  — for tenants/roles with many sites, `site_ids` as a claim can bloat token size; a user's
  site access changing mid-token-lifetime (86400s expiry) is not reflected until re-login or
  token refresh, so site membership changes need either a shorter expiry, a refresh-token
  pattern, or a server-side revocation check for sensitive scope changes.
- Follow-ups: decide whether `site_ids` becomes `"*"` + a separate fast site-membership lookup
  (Redis-cached) instead of an inline claim, if per-tenant site counts get large enough to
  matter; add an integration test that asserts RLS blocks a query even when the Hibernate
  filter is deliberately disabled, to keep the defense-in-depth claim honest; define the
  token refresh / revocation strategy referenced in `06_User_RBAC`.
