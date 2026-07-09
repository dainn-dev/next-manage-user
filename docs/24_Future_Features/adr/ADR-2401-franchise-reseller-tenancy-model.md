# ADR-2401: Franchise / Reseller Multi-Level Tenancy Model

- Status: Proposed
- Date: 2026-07-09
- Deciders: Principal Architect
- Context doc: 24_Future_Features

## Context

The canonical multi-tenancy decision (`03_SaaS_Architecture`, architecture decision §3.2)
establishes shared-database, shared-schema isolation with a `tenant_id` discriminator on
every tenant-owned table, enforced by PostgreSQL Row-Level Security, plus a `site_id`
second-level scope. The tenant hierarchy is fixed as
`Tenant → Site → Zone → ParkingSlot` (§3.3). Today's code has no tenant concept at all —
it is single-tenant with no `tenant_id`/`site_id` on any table — so this ADR is deciding
the shape of a hierarchy level *above* a `Tenant` model that does not exist in the
repository yet either; it is scoped entirely to the target design.

Future Feature #6 ("Franchise / reseller multi-level tenancy," `24_Future_Features`
README §3.6) proposes letting a franchise operator or channel/reseller partner manage a
portfolio of tenants under one console, with roll-up billing and analytics, without
weakening the tenant-level RLS isolation the rest of the platform is built around. This
is a genuine fork point: whatever shape a `Reseller` layer takes will either extend the
existing `tenant_id`-based RLS/JWT model cleanly, or require a second, parallel
authorization mechanism. It is the one idea in the Future Features set that changes the
core tenancy model rather than sitting on top of it, so it is recorded here rather than
left as a paragraph in a feature spec.

This decision is **not** a commitment to build the feature — Future Feature #6 is
explicitly beyond the P0–P7 roadmap (`23_Roadmap`). It records the preferred approach
*if and when* the feature is promoted, so that a future roadmap phase does not have to
re-derive the trade-offs, and so nothing in the near-term tenancy design (§3.2/§3.3)
accidentally forecloses it.

## Decision

Model `Reseller` as a lightweight, optional entity **above** `Tenant`, linked by a
nullable `Tenant.reseller_id` foreign key — not as a new row in the `tenant_id` RLS
discriminator chain. Tenant-owned tables keep exactly the isolation model decided in
§3.2: `tenant_id` (+ `site_id`) RLS, unchanged. Reseller-scoped access (a reseller admin
viewing/managing several tenants) is authorized through a separate mechanism: a
`reseller_id` JWT claim that is resolved, at request time (or via a short-lived cache),
to the set of `tenant_id`s owned by that reseller, and reseller-facing endpoints filter
by that resolved set rather than by a `reseller_id` column baked into RLS policies on
every tenant-owned table.

## Alternatives considered

- **A — Reseller as a new top-level RLS scope.** Add a `reseller_id` column (and RLS
  policy) to every tenant-owned table alongside `tenant_id`, so isolation is enforced
  symmetrically at both levels by the database. Pros: consistent with the existing
  `tenant_id` RLS pattern, roll-up queries are simple `WHERE reseller_id = ?` scans with
  no cross-table joins. Cons: touches every tenant-owned table again — a second wave of
  the same migration/RLS-policy work §3.2 already requires for `tenant_id` — for a
  feature the large majority of tenants (single-owner, non-franchise) will never use;
  most rows would carry a permanently-null `reseller_id`.
- **B — Reseller as an optional parent record on Tenant (chosen).** A new `Reseller`
  table with `Tenant.reseller_id` as the only schema change to existing tenant-owned
  tables (none — the FK lives on `Tenant` itself). Reseller-scoped queries are a filtered
  join/set-membership check across the tenants a reseller owns, not a first-class RLS
  discriminator. Pros: minimal schema blast radius, does not reopen RLS policies already
  written and tested for `tenant_id`, keeps the feature's complexity confined to the
  (much smaller) reseller-facing surface. Cons: reseller-scoped authorization is a
  different code path from the direct `tenant_id`-claim-match used everywhere else in
  the platform — one more pattern in the RBAC codebase — and roll-up queries fan out
  across N tenants instead of being a single indexed column scan.
- **C — Reseller as "just another Tenant."** Reuse the `Tenant` table with a
  `type = RESELLER` flag and a self-referencing `parent_tenant_id`, avoiding a new
  entity entirely. Pros: zero new tables, fully reuses existing RLS. Cons: conflates two
  different concepts — a reseller is a billing/portfolio relationship, not a
  parking-operating tenant with its own sites — which risks a reseller's own `Tenant` row
  being mistaken for a real site-operating tenant in RLS-scoped queries, and complicates
  the `Subscription`/`Plan` billing model (`05_Subscription_Billing`), which would need
  to distinguish reseller-tier plans from tenant-tier plans on the same table.

## Consequences

- **Positive:** the tenant-level RLS/JWT design decided in §3.2 stays exactly as
  specified — this ADR adds no retroactive change to it. Schema footprint if the feature
  is never built stays at zero; if built, it is one nullable FK plus one small table.
  The reseller-facing surface (console, roll-up billing) can be developed, and if needed
  reverted, independently of core tenant/site code.
- **Negative / trade-offs:** reseller-scoped RBAC needs a distinct authorization
  mechanism (tenant-set resolution from a `reseller_id` claim) not used anywhere else in
  the platform, which is additional code to design, test, and keep in sync as tenants
  move between resellers. Roll-up billing/analytics queries fan out across a reseller's
  tenants rather than being a single indexed scan, which needs attention if a reseller's
  portfolio grows large. A "reseller admin" role does not nest cleanly under the existing
  `PLATFORM_ADMIN` / `TENANT_ADMIN` scope split (§3.9) and needs its own definition.
- **Follow-ups:** if this feature is promoted into `23_Roadmap`, follow-ups are (1)
  define the reseller-admin RBAC role and its JWT claim shape alongside the roles in
  §3.9, (2) decide whether resellers get their own Stripe billing entity or roll up to
  per-tenant `Subscription`s (`05_Subscription_Billing`), and (3) revisit whether
  Alternative A (full RLS scope) becomes worthwhile if reseller portfolios grow large
  enough that cross-tenant fan-out queries become a measured performance problem.
