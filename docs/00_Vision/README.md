# 00 — Product Vision

**ParkVision** is a multi-tenant SaaS Smart Parking Platform: one subscription tenant (typically
an operator running many physical sites — for example a supermarket chain) manages many **sites**
(bãi đỗ xe / parking lots), each with cameras/gates and a mapped parking layout, from a single
dashboard. ParkVision automates vehicle entry/exit, tracks where a vehicle is parked, detects when
it moves without an exit event ("relocation"), and lets drivers and staff ask an AI chatbot instead
of digging through logs. This document sets the product vision, target customers, value
proposition, product pillars, success metrics, and business model that the rest of the doc set
(architecture, data model, roadmap) is built to serve.

Status: Draft · Owner: Principal Architect · Last updated: 2026-07-09

## 1. Current state vs Target

ParkVision's codebase does not start from zero. The current in-repo product, **"Vision License
Plate"**, is the working starting point this vision evolves from (see `01_Project_Overview` for
the full current-system description). Per the architecture brief's ground truth:

| Aspect | Current state (Vision License Plate) | Target (ParkVision) |
|---|---|---|
| Tenancy | Single-tenant. No `tenant_id`/`site_id` on any of the 8 entities (Employee, Vehicle, VehicleLog, User, VehicleAccessRequest, Gate, Department, Position). | Multi-tenant SaaS. `tenant_id` + `site_id` on every tenant-owned table, PostgreSQL Row-Level Security, tenant resolved from JWT. |
| Domain scope | Gate access for one physical site's employee vehicles. `Gate` models a physical gate location, not a tenant. | Tenant → Site → Zone → ParkingSlot hierarchy; parking-slot occupancy and relocation, not just entry/exit. |
| AI pipeline | YOLOv5 plate detection + a second YOLOv5 model for character detection (OCR-by-detection); no motion gating, no PaddleOCR, no ByteTrack, no slot mapping. | YOLOv11 vehicle detection behind OpenCV motion gating (MOG2), PaddleOCR primary OCR (EasyOCR/VietOCR comparators), ByteTrack multi-object tracking with stable `track_id`, polygon slot mapping. |
| Realtime | STOMP over WebSocket with an in-memory SimpleBroker (`/topic/vehicle-check`, `/topic/gate/{gateId}/check`); single-instance only. | Same STOMP protocol, but Redis-backed relay so WebSocket fan-out scales horizontally across instances. |
| Eventing | No message broker; the `check-vehicle` REST call is the only integration point from edge to backend. | RabbitMQ event bus, transactional outbox from the backend, 9 standardized domain events. |
| Roles | Legacy: USER, APPROVER, SECURITY_OFFICER, ADMIN. | `PLATFORM_ADMIN`, `TENANT_ADMIN`, `MEMBER` — see `06_User_RBAC` for the full RBAC mapping. |
| Billing | None — one deployment per customer, no metering. | Stripe subscriptions, plan tiers with metered entitlements, usage recorded off the event stream. |
| Chatbot | None. | LLM tool-calling chatbot (default Ollama/Qwen or Llama, optional hosted provider) with tenant-scoped read tools. |
| Deployment | `docker-compose.yml` for local dev. | Docker Compose for dev, Kubernetes for production (HPA, Ingress-NGINX, cert-manager, GitOps). |

The gap is large but deliberate: per the canonical decision to **evolve, not rewrite** (see
ADR-0001 below and the platform-wide decision it is derived from), the current gate-access flow
becomes a subset of ParkVision rather than being discarded. Employee/Department/Position survive
as an optional "workforce" module for tenants that also want to manage staff vehicles — the
original use case this codebase was built for.

## 2. Problem statement

Operators running more than one parking site today face:

1. **No cross-site visibility.** Each site is either staffed independently or, in this codebase's
   current form, is its own single-tenant deployment — there is no consolidated view across sites
   for a regional or HQ operations manager.
2. **Manual, error-prone gate operations.** Entry/exit relies on a security guard confirming a
   plate match; nothing tracks a vehicle once it is inside the lot.
3. **No answer to "where is my car."** A vehicle can be relocated inside a lot (moved by staff, or
   the driver moves it and forgets) with no system of record for the new location — today's
   `VehicleLog` only records entry/exit events at a gate, not in-lot movement.
4. **No usage-based cost model for multi-site operators.** A chain with 3 sites and a chain with
   30 sites need materially different infrastructure and support cost, but nothing today
   differentiates that — deployments are effectively bespoke per customer.
5. **Support load on human staff for routine questions.** "Which slot is my car in", "when did it
   enter", "can I see the photo" are routine queries with no self-service path today.

## 3. Goals

- Give a multi-site operator one login, one dashboard, and one bill across all of its sites.
- Turn a plate-detection event into a **located vehicle** (site + zone + slot), not just a
  timestamped log line.
- Detect and alert on vehicle relocation without manual reconciliation.
- Let a driver or guard get an answer via chatbot instead of searching logs or calling support.
- Make the cost structure predictable and scale with usage (sites, cameras, retention, AI
  minutes, chatbot messages) via subscription plans.
