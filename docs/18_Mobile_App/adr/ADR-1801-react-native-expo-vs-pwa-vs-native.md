# ADR-1801: React Native (Expo) for the driver/owner mobile app

- Status: Proposed
- Date: 2026-07-09
- Deciders: Principal Architect
- Context doc: 18_Mobile_App

## Context

**No mobile app exists today** (§1) — the driver/owner-facing "where is my car" experience is
entirely new. It needs to reuse the existing REST API (JWT auth, `/api/v1` per §3.16) and add native
push notifications (FCM/APNs) for relocation/stolen alerts (§2, §3.13 already names React Native
Expo as the target). The team already ships TypeScript across `frontend/` (Next.js/React), so
language/tooling continuity is a real factor, not just a preference.

## Decision

Build the mobile app with **React Native using Expo** (managed workflow where possible), consuming
the same `/api/v1` REST endpoints the dashboard uses, plus new mobile-specific endpoints (device
token registration, see `18_Mobile_App` README). Push delivery via FCM (Android) and APNs (iOS)
through Expo's push service or direct FCM/APNs integration (see ADR-1802).

## Alternatives considered

- **Progressive Web App (PWA)** — pros: one codebase shared closer to the existing Next.js frontend,
  no app-store review process, instant updates; cons: push notification reliability and background
  delivery on iOS Safari is materially weaker than native APNs (historically limited/late iOS PWA
  push support), no true native "deep link from push into a specific alert screen" experience,
  weaker access to background location/camera APIs if the roadmap later wants those; rejected as the
  primary vehicle-alert use case leans hard on reliable push.
- **Fully native (Swift/Kotlin, two separate codebases)** — pros: best possible platform integration
  and performance; cons: doubles the codebase/maintenance/team-skill surface for a first mobile app
  with a modest initial scope (link vehicle, find my car, alerts, status, chatbot, notifications);
  disproportionate for v1, revisit only if a specific native capability RN/Expo cannot deliver
  becomes a hard requirement.
- **React Native bare workflow (no Expo)** — pros: full native module access without Expo's
  constraints; cons: Expo's managed workflow already covers this app's needs (push, secure storage,
  deep links) and its build/OTA-update tooling (EAS) meaningfully lowers ops burden for a small
  mobile team; bare workflow is an easy escape hatch later if a specific native module demands it.

## Consequences

- Positive: single TypeScript codebase for iOS+Android, direct REST API reuse with the existing
  backend (no new API paradigm), Expo's EAS Build/Update reduces release/ops overhead, strong native
  push support on both platforms.
- Negative / trade-offs: Expo managed workflow has some constraints on custom native modules (rarely
  a problem for this app's scope, but worth flagging); team needs baseline React Native/Expo
  familiarity distinct from Next.js web patterns (navigation, secure storage, deep links differ from
  the web app's `ProtectedLayout` + `localStorage` approach in §1).
- Follow-ups: confirm Expo managed workflow covers all needed native camera/map APIs before locking
  the choice; define the CI/EAS build pipeline as part of `14_Deployment` (Kubernetes/CI doc, if
  present) or this doc's own follow-up.
