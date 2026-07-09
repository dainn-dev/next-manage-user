# ADR-2103: Managed vs self-hosted stateful services

- Status: Proposed
- Date: 2026-07-09
- Deciders: Principal Architect
- Context doc: 21_Deployment

## Context

The target production stack (brief §3, §2) adds several stateful dependencies the current
single-Postgres-container deployment does not have: **Redis** (cache, rate-limit counters,
presence, STOMP relay), **RabbitMQ** (domain event bus), and **PostgreSQL with PostGIS**
(currently `postgres:15-alpine` in Compose with no PostGIS extension enabled). Running Kubernetes
for the application tier (ADR-2101) does not by itself answer how these stateful dependencies are
run — self-hosted inside the cluster via Kubernetes Operators (e.g. Zalando/CloudNativePG for
Postgres, Bitnami/official RabbitMQ and Redis Helm charts), or consumed as **managed cloud
services** (RDS/Cloud SQL for Postgres, ElastiCache/Memorystore for Redis, Amazon MQ/CloudAMQP for
RabbitMQ). This materially affects operational burden, backup/DR posture, and cost, and needs a
default answer so the Kubernetes architecture diagram and Helm charts have a concrete target.

## Decision

**Prefer managed cloud services for all three stateful dependencies in production**, falling back
to Kubernetes-operator-run self-hosted instances only where a managed offering is unavailable
(e.g. certain PostGIS versions, on-prem/private-cloud deployments for data-residency-sensitive
tenants) or cost-prohibitive at the target scale:

- **PostgreSQL + PostGIS**: managed Postgres with the PostGIS extension enabled (RDS PostgreSQL
  supports PostGIS; Cloud SQL supports PostGIS) as the default; a CloudNativePG-operator-run
  cluster as the documented fallback for on-prem/appliance-style deployments.
- **Redis**: managed (ElastiCache/Memorystore) as default; self-hosted via the Bitnami/official
  Redis Helm chart as fallback. Redis here holds cache/rate-limit/presence/dedup data, not
  durable business state, so the bar for "must be managed" is lower than for Postgres/RabbitMQ.
- **RabbitMQ**: managed (Amazon MQ for RabbitMQ / CloudAMQP) as default; the RabbitMQ Cluster
  Operator as the self-hosted fallback.
- Local development and single-node/appliance deployments continue to run all three as plain
  containers in Docker Compose (per the dev topology diagram) — this ADR concerns production only.
- Connection configuration is externalized (Kubernetes Secrets + environment-driven Spring
  config, matching today's `SPRING_DATASOURCE_URL`-style env var pattern already used in
  `docker-compose.yml`), so switching between managed and self-hosted requires only a config
  change, not application code changes.

## Alternatives considered

- **Managed by default, operator-run fallback** (chosen).
  - Pros: offloads backup/patching/HA/failover to the cloud provider for the highest-risk
    stateful service (Postgres holds all tenant data under RLS — brief §3.2); matches the small
    team's operational bandwidth better than running three different Kubernetes operators
    correctly (each with its own failure modes, upgrade cadence, backup tooling); managed Postgres
    backup/PITR is a mature, well-tested capability versus rolling one's own.
  - Cons: recurring managed-service cost, generally higher than self-hosting at scale; less
    control over exact version/extension availability (must verify the chosen provider supports
    the PostGIS version needed); potential data-residency friction for tenants requiring specific
    jurisdictions or fully on-prem operation (mitigated by the operator-run fallback).

- **Self-hosted via Kubernetes Operators for everything, uniformly.**
  - Pros: full control over versions/extensions/tuning; potentially lower steady-state
    infrastructure cost at large scale; no vendor lock-in to a specific cloud's managed offering;
    single operational model (Kubernetes) for both app and data tier, simplifying the mental
    model.
  - Cons: the team takes on Postgres HA/failover/backup/PITR correctness itself — a
    much higher-stakes operational burden than the application tier, since this is the system of
    record for every tenant under RLS; RabbitMQ and Redis operators each add their own operational
    learning curve; this is a lot of new expertise to build simultaneously with everything else in
    this brief (multi-tenancy, event bus, billing) — high execution risk for a team already
    absorbing a large scope increase (brief §2).

- **Fully managed, no self-hosted fallback at all (hard dependency on one cloud provider's managed
  services).**
  - Pros: simplest to reason about — one deployment topology.
  - Cons: forecloses on-prem/appliance and data-residency-constrained deployments the product
    might need for enterprise tenants (brief §3.10 mentions Enterprise plans); removes the
    documented upgrade/portability path this ADR wants to preserve; rejected as too rigid.

## Consequences

- Positive: the highest-risk stateful service (Postgres, holding every tenant's data) gets
  managed-grade backup/HA by default; the team's Kubernetes operational investment stays focused
  on the stateless application tier (ADR-2101) rather than being split across three additional
  operators; a documented fallback exists for on-prem/appliance/data-residency cases without
  requiring a second architecture.
- Negative / trade-offs: production infrastructure cost is higher than a fully self-hosted
  approach at scale; the team must still learn and test the operator-run fallback path (it cannot
  be purely theoretical if any customer needs it) so it does not silently rot; managed-service
  choice is provider-specific and needs to be finalized per target cloud (not decided in this
  ADR — this ADR fixes "managed-by-default," not "which cloud").
- Follow-ups: pick the target cloud provider(s) and finalize exact managed-service SKUs/tiers as
  an implementation/costing exercise; validate PostGIS version support on the chosen managed
  Postgres offering before committing (brief §3.4 requires PostGIS for slot polygons); define
  backup/DR RPO/RTO targets referenced from the "backup/DR" section of this doc's README.
