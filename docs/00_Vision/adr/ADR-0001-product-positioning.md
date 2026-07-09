# ADR-0001: Product positioning

- Status: Proposed
- Date: 2026-07-09
- Deciders: Principal Architect
- Context doc: 00_Vision

## Context

The repo today (`Vision License Plate`) is a single-tenant license-plate gate-access system:
Spring Boot 3.2 / Java 17 backend, Next.js 14 frontend, Python/YOLOv5 edge service, PostgreSQL,
JWT auth, STOMP-over-WebSocket realtime. It has no `tenant_id` / `site_id` anywhere, one
implicit "tenant" per deployment, and a narrow domain model (Employee, Vehicle, VehicleLog,
User, VehicleAccessRequest, Gate, Department, Position). Its AI capability is plate detection +
character-detection OCR — accurate for the gate-access use case, but it does not track vehicles
across a lot, map them to parking slots, or detect relocation.

The business opportunity (issue DAI-260) is larger than "better ANPR": operators such as
supermarket chains run many parking sites and want cross-site visibility, occupancy mapping,
relocation detection, self-service answers for drivers, and a predictable subscription cost.
This is a strategic fork in how we position and build the product, and it drives nearly every
downstream architecture decision (multi-tenancy model, event bus, billing, RBAC — see §3 of the
shared brief). We need to decide, before writing the rest of the roadmap and SaaS architecture
docs, what kind of product ParkVision is.

## Decision

ParkVision positions as a **vertical SaaS platform for multi-site parking operators**, not as a
generic/horizontal ANPR (Automatic Number Plate Recognition) toolkit. Concretely:

- The unit of sale is a **tenant subscription** (a parking operator), not a per-camera SDK
  license or an on-prem appliance.
- The product models the operator's real hierarchy — **Tenant → Site → Zone → ParkingSlot** and
  **Tenant → Site → Camera/Gate** (per brief §3.3) — as first-class, tenant-scoped domain
  entities, not as opaque camera feeds.
- The AI pipeline (motion detection, vehicle/plate detection, OCR, tracking) is a means to an
  end — feeding **parking-slot occupancy, relocation detection ("VehicleRelocated"), and an AI
  chatbot** over that state — not the product itself.
- Billing, RBAC, and multi-tenant isolation (RLS, `tenant_id`/`site_id`) are core product
  surface area from day one, not bolt-ons.
- The existing single-tenant gate-access flow (Employee/Vehicle/Gate/VehicleAccessRequest)
  becomes a subset — the "workforce module" — of the larger platform (brief §3.1, §4), so
  today's investment is not discarded.

## Alternatives considered

- **Generic ANPR SDK / toolkit** — sell the detection+OCR pipeline (today's YOLOv5 plate/char
  pipeline, or its YOLOv11/PaddleOCR successor) as a component that integrators embed into their
  own systems.
  - Pros: smaller surface area to build and support; plays to the team's existing edge-AI
    strength; faster time-to-first-revenue; no need to build billing, multi-tenancy, or a
    parking-map designer.
  - Cons: commoditized market with strong incumbents (Plate Recognizer, OpenALPR and similar);
    low switching cost for customers means weak retention; no recurring platform lock-in; does
    not leverage the operational domain model (Site/Zone/ParkingSlot) already scoped in the
    vision; abandons the multi-tenant SaaS goal stated in the issue.

- **Vertical multi-tenant SaaS platform** (chosen) — sell an end-to-end operations platform for
  parking operators, where ANPR/vision is one internal capability among several (occupancy,
  relocation, chatbot, billing, dashboards).
  - Pros: matches the stated business goal (DAI-260); higher retention via workflow lock-in and
    per-tenant configuration (parking-map calibration, entitlements); recurring subscription
    revenue with natural upsell (more sites/cameras/AI minutes); reuses and extends the existing
    single-tenant codebase incrementally (brief §3.1 "evolve, don't rewrite") instead of a
    rewrite.
  - Cons: much larger scope — requires multi-tenancy (RLS), event bus, billing, chatbot, mobile
    app, and a parking-map designer UI; longer time-to-GA; more operational complexity (per-tenant
    isolation, entitlement enforcement, usage metering) than a toolkit would ever need.

- **Single-tenant on-prem appliance vendor** — package the current architecture as one
  deployment per customer (as it effectively is today), sold as a licensed appliance/VM rather
  than shared SaaS infrastructure.
  - Pros: minimal architecture change from today's code; simplest security story (no
    cross-tenant blast radius by construction); fits customers with strict data-residency or
    offline requirements.
  - Cons: no shared-infrastructure economics, so cost-to-serve scales linearly with tenants; no
    centralized cross-site dashboard for chains operating many sites (a stated goal); harder to
    ship product updates (N independent deployments to patch); does not match "multi-tenant
    SaaS" in the issue title.

## Consequences

- Positive: every subsequent architecture decision (multi-tenancy model, event-driven core, RBAC
  evolution, billing) has a clear "why" — they all serve the vertical-SaaS positioning, not a
  toolkit or appliance business. The existing codebase is treated as a valid starting point
  (brief §3.1), reducing rewrite risk and preserving the working gate-access flow as the
  "workforce module" fallback.
- Negative / trade-offs: scope is materially larger than a toolkit — multi-tenancy (RLS +
  `tenant_id`/`site_id`), an event bus, a parking-map designer, and billing must all be built
  before the platform is competitive, which pushes out GA relative to a narrower ANPR-toolkit
  play. We also take on an appliance/offline-mode gap: some customers who want on-prem-only
  deployments may need a later "single-tenant appliance" SKU, which is out of scope for this ADR.
- Follow-ups: the multi-tenancy model itself (shared-schema + RLS vs schema-per-tenant) is
  recorded separately in `03_SaaS_Architecture` (see the shared brief §3.2); billing model
  (Stripe vs build-your-own) belongs in the billing doc; this ADR only fixes the product
  category, not the implementation details.
