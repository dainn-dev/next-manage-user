# 18 · Mobile App

A driver/owner-facing mobile app so a vehicle owner can find their car, get relocation/stolen
alerts, check a site's parking status, and talk to the AI chatbot — none of which exist in any form
today. Built with React Native (Expo), reusing the same REST API the dashboard uses.

Status: Draft · Owner: Principal Architect · Last updated: 2026-07-09

## 1. Current state vs. Target

**Current state: no mobile app exists today.** The repo is `frontend/` (Next.js web), `backend/`
(Spring Boot), and `edge/` (Python) only (§1) — there is no mobile client, no push notification
integration, and no device-token storage anywhere in the codebase. Everything in this document is
new, target-state design.

**Target:** a React Native (Expo) app that is a *thin client* over the existing/target REST API
(`/api/v1`, JWT auth per §3.16) plus new mobile-specific endpoints (device token registration). It
reuses backend capabilities being built for the dashboard and chatbot rather than duplicating logic.

## 2. Why a mobile app, and why now conceptually

The core driver-facing job — "where is my car / did it move" — is inherently a mobile, push-driven
use case: a relocation alert (`VehicleRelocated` event) is only useful if it reaches the driver
wherever they are, promptly, which the dashboard's browser-tab-dependent STOMP connection cannot
guarantee. See `adr/ADR-1801-react-native-expo-vs-pwa-vs-native.md` for the platform choice
rationale (RN/Expo vs. PWA vs. fully native).

## 3. Core flows

| Flow | Description | Backend dependency |
|---|---|---|
| **Link my vehicle** | Onboarding: driver enters/confirms plate, links it to their `User.owner_user_id` | `Vehicle` entity (§4), new `POST /api/v1/vehicles/link` |
| **Where is my car** | Map pin + last snapshot for the driver's linked vehicle(s) | `getVehicleLocation()`-equivalent REST call (shared logic with `16_AI_Chatbot`'s tool) |
| **Relocation/stolen alerts** | Push notification when `VehicleRelocated` fires, or a manual "report stolen" flow | `12_Vehicle_Relocation_Detection`, `19_Notifications` |
| **Parking status for a site** | "Is there space at Site X" before driving over | `getParkingStatus()`-equivalent REST call |
| **Chatbot in-app** | Same conversational assistant as the dashboard, mobile-optimized chat sheet | `16_AI_Chatbot` |
| **Notifications** | Inbox of past alerts/notifications, mirrors the dashboard's notifications center | `19_Notifications` |

See `diagrams/mobile-navigation.mmd` for how these flows map to screens/tabs.

## 4. Authentication

- **JWT**, issued by the same `/api/v1/auth/login` endpoint the dashboard uses (§1: JWT claims
  role/email/userId today; target adds tenant_id + site scope, §3.9).
- **Secure storage**: the token is stored in the platform's secure keychain (iOS Keychain / Android
  Keystore via Expo SecureStore) — **not** `localStorage`/AsyncStorage in plaintext, a deliberate
  divergence from today's web app's `localStorage` approach (§1), since a mobile device is more
  likely to be lost/shared than a browser session.
  This means the login system remains shared (same JWT issuance and claims), but the client-side
  storage mechanism is mobile-appropriate rather than copying the web pattern.
