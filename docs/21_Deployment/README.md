# 21. Deployment

Deployment & operations for ParkVision: how the platform is packaged, run, scaled, observed, and
kept up to date — from today's single-host Docker Compose deployment to a multi-tenant
Kubernetes production target, plus how the on-site edge appliance fits into both.

Status: Draft · Owner: Principal Architect · Last updated: 2026-07-09

## 1. Current state vs Target

**Current state (verified in code/config, brief §1).** The repo ships a single production
topology: root **`docker-compose.yml`** runs three services — `postgres:15-alpine` (db
`vehicle_management`), `backend` (built from `backend/Dockerfile`, Spring Boot on **Jetty
:8080**, REST base `/api`, requires `JWT_SECRET` env, optional `GATE_API_KEY`), and `frontend`
(built from `frontend/Dockerfile`, **Next.js `standalone` build on :3000**, talks to
`NEXT_PUBLIC_API_URL=http://localhost:8080/api`). The `deploy/` folder holds variants of this same
idea: `docker-compose.dev.yml` (adds `init-db.sql` seeding, `SPRING_JPA_HIBERNATE_DDL_AUTO:
validate`, `SPRING_FLYWAY_BASELINE_ON_MIGRATE: true`, and container healthchecks against
`GET /api/actuator/health`) and `docker-compose-image.yml` (pulls pre-built images, e.g.
`dainndev/vehicle-management-backend:latest`, from Docker Hub instead of building locally), plus
helper scripts `build-and-run-dev.sh/.bat` and `docker-build-push.sh/.bat`. Observability today is
**Micrometer + Prometheus**, exposed at `/actuator/prometheus` (`management.endpoints.web.
exposure.include: health,info,metrics,prometheus`, permitAll at the security-filter level per
brief §1) — nothing in-repo currently scrapes or visualizes it (no Prometheus server, no Grafana
config checked in). The **edge** runs on-site today as a Python process per camera/gate,
connecting outbound to the backend over `X-Gate-Key`-authenticated REST calls, with a local
SQLite store-and-forward queue for resilience (brief §1) — there is no fleet-management or OTA
update mechanism in the repo today.

**Target.** Dev stays Docker Compose, extended with Redis, RabbitMQ, MinIO, and optionally
Ollama. Production moves to **Kubernetes**: Deployments + HPA behind Ingress-NGINX with
cert-manager, Helm charts reconciled via GitOps, managed (or operator-run) Postgres+PostGIS/Redis/
RabbitMQ, object storage for snapshots, a full observability stack (Prometheus/Grafana/Loki/
tracing), a real edge fleet deployment & OTA update story, backup/DR, and CI/CD.

| Aspect | Current | Target |
|---|---|---|
| Dev orchestration | Docker Compose (3 services) | Docker Compose (+ Redis, RabbitMQ, MinIO, Ollama) |
| Prod orchestration | Docker Compose, single host | Kubernetes: Deployments, HPA, Ingress-NGINX, cert-manager |
| Deploy mechanism | Manual `docker-compose up` / helper scripts | Helm + GitOps (Argo CD/Flux) |
| Postgres | Single container, no PostGIS | Managed (or operator) Postgres + PostGIS |
| Event bus / cache | None | Managed (or operator) RabbitMQ, Redis |
| Snapshot storage | Local disk (`uploads/snapshots`, Docker volume) | Object storage (MinIO/S3) |
| Observability | Prometheus endpoint only, unconsumed | Prometheus + Grafana + Loki + tracing |
| Edge updates | None (manual) | Fleet registry + OTA update agent |
| CI/CD | None in repo | Full pipeline: lint/test/build/scan/deploy/smoke |

## 2. Dev environment (target)

Extends today's `docker-compose.yml` topology with target dependencies, all still local
containers — no new cloud dependency for local development:

| Service | Role | Notes |
|---|---|---|
| `postgres` | Primary datastore | Same as today; PostGIS extension enabled for dev too |
| `backend` | Spring Boot API | Same image/build as today |
| `frontend` | Next.js UI | Same image/build as today |
| `redis` | Cache, rate-limit, STOMP relay, dedup | New — brief §3.6 |
| `rabbitmq` | Domain event bus | New — brief §3.5 |
| `minio` | S3-compatible object storage | New — brief §3.7, ADR-2102 |
| `ollama` (optional) | Local LLM for chatbot dev | New — brief §3.11, only needed when working on `16_AI_Chatbot` |

See `diagrams/dev-docker-compose-topology.mmd`.

## 3. Production: Kubernetes (target)

Per ADR-2101: **Deployments** for `backend`/`frontend` behind **Services**, **HPA** scaling on
CPU/custom metrics, **Ingress-NGINX** + **cert-manager** for TLS, **Secrets** for all credentials
(`JWT_SECRET`, `GATE_API_KEY`, DB/Redis/RabbitMQ/Stripe credentials), **Helm** charts reconciled
by a **GitOps** controller. Stateful dependencies run managed-by-default with an operator-run
fallback (ADR-2103). See `diagrams/kubernetes-architecture.mmd`.

### Observability stack

- **Metrics**: Prometheus (Operator-managed), scraping the backend's existing
  `/actuator/prometheus` endpoint (brief §1 — this endpoint already exists, only the scraper is
  new) plus RabbitMQ/Redis/Postgres exporters.
