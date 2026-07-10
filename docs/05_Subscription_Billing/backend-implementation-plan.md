# Backend Billing Implementation Plan

## Overview

This file is the confirmed handoff for backend implementation of the subscription and billing
MVP. It converts the DAI-274 design review into implementation-ready scope for the staged
backend tasks under DAI-262.

Confirmed decision: ship Phase A now with Stripe lifecycle, idempotent webhooks, structural
entitlement limits, and forward-compatible billing persistence. Defer RabbitMQ/Redis-backed
metered usage until the event bus/cache infrastructure exists in the backend.

## Phase A Scope

Phase A is the scope for the current billing MVP:

- Add the billing module and persistence for plans, subscriptions, usage records, processed
  Stripe events, and billing audit records.
- Implement Stripe Checkout, Customer Portal, local subscription state, plan changes,
  cancellation, and subscription status sync.
- Implement idempotent Stripe webhook handling for `checkout.session.completed`,
  `invoice.paid`, `customer.subscription.updated`, and `invoice.payment_failed`.
- Enforce structural plan limits for tenant-scoped resources through direct counts:
  max sites, max cameras, and max users.
- Return a clear entitlement error shape when structural limits are exceeded.
- Keep `UsageRecord` and entitlement-cache interfaces forward-compatible with Phase B.

Phase A must not introduce RabbitMQ, Redis, or a transactional outbox implementation inside the
billing work. Those remain platform dependencies for Phase B.

## Phase B Scope

Phase B starts only after event bus/cache infrastructure is available:

- Consume metered domain events such as AI-minute events and `ChatbotMessageSent`.
- Upsert `UsageRecord` idempotently by event id, tenant id, metric, and billing period.
- Add daily reconciliation from raw events to `UsageRecord` totals.
- Replace the Phase A in-process entitlement cache with the Redis-backed cache described by
  ADR-0303.
- Enforce soft metered limits with throttling or `429 Retry-After`, without silently dropping
  safety-critical detections.

## Data Model

Implement a `billing` module using the existing package and repository conventions.

`plan`

- Platform-global table, not tenant-scoped, no RLS.
- Fields: `id`, `tier`, `name`, `limits jsonb`, `stripe_price_id`, `price_cents`,
  `currency`, `active`, timestamps.
- Seed Free, Starter, Pro, and Enterprise tiers from the current entitlement matrix. Treat
  numeric values as product/pricing placeholders until final pricing sign-off.

`subscription`

- Tenant-scoped table with RLS enabled and forced.
- Fields: `id`, `tenant_id`, `plan_id`, `stripe_customer_id`, `stripe_subscription_id`,
  `status`, `current_period_end`, `cancel_at_period_end`, optional `past_due_since`,
  timestamps.
- Add a partial unique index so a tenant has at most one active/trialing/past_due
  subscription.
- Stripe is the source of truth; local state is eventually consistent.

`usage_record`

- Tenant-scoped table with RLS enabled and forced.
- Fields: `tenant_id`, `metric`, `qty`, `period`, timestamps.
- Unique key: `(tenant_id, metric, period)`.
- Create in Phase A for forward compatibility; event-stream population is Phase B.

`processed_stripe_event`

- Platform-global table, not tenant-scoped, no RLS.
- Fields: `stripe_event_id`, `event_type`, `processed_at`.
- Use `stripe_event_id` as the primary key and `INSERT ... ON CONFLICT DO NOTHING` for
  webhook idempotency.

`billing_audit`

- Tenant-scoped append-only table with RLS enabled and forced.
- Fields: `id`, `tenant_id`, `actor`, `action`, `stripe_event_id`, `detail jsonb`,
  `created_at`.
- Typical actions: `checkout_started`, `subscription_activated`, `plan_changed`,
  `payment_failed`, `downgraded_to_free`.

## API Contract

Add `/api/v1/billing/**`.

- `POST /api/v1/billing/checkout-session`: `TENANT_ADMIN`; creates a hosted Stripe Checkout
  Session and stores `tenant_id` in Stripe metadata.
- `POST /api/v1/billing/portal-session`: `TENANT_ADMIN`; creates a hosted Stripe Customer
  Portal session.
- `GET /api/v1/billing/subscription`: `TENANT_ADMIN`; returns current plan, status, period,
  and Phase A structural usage/limits.
- `POST /api/v1/billing/webhooks`: `permitAll`; authenticate with Stripe signature
  verification against the raw request body.

Webhook handlers must verify signature, dedupe through `processed_stripe_event`, apply local
state changes in a transaction, and return `200` quickly for both processed and already-seen
events.

## Entitlement Guard

Implement `EntitlementGuard` as a Spring service with an annotation/aspect path where it fits
the existing AOP conventions, plus direct-call support for cases that need explicit logic.

Rules:

- Run only after tenant context is bound.
- `PLATFORM_ADMIN` bypasses entitlement checks.
- `TENANT_ADMIN` can manage billing.
- Hard structural limits return `403` with a machine-readable body:
  `code`, `metric`, `limit`, `currentUsage`, and `upgradeUrl`.
- Phase A structural metrics use direct counts from source tables.
- Phase A may fail open on guard-internal lookup errors, with logging, so a billing bug does
  not lock tenants out during rollout. Business-rule limit breaches still fail closed.

## Configuration

Add blank-by-default configuration values:

```yaml
stripe.secret-key: ${STRIPE_SECRET_KEY:}
stripe.webhook-secret: ${STRIPE_WEBHOOK_SECRET:}
stripe.publishable-key: ${STRIPE_PUBLISHABLE_KEY:}
billing.enabled: ${BILLING_ENABLED:false}
```

Add the same keys to the sample environment file. Never hardcode Stripe secrets.

## Task Mapping

DAI-275: Implement Stripe subscription lifecycle.

- Use this document for persistence, configuration, Checkout, Portal, and local subscription
  state.
- Include the migration for Phase A billing tables if it is not already present.
- Keep webhook-specific state transition details ready for DAI-276.

DAI-276: Implement idempotent Stripe webhooks and dunning.

- Use `processed_stripe_event` for durable idempotency.
- Derive dunning from Stripe subscription/invoice state.
- Do not reimplement Stripe retry timing.

DAI-277: Implement entitlement guard and Phase A usage signals.

- Enforce structural limits with direct counts.
- Do not implement RabbitMQ/Redis-backed metered usage in this step.
- Keep interfaces ready for ADR-0502 Phase B.

DAI-278: QA verification.

- Verify checkout, portal, subscription sync, webhook replay idempotency, dunning state,
  structural limit rejection, tenant isolation, and no hardcoded Stripe secrets.

DAI-279: Code review.

- Review RLS, webhook signature verification, idempotency, tenant isolation, migration safety,
  configuration/secrets, and tests.

## Open Product Decisions

- Final numeric entitlement/pricing values.
- Stripe Tax at launch vs deferred.
- AI-minute metric definition for Phase B.
- Enterprise per-tenant custom limit override model.

## References

- DAI-274: Backend billing architecture design.
- `README.md`: Billing domain overview.
- `adr/ADR-0501-stripe-vs-byo.md`: Stripe Billing decision.
- `adr/ADR-0502-usage-metering-event-stream.md`: Target usage metering design.
- `../03_SaaS_Architecture/adr/ADR-0302-rabbitmq-outbox.md`: Event bus/outbox target.
- `../03_SaaS_Architecture/adr/ADR-0303-redis-cache-ws-scaleout.md`: Redis target.
- `../04_Multi_Tenant_Design/README.md`: Tenant scoping and RLS context.
