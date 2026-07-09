# ADR-0101: Evolve existing system, don't rewrite

- Status: Proposed
- Date: 2026-07-09
- Deciders: Principal Architect
- Context doc: 01_Project_Overview

## Context

Today's repo (`C:\Users\hoang\Projects\next-manage-user`) is a working, single-tenant
license-plate gate-access system: Spring Boot 3.2 / Java 17 backend on Jetty (`/api`),
PostgreSQL via Spring Data JPA with Flyway migrations V1-V35, Spring Security stateless JWT
(jjwt 0.11.5, HS256), STOMP-over-WebSocket realtime (`/topic/vehicle-check`,
`/topic/gate/{gateId}/check`), a Next.js 14 App Router frontend (Tailwind v4, shadcn/ui,
hand-rolled `fetch` API clients, no react-query/SWR), and a Python edge service
(`edge/edge/`) running YOLOv5 plate + character detection with a SQLite store-and-forward
queue. It has 8 core entities (Employee, Vehicle, VehicleLog, User, VehicleAccessRequest,
Gate, Department, Position), all UUID-keyed, none tenant-scoped.

The target (issue DAI-260) is a multi-tenant SaaS smart-parking platform: many tenants,
each with many sites, cameras, parking-slot maps, an AI chatbot, subscription billing, and
an event-driven backend. That is a large capability gap (see the current-vs-target gap
table in this document's README). The team must decide how to close it: keep building on
today's code, or start over.

The existing system is in production use for gate access, has 35 Flyway migrations of
schema history, working JWT auth, a working edge pipeline with an offline-resilient queue,
and a frontend team already fluent in its Next.js/shadcn conventions. A rewrite would throw
all of that away and re-derive it under time pressure while the current system keeps running
in parallel.

## Decision

Evolve the existing system incrementally. Keep the current stack as the foundation:
Spring Boot 3.2 / Java 17 backend, Next.js 14 App Router frontend, Python edge service,
PostgreSQL, JWT auth, STOMP-over-WebSocket realtime. Add multi-tenancy, the event bus,
billing, the AI chatbot, and the richer edge AI pipeline (YOLOv11, PaddleOCR, ByteTrack,
parking-slot mapping) as new modules and schema additions on top of this base. The current
single-tenant gate-access flow becomes a subset of the parking platform's capabilities
(effectively: one implicit tenant with one site, generalized). This is canonical decision
#1 in the shared architecture brief (§3) and underpins every other decision in this doc set.

## Alternatives considered

- **Evolve incrementally (chosen)** — Add `tenant_id`/`site_id`, RLS, RabbitMQ, Redis,
  PostGIS, the richer edge pipeline, and new backend modules on top of the current
  Spring Boot/Next.js/PostgreSQL/JWT/STOMP stack, migrating data and callers module by
  module.
  - Pros: preserves 35 migrations of schema history and the working JWT/STOMP/edge
    pipeline; ships incremental value (each module can go live independently); lets the
    existing gate-access customer keep running unmodified during the transition; reuses
    team's existing Spring Boot/Next.js expertise; lowest immediate risk.
  - Cons: retrofitting multi-tenancy onto an already-live single-tenant schema is
    genuinely harder than designing it in from day one (every existing table needs a
    tenant_id/site_id backfill and RLS policy); some early schema/API decisions (e.g.
    Gate as a standalone entity rather than site-scoped from the start) will need
    compatibility shims during transition; technical debt from the original single-tenant
    design can leak into the new modules if boundaries aren't enforced.

- **Greenfield rewrite on a new stack** — Start a new repo/stack chosen fresh for the SaaS
  requirements (e.g. microservices from day one, a different language/framework).
  - Pros: no legacy constraints; can design multi-tenancy, event sourcing, and module
    boundaries cleanly from the first commit; freedom to pick the theoretically-optimal
    stack per component.
  - Cons: discards a working, tested system and 35 migrations of schema knowledge; doubles
    delivery risk (rewrite everything while also inventing new SaaS capabilities); the
    current gate-access customer would need a hard cutover or a costly dual-run period;
    historically high failure rate for full rewrites under business pressure; no faster
    path to the AI pipeline upgrades (YOLOv11/ByteTrack/PaddleOCR), which are edge-side and
    stack-independent anyway.

- **Fork current system per-tenant (deploy N copies)** — Keep the single-tenant codebase
  as-is and deploy a separate instance (own DB, own containers) per tenant.
  - Pros: zero multi-tenancy code changes; strongest possible tenant isolation (physical,
    not logical); fastest to first paying tenant.
  - Cons: operational cost scales linearly with tenant count (N databases, N deployments,
    N sets of migrations to keep in sync); no shared chatbot/analytics/billing surface
    across tenants; upgrades must be rolled out to every fork individually, risking drift;
    does not match the target vision's shared-schema + RLS decision (§3.2) or the
    Tenant→Site→Zone→ParkingSlot hierarchy (§3.3), so it would need to be unwound later
    anyway to reach the target architecture.

## Consequences

- Positive: fastest path to shipping incremental SaaS capability; current gate-access
  customer is never blocked; team reuses existing Spring Boot/Next.js/edge investment;
  every other ADR in this doc set (multi-tenancy, event bus, modular monolith) builds on
  this decision.
- Negative / trade-offs: multi-tenancy retrofit (tenant_id/site_id + RLS backfill) is more
  work than tenant-first design; some current entities (e.g. `Gate`, not yet site-scoped)
  need a compatibility-preserving migration path, not a clean-slate redesign; module
  boundaries must be actively enforced (see ADR-0102) to avoid the new code inheriting the
  old code's lack of tenant scoping.
- Follow-ups: see `04_Multi_Tenant_Design` for the tenant_id/site_id + RLS migration plan;
  see `23_Roadmap` for the phased sequencing of which capability lands when.
