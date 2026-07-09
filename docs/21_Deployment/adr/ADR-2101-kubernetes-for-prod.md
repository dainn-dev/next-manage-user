# ADR-2101: Kubernetes for prod vs compose/swarm

- Status: Proposed
- Date: 2026-07-09
- Deciders: Principal Architect
- Context doc: 21_Deployment

## Context

Today's deployment surface is entirely **Docker Compose**: the root `docker-compose.yml` (three
services — `postgres:15-alpine`, `backend` building from `backend/Dockerfile` on Jetty `:8080`,
`frontend` building from `frontend/Dockerfile` as a Next.js `standalone` build on `:3000`), plus
`deploy/` variants — `docker-compose.dev.yml` (adds `init-db.sql` seeding, `ddl-auto: validate`,
Flyway `baseline-on-migrate`, healthchecks against `/api/actuator/health`) and
`docker-compose-image.yml` (pulls pre-built images, e.g. `dainndev/vehicle-management-backend`,
from Docker Hub rather than building locally), plus shell/batch helper scripts
(`build-and-run-dev.sh/.bat`, `docker-build-push.sh/.bat`). This is a single-host, single-tenant
deployment model: one Postgres, one backend, one frontend, no horizontal scaling, no rolling
deploys beyond `restart: unless-stopped`, and Prometheus metrics exposed but nothing consuming
them in-cluster. The target platform is multi-tenant SaaS serving many parking sites, needs
horizontal scale-out (multiple backend instances behind the Redis-backed STOMP relay, brief
§3.6), rolling zero-downtime deploys, per-tenant load isolation, autoscaling under variable
camera-event load, and a real secrets/certificate story. We need to decide the production
orchestration platform.

## Decision

**Kubernetes** is the target production orchestration platform. Concretely:

- **Deployments** for `backend` and `frontend`, each with a **HorizontalPodAutoscaler (HPA)**
  scaling on CPU and/or custom metrics (e.g. RabbitMQ queue depth, request rate).
- **Ingress-NGINX** as the ingress controller, terminating TLS certificates managed by
  **cert-manager** (Let's Encrypt or a private CA).
- **Secrets** (JWT_SECRET, GATE_API_KEY, DB/Redis/RabbitMQ credentials, Stripe keys) held in
  Kubernetes Secrets, sourced from a secret manager (cloud KMS-backed) rather than plain manifests.
- **Helm** charts define the deployable unit per service; a **GitOps** controller (Argo CD or
  Flux) reconciles cluster state from a Git repo, so "deploy" means "merge to the environment
  branch," not a manual `docker-compose up` on a host.
- Stateful dependencies (Postgres+PostGIS, Redis, RabbitMQ) run as **managed cloud services or
  Kubernetes operators** — the specific choice per service is ADR-2103, not this ADR.
- Docker Compose is **retained for local development only** (extended per the target dev topology
  diagram, not replaced) — this is not a "rewrite the dev workflow" decision, only a production
  orchestration decision.

## Alternatives considered

- **Kubernetes** (chosen) — pods, Deployments, HPA, Ingress-NGINX, cert-manager, Helm/GitOps.
  - Pros: industry-standard autoscaling and self-healing; every major cloud offers managed K8s
    (EKS/GKE/AKS), reducing control-plane operational burden; rich ecosystem for the observability
    stack (Prometheus Operator, Grafana, Loki) already targeted (brief §3.14); natural fit for the
    modular-monolith-now/extract-services-later strategy (brief §3.15) since new services are just
    new Deployments in the same cluster; strong secrets/RBAC primitives needed for multi-tenant
    compliance posture.
  - Cons: materially more operational complexity and learning curve than Compose; requires
    investment in Helm charts, GitOps tooling, and cluster operations (upgrades, node pools) that
    do not exist today; overkill if the platform never grows past a handful of tenants.

- **Docker Swarm.**
  - Pros: much smaller step up from Compose (Swarm mode reuses Compose-file syntax essentially
    unchanged); simpler mental model; adequate rolling-update and scaling primitives for a modest
    fleet.
  - Cons: materially smaller ecosystem and hiring pool than Kubernetes; weaker autoscaling
    (no built-in HPA-equivalent tied to custom metrics); most managed-cloud "database/queue as a
    service" and observability tooling assumes Kubernetes, not Swarm, so the team would still end
    up hand-rolling integration work; effectively a dead-end technology choice for a platform
    explicitly targeting scale (brief: "multi-tenant SaaS").

- **Stay on Docker Compose in production, scaled vertically per tenant or via multiple Compose
  stacks per host.**
  - Pros: zero new tooling — literally what exists today, per `docker-compose.yml`.
  - Cons: no rolling deploys without downtime; no autoscaling; scaling out means manually
    provisioning more hosts and Compose stacks, which does not compose (pun intended) with
    shared-schema multi-tenancy's economics (brief §3.2 — the whole point is shared infrastructure
    serving many tenants); no practical HPA-equivalent; rejected outright for prod, though this is
    exactly what dev/staging keeps using.

## Consequences

- Positive: production gets real autoscaling, rolling deploys, and a GitOps-auditable deployment
  history; the observability stack (Prometheus already emitting `/actuator/prometheus`, per brief
  §1) plugs directly into the standard Prometheus Operator pattern; aligns with the
  modular-monolith-then-extract strategy (brief §3.15) — extracting `ai-ingest` or `analytics`
  into a separate service later is "add a Deployment," not "re-architect the platform."
- Negative / trade-offs: the team takes on Kubernetes operational complexity (cluster upgrades,
  RBAC, network policy, node autoscaling) that does not exist today; Helm chart and GitOps
  tooling must be built from scratch; local dev/staging intentionally stays on Compose, so there
  is a real environment-parity gap to manage (mitigated by keeping images identical between
  Compose and K8s — same `Dockerfile`s).
- Follow-ups: ADR-2103 covers whether stateful services (Postgres/Redis/RabbitMQ) are managed or
  self-hosted/operator-run inside the cluster; Helm chart structure and GitOps repo layout are
  implementation tickets, not further ADRs.
