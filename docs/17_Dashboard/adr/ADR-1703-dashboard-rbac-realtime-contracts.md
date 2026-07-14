# ADR-1703: MVP dashboard RBAC, scoping, realtime, and frontend contracts

- Status: Accepted
- Date: 2026-07-14
- Deciders: Principal Architect
- Context doc: 17_Dashboard
- Tracking: DAI-300

## Context

Stage 5 adds an operational dashboard over data that is tenant-, site-, zone-, camera-, and
parking-slot-scoped. The existing application already has tenant RLS, `site_ids` in operator JWTs,
REST endpoints, and STOMP/SockJS, but those pieces do not yet form a complete dashboard contract.
This ADR fixes the MVP authorization boundary, resource hierarchy, wire shapes, and degraded-mode
behaviour before frontend implementation begins.

The backend is always the authorization authority. Navigation hiding, disabled controls, route
guards, and client-side filtering are usability measures only and must never be treated as access
control.

## Decision 1: roles and dashboard visibility

The MVP dashboard recognizes the following product roles. `SECURITY_GUARD` is a target Stage 5
role; it is not present in the current `User.Role` enum and therefore cannot be assigned until the
backend gap listed below is implemented.

| View / capability | `PLATFORM_ADMIN` | `TENANT_ADMIN` | `SITE_MANAGER` | `SECURITY_GUARD` |
|---|---|---|---|---|
| Platform overview and tenant health | Read all tenants; no tenant operational data by default | No | No | No |
| Operations overview / KPIs | No; must explicitly enter an audited tenant-support context | Read all tenant sites | Read assigned sites | Read assigned sites, operational subset |
| Site switcher | Tenant selector first; support context only | All sites in JWT tenant | Intersection of JWT `site_ids` and active sites | Intersection of JWT `site_ids` and active sites |
| Parking map and slot detail | Support context only | Read all tenant sites | Read assigned sites | Read assigned sites |
| Live cameras | Support context only | Read all tenant sites | Read assigned sites | Read assigned sites |
| Event timeline / LPR events | Support context only | Read all tenant sites | Read assigned sites | Read assigned sites; no owner/contact PII |
| Analytics | Platform aggregates only, never tenant rows | Tenant roll-up and site/zone drill-down | Assigned-site and zone drill-down | No MVP analytics view |
| Site CRUD | No from platform console | Create/update/delete | Read assigned sites | No |
| Zone / camera CRUD | Support context is read-only | Create/update/delete | Create/update/delete in assigned sites, except camera credentials | No |
| Slot-map configuration | Support context is read-only | Replace/publish | Read only | Read only |
| Camera credential issue/rotation | No | Yes | No | No |

Rules:

1. `PLATFORM_ADMIN` operates outside tenant RLS and sees platform metadata only. Tenant operational
   views require a future explicit support-session contract containing tenant, reason, expiry, and
   audit identity; the MVP must not silently grant cross-tenant dashboard access.
2. `TENANT_ADMIN` is tenant-wide. Its `tenant_id` JWT claim is mandatory and every operational
   query is confined to it by RLS.
3. `SITE_MANAGER` and `SECURITY_GUARD` are site-bound. A resource is visible only when its owning
   `siteId` occurs in the authenticated principal's server-resolved site assignments. A client
   supplied `siteId` never expands this set.
4. Unauthorized resource identifiers return `404` to avoid disclosing existence across a scope;
   an authenticated role lacking a capability on an otherwise visible resource returns `403`.
5. The API must derive tenant and allowed sites from the validated principal, not from headers or
   request bodies. JWT `site_ids` are a cache of server assignments; changes require token renewal
   or server-side assignment validation.

## Decision 2: resource scoping

The canonical ownership chain is:

```text
tenant -> site -> zone -> camera
                  |-> parking slot
       -> gate -> LPR/access event
```

- `siteId` is the dashboard's required top-level operational scope. No tenant dashboard endpoint
  may return unscoped operational rows accidentally.
- `zoneId`, `cameraId`, `slotId`, and `gateId` are filters beneath a site. The backend resolves each
  child and verifies that it belongs to the path/query `siteId`; mismatches return `404`.
- A missing `zoneId` means all permitted zones in the selected site, not all tenant sites.
- Cameras without a zone remain site-scoped and appear in an explicit `Unassigned` group.
- Slot occupancy is authoritative by `slotId`; `cameraId` is provenance, never authorization.
- Tenant roll-ups are allowed only for `TENANT_ADMIN` and must be explicitly requested with
  `scope=tenant`. All other dashboard calls require one `siteId`.
- Pagination uses zero-based `page`, bounded `size` (default 50, maximum 200), and stable ordering
  by `(occurredAt DESC, id DESC)`. Times are RFC 3339 UTC strings. IDs are UUID strings.

## Decision 3: realtime with polling fallback

STOMP over WebSocket/SockJS is the MVP primary transport because it already exists. The REST API
is authoritative; messages are invalidations/deltas and are not a durable event log.

