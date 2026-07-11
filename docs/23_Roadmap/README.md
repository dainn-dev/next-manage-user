# Roadmap

ParkVision's delivery plan for turning the current single-tenant license-plate gate-access
system into the multi-tenant Smart Parking SaaS platform described in the vision. This document
sequences the work into eight phases (P0–P7), states what depends on what, and gives each phase
concrete, testable exit criteria so a team can plan sprints and staffing from it directly.

Status: Draft · Owner: Principal Architect · Last updated: 2026-07-09

> **Documentation status note.** This initial documentation batch delivers `00_Vision`,
> `01_Project_Overview`, `02_Business_Flow`, `23_Roadmap` (this document), and
> `24_Future_Features`. Every other numbered doc referenced below — `03_SaaS_Architecture`,
> `04_Multi_Tenant_Design`, `05_Subscription_Billing`, `06_User_RBAC`, `07_Camera_Management`,
> `08_Parking_Map_Designer`, `09_AI_Calibration`, `13_Event_Driven_Architecture`,
> `14_Backend_API`, `15_Database_Design`, `16_AI_Chatbot`, `17_Dashboard`, `18_Mobile_App`,
> `19_Notification`, `20_Analytics`, `21_Deployment`, `22_Testing` — is named here only as a
> **forward reference following the established numbering convention**. These are planned,
> not-yet-guaranteed-complete docs; a link to one is not evidence the corresponding design work
> has started. Treat the folder names as the contract for where that content will live, not as
> confirmation it exists today.

## 1. Current state vs. target

**Current state (§1 of the shared brief, verified from code today).** ParkVision's repo is a
single-tenant gate-access system: Spring Boot 3.2 / Java 17 backend on Postgres with no
`tenant_id` anywhere, four flat legacy roles (`USER`, `APPROVER`, `SECURITY_OFFICER`, `ADMIN`), STOMP
over WebSocket with an in-memory broker (no Redis), no message broker (no RabbitMQ), and an edge
service running YOLOv5-only detection (no PaddleOCR, no ByteTrack, no motion gating, no
parking-slot concept). There is no billing, no chatbot, no mobile app, and no Kubernetes
deployment — Docker Compose is the only deployment target today.

**Target (§2/§3 of the shared brief).** A multi-tenant SaaS platform with tenant/site/zone/slot
hierarchy enforced by Postgres RLS, an event-driven core (RabbitMQ + outbox + Redis), an
AI pipeline evolved to YOLOv11 + PaddleOCR + ByteTrack with slot-mapping and relocation
detection, a parking-map designer and live dashboards, an AI chatbot, Stripe billing, a mobile
app, and Kubernetes-based production deployment.

**The gap this roadmap bridges.** Every capability in the target column above is new work; none
of it exists in the repo today. The roadmap below is deliberately sequenced so that foundational,
cross-cutting pieces (tenancy, event schema) land before the features that depend on them
(dashboards, chatbot, analytics), while independent tracks (billing, mobile, platform hardening)
run in parallel to compress the calendar.

## 2. Planning assumptions

- The original vision issue sketched an "8-week roadmap." That was directional ambition, not a
  committed estimate — building RLS-enforced multi-tenancy, a new AI pipeline, an event bus, a
  chatbot, billing, a mobile app, and Kubernetes hardening in 8 weeks is not credible for a team
  evolving a live single-tenant system. This roadmap reframes that ambition into **eight
  phases across roughly 18 months**, with explicit parallel tracks so elapsed time is shorter
  than the sum of the phases.
- Architecture style follows decision §3.15: **modular monolith first** (`iam`, `tenancy`,
  `billing`, `parking`, `ai-ingest`, `events`, `chatbot`, `notification`, `analytics` as
  packages/modules inside the existing Spring Boot app), extracting services later only where
  load justifies it. Phases below build modules inside the monolith unless stated otherwise.
- "Exit criteria" are the Definition of Done for a phase to be considered shippable to at least
  one pilot tenant. They are written to be checkable in CI or a demo, not aspirational.