- **Refresh**: client-side expiry check (same pattern as today's web `ProtectedLayout`), refresh
  proactively before expiry where a refresh-token flow exists, else re-prompt login.
- **Role scope**: mobile app targets the `MEMBER` role primarily (vehicle owner) — it is not
  an operator console; `TENANT_ADMIN` operational tooling stays on the dashboard.

## 5. Offline behavior

- **Read-mostly, degrade gracefully.** Vehicle location/status/history are read-only lookups; on
  network loss, show the last successfully fetched state with a clear "last updated at HH:MM,
  offline" indicator rather than a blank/error screen.
- **No offline write queue for v1** (contrast with `edge/`'s SQLite store-and-forward queue, §1 —
  that pattern exists for edge event ingestion under unreliable network, which is a materially
  different problem; the mobile app has no comparable write-heavy offline requirement for v1's
  scope). "Report stolen" and "link vehicle" require connectivity.
- **Push notifications** are the mechanism that keeps the app "live" without polling while
  backgrounded — see `diagrams/push-notification-flow.mmd` and `adr/ADR-1802-push-delivery-token-management.md`.

## 6. Deep links

- `parkvision://vehicle/{plate}` — opens directly to that vehicle's find-my-car detail.
- `parkvision://alert/{eventId}` — opens the alert detail for a specific `ParkingEvent`/
  `Notification`, the primary target of a push-notification tap.
- Universal/App Links (HTTPS fallback for when the app isn't installed) route to a lightweight web
  landing page prompting install — not detailed further here.

## 7. Push notifications

Delivery path: domain event (`VehicleRelocated`, etc.) → RabbitMQ → `notification` module → channel
fan-out → **FCM** (Android) / **APNs** (iOS) → device → tap → deep link into the app. Full flow in
`diagrams/push-notification-flow.mmd`; token registration/lifecycle decision in
`adr/ADR-1802-push-delivery-token-management.md`.

## 8. Worked example: "find my car"

1. Driver opens the app; token read from secure storage (refreshed if needed).
2. App calls `GET /api/v1/vehicles/me/location` (owner resolved from JWT `sub`, tenant/site scoped
   server-side — same isolation guarantee as every other tenant-scoped endpoint).
3. Backend returns current slot, site, and last-seen timestamp.
4. App fetches the linked snapshot via a short-TTL signed URL.
5. Map renders a pin at the slot; snapshot thumbnail shown alongside.
6. If the vehicle relocated since the last check, a banner surfaces the change immediately.

Full sequence: `diagrams/find-my-car-sequence.mmd`.

## 9. Diagrams

- `diagrams/mobile-navigation.mmd` — tab/screen navigation: onboarding → home → find-my-car →
  chatbot → notifications → profile, plus deep-link entry points.
- `diagrams/find-my-car-sequence.mmd` — token refresh, location lookup, snapshot resolution, and
  relocation-banner logic end to end.
- `diagrams/push-notification-flow.mmd` — domain event → notification module → FCM/APNs → device →
  deep link, plus device-token registration/pruning lifecycle.

## 10. Decisions / ADRs

- `adr/ADR-1801-react-native-expo-vs-pwa-vs-native.md` — React Native (Expo) chosen over PWA and
  fully native, primarily on push-reliability and single-codebase grounds.
- `adr/ADR-1802-push-delivery-token-management.md` — backend-owned device-token lifecycle, direct
  FCM/APNs delivery via the `notification` module.

## 11. Open questions / risks

- No refresh-token mechanism is confirmed to exist on the backend today (§1 describes access-token
  JWT only, 86400s expiry) — mobile session UX (silent refresh vs. re-login) depends on this being
  added; flagged here, owned by `06_User_RBAC`/auth design.
- App-store review timelines (iOS/Android) affect release cadence in a way the web dashboard never
  has to plan around — not detailed here.
- "Report stolen" flow's downstream effect (does it change `Vehicle.status`, trigger a
  `TENANT_ADMIN` alert, etc.) needs definition with `12_Vehicle_Relocation_Detection` and
  `19_Notifications`.
- Expo managed-workflow constraints on background location (if a future "live tracking" feature is
  requested) are unassessed — flagged in `adr/ADR-1801`.

## 12. Cross-references

- `04_Multi_Tenant_Design` — tenant/site scoping enforced on every mobile API call.
- `06_User_RBAC` — `MEMBER` role scope the mobile app targets.
- `12_Vehicle_Relocation_Detection` — source of relocation/stolen alert events.
- `16_AI_Chatbot` — in-app chatbot reuses the same tool-calling backend as the dashboard.
- `17_Dashboard` — shares the REST API surface; operator-facing counterpart to this driver-facing app.
- `19_Notifications` — notification rules, channels, and the mobile app's in-app inbox.
