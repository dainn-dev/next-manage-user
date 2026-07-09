# ADR-1701: Keep native fetch + Context for now; adopt react-query when data volume/complexity crosses a threshold

- Status: Proposed
- Date: 2026-07-09
- Deciders: Principal Architect
- Context doc: 17_Dashboard

## Context

Today's frontend (`frontend/`) has **no react-query/SWR/axios** — data access is native `fetch`
wrapped in hand-rolled class API clients under `lib/api/` (e.g. `vehicle-api.ts`, `gate-api.ts`),
and there is **no global store**, only React Context (per §1). This has worked for a single-tenant
app with a modest number of resources. The target dashboard (§2 of this doc) adds a materially
larger data surface: multi-site switching, live slot occupancy, event timelines, analytics widgets,
a notifications center, and tenant/site/billing admin screens — each with its own fetch/cache/
refetch/loading-state concerns, on top of the existing STOMP realtime hook.

## Decision

**Keep the existing native-fetch + Context pattern for the first wave of dashboard additions**
(multi-site switcher, parking map, live camera, vehicle search, event timeline) — extend the
existing `lib/api/` client style with new clients (e.g. `site-api.ts`, `parking-slot-api.ts`,
`notification-api.ts`) rather than introducing a new data-fetching paradigm mid-migration. Set an
explicit trigger for revisiting: **adopt react-query (TanStack Query) once any of the following is
true** — (a) more than ~3 views need the same server data with different staleness/refetch needs
(e.g. slot occupancy needed on both the map view and a summary widget), (b) optimistic updates or
request deduplication become a recurring hand-rolled pain point (billing/admin screens with
mutations), or (c) analytics widgets (`20_Analytics`) need windowed/paginated data with
background refetching.

## Alternatives considered

- **Adopt react-query immediately for all new dashboard views** — pros: solves caching,
  deduplication, background refetch, and loading/error state boilerplate from day one, well suited
  to the STOMP-plus-REST hybrid pattern; cons: introduces a second data-fetching paradigm alongside
  the existing hand-rolled clients mid-build, forces an immediate decision on cache-key conventions
  and STOMP-to-cache invalidation bridging before the team has hands-on experience with the new
  views' actual access patterns.
- **Introduce a global store (Redux/Zustand) instead of react-query** — pros: solves cross-view state
  sharing (e.g. current site selection); cons: solves the wrong problem — the dashboard's pain point
  is server-state caching/sync, not client-state management; Context already handles the light
  client-state (auth, current tenant/site, theme) adequately at this scale.

## Consequences

- Positive: no migration risk or mixed-paradigm churn while the team is still shaping the new
  views' actual data-access patterns; new views ship using patterns the team already knows.
- Negative / trade-offs: some near-term duplication of loading/error/refetch boilerplate across new
  `lib/api/` clients that react-query would have solved once; the STOMP hook and REST fetch layer
  stay independently managed (no unified cache invalidation on WS push) until the migration happens.
- Follow-ups: once any trigger condition above is met, scope a react-query adoption ADR covering
  cache-key conventions and how STOMP messages invalidate/update query cache entries (e.g. slot
  occupancy pushes updating the `parking-status` query directly via `queryClient.setQueryData`).
