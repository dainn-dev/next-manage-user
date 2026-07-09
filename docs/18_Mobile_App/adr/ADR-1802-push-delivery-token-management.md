# ADR-1802: Push delivery via FCM/APNs with backend-owned token lifecycle

- Status: Proposed
- Date: 2026-07-09
- Deciders: Principal Architect
- Context doc: 18_Mobile_App

## Context

Relocation/stolen alerts (`VehicleRelocated` domain event, §2) and other driver-facing notifications
need to reach the mobile app reliably even when it is backgrounded or closed — the existing STOMP/
WebSocket realtime channel (§1, §3.6) only delivers while the app is foregrounded and connected, so
it cannot be the sole delivery path for time-sensitive alerts like "your car was relocated" or a
security alert. The backend has no notion of mobile device tokens today (no such table/entity
exists pre-target; `Notification` is a new target entity per §4 with `channel{push,email,ws}`).

## Decision

The backend owns device-token lifecycle end to end:

- On login/app-start, the mobile app calls `POST /api/v1/devices/register` with its FCM or APNs
  token, platform, and the authenticated user's JWT; the backend upserts a `DeviceToken` record
  (new table, tenant/user-scoped) keyed by `(user_id, token)`.
- The `notification` module (modular monolith package, §3.15) consumes domain events from RabbitMQ,
  evaluates notification rules (`Notification.channel = push`), looks up the user's active device
  tokens, and sends via **FCM** for Android and **APNs** for iOS (directly, or via a unified
  provider such as Expo's push service — implementation detail, not architecture).
- Delivery failures indicating an invalid/expired token (FCM `UNREGISTERED`, APNs `BadDeviceToken`)
  trigger token pruning; tokens are also cleared on explicit logout.

## Alternatives considered

- **Client-managed tokens only (app talks to FCM/APNs directly, backend never stores tokens)** —
  pros: less backend state; cons: the backend cannot target "all of this vehicle owner's devices"
  for an event-driven alert without a server-side token registry, which is the entire point of the
  relocation-alert feature; rejected.
- **Third-party notification platform (e.g. OneSignal) instead of direct FCM/APNs** — pros: unified
  API, less token-lifecycle code to own; cons: another vendor dependency and cost line for a capability
  (push fan-out) the platform can own directly at modest complexity, and it would store tenant user
  identifiers with a third party unnecessarily; deferred, direct integration preferred while
  volumes are modest.
- **Poll-based notifications (mobile app polls for new alerts)** — pros: no push infra at all; cons:
  defeats the "urgent alert" use case (stolen/relocated vehicle should notify promptly, not on the
  next poll interval), unnecessary battery drain; rejected.

## Consequences

- Positive: the same `notification` module and `Notification` entity serve push, WS, and future
  email channels uniformly; alerts reach users even when the app is backgrounded, which is the
  actual product requirement for relocation/stolen alerts.
- Negative / trade-offs: the backend now owns token-lifecycle correctness (multi-device per user,
  stale-token pruning, platform-specific payload formatting for FCM vs APNs); push delivery failures
  need monitoring so silent notification loss is caught.
- Follow-ups: decide FCM/APNs direct integration vs. a push-delivery library/service as part of
  implementation; define notification-rule/preference model (which events, quiet hours) alongside
  `19_Notifications`.
