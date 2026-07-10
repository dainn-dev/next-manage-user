# ADR-0502: Usage Metering via Event Stream vs Periodic Aggregation

- Status: Accepted as target architecture; Phase A implementation deferred for metered metrics
- Date: 2026-07-09
- Deciders: Principal Architect
- Context doc: 05_Subscription_Billing

## Context

Entitlement enforcement (max sites, max cameras, retention days, AI minutes, chatbot messages
— brief §3.10) needs an accurate, near-real-time count of "how much has this tenant used this
period" so the `EntitlementGuard` (see README §"entitlement enforcement") can block or throttle
an over-limit action *before* it happens, not just report on it after the fact. The platform is
already adopting RabbitMQ with a transactional outbox for domain events
(`03_SaaS_Architecture` ADR-0302) — every AI-minute-consuming detection and every chatbot
message already produces or can produce an event on that bus. The question is whether
`UsageRecord` (brief §4) should be derived by consuming that event stream, or by a separate
periodic batch job that aggregates raw tables (`ParkingEvent`, chatbot logs) on a schedule.

## Decision

Meter usage **off the event stream**: a dedicated consumer in the `billing` module subscribes
to the relevant domain events (e.g. AI-minute-consuming events from `ai-ingest`, a
`ChatbotMessageSent` event from `chatbot`) and increments `UsageRecord(tenant_id, metric,
qty, period)` transactionally as events arrive, using the same at-least-once-consumer +
idempotent-upsert pattern already established for other RabbitMQ consumers (dedupe by
`event_id`). For **hard structural limits** that aren't event-driven (max sites, max cameras
— these change on explicit create/delete API calls, not a stream of telemetry), the
`EntitlementGuard` checks a direct `COUNT(*)` against the relevant table instead of
`UsageRecord` — those are cheap, low-cardinality checks that don't need streaming
infrastructure. `UsageRecord` is specifically for **metered, high-frequency** metrics (AI
minutes, chatbot messages, event volume).

## Alternatives considered

- **Periodic batch aggregation only** (nightly job scans raw tables, computes usage, writes
  `UsageRecord`) — pros: simple to implement, no new consumer code; cons: cannot support
  real-time entitlement enforcement (brief explicitly wants a "guard/interceptor that blocks
  over-limit actions" — a nightly job means a tenant could burn 10x their AI-minute limit
  before the next batch run catches it); also duplicates work the event bus already does for
  other consumers.
- **Synchronous increment inside the request path** (every AI-minute-consuming call directly
  writes to `UsageRecord` in the same transaction as the domain write) — pros: strongest
  consistency, no lag; cons: couples `ai-ingest`'s write path to `billing`'s schema, violating
  the module-boundary rule in `03_SaaS_Architecture` (ADR-0301); adds billing-module latency
  to every ingest request, which is on the tight NFR budget (`03_SaaS_Architecture` §7).
- **Event stream consumption (chosen)** — pros: reuses the already-adopted outbox/RabbitMQ
  infrastructure, keeps `ai-ingest`/`chatbot` decoupled from `billing` (they just emit domain
  events; billing subscribes independently), near-real-time (seconds, not a nightly batch) so
  `EntitlementGuard` can catch overages promptly; cons: eventual consistency means a tenant
  could briefly exceed a soft metered limit in the window between the triggering event firing
  and the `UsageRecord` update landing (acceptable — see README's soft-limit
  throttle-not-block behavior) — this window does not apply to hard structural limits, which
  are checked synchronously via direct count, not via the event stream.

## Consequences

- Positive: one consistent event-driven pattern across the platform rather than a special-case
  batch job; entitlement checks reflect near-real-time usage (bounded by RabbitMQ/outbox
  relay latency, already budgeted in `03_SaaS_Architecture` §7); billing module stays
  decoupled from producer modules.
- Negative / trade-offs: `UsageRecord` accuracy depends on the health of the event pipeline —
  if the outbox relay stalls, usage metering (and therefore soft-limit enforcement) lags
  behind reality; requires a periodic reconciliation job as a safety net against consumer
  bugs or missed events (belt-and-suspenders, not the primary mechanism).
- Follow-ups: build a daily reconciliation job that cross-checks `UsageRecord` sums against
  raw event counts and alerts on drift beyond a threshold; define the exact list of events
  that map to each metered metric (AI minutes especially needs a clear definition — per
  detection event? per second of active inference?) before implementation.

## Implementation note: Phase A billing MVP

The current backend billing MVP does not implement RabbitMQ/Redis/outbox-backed metered usage
because those infrastructure pieces are not wired in the codebase yet. Phase A still creates
the billing persistence needed for `UsageRecord`, but enforces only structural limits such as
sites, cameras, and users through direct `COUNT(*)` checks.

The event-stream consumer, Redis-backed entitlement cache, and reconciliation job remain the
Phase B implementation path after the platform event bus/cache work exists.