### Connection and subscriptions

- Endpoint: `/ws`, authenticated with the same bearer token during STOMP `CONNECT`.
- Topics: `/topic/site/{siteId}/slots`, `/topic/site/{siteId}/events`, and
  `/topic/site/{siteId}/cameras`.
- The server must authorize every subscription against the principal's tenant and site assignments;
  guessing a topic must not bypass REST authorization.
- The current global `/topic/vehicle-check` remains legacy-only and must not power Stage 5 views.

### Bootstrap, reconnect, and degraded mode

1. Fetch the REST snapshot first and retain its `snapshotVersion`/`asOf`.
2. Connect and subscribe, then refetch once to close the fetch/subscribe race. Apply only events
   whose `version` is newer than the stored resource version.
3. Reconnect with exponential backoff plus jitter (1, 2, 5, 10, then 30 seconds maximum).
4. After disconnect or a sequence gap, mark the view `stale`, refetch the snapshot, then resume.
5. While STOMP is unavailable, poll operational snapshots every 15 seconds while the tab is visible
   and every 60 seconds while hidden. Analytics polls every 60 seconds. Stop fallback polling after
   a healthy subscription and reconciliation fetch.
6. Display `Live`, `Reconnecting`, or `Updated <time>`; never present polled/stale data as live.

The in-memory Spring `SimpleBroker` is acceptable only for a single backend replica. Multi-replica
deployment requires an authenticated broker relay or a shared fan-out bridge before HPA is enabled.

## Decision 4: REST data contracts

All successful responses use camelCase JSON. Errors use:

```json
{
  "code": "SITE_SCOPE_DENIED",
  "message": "The requested resource is not available",
  "requestId": "01J...",
  "fieldErrors": {}
}
```

### Auth and scope bootstrap

`GET /api/auth/me` is extended as the one frontend bootstrap contract:

```json
{
  "id": "uuid",
  "displayName": "Nguyen An",
  "role": "SITE_MANAGER",
  "tenant": { "id": "uuid", "name": "ParkVision VN" },
  "sites": [{ "id": "uuid", "name": "District 1", "permissions": ["DASHBOARD_READ", "CAMERA_WRITE"] }],
  "capabilities": ["DASHBOARD_READ", "EVENT_PII_READ"],
  "tokenExpiresAt": "2026-07-14T10:00:00Z"
}
```

The frontend renders capabilities, not duplicated role conditionals. Role remains available for
labels and coarse navigation. Existing `siteIds` may remain during migration, but `sites` is the
MVP dashboard source of selector labels and permissions.

### Site topology and cameras

- `GET /api/sites` returns only selectable sites.
- `GET /api/zones?siteId={siteId}` returns `{id, siteId, name}`.
- `GET /api/cameras?siteId={siteId}&zoneId={zoneId?}` returns:

```json
[{"id":"uuid","siteId":"uuid","zoneId":"uuid|null","name":"North entry","status":"ONLINE","lastSeenAt":"2026-07-14T08:00:00Z","stream":{"kind":"HLS","url":"short-lived-or-proxied-url","expiresAt":"2026-07-14T08:05:00Z"}}]
```

RTSP URLs, usernames, passwords, edge keys, and credential material are never returned to the
dashboard. Stream URLs must be browser-consumable, short-lived or same-origin proxied.

### Parking snapshot

`GET /api/sites/{siteId}/parking-status?zoneId={zoneId?}` returns:

```json
{
  "siteId": "uuid",
  "asOf": "2026-07-14T08:00:00Z",
  "snapshotVersion": 1842,
  "summary": {"total":120,"available":42,"occupied":70,"reserved":5,"disabled":3},
  "slots": [{
    "id":"uuid","zoneId":"uuid","code":"A-001","status":"OCCUPIED",
    "polygon":{"coordinateSpace":"NORMALIZED_0_1","points":[[0.1,0.2],[0.2,0.2],[0.2,0.3]]},
    "occupancy":{"vehicleId":"uuid|null","plate":"51A-123.45","since":"2026-07-14T07:40:00Z","confidence":0.97},
    "version":91
  }]
}
```

Statuses are `AVAILABLE | OCCUPIED | RESERVED | DISABLED | UNKNOWN`. Plate and vehicle identifiers
are omitted when the principal lacks `EVENT_PII_READ`. `UNKNOWN` is mandatory for stale/conflicting
detection; it must not be coerced to `AVAILABLE`.

### LPR/event timeline

Plate lookup uses `GET /api/vehicles/plate-search?siteId={required}&plate={normalized-or-formatted}`.
It merges the vehicle registry, current slot occupancy, and durable gate history for the authorized
site. Results include `currentSlotId`, `currentSlotCode`, `currentZoneId`, `lastSeenAt`,
`lastEventType`, and `snapshotUrl`; observed unregistered plates are included. Queries shorter than
two alphanumeric characters are rejected.