- Preserve everything that works today (JWT auth, STOMP realtime, the edge store-and-forward
  queue, the gate-access workflow) — evolve the current single-tenant system into ParkVision
  incrementally rather than a ground-up rewrite.

## 4. Target customers

- **Primary: multi-site retail and commercial operators** — e.g. a supermarket chain with 10–50
  parking lots across a city or country, currently running either manual staffing or disconnected
  point solutions per site. This is the persona referenced throughout the brief and the domain
  model (`Tenant` = the chain, `Site` = each lot).
- **Secondary: single large-campus operators** — e.g. an office park, hospital, or university with
  one very large site that benefits from `Zone`/`ParkingSlot` granularity even without multiple
  physical sites (one `Tenant`, one `Site`, many `Zone`s).
- **Tertiary: the existing gate-access customer** — an organization that only needs
  Employee/Vehicle/Gate workforce access control (today's exact use case) and does not need
  parking-slot mapping or the chatbot; served by the lower plan tiers with those features simply
  unused/disabled by entitlement.

ParkVision is explicitly **not** targeting: individual consumers looking for a parking-finder app,
or integrators wanting a bare ANPR SDK to embed in third-party systems (see ADR-0001 for why the
vertical-SaaS path was chosen over a horizontal ANPR toolkit).

## 5. Value proposition

- **For the tenant operations lead:** one realtime dashboard across every site — occupancy,
  in/out counts, relocation alerts, exceptions — instead of N disconnected deployments.
- **For the tenant admin (ops that legacy SITE_MANAGER / SECURITY_GUARD / SECURITY_OFFICER held):** the same
  kiosk-style gate flow that exists today (`/gate/[gateId]` full-screen view with TTS), plus a
  live parking map instead of a bare event log.
- **For the driver (`MEMBER`):** self-service "where is my car" and "did it move" via the AI
  chatbot and, later, the mobile app — no need to call the front desk.
- **For the platform owner (`PLATFORM_ADMIN` / ParkVision the business):** a recurring subscription with natural
  expansion revenue as a tenant adds sites, cameras, retention, or chatbot usage — replacing a
  one-off, per-deployment sales motion with SaaS economics.

## 6. Product pillars

1. **Smart Parking 4.0** — end-to-end automation from motion detection through vehicle location
   to notification, replacing manual gate confirmation with an AI-driven pipeline.
2. **AI computer vision** — YOLOv11 vehicle detection + the existing YOLOv5 plate/character
   pipeline evolving toward PaddleOCR as primary OCR (EasyOCR/VietOCR as comparators for accuracy
   validation).
3. **Real-time tracking** — ByteTrack assigns a stable `track_id` per vehicle across frames, the
   foundation for relocation detection (today's system has no multi-object tracker — "tracking" is
   a per-plate-string cooldown dict, not object tracking).
4. **Slot mapping** — a `ParkingSlot` polygon per physical space (PostGIS geometry), vehicle
   center-point-in-polygon to know exactly which slot a vehicle occupies.
5. **Vehicle relocation detection** — same `track_id`, slot changed → `VehicleRelocated` domain
   event, closing the "where did my car go" gap that exists today.
6. **AI chatbot** — tool-calling LLM (`getVehicleLocation`, `getHistory`, `getSnapshot`,
   `getParkingStatus`), tenant-scoped, answering the exact questions drivers and guards ask today
   by phone or in person.
7. **Event-driven architecture** — RabbitMQ + transactional outbox turns every detection into a
   standardized, replayable domain event (`MotionDetected` … `NotificationSent`), instead of the
   current single synchronous `check-vehicle` REST call.
8. **Realtime dashboards** — the existing STOMP-over-WebSocket mechanism, scaled out with a Redis
   relay so dashboards update live across many concurrent tenants and sites, not just one broker
   instance.
9. **Docker/Kubernetes deployment** — the current `docker-compose.yml` dev flow is retained for
   local development; production adds Kubernetes (Deployments, HPA, Ingress-NGINX, cert-manager)
   for multi-tenant scale-out. Edge devices stay outbound-only on-site agents.

## 7. Success metrics / KPIs

Illustrative targets for evaluating product-market fit and platform health (to be refined with
real usage data once tenants are onboarded):

| Metric | Definition | Example target |
|---|---|---|
| Plate recognition accuracy | Correct plate string / total confirmed detections | ≥ 97% under good lighting, ≥ 90% overall |
| Relocation detection latency | Time from actual slot change to `VehicleRelocated` event | < 30 seconds p95 |
| Dashboard event latency | Time from edge detection to dashboard update | < 2 seconds p95 (STOMP/Redis path) |
| Edge offline resilience | Events successfully delivered after reconnect via the SQLite queue | 100% (zero data loss), matches today's store-and-forward guarantee |
| Tenant onboarding time | Time from signup to first site fully operational (cameras calibrated, slots mapped) | < 1 business day for a single-site tenant |
| Chatbot deflection rate | % of "where is my car" style queries resolved without human support | ≥ 60% within first 2 quarters of GA |
| Monthly recurring revenue (MRR) growth | Subscription revenue trend | tracked per plan tier, see `23_Roadmap` for phase targets |
| Site activation rate | % of a tenant's registered sites with at least one active camera | ≥ 90% steady-state |
| False relocation alert rate | Relocation alerts later marked false-positive by an operator | < 5% |

## 8. Business model

ParkVision sells **subscription SaaS** access, billed per tenant via **Stripe**, with plan tiers
gating metered entitlements rather than gating features outright (every tenant gets the full
product; plans differ in scale and AI usage):

| Plan | Sites | Cameras | Retention | AI minutes | Chatbot | Target customer |
|---|---|---|---|---|---|---|
| Free | 1 | 2 | 7 days | limited trial | not included | evaluation / proof of concept |
| Starter | up to 3 | up to 10 | 30 days | metered | not included | single small chain |
| Pro | up to 15 | up to 60 | 90 days | metered, higher cap | included | mid-size chain |
| Enterprise | unlimited | unlimited | custom | custom | included, custom tools | large chain, custom SLA |

Usage (sites, cameras, snapshot retention, AI processing minutes, chatbot messages) is metered off
the `ParkingEvent` stream into `UsageRecord`s and compared against the tenant's `Plan` limits;
overages prompt an upsell rather than a hard cutoff for paying tiers. See
`docs/00_Vision/diagrams/business-model.mmd` for the full flow and `03_SaaS_Architecture` /
`24_Future_Features` for how entitlement enforcement and billing integration are implemented.

## Diagrams

- `diagrams/product-vision.mmd` — flowchart from the five core problems, through the nine product
  pillars, to the tenant outcomes they produce; the throughline for why each pillar exists.
- `diagrams/business-model.mmd` — flowchart from tenant, through plan selection and metered
  entitlements, to usage-based billing and recurring revenue.
- `diagrams/product-roadmap.mmd` — a high-level, six-milestone flowchart from today's system to a
  GA multi-tenant SaaS platform. This is intentionally simple; the detailed phased plan with
  scoped work items lives in `23_Roadmap` and is not duplicated here.
- `diagrams/ecosystem.mmd` — flowchart of ParkVision and everything around it: tenants and sites,
  on-site edge devices, the event bus/cache/object storage core, the web dashboard and mobile app,
  the AI chatbot and its LLM provider, the payment provider, and notification channels.

## Decisions / ADRs

- [`adr/ADR-0001-product-positioning.md`](adr/ADR-0001-product-positioning.md) — decides that
  ParkVision positions as a vertical multi-tenant SaaS platform for parking operators, rather than
  a generic/horizontal ANPR toolkit or a single-tenant on-prem appliance business. This decision
  underpins every other architecture choice in the doc set (multi-tenancy, event bus, billing,
  RBAC).

## Open questions / risks

- **Scope creep risk:** the pillar list (AI pipeline, slot mapping, chatbot, billing, mobile,
  Kubernetes) is large for one platform; sequencing matters more than any individual decision —
  see `23_Roadmap` for how this is phased and de-risked.
- **AI accuracy at scale:** plate/vehicle detection accuracy under real-world lighting/weather at
  many concurrent sites is unproven beyond the current single-site YOLOv5 pipeline; PaddleOCR vs
  EasyOCR/VietOCR selection needs a measured bake-off before committing (tracked as an ADR-worthy
  decision in the edge/AI doc, not duplicated here).
- **Tenant data isolation is existential:** a shared-database RLS model (the chosen approach) must
  be proven leak-proof before onboarding real tenants with competitively sensitive site data (e.g.
  two competing supermarket chains on the same infrastructure); see `03_SaaS_Architecture`.
- **Chatbot tool-call safety:** every chatbot tool call must be strictly tenant-scoped; an LLM
  prompt-injection or tool-call bug that crosses tenant boundaries would be a severe trust failure
  for a SaaS product built on multi-tenant isolation as a selling point.
- **Existing customer migration:** any organization already running the single-tenant "Vision
  License Plate" system needs a defined migration path to a `Tenant`/`Site` model; this vision doc
  assumes evolution is possible but does not itself define the migration steps.
- **Pricing validation:** the plan tiers and limits in §8 are illustrative starting points, not
  validated against real willingness-to-pay data; expect revision after early customer
  conversations.

## Cross-references

- `01_Project_Overview` — detailed description of the current "Vision License Plate" system this
  vision evolves from.
- `02_Business_Flow` — today's and target end-to-end operational flows (entry/exit, approval,
  relocation).
- `03_SaaS_Architecture` (implied by brief §3.2) — multi-tenancy model (shared-schema + RLS),
  RBAC evolution, and the modular-monolith architecture style.
- `23_Roadmap` — the detailed, phased implementation plan; the roadmap diagram in this document is
  a high-level summary only.
- `24_Future_Features` — deeper detail on chatbot, mobile app, parking-map designer, and other
  target-state capabilities summarized as pillars here.
