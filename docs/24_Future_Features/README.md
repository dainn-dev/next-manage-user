# 24 — Future Features (Beyond-MVP)

ParkVision's near-term build plan is phased P0–P7 in `23_Roadmap`. This document is a
forward radar: a catalog of **beyond-MVP ideas** — features that are plausible, valuable
extensions of the platform once the core (multi-tenancy, slot mapping, event bus, AI
pipeline, billing) is in place, but that are explicitly **not** part of the near-term
roadmap. Each idea is written as a short spec (description, value, rough complexity,
dependencies) so a future planning pass can lift any of them into a real roadmap phase
without re-deriving the rationale from scratch.

Status: Draft · Owner: Principal Architect · Last updated: 2026-07-09

## 1. Current state vs. target

**Current state.** None of the ten ideas below exist in the codebase, and none are part
of the P0–P7 target build (`23_Roadmap`). The one piece of real, shipped infrastructure
any of them build on is the edge store-and-forward queue: a durable, bounded FIFO
**SQLite** queue (`edge/edge_queue/events.sqlite3`) with a background retry worker,
exponential backoff, and idempotent dedup by `event_id`, used today to buffer
`check-vehicle` calls when the backend is unreachable. Canonical decision §3.8 explicitly
keeps and extends this queue rather than replacing it — idea #8 (Offline-first edge) is
that extension. No other fact below reflects shipped code; everything else here is
speculative and should be read as "candidate for a phase beyond P7," not "planned."