- **Dashboards**: Grafana.
- **Logs**: Loki (+ Promtail/Fluent Bit shipping pod logs).
- **Tracing**: OpenTelemetry collector, for tracing an event from edge ingest through the bus to
  notification/analytics consumers — valuable given the now-asynchronous, multi-hop event flow
  (`13_Event_Driven_Architecture`).

### Backup / DR

- Postgres: automated snapshots + point-in-time recovery via the managed provider (ADR-2103);
  documented RPO/RTO targets are an implementation follow-up.
- Object storage (snapshots): versioned bucket + cross-region replication for tenants on
  higher-tier plans (entitlement-gated, brief §3.10).
- RabbitMQ: mirrored/quorum queues for durability of in-flight events between the outbox relay and
  consumers (notification, analytics).
- Config/secrets: GitOps repo is the source of truth for cluster state (excluding actual secret
  values, which live in a secret manager), so a full environment can be reconstructed from Git +
  restored data.

## 4. CI/CD (target)

Lint → unit tests → integration tests (Testcontainers: Postgres, RabbitMQ, Redis — see
`22_Testing`) → build image → scan → push to registry → update GitOps repo image tag → deploy to
staging → E2E (Playwright) → manual approval gate → deploy to prod (rolling update) → smoke test
against `/actuator/health` → automated rollback on smoke-test failure. This generalizes and
automates what `deploy/docker-build-push.sh/.bat` do manually today (build + push an image to a
registry). See `diagrams/cicd-pipeline.mmd`.

## 5. Edge deployment & updates

The edge continues to run **on-site**, one process per camera/gate, connecting **outbound only**
to the backend ingest API (no inbound ports exposed at the site — unchanged security posture from
today, brief §1). The **SQLite store-and-forward queue is kept and extended** (brief §3.8) as the
resilience mechanism for network/backend outages. New in the target: a **fleet registry** tracking
every deployed edge appliance/camera, a **release channel** (stable/canary) for update rollout,
and an **OTA update agent** on each appliance that polls for or receives signed updates, applies
them, and reports its running version back to the registry — closing the gap that today's edge has
no update mechanism at all. See `diagrams/edge-deployment.mmd`.

## 6. Diagrams

- [`diagrams/dev-docker-compose-topology.mmd`](diagrams/dev-docker-compose-topology.mmd) — today's
  3-service Compose stack plus the target Redis/RabbitMQ/MinIO/Ollama additions, and how the edge
  connects in.
- [`diagrams/kubernetes-architecture.mmd`](diagrams/kubernetes-architecture.mmd) — the target prod
  cluster: ingress, Deployments/HPA, managed stateful services, observability stack, GitOps.
- [`diagrams/cicd-pipeline.mmd`](diagrams/cicd-pipeline.mmd) — the target pipeline from commit to
  production smoke test and rollback.
- [`diagrams/edge-deployment.mmd`](diagrams/edge-deployment.mmd) — on-site edge topology, the
  existing store-and-forward queue, and the target fleet/OTA update mechanism.

## 7. Decisions / ADRs

- [`adr/ADR-2101-kubernetes-for-prod.md`](adr/ADR-2101-kubernetes-for-prod.md) — Kubernetes over
  Compose/Swarm for production orchestration.
- [`adr/ADR-2102-object-storage-minio-s3.md`](adr/ADR-2102-object-storage-minio-s3.md) — MinIO/S3
  object storage for snapshots, replacing local disk, required for stateless horizontal scaling.
- [`adr/ADR-2103-managed-vs-selfhosted-stateful-services.md`](adr/ADR-2103-managed-vs-selfhosted-stateful-services.md) —
  managed-by-default with an operator-run fallback for Postgres/Redis/RabbitMQ.

## 8. Open questions / risks

- **Multi-region / data residency** for enterprise tenants is not addressed in this doc — flagged
  as a future extension once a concrete tenant requirement exists.
- **Cost model** for managed services at scale needs real usage projections once tenant/site
  counts are estimated; this could shift the managed-vs-self-hosted balance in ADR-2103 for
  specific services.
- **Edge OTA rollout safety** (canary %, automatic rollback on appliance failure) needs a concrete
  design once the fleet registry is built — this doc only establishes that the capability exists,
  not its rollout policy.
- **Secrets rotation** (JWT signing key, Gate API key, DB credentials) process is not yet defined;
  today's `GATE_API_KEY` "runs OPEN if unset" dev fallback (brief §1) must be hard-disabled in
  every non-dev environment.

## 9. Cross-references

- `13_Event_Driven_Architecture` — RabbitMQ deployment shape referenced by the K8s diagram here.
- `04_Multi_Tenant_Design` — PostGIS/RLS requirements on the managed Postgres choice (ADR-2103).
- `19_Notification`, `20_Analytics` — consumers whose queue depth may drive backend HPA scaling.
- `22_Testing` — the Testcontainers-based integration tests this doc's CI/CD pipeline runs, and
  the E2E/load tests gating staging→prod promotion.
- `05_Subscription_Billing` — plan-based retention/entitlement limits enforced via object-storage
  lifecycle policies (ADR-2102).
