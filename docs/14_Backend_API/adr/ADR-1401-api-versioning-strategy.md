# ADR-1401: API versioning strategy — /api/v1 + additive evolution, legacy /api kept as-is

- Status: Proposed
- Date: 2026-07-09
- Deciders: Principal Architect
- Context doc: 14_Backend_API

## Context

Today every controller hangs directly off `/api` with no version segment:
`/api/auth`, `/api/vehicles`, `/api/gates`, `/api/employees`, `/api/admin/users`,
`/api/departments`, `/api/positions`, `/api/vehicle-logs`, `/api/access-requests` (see the
endpoint table in this doc's README). These are used today by the Next.js frontend
(`frontend/lib/api/*` hand-rolled fetch clients) and by the edge `GateClient`. Breaking any
of them breaks a running fleet of edge devices in the field, which cannot all be upgraded
atomically.

The SaaS expansion (§4 of the brief) adds a large batch of genuinely new resources —
tenants, sites, zones, cameras, parking-slots, vehicles with current location,
parking-events, snapshots, subscriptions, notifications, analytics, chat — that have no
legacy equivalent and are free to be designed cleanly from day one, including tenant/site
scoping baked into the URL and payload contracts from the start.

## Decision

- Keep every existing endpoint under unversioned `/api/**` exactly as it is today —
  no path changes, no behavior changes, for backward compatibility with edge devices and the
  current frontend build. Evolve these only additively (new optional fields/params); a
  breaking change to one of them requires moving it to `/api/v1` as a deliberate,
  separately-communicated migration, not a silent edit.
- All new SaaS resources are introduced under **`/api/v1`** from the start: `/api/v1/tenants`,
  `/api/v1/sites`, `/api/v1/zones`, `/api/v1/cameras`, `/api/v1/parking-slots`,
  `/api/v1/vehicles`, `/api/v1/parking-events`, `/api/v1/snapshots`,
  `/api/v1/subscriptions`, `/api/v1/notifications`, `/api/v1/analytics`, `/api/v1/chat`.
- Within `/api/v1`, evolution is **additive-only** (new optional fields, new endpoints, new
  optional query params). A breaking change bumps to `/api/v2` for the affected resource
  only — not a platform-wide version bump.
- **OpenAPI 3.1** (springdoc, already wired today at `/api-docs`, `/swagger-ui`) is the
  contract of record for both the legacy and `/api/v1` surfaces; this document's endpoint
  table must stay in lockstep with the generated spec.

## Alternatives considered

- **Header-based versioning** (`Accept: application/vnd.parkvision.v1+json`) — keeps URLs
  stable, but is harder to browse/curl/debug, harder to route distinctly in gateway/ingress
  rules later, and gives no benefit here since we are not renaming existing resources, only
  adding new ones. Rejected.
- **Version everything, migrate legacy endpoints into /api/v1 immediately** — cleaner
  end-state, but forces a synchronized edge-fleet + frontend cutover on day one, which is
  exactly the risk the "evolve, don't rewrite" decision (brief §3.1) is meant to avoid.
  Rejected for now; legacy endpoints migrate opportunistically.
- **/api/v1 for everything including new resources, additive evolution (chosen)** — pros:
  zero disruption to existing clients, a clean versioned home for the resources that most
  need forward-compatibility guarantees (billing, tenancy, events), matches brief §3.16
  verbatim. Cons: two URL conventions coexist during the transition (`/api/vehicles` and
  `/api/v1/vehicles` both exist and must be kept conceptually distinct — see the API resource
  map diagram for how they relate).

## Consequences

- Positive: no forced simultaneous upgrade of edge fleet + frontend; new SaaS surface gets a
  versioning discipline from day one; OpenAPI spec stays the single source of truth for both.
- Negative / trade-offs: temporary duplication/overlap between `/api/vehicles` and
  `/api/v1/vehicles` (different shapes, different scope) needs clear documentation so
  frontend/mobile engineers don't call the wrong one; eventual full migration of legacy
  endpoints into `/api/v1` is unscheduled technical debt.
- Follow-ups: track which legacy endpoints have an `/api/v1` successor (see the endpoint
  table's "Superseded by" notes) and set a deprecation timeline once the SaaS frontend no
  longer needs the legacy shape.