- Dates in the Gantt chart (`diagrams/roadmap-gantt.mmd`) are planning estimates anchored to a
  2026-07-13 kickoff (the Monday after this document's date), not commitments.

## 3. Phase plan

| Phase | Goal | Key docs (see status note above) | Exit criteria |
|---|---|---|---|
| **P0 — Multi-tenancy foundation** | Add `tenant_id`/`site_id` discriminators + Postgres RLS, build the `Tenant → Site → Zone → ParkingSlot` hierarchy, evolve RBAC to `PLATFORM_ADMIN`/`TENANT_ADMIN`/`MEMBER`. | `04_Multi_Tenant_Design`, `06_User_RBAC`, `15_Database_Design` | Flyway migrations (V36+) add `tenant_id`/`site_id` to every tenant-owned table; a Hibernate tenant filter is active on every session. RLS policies exist on all tenant-owned tables and a Testcontainers integration test proves cross-tenant reads/writes are blocked for at least `Vehicle`, `VehicleLog`, `Gate`, `User`. JWT issuance carries `tenant_id` + role. Existing single-tenant data is backfilled into a default tenant with zero row-count loss (pre/post migration count parity). The 3 product roles are enforced via `@PreAuthorize` + URL rules, with a documented mapping from legacy roles (`APPROVER` / `SITE_MANAGER` / `SECURITY_GUARD` / `SECURITY_OFFICER` / tenant `ADMIN` fold into `TENANT_ADMIN`; legacy `USER` → `MEMBER`; `PLATFORM_ADMIN` = SaaS operator). |
| **P1 — Edge AI upgrade** | MOG2 motion gate, YOLOv11 vehicle detection, PaddleOCR as primary OCR (EasyOCR/VietOCR as comparators), ByteTrack multi-object tracking, parking-slot polygon mapping, relocation detection. | `09_AI_Calibration`, `15_Database_Design` | MOG2 motion gate measurably reduces inference calls on a recorded idle-camera benchmark clip (target: ≥40% frame skip). YOLOv11 runs in shadow mode alongside the existing YOLOv5 plate pipeline with a documented precision/recall report vs. the YOLOv5-only baseline before it is promoted to primary. PaddleOCR plate-read accuracy on a labeled VN-plate benchmark set meets or beats the current YOLOv5-char baseline. ByteTrack produces a stable `track_id` per vehicle across frames, persisted as `VehicleTrack` rows. Vehicle-center-to-slot polygon mapping (PostGIS point-in-polygon) resolves to a `ParkingSlot.id`; the same `track_id` mapping to a new slot emits `VehicleRelocated`. The existing SQLite store-and-forward queue (§1) continues to pass its offline-resilience regression tests unchanged. |
| **P2 — Event bus + realtime** | Transactional outbox, RabbitMQ, backend ingest API, Redis (cache/presence/STOMP relay), Postgres time-partitioned event tables, object storage for snapshots. | `13_Event_Driven_Architecture`, `14_Backend_API`, `15_Database_Design` | Outbox table + relay publishes all 9 domain events (`MotionDetected` … `NotificationSent`) to RabbitMQ with p95 relay latency under a documented SLA (e.g. < 2s), verified by an integration test. `POST /api/v1/ingest/events` validates `event_id` idempotency; a duplicate `event_id` is a documented no-op (test asserts single persisted row for a replayed payload). `ParkingEvent` is partitioned by time and `EXPLAIN` on a date-range query shows partition pruning. Redis-backed STOMP relay lets 2+ backend instances fan out the same WebSocket topic to clients connected to different instances (scale-out integration test with 2 app replicas). Snapshots write to object storage (MinIO/S3-compatible) in non-dev profiles, with signed-URL retrieval. |
| **P3 — Dashboards + parking-map designer** | SVG/Canvas polygon editor for `ParkingSlot`s, live camera view, analytics dashboards. | `08_Parking_Map_Designer`, `17_Dashboard`, `07_Camera_Management` | `TENANT_ADMIN` can draw and edit `ParkingSlot` polygons over a camera still image and persist `calibration_json`; a draw → save → reload round-trip test renders an identical polygon. Live camera view renders at least an MJPEG fallback for 1 camera per site in a demo tenant (HLS/WebRTC gateway tracked as a stretch goal, not a blocking exit criterion). Occupancy dashboard reflects `ParkingSlot.status` changes pushed over STOMP within a documented latency budget (e.g. < 3s event-to-UI). Analytics view shows occupancy trend, average dwell time, and relocation count for a selectable date range on a single site. |
| **P4 — AI chatbot** | Ollama/Qwen tool-calling chatbot with tenant-scoped tools. | `16_AI_Chatbot`, `13_Event_Driven_Architecture` | The 4 tools (`getVehicleLocation`, `getHistory`, `getSnapshot`, `getParkingStatus`) are implemented as tenant-scoped internal read APIs; a security test asserts each rejects a cross-tenant request. End-to-end demo: chatbot answers "where is my car" for a seeded demo tenant via local Ollama + Qwen2.5, with the tool-call trace logged. An adversarial prompt suite (≥10 prompts attempting cross-tenant data access) shows 0 leaks. p95 chatbot response latency is measured and documented for the local-Ollama baseline. |
| **P5 — Billing + mobile app** | Stripe subscriptions/plans with metered entitlements; React Native (Expo) mobile app. | `05_Subscription_Billing`, `18_Mobile_App` | 4 plans (Free/Starter/Pro/Enterprise) with entitlement limits (max sites, max cameras, retention days, AI minutes, chatbot messages) are enforced at the API layer; an integration test per limit asserts a 403/429 on breach. Stripe checkout + webhook handling creates/updates `Subscription` rows; a `past_due`/`canceled` webhook is reflected in entitlement checks within one webhook-processing cycle. Expo app supports login, "where is my car," and push notification on `VehicleRelocated`/`VehicleEntered` for a demo tenant, verified on both an iOS and an Android simulator. Usage metering records at least the AI-minutes metric off the event stream, ready for P6. |
| **P6 — Analytics + notifications** | Usage metering, notification center, deeper cross-site analytics. | `20_Analytics`, `19_Notification`, `13_Event_Driven_Architecture` | Notification center delivers push/email/WS notifications for at least 3 event types (`VehicleRelocated`, an anomaly type, `Subscription past_due`) with read/unread state persisted per user. Usage-metering dashboard shows per-tenant consumption vs. plan entitlements, refreshed at least hourly. Cross-site analytics (multi-site occupancy comparison, peak-hour heatmap) is available to `TENANT_ADMIN`; an RLS integration test confirms a `MEMBER` cannot see another tenant's analytics in the same view. |
| **P7 — Kubernetes hardening** | Deployments/HPA/Ingress-NGINX/cert-manager, GitOps/Helm, managed or operator-run Postgres/Redis/RabbitMQ. | `21_Deployment` | Helm charts exist for backend, frontend, and the edge-ingest path; `helm install` brings up a working stack in a clean namespace (documented smoke test). HPA scales backend pods under a documented load test (e.g. 2x baseline event throughput triggers scale-out within 2 minutes). Ingress-NGINX + cert-manager issues a valid TLS cert for a staging domain automatically, with a passing renewal dry-run. A GitOps pipeline deploys on merge to a release branch, and a rollback (revert commit → previous version live) is tested within a documented time bound. Postgres/Redis/RabbitMQ run as managed services or operator-managed StatefulSets with a documented backup/restore runbook, and a restore drill is executed successfully at least once before GA. |

## 4. Dependencies between phases

The phase table reads top-to-bottom for narrative order, but the real build order is a DAG, not
a strict sequence. See `diagrams/phase-dependencies-flowchart.mmd` for the full graph; the load-
bearing edges are:

- **P0 gates almost everything.** P2's event schema carries `tenant_id`/`site_id` on every row
  (§3.5), so the outbox/ingest work cannot be finalized until P0's schema is in place. P3's map
  designer edits `ParkingSlot`/`Zone` rows, which P0 defines. P5's plan/entitlement model attaches
  to `Tenant`, which P0 defines. P4 and P6 depend on P0 transitively through P2.
- **P1 (edge AI) is independent of P0 at the code level** — it runs in the `edge/` Python service
  against its own detection pipeline — so it can start on day one in parallel with P0. Only its
  last sub-milestone, slot mapping + relocation detection, needs `ParkingSlot` rows to map into,
  so it is scheduled to land after P0's schema work completes.
- **P2 depends on P0** (event rows need `tenant_id`/`site_id` to be meaningful and RLS-safe) and
  is a soft dependency for P1 (P1 can produce events into a stub sink before P2 exists, but the
  outbox/RabbitMQ path is what makes those events useful platform-wide).
  Ingest API must also stay backward compatible with today's `check-vehicle` payload shape so
  existing edge deployments do not break during the transition.
  P2 largely happens before P1's last milestone completes, but P1 does not block P2.
- **P3 depends on P0** (schema) directly and **P2** (for live occupancy pushed over the
  Redis-backed STOMP relay); it is *helped but not blocked* by P1's slot-mapping AI — the polygon
  editor can be built and used manually before AI-assisted suggestions exist.
- **P4 depends on P2** (its tools are internal read APIs over the event/data model) and
  transitively on P0 for tenant scoping.
- **P5 is the most independent phase** — Stripe billing only needs `Tenant`/`Plan` from P0, and
  the mobile app mainly re-exposes existing/soon-to-exist REST APIs. It is scheduled to run
  parallel to P3/P4 to use engineering capacity that would otherwise sit idle waiting on P2.
- **P6 depends on P2** (event stream for metering/notifications) and **P5** (plan entitlements
  are what usage is metered against).
- **P7 is platform work, not a feature phase** — its early milestones (Helm/GitOps skeleton) can
  start in parallel with P0 since they do not depend on application schema. Its final hardening
  milestone (managed datastores, backup/restore drill) is scheduled to complete only after the
  feature phases it must hold (P5, P6) are done, since it needs a realistic workload to load-test
  against before General Availability (GA).

## 5. Timeline by quarter (indicative)

| Quarter | Focus |
|---|---|
| Q3 2026 (Jul–Sep) | P0 schema + RLS work begins; P1 YOLOv11/motion-gate work begins in parallel; P7 Helm/GitOps skeleton starts. |
| Q4 2026 (Oct–Dec) | P0 RBAC evolution completes; P1 OCR/tracking completes; P2 outbox + ingest API begin. |
| Q1 2027 (Jan–Mar) | P2 completes (Redis scale-out); P1 slot-mapping/relocation completes; P3 map designer and P5 billing begin in parallel. |
| Q2 2027 (Apr–Jun) | P3 live camera + dashboards complete; P4 chatbot built on P2's tool APIs; P5 mobile app continues. |
| Q3 2027 (Jul–Sep) | P6 notifications + analytics; P7 managed-datastore migration and HPA load testing. |
| Q4 2027 (Oct–Dec) | P7 pre-GA hardening (backup/restore drill, rollback test); bug bash across all phases; **GA launch**. |

This is roughly an 18-month plan from kickoff to GA, driven primarily by the P0 → P2 → {P3, P4,
P6} critical path, with P5 and the early half of P7 absorbing parallel capacity.

## 6. Diagrams

- [`diagrams/roadmap-gantt.mmd`](diagrams/roadmap-gantt.mmd) — Mermaid `gantt` chart of all eight
  phases and their sub-milestones, anchored to a 2026-07-13 kickoff, with `after` dependencies
  encoding the relationships described in §4 (e.g. P2's outbox milestone starts `after` P0's RLS
  milestone; P3's live-camera milestone starts `after` P2's Redis milestone).
- [`diagrams/phase-dependencies-flowchart.mmd`](diagrams/phase-dependencies-flowchart.mmd) — a
  `flowchart TD` of the phase-level dependency DAG, distinguishing hard dependencies (solid
  arrows) from soft/helpful-but-not-blocking dependencies (dashed arrows, e.g. P1 → P3), and
  showing the parallel P5/P7 tracks converging on a GA milestone.

## 7. Decisions / ADRs

No ADRs are recorded for this document. Per the shared brief's output conventions, a Roadmap is a
descriptive planning document, not a design document — it sequences and cross-references
decisions that are made (and recorded as ADRs) in the phase-specific docs listed in §3, such as
the multi-tenancy model in `04_Multi_Tenant_Design`, the outbox/event-bus choice in
`13_Event_Driven_Architecture`, and the OCR/tracker choices in `09_AI_Calibration`. This folder
therefore has no `adr/` directory.

## 8. Open questions / risks

- **RLS performance at scale is unproven.** Row-Level Security policies add per-query predicate
  overhead; P0's exit criteria should include a load-test benchmark before P2's event volume
  makes this expensive to discover late. Tracked in `04_Multi_Tenant_Design`.
- **YOLOv11 + PaddleOCR accuracy on Vietnamese plates is unproven** against the current YOLOv5
  two-model pipeline. P1's shadow-mode benchmark is a hard gate before cutover, not a formality —
  if accuracy regresses, the phase should slip rather than ship a worse detector.
  Tracked in `09_AI_Calibration`.
- **Edge appliance sizing is undecided.** YOLOv11 + ByteTrack + motion gating changes the
  per-camera compute budget; whether this stays on existing on-site hardware or requires a
  hardware refresh is an open question that affects P1's rollout cost.
- **RabbitMQ vs. a managed alternative (e.g. a cloud pub/sub service) is not yet decided** for
  the P7 managed-datastore milestone; the brief specifies RabbitMQ (§3.5), but the ops-cost
  trade-off for small pilot tenants vs. self-hosting should be revisited in
  `13_Event_Driven_Architecture` before P7's final hardening milestone.
- **Schema-per-tenant upgrade path (§3.2) is deferred design, not deferred risk.** The shared
  schema + RLS model is what P0 ships, but large/enterprise tenants may need schema isolation
  sooner than P7; this should be scoped explicitly in `04_Multi_Tenant_Design` rather than
  discovered during a large-tenant sales conversation.
- **Staffing contention across parallel tracks.** P3, P4, and P5 are scheduled to run in
  parallel to compress the calendar, but they compete for the same backend engineers who also
  own P2. If P2 slips, P3/P4's start dates slip with it even though P5 does not — the plan
  assumes distinct staffing pools for billing/mobile vs. platform/AI work; if that assumption is
  wrong, the Gantt chart's parallelism is optimistic.
- **GA gating on P7's final milestone is a scope risk.** If P6 or P5 slip, P7's pre-GA hardening
  milestone (which depends on both) slips with them; consider whether a reduced-scope GA
  (e.g. without full cross-site analytics) is acceptable to decouple the K8s hardening timeline
  from feature completeness.

## 9. Cross-references

- `00_Vision` — the source vision this roadmap operationalizes.
- `01_Project_Overview` — product framing and audience for ParkVision.
- `02_Business_Flow` — end-to-end business flows the phases above are built to support.
- `24_Future_Features` — capabilities explicitly out of scope for P0–P7; consult before adding a
  phase.
- `03_SaaS_Architecture` — the modular-monolith architecture style referenced in §2 of this doc.
- `04_Multi_Tenant_Design`, `06_User_RBAC`, `15_Database_Design` — P0 detail.
- `09_AI_Calibration` — P1 detail.
- `13_Event_Driven_Architecture`, `14_Backend_API` — P2 detail.
- `08_Parking_Map_Designer`, `17_Dashboard`, `07_Camera_Management` — P3 detail.
- `16_AI_Chatbot` — P4 detail.
- `05_Subscription_Billing`, `18_Mobile_App` — P5 detail.
- `20_Analytics`, `19_Notification` — P6 detail.
- `21_Deployment` — P7 detail.
- `22_Testing` — cross-cutting test strategy referenced by every phase's exit criteria.
