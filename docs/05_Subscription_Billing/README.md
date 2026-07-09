# Subscription & Billing

Stripe-based subscription billing for ParkVision: plan tiers with metered entitlements,
usage tracking off the platform's event stream, and enforcement that blocks over-limit
actions before they happen.

Status: Draft · Owner: Principal Architect · Last updated: 2026-07-09

## 1. Purpose

Define the billing domain model, the plan/entitlement matrix, the Stripe integration
lifecycle (checkout through dunning), how usage is metered, and how entitlements are enforced
at request time. This document assumes the tenancy model from `04_Multi_Tenant_Design` — every
billing object is keyed by `tenant_id`.

## 2. Current State vs Target

### Current state (brief §1)

**No billing concept exists in the codebase today.** The system is a free-standing,
single-tenant internal tool — there are no Plan, Subscription, or UsageRecord entities, no
Stripe integration, and no entitlement checks anywhere in the 8 existing entities or their
controllers. This entire document describes net-new capability.

### Target

A `billing` module (brief §3.15) owning `Plan`, `Subscription`, `UsageRecord` (brief §4),
integrated with Stripe Billing (ADR-0501) for payment collection and lifecycle, with usage
metered off the RabbitMQ event stream (ADR-0502) and enforced via an `EntitlementGuard`
interceptor that every tenant-scoped module can call before allowing a limited action.

### The gap

Everything: the entities, the Stripe account/product/price configuration, the webhook
handler, the entitlement guard, and the frontend billing/upgrade UI are all net-new builds.

## 3. Domain Model

Per brief §4:

- **Plan**(id, name, limits `jsonb`, price) — one row per tier (Free/Starter/Pro/Enterprise).
  `limits` holds the entitlement matrix values (see §4) as structured JSON so new metrics can
  be added without a schema migration.
- **Subscription**(id, tenant_id, plan_id, stripe_customer_id, stripe_subscription_id, status,
  current_period_end) — the tenant's current billing relationship; `status` mirrors Stripe's
  subscription status enum (`trialing`, `active`, `past_due`, `canceled`, `unpaid`).
- **UsageRecord**(tenant_id, metric, qty, period) — one row per tenant per metric per billing
  period, incremented as usage events are consumed (ADR-0502).

See `diagrams/plan-entitlement-model.mmd` for the class-level relationships including the
`EntitlementGuard` collaborator.

## 4. Plan Tiers and Entitlement Matrix

| Entitlement | Free | Starter | Pro | Enterprise |
|---|---|---|---|---|
| Max sites | 1 | 3 | 15 | Unlimited (custom) |
| Max cameras per site | 2 | 8 | 30 | Unlimited (custom) |
| Snapshot/event retention | 7 days | 30 days | 90 days | 365 days (custom) |
| AI processing minutes / month | 500 | 5,000 | 50,000 | Custom / dedicated |
| Chatbot messages / month | 100 | 1,000 | 10,000 | Unlimited (fair-use) |
| Users per tenant | 3 | 10 | 50 | Unlimited |
| Support | Community | Email | Priority email | Dedicated + SLA |
| Multi-tenant white-label | No | No | No | Yes |

Values above are illustrative starting points for capacity planning and product/pricing to
refine — the structural point is that every row is a `metric` key inside `Plan.limits`, so
adding a plan or changing a limit is a data change, not a code change.

## 5. Stripe Integration Lifecycle

See `diagrams/billing-sequence.mmd` for the full sequence. Summary:

1. **Signup / plan selection**: Tenant admin picks a plan in the ParkVision console → backend
   creates a Stripe Checkout Session (customer + price, `tenant_id` in session metadata) →
   redirect to Stripe-hosted checkout. No card data ever touches ParkVision's servers.
2. **`checkout.session.completed` webhook**: backend verifies the Stripe signature, upserts
   `Subscription` with `status=active`, links `stripe_customer_id`/`stripe_subscription_id`,
   publishes a "subscription activated" domain event (via the outbox pattern from
   `03_SaaS_Architecture` ADR-0302) so `notification` can email the tenant admin.
3. **`invoice.paid` webhook**: renews `current_period_end`, reconciles the period's
   `UsageRecord` totals (billing period boundary).
4. **`customer.subscription.updated` webhook**: syncs plan changes (upgrade/downgrade),
   status transitions (`active` ↔ `past_due` ↔ `canceled`).
5. **`invoice.payment_failed` webhook → dunning**: sets `Subscription.status = past_due`,
   triggers a payment-reminder notification. Stripe's own retry schedule (Smart Retries)
   handles the retry cadence; ParkVision does not reimplement retry timing. After Stripe's
   retries exhaust and the subscription is canceled, the tenant is **downgraded to Free-tier
   entitlements**, not immediately locked out — existing data is retained per Free-tier
   retention, new usage is capped at Free-tier limits.

