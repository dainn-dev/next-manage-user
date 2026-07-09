# ADR-1902: Push provider & multi-channel fan-out with per-user preferences

- Status: Proposed
- Date: 2026-07-09
- Deciders: Principal Architect
- Context doc: 19_Notification

## Context

The vision requires a driver-facing "your car moved" / "you left the lot" alert to reach a user
even when the ParkVision mobile app (`18_Mobile_App`, React Native/Expo per brief §3.13) is
backgrounded or the phone is locked — which requires native push, not just WebSocket. The repo
today has no push integration at all (no FCM/APNs SDK, no device-token storage) and no
`NotificationPreference` concept; the closest existing thing is the STOMP `/topic/vehicle-check`
feed, which only reaches an open browser/kiosk tab. We need to pick a push provider strategy and
decide how fan-out across channels (push + email + in-app) respects what each user actually wants
per event type, without over-notifying (a relocation followed immediately by an exit should not
fire two redundant alerts).

## Decision

1. **Push provider**: use **Firebase Cloud Messaging (FCM)** as the single push abstraction for
   both Android and iOS. iOS devices register through FCM's APNs bridge (Firebase relays to
   APNs under the hood), so the mobile app and backend integrate against **one provider SDK**
   (`firebase-admin` on the backend) instead of maintaining separate FCM and raw-APNs code paths.
   Device tokens are stored per user (`user_id`, `device_token`, `platform`, `last_registered_at`)
   and refreshed on app foreground per Firebase's rotation guidance.
2. **Per-user preferences**: a `NotificationPreference(user_id, event_type, channel, enabled,
   min_severity)` table lets a user opt in/out per (event type x channel) — e.g. "push for
   VehicleRelocated, email off, in-app always on". Defaults ship opinionated: push+in-app ON for
   VehicleRelocated/VehicleExited (owner-facing, high urgency), in-app-only for CameraOffline
   (operator-facing, not urgent enough to page).
3. **Fan-out order and dedup**: for a single triggering event, the rule engine (ADR-1901)
   computes the enabled-channel set once per user, and writes one `Notification` row per
   channel, not one row fanned out N times per channel. A dedup key
   `(user_id, vehicle_id, event_type)` with a short TTL (default 5 minutes, tenant-configurable)
   in Redis suppresses re-alerting on flapping detections (e.g. a track briefly jitters across a
   slot boundary and back).
4. **Severity levels**: `INFO` (e.g. CameraOffline recovered), `WARNING` (CameraOffline sustained,
   PersonDetected lingering), `CRITICAL` (VehicleRelocated, VehicleExited unexpectedly). Channel
   defaults scale with severity — `CRITICAL` defaults to push+in-app, `INFO` defaults to in-app
   only — but remain user-overridable within plan entitlements (Free plan may cap to in-app only,
   per brief §3.10 metered entitlements).
5. **Email** uses a transactional email provider reached over SMTP/API from the same channel-
   adapter interface; it is lowest priority to implement (digest-style, not real-time) and is not
   blocking for GA.

## Alternatives considered

- **FCM for both platforms via the APNs bridge** (chosen) — one backend integration, one SDK.
  - Pros: single code path and single credential set to manage; Firebase's free tier covers
    ParkVision's expected volume for a long time; well-documented Spring Boot integration; the
    mobile app (Expo) has first-class FCM support via `expo-notifications`.
  - Cons: adds a dependency on Google infrastructure even for iOS-only delivery; slightly less
    control over APNs-specific features (interruption levels, live activities) than talking to
    APNs directly.

- **Direct APNs + FCM as two separate integrations.**
  - Pros: full native control per platform, no intermediary.
  - Cons: doubles the backend integration and credential/cert management (APNs certificate/token
    rotation is notably more operationally fiddly than FCM's service-account key); no material
    benefit for ParkVision's use case (simple alert push, not platform-specific rich
    notifications) at this stage.

- **Third-party push aggregator (OneSignal, Courier).**
  - Pros: unified dashboard, less backend code, built-in preference UI.
  - Cons: yet another vendor and per-notification cost; device tokens and (indirectly) plate/
    location-derived alert text would flow through a third party, complicating the tenant-
    isolation and data-residency story (brief §3.2); deferred as a possible later swap behind the
    channel-adapter interface from ADR-1901, not a day-one requirement.

- **No preferences — fixed rules for all users.**
  - Pros: zero schema, zero UI.
  - Cons: guaranteed complaints ("stop pushing me every relocation") for site managers watching
    many vehicles; does not support plan-based entitlement differences (Free vs Pro channel
    limits); rejected.

## Consequences

- Positive: one push SDK to operate; preference model gives users control and gives the platform
  a lever for plan-based feature gating (billing doc `05_Subscription_Billing`); severity-based
  defaults keep out-of-the-box behavior sane without forcing every user to configure anything.
- Negative / trade-offs: FCM outage or Google-side APNs bridge issues would affect iOS delivery
  too (single point of failure across both platforms); dedup TTL is a tuning knob that needs
  real-world calibration (too short = spam, too long = a genuinely new relocation gets
  suppressed).
- Follow-ups: device-token lifecycle (registration/expiry/re-registration) is specified in
  `18_Mobile_App`; the channel-adapter interface itself is defined in ADR-1901; email provider
  selection is deferred to an implementation ticket, not a doc-level ADR, since it is
  low-risk/reversible.
