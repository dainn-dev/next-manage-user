# DAI-311 · Dashboard integration QA

Date: 2026-07-14

## Covered MVP paths

| Area | Tenant admin | Site manager | Security guard | Result |
|---|---|---|---|---|
| Dashboard + occupancy analytics | All tenant sites | Assigned sites | Assigned sites | HTTP/JWT/site-scope integration covered |
| Camera tiles | Scoped site/zone | Scoped site/zone | Scoped site/zone | Loading/empty/offline/media-error covered |
| Parking map | Scoped site/zone | Scoped site/zone | Scoped site/zone | Designer polygons + realtime slot state |
| Plate search | Tenant results | Fail-closed to scoped occupancy/events | Fail-closed to scoped occupancy/events | HTTP contract + current slot/last seen/latest snapshot covered |
| Event timeline | Scoped site/zone | Scoped site/zone | Scoped site/zone | Unified gate/parking/camera read model + filter/page covered |
| Tenant administration | Allowed | Denied/hidden | Denied/hidden | Frontend route/nav policy covered |

Focused frontend tests live in `frontend/tests/dashboard-foundation.test.mjs`. Full backend HTTP
coverage lives in `DashboardApiIntegrationTest`: it boots the real security chain and random-port
server against PostgreSQL/PostGIS, issues JWTs for all three operator roles, and verifies positive
and negative site scopes plus the timeline, plate-search, latest-snapshot, and dwell JSON contracts.

## Remaining backend/API blockers

1. Site occupancy STOMP (`/topic/site/{siteId}/slots`) and JWT/site-scoped subscription
   authorization are implemented, with polling retained as reconnect fallback. Durable publication
   for the broader `/events` stream still depends on an outbox dispatcher.
2. Camera REST now keeps RTSP write-only and exposes a browser-safe HLS/MJPEG/MP4/WebRTC metadata
   contract with optional expiry and snapshot fallback. Deployments still need to configure a media
   gateway URL; the API does not transcode RTSP itself.
The implemented event endpoint currently uses bounded offset pagination. ADR-1703 cursor semantics
remain a scale-hardening item for very high insert rates; correctness, site isolation, filters, and
bounded page validation are covered by the HTTP integration suite.