All webhook handlers are idempotent (dedupe by Stripe event ID, stored in a
`processed_stripe_event_id` table) since Stripe delivery is at-least-once and can arrive
out of order.

## 6. Usage Metering

Per ADR-0502: metered, high-frequency metrics (AI minutes, chatbot messages) are derived by a
`billing`-module consumer subscribed to the relevant domain events on RabbitMQ (e.g. an
AI-minute-consuming detection event, `ChatbotMessageSent`), incrementing `UsageRecord`
idempotently as events arrive. Structural, low-frequency limits (max sites, max cameras) are
checked with a direct `COUNT(*)` against the live table instead — no need for streaming
infrastructure on a value that only changes via explicit create/delete calls. A daily
reconciliation job cross-checks `UsageRecord` sums against raw event counts to catch consumer
drift.

## 7. Entitlement Enforcement

An `EntitlementGuard` interceptor runs after tenant-context resolution (`04_Multi_Tenant_Design`
§4) and before any limited action executes:

1. Resolve the tenant's active `Plan.limits` and current usage (Redis-cached,
   `tenant:{id}:entitlements`, short TTL — `03_SaaS_Architecture` ADR-0303).
2. Compare current usage + 1 against the plan limit for the relevant metric.
3. **Hard limits** (sites, cameras — structural): block with `403 Entitlement Exceeded` and an
   upgrade call-to-action in the response body.
4. **Soft/metered limits** (AI minutes, chatbot messages): degrade gracefully — throttle or
   return `429` with `Retry-After`, but **never silently drop a safety-critical event** (e.g.
   a `VehicleRelocated` detection is never dropped for being over the AI-minutes quota; it is
   processed and simply counted toward the next period, or flagged for a required upgrade).
5. On successful action, emit a `UsageRecord` increment asynchronously and check 80%/100%
   usage thresholds to trigger a "approaching plan limit" notification to `TENANT_ADMIN`.

See `diagrams/entitlement-check-flow.mmd` for the full decision flow.

## 8. Dunning Summary

Dunning is delegated to Stripe's Smart Retries (configurable retry schedule, typically 3–4
attempts over ~2 weeks). ParkVision's responsibility is reacting to the webhook state
transitions: `past_due` triggers an in-app banner + email reminder (day 1), a second reminder
at the midpoint of Stripe's retry window, and a final "your plan will be downgraded" warning
before Stripe cancels the subscription and the `customer.subscription.updated` webhook lands
with `status=canceled`.

## 9. Diagrams

- `diagrams/billing-sequence.mmd` — signup → Stripe Checkout → webhook → activation, plus the
  recurring renewal and payment-failure/dunning paths.
- `diagrams/entitlement-check-flow.mmd` — the `EntitlementGuard` decision flow from action
  attempt to allow/block/throttle.
- `diagrams/plan-entitlement-model.mmd` — class diagram of Plan/Subscription/UsageRecord and
  the `EntitlementGuard` collaborator.

## 10. Decisions / ADRs

- [`adr/ADR-0501-stripe-vs-byo.md`](adr/ADR-0501-stripe-vs-byo.md) — Stripe Billing vs build-your-own.
- [`adr/ADR-0502-usage-metering-event-stream.md`](adr/ADR-0502-usage-metering-event-stream.md) — Usage metering via event stream vs periodic aggregation.

## 11. Open Questions / Risks

- Entitlement matrix values in §4 are illustrative placeholders pending product/pricing
  sign-off — do not treat as final pricing.
- Exact event-to-metric mapping for "AI minutes" is not yet defined (per detection event vs.
  per second of active inference) — needed before ADR-0502's consumer can be implemented.
- Enterprise "custom" limits imply a per-tenant override mechanism on top of `Plan.limits` —
  not yet designed (likely a `tenant_config` override, see `04_Multi_Tenant_Design` §7).
- Tax handling (Stripe Tax vs manual) is not yet decided — see ADR-0501 follow-ups.

## 12. Cross-References

- `03_SaaS_Architecture` — event bus (ADR-0302) and Redis cache (ADR-0303) that billing
  depends on.
- `04_Multi_Tenant_Design` — `tenant_id` scoping that every billing entity relies on.
- `06_User_RBAC` — `TENANT_ADMIN` role, the only role permitted to manage billing.
- `15_Database_Design` (sibling doc) — full DDL for Plan/Subscription/UsageRecord.
- `20_Analytics` (sibling doc) — usage dashboards built on the same `UsageRecord` data.