`GET /api/sites/{siteId}/events?zoneId=&cameraId=&slotId=&type=&from=&to=&cursor=&size=` returns:

```json
{
  "items": [{
    "id":"uuid","siteId":"uuid","zoneId":"uuid|null","cameraId":"uuid|null","slotId":"uuid|null",
    "type":"LPR_RECOGNIZED","occurredAt":"2026-07-14T07:59:58Z","receivedAt":"2026-07-14T07:59:59Z",
    "plate":"51A-123.45","confidence":0.96,"direction":"ENTRY","imageUrl":"short-lived-url|null",
    "correlationId":"uuid","version":1
  }],
  "nextCursor":"opaque|null",
  "asOf":"2026-07-14T08:00:00Z"
}
```

MVP event types are `LPR_RECOGNIZED`, `VEHICLE_ENTERED`, `VEHICLE_EXITED`,
`VEHICLE_RELOCATED`, `SLOT_OCCUPANCY_CHANGED`, and `CAMERA_STATUS_CHANGED`. Image URLs and plate
data are redacted by capability. Cursor pagination prevents duplicates/skips during live inserts.

### Analytics

`GET /api/analytics/occupancy?siteId={required-unless-tenant-scope}&zoneId=&from=&to=&bucket=hour|day&scope=site|tenant`
returns:

```json
{
  "scope":{"tenantId":"uuid","siteId":"uuid|null","zoneId":"uuid|null"},
  "from":"2026-07-07T00:00:00Z","to":"2026-07-14T00:00:00Z","bucket":"day",
  "summary":{"averageOccupancyRate":0.61,"peakOccupancyRate":0.92,"averageDwellSeconds":4200},
  "series":[{"start":"2026-07-13T00:00:00Z","occupied":68,"capacity":120,"occupancyRate":0.567,"entries":143,"exits":139}],
  "generatedAt":"2026-07-14T08:00:00Z"
}
```

The server validates bounded ranges and returns consistent empty arrays, never `null` collections.

## Decision 5: event envelope

All Stage 5 STOMP payloads use one versioned envelope:

```json
{
  "schemaVersion": 1,
  "eventId": "uuid",
  "type": "SLOT_OCCUPANCY_CHANGED",
  "tenantId": "uuid",
  "siteId": "uuid",
  "occurredAt": "2026-07-14T07:59:58Z",
  "publishedAt": "2026-07-14T07:59:59Z",
  "sequence": 1843,
  "correlationId": "uuid",
  "data": {
    "slotId":"uuid","zoneId":"uuid","cameraId":"uuid|null","status":"OCCUPIED",
    "previousStatus":"AVAILABLE","plate":"51A-123.45","since":"2026-07-14T07:59:58Z",
    "confidence":0.97,"version":92
  }
}
```

`sequence` is monotonically increasing per site stream and detects gaps; it is not a global order.
Consumers ignore duplicate `eventId`s and resource versions older than current state. Camera events
carry `{cameraId, zoneId, status, previousStatus, lastSeenAt, version}`. Timeline events reuse the
REST event item inside `data`. Payload redaction must happen before publication to a destination;
if subscribers require different PII rights, use capability-specific user destinations rather than
broadcasting sensitive fields on a site topic.

## Backend dependency gaps before Stage 5

Blocking gaps:

1. Add `SECURITY_GUARD`, its site assignments/capabilities, migrations, JWT mapping, and endpoint
   authorization. Current backend/frontend role enums contain only platform admin, tenant admin,
   site manager, and member.
2. Authenticate STOMP `CONNECT` and authorize `SUBSCRIBE`; current `/ws` allows all origins and the
   simple broker has no documented destination authorization.
3. Add the consolidated auth bootstrap/capability contract. Current `/api/auth/me` returns a
   `UserDto`, not tenant/site labels or per-view capabilities.
4. Add authoritative `parking-status` snapshot, site event timeline, camera browser-stream, and
   occupancy analytics endpoints with the shapes above. Existing parking-slot list/occupancy APIs
   are partial inputs, not the dashboard snapshot contract.
5. Add site-scoped versions/sequences and the versioned STOMP envelopes. Current vehicle-check
   payload has neither schema version nor replay/sequence semantics.
6. Audit legacy vehicle-log/statistics endpoints for mandatory site scoping. They currently expose
   tenant-oriented routes without the Stage 5 `siteId` contract.
7. Choose and configure shared fan-out before running multiple backend replicas.

Non-blocking follow-ups: define stream gateway/SLA, image retention and signed-URL TTL, analytics
retention limits, and the audited platform support-session design.

## Consequences

- Frontend teams can implement role-safe navigation, selectors, maps, timelines, connection state,
  and typed clients without inventing authorization or payload rules.
- REST reconciliation makes correctness independent of best-effort websocket delivery.
- Site-specific topics reduce fan-out, but require server-side subscription authorization.
- `SECURITY_GUARD` and several aggregate endpoints become explicit backend prerequisites rather
  than late Stage 5 surprises.
