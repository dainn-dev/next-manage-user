# ParkVision — Smart Parking Platform (Multi-Tenant SaaS) · Architecture & Plan

> **Status:** Draft · **Owner:** Principal Architect · **Last updated:** 2026-07-09
> Issue: DAI-260. This is the master index for the ParkVision planning documentation set.

ParkVision is the multi-tenant SaaS evolution of the existing single-tenant
license-plate **gate-access** system in this repository ("Vision License Plate"). This doc set
analyzes the product vision in detail and lays out an **evolve-not-rewrite** plan to grow the
current system into a Smart Parking platform: multi-tenant / multi-site, AI vision pipeline
(motion → vehicle → plate → OCR → tracking → slot mapping → relocation), event-driven backbone,
AI chatbot, dashboards, mobile app, notifications, analytics, billing, and Kubernetes deployment.

## How to read this set

- Each numbered folder is one document: a substantial `README.md`, `diagrams/*.mmd` (Mermaid v11),
  an `images/` placeholder, and an `adr/` folder of Architecture Decision Records where a real
  decision with alternatives exists.
- Start with **00 → 01 → 02** for the "why/what", then **03–06** for the SaaS platform, then the
  capability tracks (**07–20**), then **21–24** for ops, roadmap and future work.
- Every document states **Current state** (grounded in the real code today) vs **Target**, so the
  gap and the migration path are explicit. The current system is single-tenant; RabbitMQ, Redis,
  PostGIS, ByteTrack, PaddleOCR, multi-tenancy, the map designer, the chatbot and the mobile app
  are **target additions**, not existing code.
- Cross-cutting canonical decisions live in the **[ADR register](./adr/README.md)** (48 ADRs).
- The API contract is **[openapi/openapi.yaml](./openapi/openapi.yaml)**; system-wide diagrams are
  in **[diagrams/](./diagrams/README.md)**.

## Document map

| # | Document | What it covers |
|---|----------|----------------|
| 00 | [Vision](./00_Vision/README.md) | Product vision, target customers, pillars, KPIs, business model |
| 01 | [Project Overview](./01_Project_Overview/README.md) | Current→target bridge, monorepo layout, glossary, gap table |
| 02 | [Business Flow](./02_Business_Flow/README.md) | End-to-end flows (onboarding, entry, relocation, exit, chatbot, approval) |
| 03 | [SaaS Architecture](./03_SaaS_Architecture/README.md) | Modular monolith, RabbitMQ, Redis, object storage, scaling, NFRs |
| 04 | [Multi-Tenant Design](./04_Multi_Tenant_Design/README.md) | Shared-schema + RLS, tenant/site hierarchy, isolation, GDPR |
| 05 | [Subscription & Billing](./05_Subscription_Billing/README.md) | Stripe, plans, entitlements, usage metering |
| 06 | [User & RBAC](./06_User_RBAC/README.md) | Role evolution, permission matrix, edge credentials |
| 07 | [Camera Management](./07_Camera_Management/README.md) | Camera/gate lifecycle, enrollment, health, live-view |
| 08 | [Parking Map Designer](./08_Parking_Map_Designer/README.md) | Polygon slot editor, PostGIS geometry, calibration handoff |
| 09 | [AI Calibration](./09_AI_Calibration/README.md) | ROI/threshold/homography calibration, per-camera profiles |
| 10 | [AI Pipeline](./10_AI_Pipeline/README.md) | Motion→YOLOv11→plate→OCR→ByteTrack→slot pipeline, current vs target |
| 11 | [Parking Slot Detection](./11_Parking_Slot_Detection/README.md) | Vehicle→slot point-in-polygon, occupancy state machine |
| 12 | [Vehicle Relocation](./12_Vehicle_Relocation/README.md) | Same track/plate, slot changed → VehicleRelocated |
| 13 | [Event-Driven Architecture](./13_Event_Driven_Architecture/README.md) | Domain events, RabbitMQ topology, transactional outbox |
| 14 | [Backend API](./14_Backend_API/README.md) | REST /api/v1 + WebSocket, ingest contract, error model |
| 15 | [Database Design](./15_Database_Design/README.md) | Target ERD, tenancy columns, PostGIS, partitioning, migrations |
| 16 | [AI Chatbot](./16_AI_Chatbot/README.md) | LLM + tool-calling, tenant-scoped tools, guardrails |
| 17 | [Dashboard](./17_Dashboard/README.md) | Web operator UI, live camera, parking map, realtime occupancy |
| 18 | [Mobile App](./18_Mobile_App/README.md) | React Native (Expo) driver app, find-my-car, alerts |
| 19 | [Notification](./19_Notification/README.md) | Alerts (moved/exited/loitering/offline), channels, preferences |
| 20 | [Analytics](./20_Analytics/README.md) | Occupancy, fill rate, dwell time, heatmaps, projections |
| 21 | [Deployment](./21_Deployment/README.md) | Docker Compose dev → Kubernetes prod, CI/CD, edge rollout |
| 22 | [Testing](./22_Testing/README.md) | Test pyramid, AI eval harness, multi-tenant isolation tests |
| 23 | [Roadmap](./23_Roadmap/README.md) | Phased plan P0→P7 with dependencies and exit criteria |
| 24 | [Future Features](./24_Future_Features/README.md) | Beyond-MVP: EV charging, dynamic pricing, digital twin, etc. |

Supporting material: [adr/](./adr/README.md) · [openapi/](./openapi/openapi.yaml) · [diagrams/](./diagrams/README.md)

## Existing operational docs (kept)

- [DOCKER_DEPLOYMENT.md](./DOCKER_DEPLOYMENT.md) — current container build & deploy notes.
- [ENVIRONMENT_SETUP.md](./ENVIRONMENT_SETUP.md) — current environment variables & local setup.
- [UPDATED_CREDENTIALS.md](./UPDATED_CREDENTIALS.md) — current role model & default-account handling.

## Canonical decisions at a glance

Evolve the existing Spring Boot 3.2 / Next.js 14 / Python edge / PostgreSQL / JWT / STOMP stack.
Add multi-tenancy (shared-schema + `tenant_id`/`site_id` + Postgres RLS), RabbitMQ (domain events
via transactional outbox), Redis (cache + WS scale-out), PostGIS (slot polygons), object storage
(MinIO/S3 for snapshots), an upgraded edge AI pipeline (MOG2 motion gate → YOLOv11 → PaddleOCR →
ByteTrack → slot mapping), an LLM chatbot with tenant-scoped tool-calling, a React Native mobile
app, Stripe billing, and a Docker-Compose-dev → Kubernetes-prod deployment path. Start as a
modular monolith; extract services along a Strangler path only when load justifies it. See the
[ADR register](./adr/README.md) for the full rationale behind each of these.
