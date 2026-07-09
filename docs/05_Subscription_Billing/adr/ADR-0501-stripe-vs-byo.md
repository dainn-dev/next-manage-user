# ADR-0501: Stripe Billing vs Build-Your-Own

- Status: Proposed
- Date: 2026-07-09
- Deciders: Principal Architect
- Context doc: 05_Subscription_Billing

## Context

Today's codebase has **no billing, subscription, or payment concept whatsoever** — it is a
single-tenant internal tool with no monetization layer (brief §1). The target vision requires
recurring subscription billing across four plan tiers (Free/Starter/Pro/Enterprise) with
metered entitlements (max sites, max cameras, retention days, AI minutes, chatbot messages),
which implies: payment method collection and storage (PCI scope), recurring invoicing, proration
on plan changes, dunning on failed payments, tax handling, and a customer-facing billing
portal. None of this exists, and none of it is core to ParkVision's differentiation (which is
the AI/parking domain, not payments infrastructure).

## Decision

Use **Stripe Billing** (Checkout + Billing + Customer Portal + Webhooks) as the subscription
and payment provider. The `billing` module owns the mapping between Stripe's objects
(Customer, Subscription, Price/Product) and ParkVision's domain objects (`Tenant`, `Plan`,
`Subscription`, `UsageRecord` — brief §4), consumes Stripe webhooks
(`checkout.session.completed`, `invoice.paid`, `customer.subscription.updated`,
`invoice.payment_failed`) to keep local state in sync, and pushes metered usage to Stripe
where applicable (or reconciles it locally against plan limits — see ADR-0502). ParkVision
never stores raw card data; Stripe Checkout/Portal are hosted, keeping the platform out of
PCI-DSS SAQ A-EP/D scope and down to the much lighter SAQ A.

## Alternatives considered

- **Build-your-own billing** (own payment processor integration, invoicing, dunning logic) —
  pros: no per-transaction Stripe fee, full control over UX; cons: reimplements a solved
  problem (recurring billing, proration math, retry/dunning schedules, tax calculation,
  invoice PDF generation) that is not ParkVision's value proposition; full PCI-DSS scope if
  card data ever touches ParkVision's servers; materially slower time-to-first-paying-tenant.
- **Paddle / Chargebee / other billing-as-a-service** — pros: similar hosted-checkout
  benefits to Stripe, Paddle additionally acts as merchant-of-record (handles global tax
  remittance); cons: smaller ecosystem/documentation than Stripe, team has no existing
  familiarity; Chargebee still requires a separate payment gateway underneath it, adding a
  second integration surface. Worth revisiting if global tax-as-a-service becomes a hard
  requirement (see follow-ups).
- **Stripe (chosen)** — pros: hosted Checkout + Customer Portal eliminates most billing UI
  build-out, webhook-driven model fits the outbox/event-driven pattern already adopted
  platform-wide (`03_SaaS_Architecture` ADR-0302), mature usage-based billing primitives (metered
  prices) that map onto the entitlement model in §4/§5 of the README; cons: per-transaction
  fee, vendor dependency for a business-critical function, tax remittance is the platform's
  responsibility unless Stripe Tax is separately enabled.

## Consequences

- Positive: subscription lifecycle (trial, upgrade, downgrade, cancel, dunning) is handled by
  a battle-tested provider; hosted Checkout/Portal means the frontend team builds a redirect
  flow, not a payment form; webhook-driven sync fits the platform's existing event-driven
  architecture.
- Negative / trade-offs: Stripe webhook delivery is at-least-once and can arrive out of order
  — the `billing` module must be idempotent (dedupe by Stripe event ID) and tolerant of
  out-of-order `subscription.updated` events; local `Subscription`/`UsageRecord` state is
  eventually consistent with Stripe, never the other way around — Stripe is the source of
  truth for payment state.
- Follow-ups: decide whether Stripe Tax is enabled at launch or deferred; define the webhook
  retry/idempotency table (`processed_stripe_event_id`) before go-live; if the platform
  expands to markets where Paddle's merchant-of-record model is materially simpler for tax
  compliance, re-evaluate this ADR.
