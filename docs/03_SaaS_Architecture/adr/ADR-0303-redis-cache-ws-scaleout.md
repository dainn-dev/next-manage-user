# ADR-0303: Redis for Cache and WebSocket Scale-Out

- Status: Proposed
- Date: 2026-07-09
- Deciders: Principal Architect
- Context doc: 03_SaaS_Architecture

## Context

Today's realtime layer is STOMP over WebSocket (SockJS) using Spring's in-memory
`SimpleBroker` on a single instance — **no Redis exists today**. This works for one JVM but
breaks the moment the API is scaled horizontally (ADR-0301, deployment topology): a client
connected to pod A will never receive a message published by pod B, because `SimpleBroker`
does not share state across instances. The target vision also needs cross-pod concerns that
have no home today: gate/camera online-presence tracking (currently a DB column,
`Gate.lastHeartbeatAt`, swept by a 30s scheduled job on one instance), rate-limit counters for
the edge ingest API, and short-lived caches (tenant config, entitlement lookups) to avoid a
DB round trip on every request.

## Decision

Introduce **Redis** for three purposes: (1) a **STOMP relay** — replace `SimpleBroker` with a
broker relay (e.g. Spring's `spring-messaging` external broker relay or a pub/sub bridge) so
`/topic/**` messages published on any pod fan out to WebSocket clients connected to any other
pod; (2) a **cache** for read-heavy, low-churn data — tenant/site config, plan entitlements
(ADR-0501/0502), JWT-derived tenant context lookups — with short TTLs and explicit
invalidation on write; (3) **ephemeral state** — gate/camera presence (replacing/augmenting
the DB heartbeat sweep with a Redis key + TTL per camera), and per-tenant/per-IP rate-limit
counters for the edge ingest API and chatbot endpoints.

## Alternatives considered

- **RabbitMQ topic exchange instead of Redis pub/sub for WS fan-out** — pros: one fewer
  infra dependency since RabbitMQ is already introduced (ADR-0302); cons: STOMP-over-RabbitMQ
  relay is heavier to operate for pure ephemeral fan-out, and RabbitMQ is reserved for durable
  domain events, not transient UI push — mixing concerns risks queue bloat from WS traffic.
- **Sticky sessions at the load balancer (no relay)** — pros: no new infra; cons: defeats
  the point of stateless horizontally-scaled pods (ADR-0301 deployment topology), breaks on
  pod restarts/rolling deploys, and does not solve the cache/presence/rate-limit needs anyway.
- **Database-backed cache/presence (status quo extended)** — pros: no new infra; cons:
  Postgres is not designed for high-churn ephemeral writes (heartbeats, rate-limit counters)
  at multi-tenant scale; adds write load to the primary that Redis is purpose-built to absorb.

## Consequences

- Positive: WebSocket fan-out becomes correct under horizontal scaling; entitlement and
  tenant-config checks (hot path on every request, see `05_Subscription_Billing`) avoid a DB
  hit; gate/camera presence and rate limiting get sub-millisecond reads/writes instead of
  contending with transactional Postgres load.
- Negative / trade-offs: Redis becomes a new stateful dependency requiring its own HA story
  (Sentinel/Cluster) in production; cache invalidation bugs are a new failure class (stale
  entitlement allowing an over-limit action); presence data in Redis needs a documented
  TTL/heartbeat contract so it doesn't silently drift from the DB `Camera.last_heartbeat_at`.
- Follow-ups: decide Redis deployment mode (single managed instance for MVP vs Cluster) as
  part of the Kubernetes rollout in `21_Deployment`; define cache-key naming convention
  (`tenant:{id}:...`) so eviction/inspection stays tenant-scoped; add Redis metrics to the
  existing Prometheus/Micrometer setup.