**Target.** This doc exists so that when a tenant, sales conversation, or competitive
pressure surfaces one of these ideas, the team has a pre-thought-through starting point:
rough sizing, the value case, and which core platform pieces (multi-tenancy, event bus,
slot mapping, billing, RBAC) it would sit on top of. Promotion path: an idea here gets
scoped into a real phase in `23_Roadmap` once prioritized, at which point it should be
moved out of this document and into that one (or into its own dedicated doc folder, per
the `NN_Title` convention, if it's substantial enough).

## 2. How to read the specs

Each idea below has:
- **Description** — one paragraph, what it does.
- **Value** — why a tenant, site operator, or rider would want it.
- **Rough complexity** — S/M/L/XL, with a one-line reason (this is a t-shirt-size gut
  check for planning purposes, not an estimate to commit to).
- **Depends on** — which canonical decisions (`03_SaaS_Architecture` §3) or domain
  entities (§4) it needs underneath it. Most ideas depend on P0 multi-tenancy at minimum;
  only additional/notable dependencies are called out.

### Summary table

| # | Feature | Value in one line | Complexity | Key dependency |
|---|---------|--------------------|------------|-----------------|
| 1 | EV charging integration | New revenue stream + EV-driver stickiness | L | P1 slot mapping, billing |
| 2 | Dynamic pricing / reservations | Peak-demand revenue, guaranteed parking | M | P1 slot mapping, billing |
| 3 | ALPR-based payment | Frictionless entry/exit, no gate hardware | M | Core ANPR pipeline, billing |
| 4 | LP watchlists / security alerts | Real-time safety/security response | S | Event bus, notifications |
| 5 | Digital twin / heatmaps | Operational visibility + utilization insight | M | Slot mapping, time-series |
| 6 | Franchise / reseller tenancy | Channel/franchise go-to-market | XL | Core tenancy + RBAC (structural) |
| 7 | Edge model OTA updates | Improve AI accuracy without truck-rolls | L | Edge service, object storage |
| 8 | Offline-first edge | Keeps sites running through WAN outages | L | Existing SQLite queue (§1) |
| 9 | Federated analytics | Cross-tenant benchmarking, no raw-data leak | L | Multi-tenancy/RLS, time-series |
| 10 | Marketplace of AI models | Extensible AI ecosystem + partner revenue | XL | Modular AI pipeline, OTA (#7) |

## 3. Feature specs

### 3.1 EV charging integration

Slot-level EV charger status (charger id, connector type, power rating, available /
in-use / faulted) attached to a subset of `ParkingSlot` rows, with charging session
start/stop tied to the existing `VehicleEntered` / `VehicleExited` domain events so a
charging session's duration and energy delivered can be correlated with the vehicle that
used the slot. Optionally allow reserving EV-equipped slots exclusively for vehicles
that request charging.

- **Value.** Differentiates ParkVision for tenants adding EV infrastructure (malls,
  office campuses, supermarket chains). Lets riders see charger availability and
  reserve a charging slot, not just any slot. Gives operators a new metered revenue
  line (charging sessions) on top of parking.
- **Rough complexity: L.** New charger sub-entity and status model, integration with
  charger hardware (most realistically via the OCPP protocol or a per-vendor cloud API),
  new event handling, and metered billing. Hardware/vendor variance is the main risk,
  not the ParkVision-side data model.
- **Depends on.** P0 multi-tenancy, P1 slot mapping (`ParkingSlot`), the event bus
  (§3.5), and `Subscription` / `UsageRecord` metering (§3.10) if charging sessions are
  billed separately from parking.

### 3.2 Dynamic pricing / reservations

A demand-based pricing engine that adjusts the hourly rate per site/zone from historical
and live occupancy (read off the `ParkingEvent` stream), plus a pre-booking flow letting
a driver reserve a specific slot or slot class for a future arrival window — the slot
moves to `reserved` status until arrival or a booking-expiry timeout.

- **Value.** Lets operators capture more revenue during peak demand instead of a flat
  rate, and gives visiting drivers (a tenant's customers/employees/riders) the certainty
  of a guaranteed spot instead of circling a full lot.
- **Rough complexity: M.** Reuses the existing `ParkingSlot.status` enum (already has
  `reserved`) and the `ParkingEvent` stream for occupancy signal; the real work is the
  pricing-rules engine, a reservation state machine with expiry/no-show handling, and a
  rate-plan configuration UI, not new core data structures.
- **Depends on.** P1 slot mapping and live occupancy, P0 multi-tenancy (per-tenant
  pricing config), and Stripe billing (§3.10) for reservation holds/deposits.

### 3.3 ALPR-based payment

The plate already recognized at entry (`PlateRecognized` → `VehicleEntered`) is tied to
a pre-registered payment method, or to a post-pay invoice keyed by plate/owner. Exit
(`VehicleExited`) automatically triggers an invoice or charge — no physical ticket, no
gate arm required. "Frictionless" entry/exit for tenants that want to remove barrier
hardware entirely.

- **Value.** Removes ticket-dispenser and gate-arm hardware cost for high-turnover
  tenants (retail, malls, quick-service sites), speeds throughput at busy hours, and
  gives operators auditable per-vehicle billing tied to actual dwell time instead of a
  flat validated rate.
- **Rough complexity: M.** The core ANPR pipeline (§3.8) already produces the plate and
  entry/exit events this needs; the addition is a payment-method-to-plate binding,
  invoice generation on `VehicleExited`, and dispute handling for plate misreads,
  tailgating, or shared/rental vehicles.
- **Depends on.** P0 multi-tenancy, the core ANPR pipeline (YOLOv11 + PaddleOCR +
  ByteTrack, §3.8), the event bus, and Stripe billing (§3.10). Needs a higher OCR
  confidence bar than informational use cases, since a misread here means an incorrect
  charge, not just a logging error.

### 3.4 LP watchlists / security alerts

A per-tenant (or, where legally permitted, platform-wide) list of flagged license plates
— stolen, banned, VIP, etc. — checked against every `PlateRecognized` event. A match
raises a `Notification` in real time to site security/managers over the existing
push/WebSocket channel.

- **Value.** Safety/security differentiator for tenants with security obligations
  (corporate campuses, malls, gated communities); fast operational response to a known
  bad actor. The same mechanism doubles as a positive-use "VIP arriving" alert.
- **Rough complexity: S.** A lookup table plus an event subscriber added to the existing
  `PlateRecognized` handling and the `Notification` model (§4). No new AI/ML work — this
  rides entirely on the ANPR pipeline that other target work already builds.
- **Depends on.** The core ANPR event stream (`PlateRecognized`), the event bus /
  RabbitMQ (§3.5), and notification delivery (push/WS, §3.12, `Notification` entity in
  §4). Needs a data-retention/privacy policy per tenant jurisdiction before shipping.

### 3.5 Digital twin / heatmaps

A live 2D (3D as a stretch goal, not initial scope) visual model of a site's parking map
showing real-time slot occupancy color-coded by status, plus historical heatmaps of slot
utilization by hour/day/zone built from the `ParkingEvent` time-series.

- **Value.** Gives site managers an at-a-glance operational view of their lot, and gives
  tenants aggregate insight into over/under-used zones to inform layout, pricing, or
  capacity decisions. Strong sales-demo visual for the platform generally.
- **Rough complexity: M.** The live 2D view reuses the Parking-Map Designer's slot
  polygons (§3.12) plus a live WebSocket feed; the historical heatmap needs time-bucketed
  aggregation queries over the partitioned `ParkingEvent` tables (§3.7). 3D rendering is
  explicitly out of initial scope if this is picked up.
- **Depends on.** P1 slot mapping and the Parking-Map Designer, time-series partitioning
  of `ParkingEvent` (§3.7), and Redis pub-sub (§3.6) if live fan-out needs to scale
  beyond one backend instance.

### 3.6 Franchise / reseller multi-level tenancy

A `Reseller` entity above `Tenant` in the hierarchy —
`Platform → Reseller → Tenant → Site` — so a franchise operator or channel partner can
white-label ParkVision, manage a portfolio of tenants under one console, see roll-up
billing/analytics across that portfolio, and (optionally) apply its own branding or
pricing markup, without weakening the Tenant-level RLS isolation the rest of the
platform depends on.

- **Value.** Opens a channel-sales / franchise go-to-market motion — e.g. a
  parking-garage franchisor onboarding and managing many independently billed
  franchisee locations from one console, or a systems-integrator reselling ParkVision
  under its own brand.
- **Rough complexity: XL.** This is a structural change to the isolation model, not an
  additive feature: it touches the core tenancy model and RLS policies (§3.2), JWT claim
  shape, billing roll-ups (`Subscription`/`Plan`, §4), and RBAC (a new
  reseller-scoped role sitting between `PLATFORM_ADMIN` and `TENANT_ADMIN`). This is the
  one idea in this document with a genuine architectural fork with real alternatives —
  see **ADR-2401** below.
- **Depends on.** P0 multi-tenancy (the `tenant_id` + RLS model) and P0 RBAC; has
  billing implications for `Subscription`/`Plan`/`UsageRecord` roll-up (§4).

### 3.7 Edge model OTA updates

A fleet-management channel for pushing new YOLOv11 / PaddleOCR model weight versions out
to on-site edge devices (the `EdgeService` described in §1), with version pinning, staged
rollout, health-check-gated promotion, and rollback if accuracy or heartbeat health
regresses after an update.

- **Value.** Lets ParkVision improve detection accuracy over time — new training data,
  new regional plate formats, better low-light performance — without a truck-roll to
  every site, and lets an operator canary a new model on one camera before a fleet-wide
  push.
- **Rough complexity: L.** Needs a model artifact registry, a secure download-and-verify
  channel to edge devices that today only initiate outbound connections (§3.14), local
  model versioning/rollback logic added to the edge service, and rollout orchestration
  (per-camera or per-site canary before fleet-wide promotion).
- **Depends on.** The edge service architecture (`EdgeService`, §1), P0 multi-tenancy
  and per-site scoping (for tenants with custom-trained models), and object storage
  (MinIO/S3, §3.7) for model artifacts.

### 3.8 Offline-first edge

Extends the store-and-forward queue that already ships today (durable SQLite FIFO queue
at `edge/edge_queue/events.sqlite3`, idempotent dedup by `event_id`, background retry
with exponential backoff — §1) from "buffer failed `check-vehicle` calls" into full
offline operation: a local cache of last-known slot state/occupancy, local
relocation/alerting logic that keeps working with no backend connection, and a defined
sync-on-reconnect protocol that reconciles local and server state, including conflict
resolution for events recorded while offline.

- **Value.** Keeps a site operational — entry/exit still gated and logged, security
  alerts (#4) still fire locally — through WAN/ISP outages, which matters for sites with
  unreliable connectivity or edge appliances behind restrictive corporate networks.
- **Rough complexity: L.** The hard part — a durable queue with idempotent dedup — is
  already built and is explicitly meant to be kept & extended (§3.8 of the architecture
  decisions), so this is the one idea in the document with real infrastructure to build
  on rather than a green field. The new work is local slot-state/relocation logic
  running edge-side and a robust reconciliation protocol for the reconnect window.
- **Depends on.** The existing SQLite queue (§1) as its direct foundation, P1 slot
  mapping/relocation logic running edge-side once it exists, and the ingest API's
  idempotency-key contract (§3.16).

### 3.9 Federated analytics

Cross-tenant aggregate benchmarking — e.g. "your Tuesday-afternoon occupancy is in the
top 20% among similar-sized sites in your region" — computed from `ParkingEvent`
aggregates without ever exposing another tenant's raw events, plate data, or identity.
Only derived, anonymized statistics cross a tenant boundary; raw data never does.

- **Value.** Gives tenants a "how do we compare" signal no single-site or on-prem-only
  competitor can offer, since it depends on the platform's aggregate scale across many
  tenants — a differentiator specific to being a multi-tenant SaaS.
- **Rough complexity: L.** Requires a strict aggregation/anonymization layer (minimum
  cohort sizes so no small-cohort re-identification is possible, no plate/PII crossing
  a tenant boundary under any code path), a separate analytics pipeline reading the
  partitioned `ParkingEvent` tables (§3.7), and per-tenant legal/ToS opt-in before a
  tenant's data contributes to any benchmark.
- **Depends on.** P0 multi-tenancy/RLS (to firmly separate the raw-data path from the
  aggregate/anonymized path), time-series partitioning (§3.7), and likely a consent flag
  on the `Tenant` entity (§4).

### 3.10 Marketplace of AI models

Lets tenants or third-party partners plug in alternative detection/OCR/tracking models —
e.g. a region-specific plate OCR tuned for a market ParkVision doesn't cover well, or a
different vehicle classifier — behind the same pipeline interface, with published
accuracy/latency benchmarks and, for partner-submitted paid models, a revenue-share
arrangement when a tenant adopts one.

- **Value.** Turns the AI pipeline from a fixed vendor choice into an extensible
  ecosystem: tenants pick the best-fit model for their region, lighting conditions, or
  plate format, and the platform opens a partner revenue stream instead of only a
  ParkVision-authored model set.
- **Rough complexity: XL.** Requires a stable, versioned plugin interface at each
  pipeline stage (motion detection, vehicle detection, OCR, tracking), a model
  certification/benchmarking harness so listed models are trustworthy, marketplace
  listing and revenue-share billing infrastructure, and sandboxing of untrusted
  partner-submitted model code for safety.
- **Depends on.** The edge AI pipeline being genuinely modular at each stage (§3.8), the
  OTA update mechanism (#7) to distribute marketplace models to edge devices, and
  `Subscription`/billing infrastructure (§3.10) for revenue share.

## 4. Diagrams

- [`diagrams/future-features-mindmap.mmd`](diagrams/future-features-mindmap.mmd) — a
  mindmap with "ParkVision Future Features" as the central node, branching to each of
  the ten ideas above with their one or two defining sub-points. Intended as a
  quick-scan visual index into the specs in §3, not a substitute for reading them.

## 5. Decisions / ADRs

- [`adr/ADR-2401-franchise-reseller-tenancy-model.md`](adr/ADR-2401-franchise-reseller-tenancy-model.md) —
  records the alternatives considered for idea #6 (Franchise / reseller multi-level
  tenancy), since it is the one idea in this document that forks the core tenancy model
  rather than sitting cleanly on top of it. No other idea in this document required an
  ADR: the remaining nine are feature-level extensions of the target architecture
  decided in `03_SaaS_Architecture`, not new architectural forks.

## 6. Open questions / risks

- **Scope creep into the roadmap.** These ideas exist so they are *not* accidentally
  pulled into P0–P7 scope by feature pressure; each promotion into `23_Roadmap` should
  be a deliberate prioritization decision, not a drift.
- **Privacy/legal exposure.** Watchlists (#4) and federated analytics (#9) both involve
  data crossing normal tenant/visibility boundaries and need jurisdiction-specific legal
  review before design, not after.
- **Payment liability.** ALPR-based payment (#3) and dynamic pricing (#2) both create
  real financial exposure from an OCR misread or a slot-mapping error; whichever is
  built first needs an explicit confidence-threshold and dispute-resolution design, not
  just a feature flag.
- **Reseller tenancy is a fork, not an add-on.** Idea #6 is flagged XL and has its own
  ADR precisely because retrofitting a reseller layer after tenants are already live is
  materially harder than deciding it up front; if this idea gains traction it should be
  re-evaluated early, not left until many tenants exist.
- **Hardware/vendor variance.** EV charging (#1) and edge OTA updates (#7) both depend
  on third-party hardware/protocol behavior (charger vendors, edge device fleets in the
  field) that is hard to fully scope from the software side alone.
- **Marketplace trust and safety.** A model marketplace (#10) means running
  partner-submitted code against live camera feeds; sandboxing and certification are
  prerequisites, not follow-ups, if this is ever picked up.

## 7. Cross-references

- `00_Vision` — overall product vision this document's ideas extend beyond.
- `01_Project_Overview` — current-state project summary; §1 above cites the same
  ground-truth facts.
- `02_Business_Flow` — today's and target business flows these features would sit on
  top of.
- `23_Roadmap` — the near-term P0–P7 target build; every idea in this document is a
  candidate for a phase beyond P7, not part of that roadmap today.
- `03_SaaS_Architecture` — canonical architecture decisions (multi-tenancy, event bus,
  edge AI evolution, RBAC, billing) that every idea above depends on.
- `04_Multi_Tenant_Design` — the `tenant_id`/RLS isolation model that idea #6 (Franchise
  / reseller tenancy) proposes extending.
- `05_Subscription_Billing` — the Stripe/`Subscription`/`Plan` model several ideas
  (#1, #2, #3, #6, #10) meter or bill against.
- `13_Event_Driven_Architecture` — the domain event bus several ideas (#1, #3, #4, #5)
  consume events from.
- `15_Database_Design` — the target domain model (§4 of the shared brief) referenced
  throughout this document's specs.
