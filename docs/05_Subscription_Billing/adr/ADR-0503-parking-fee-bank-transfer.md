# ADR-0503: Driver Parking Fees via Bank Transfer (SePay / VietQR)

- Status: Accepted
- Date: 2026-07-11
- Deciders: Product + Principal Architect
- Context doc: 05_Subscription_Billing (adjacent; parking ≠ SaaS)

## Context

Public sites (retail, airport) charge drivers for parking time. Product chose **Vietnamese
bank transfer** (VietQR / SePay inbound webhook) rather than card checkout for v1 driver fees.
SaaS subscriptions for tenants remain on Stripe (ADR-0501) — these are separate money flows.

## Decision

1. Persist `parking_session`, `parking_payment`, and `site_parking_bank_account` (V60).
2. Fee quote: simple hourly ceiling (configurable later); currency **VND**.
3. Payment instruction exposes bank code / account / account name + unique
   `transfer_content` (`PV` + 10 hex chars from session id).
4. SePay (or compatible) webhook `POST /api/v1/parking/webhooks/sepay` matches the PV code
   in transfer description and marks payment `PAID` (idempotent).
5. MEMBER may claim a session and request bank-transfer instructions without a home
   `tenant_id` in JWT (session tenant resolved via admin lookup).

## Alternatives considered

- **Stripe Checkout for drivers** — rejected for VN retail UX and local bank preference.
- **Cash-only at gate** — still allowed operationally; bank transfer is the digital path.
- **Reuse SaaS Stripe customer** — rejected; wrong payer and wrong product.

## Consequences

- Positive: matches VN market; clear separation from tenant SaaS billing.
- Trade-offs: requires each site to configure a bank account; SePay webhook auth (API key /
  IP allowlist) still to harden; rate cards per site TBD.
