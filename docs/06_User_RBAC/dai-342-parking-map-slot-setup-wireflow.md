# DAI-342 · Parking Map & Slot Setup Wireflow and Implementation Handoff

Status: **Design handoff** · Owner: Product Design / Principal Architect · Last updated: 2026-07-16

- Tracking: DAI-342 · Parent: DAI-331
- Actors: `TENANT_ADMIN`, assigned-site `SITE_MANAGER`; published-map view only for
  `SECURITY_GUARD`
- Inputs: [DAI-332 permission matrix](permission-matrix.md),
  [DAI-333 IA standards](ia-interaction-standards.md),
  [DAI-341 Camera & Gate setup](dai-341-camera-gate-setup-wireflow.md),
  [Parking Map Designer](../08_Parking_Map_Designer/README.md),
  [ADR-0804 commissioning contract](../08_Parking_Map_Designer/adr/ADR-0804-commissioning-version-and-api-contract.md),
  and [ADR-1102 runtime contract](../11_Parking_Slot_Detection/adr/ADR-1102-slot-runtime-and-event-contract.md)

## 1. Outcome and boundary

This document defines the end-to-end experience at
`Site → Thiết lập bãi đỗ → Sơ đồ & Ô đỗ`: create zones, choose an eligible `OVERVIEW` camera and
capture a still (or upload a fallback image), calibrate it, author slot polygons, validate a
single- or multi-camera site, save a draft, publish an immutable runtime version, and manage
history through rollback and GeoJSON interchange.

The repository already contains the commissioning page, source-image upload, calibration,
optimistic draft APIs, site-wide validation, publish/archive/rollback, GeoJSON, unified preview,
PostGIS geometry, stable slot identity, and automated single/multi-camera tests. This handoff
specifies the target interaction and accessibility contract and records gaps without replacing
ADR-0804 or presenting incomplete UX as finished.

Draft content never changes runtime occupancy. Runtime and Guard views consume only published
site-local geometry through ADR-1102-compatible reads.

## 2. Actor and scope contract

| Actor | Zones / drafts | Validate / publish | History / rollback | Runtime map |
|---|---|---|---|---|
| `TENANT_ADMIN` | Any active site in own tenant | Yes | Yes, with reason/audit | View |
| `SITE_MANAGER` | Assigned active sites only | Yes | Yes, with reason/audit | View |
| `SECURITY_GUARD` | No authoring access | No | No | Assigned-site published occupancy, view only |
| `PLATFORM_ADMIN` | No implicit tenant access | No | No | No tenant-ops route |
| `MEMBER` | No | No | No | No operations map |

The selected `siteId`, `cameraId`, zone IDs, still, calibration, map, and slot IDs are untrusted
inputs. Every API verifies tenant/site relationships and server-resolved site assignment. A
cross-scope identifier returns a non-enumerating denial. Site switching aborts requests, closes
dialogs, clears image URLs, and never carries a draft or polygon selection into the new site.

## 3. Entry and readiness

1. The operator selects an allowed site and opens `Thiết lập bãi đỗ → Sơ đồ & Ô đỗ`.
2. A readiness panel checks: site exists and is active; at least one zone; an eligible Overview
   camera or permission to use image upload; source image; valid calibration; and current map
   history.
3. If no Overview camera is available, show `Thiết lập camera` and `Tải ảnh tĩnh` recovery. Upload
   is a commissioning fallback attached to a server-approved camera context; it does not create a
   fake online camera or bypass site/camera authorization.
4. If the camera is offline or its snapshot is stale, show capture time and cause. Allow an older
   image only as an explicit draft source; publish must warn or reject according to server policy.
5. Guards never enter this readiness/editor flow. They open the published operational map.

## 4. Zone setup

A zone represents a floor or parking area such as `Tầng 2 / Khu A`. The zone step lists name,
enabled slot count, referenced cameras/maps, and current occupancy impact.

- Create and rename within the selected site; normalize whitespace and reject duplicate names.
- Deleting a zone is blocked while referenced by a camera, active/draft slot, map history, or
  runtime record. Offer `Chuyển sang zone khác` where safe.
- A slot requires a same-site zone in the DAI-342 editor even if the lower-level data model permits
  null for compatibility.
- Changing a slot's zone is a logical metadata edit that preserves its stable `slotId` when the
  physical space is unchanged.

## 5. Source image and calibration

### 5.1 Choose source

The camera picker contains selected-site `OVERVIEW` cameras only and shows eligibility, health,
snapshot freshness, resolution, coverage label, and explicit ineligible reason.

- `Chụp ảnh mới` requests a server-side capture. If the deployment returns
  `capture_unavailable`, keep the editor state and offer upload.
- Upload accepts the ADR-0804 image types/limits, normalizes orientation server-side, and returns
  immutable image metadata plus a short-lived read URL.
- Changing the source image after drawing begins requires confirmation and starts a new draft or
  a controlled rebase; vertices are never silently scaled to a new frame.

### 5.2 Calibration mode

Calibration uses four or more non-degenerate pixel-to-site-local control points. The editor
collects pixel position and known site coordinates/distance, labels every pair, supports keyboard
adjustment, and previews reprojection error. Validation reports duplicate/collinear points,
dimension/hash mismatch, singular transform, and threshold failure beside the affected input.

Saving creates an immutable calibration version. Editing points creates a new version; it does not
reinterpret a published map. A calibration referenced by history cannot be deleted.

## 6. Draft and editor interaction

Creating a draft pins site, camera, immutable source image, calibration version, native dimensions,
coverage polygon, and a `lockVersion`. The canvas always converts pointer coordinates back to
native image pixels before sending them.

### 6.1 Draw a slot

1. Choose `Vẽ ô đỗ`, then add at least three vertices. Enter/double-click closes; Escape cancels.
2. Enter a trimmed code such as `A01`, choose a same-site zone, and choose administrative state
   `enabled | disabled`.
3. Confirm to add the slot. The editor focuses the new item in the slot list and announces its
   validation result.
4. Select a polygon or list row to edit vertices, code, zone, or state. Copy offsets geometry but
   requires a new unique code before save.
5. Undo/redo covers local geometric and metadata edits. It does not undo a completed publish,
   rollback, import, or scope change.

`enabled/disabled` is administrative state; occupied/free is runtime state and cannot be authored
here. Removing a physical slot retires stable identity on publish. Reusing a retired code creates a
new logical identity and requires explicit confirmation.

### 6.2 Live validation

| Rule | Editor feedback | Server authority |
|---|---|---|
| At least 3 distinct finite vertices | Prevent close/save; highlight count | Reject |
| Within native frame | Clamp preview and mark offending vertices | Reject |
| Simple, positive-area polygon; no holes | Highlight crossing/degenerate edges | PostGIS reject |
| Slot inside owning coverage partition | Overlay partition and mark outside area | Reject |
| No slot interior overlap; boundary touch allowed | Shade conflicting polygons and link both codes | Site-wide reject |
| Code unique, trimmed/case-insensitive | Inline duplicate message | Site-wide constraint/reject |
| Zone belongs to selected site | Remove invalid option, block save | Reject |
| Source/calibration/camera share scope and dimensions | Readiness warning | Reject |

The issue panel groups errors by slot/code and supports `Đi tới lỗi`. A valid client preview is
never evidence that publish will succeed; the server revalidates the entire active site layout.

## 7. Autosave, explicit save, and conflict recovery

The status region is always visible and has semantic states: `Chưa lưu`, `Đang tự lưu…`,
`Đã lưu lúc …`, `Không thể lưu`, and `Có phiên bản mới hơn`.

- Debounced autosave and `Lưu bản nháp` call the same draft update using `If-Match`.
- Autosave triggers only for a mutable draft; it never publishes and never edits archived or
  published versions.
- Navigation, site/camera/source change, browser close, and session expiry warn while dirty or a
  save is in flight.
- On network failure, keep unsaved work in memory, show retry/export recovery, and do not claim it
  is stored.
- On `409` stale lock, stop autosave. Show current server version, local change summary, and
  `Tải bản server`, `Xuất thay đổi local`, or an explicit review/merge path. Never last-write-win.
- On `401`, preserve only non-secret in-memory work until reauthentication; on success, re-check
  access and lock before retrying.

## 8. Preview and multi-camera partitioning

`Xem trước toàn site` renders the unified published site-local layout plus the current candidate as
a clearly differentiated overlay. Occupancy is preview data only and never saved into the draft.

For multiple Overview cameras, each camera owns one calibrated, non-overlapping coverage partition.
The workspace provides:

- camera-colored coverage overlays and a legend;
- warnings for uncovered areas and blocking errors for partition interior overlap;
- cross-camera slot-code and polygon-overlap validation;
- links from a conflict to both owning camera drafts;
- a site summary of which candidate will replace which active camera version.

A slot is authored once, belongs to exactly one camera partition, and becomes part of one unified
site runtime map after publish. The editor does not merge duplicate overlapping observations or
choose a winning camera.

## 9. Publish

`Publish` is disabled until the current draft is explicitly saved and a fresh server validation is
valid. The confirmation summarizes:

- selected site, camera, source and calibration;
- draft/version and lock version;
- total enabled/disabled/new/changed/retired slots by zone;
- coverage changes and other active camera partitions;
- version that will be archived and runtime impact.

Confirming sends `If-Match` plus an idempotency key. The server revalidates site-wide and atomically
publishes the candidate while archiving the previous active version for that camera. The UI reports
success only after the transaction returns, shows the new version/audit reference, refreshes unified
preview, and clears local undo history. A timeout is treated as unknown outcome: query history using
the idempotency key/status before offering retry.

Publish validation failure leaves the draft editable and maps structured errors back to slots,
coverage, source, calibration, or cross-camera conflict. Runtime continues reading the previous
published version throughout.

## 10. History, rollback, archive, and GeoJSON

Version history shows `draft | published | archived`, version number, camera, source/calibration,
slot summary, author, timestamps, activation reason/audit reference, and compatibility status.

- **Rollback:** choose a compatible archived version, compare it to current, enter a nonblank
  reason, and confirm affected slots/occupancy. The server validates against current site-wide
  partitions and atomically reactivates it. Failure leaves the current published version active.
- **Archive:** never removes historical geometry. Archiving the current runtime source requires
  an approved replacement/activation path; draft deletion is distinct.
- **Export:** produces server-generated GeoJSON for the chosen version in
  `site-local-meters-v1`, with non-secret metadata.
- **Import:** parse and preview into a new draft only. Show feature count, invalid geometry,
  duplicate codes, zone mapping, ignored foreign IDs, and camera/coverage conflicts before create.
  Imported tenant/site/camera fields never grant scope.

## 11. Camera movement and stale maps

An Overview camera may be moved, replaced, re-aimed, change resolution, or produce a materially
different scene. Health/commissioning compares current evidence with the map's pinned source and
calibration and marks the map `potentially stale` with cause and detected time.

- Published runtime remains the explicit source until a validated replacement is published or an
  operational safety policy disables consumption; the UI never silently redraws geometry.
- Authoring requires a new source and calibration when dimensions/hash/coverage assumptions fail.
- Guards see a non-configurable stale/degraded banner on the published map and recovery ownership,
  not draft geometry or commissioning controls.

## 12. Responsive wireframes

The canonical navigation/state model is in
[`diagrams/dai-342-parking-map-wireflow.mmd`](diagrams/dai-342-parking-map-wireflow.mmd).

### Desktop editor

```text
┌ Site A / Sơ đồ & Ô đỗ ─ Cam Overview A ▾ ─ v7 draft ─ Đã lưu 14:32 ┐
│ [Zones] [Source] [Calibration] [Editor] [Preview] [History]           │
├───────────────┬──────────────────────────────────────┬─────────────────┤
│ Tools         │ Native image / coverage canvas       │ Slots (24)      │
│ Select        │   ┌ A01 ─────┐  ┌ A02 ─────┐         │ Search/filter   │
│ Draw polygon  │   │ handles  │  │ overlap! │         │ A01 enabled     │
│ Pan / zoom    │   └──────────┘  └──────────┘         │ A02 error       │
│ Undo / redo   │ Camera B partition shown read-only   │ Code / Zone     │
│               │                                      │ State           │
├───────────────┴──────────────────────────────────────┴─────────────────┤
│ 2 validation errors [Đi tới lỗi]   [Lưu bản nháp] [Validate] [Publish]│
└────────────────────────────────────────────────────────────────────────┘
```

### Tablet editor

```text
┌ Site A ▾  Cam A ▾  v7 draft                    Đã lưu ┐
│ [Edit] [Slots] [Validate] [Preview] [History]          │
│ ┌──────────────── canvas / pinch zoom ───────────────┐ │
│ │ Tap to add vertices · selected polygon + handles  │ │
│ └────────────────────────────────────────────────────┘ │
│ A01 · Zone A · enabled                         [Edit]   │
│ Error: overlaps B03                         [Go to]     │
│ [Undo] [Redo]             [Lưu] [Validate] [Publish]   │
└────────────────────────────────────────────────────────┘
```

On tablet portrait, tools and slot properties use mutually exclusive bottom sheets so the canvas
retains useful size. Publish/history are full-screen review steps. All targets are touch-sized;
pinch zoom has button equivalents. Desktop and tablet support keyboard polygon creation, visible
focus, non-color-only validation, screen-reader save announcements, and a textual slot table.

## 13. Guard published-map view

The Guard view contains selected assigned site, published version/freshness, zone filter, slot
code, occupancy status, last update, camera-health degradation, and a list alternative to the
visual map. It excludes draft/history/source/calibration data and all create/edit/import/export/
publish/rollback controls. Realtime failure shows stale timestamp and retry; it never resets the
map to an apparently empty lot.

## 14. Existing foundation and implementation gaps

| Concern | Existing foundation | Target UX/runtime follow-up |
|---|---|---|
| Route/editor | `/parking/commissioning` wizard, SVG polygon editing, undo/redo | IA route naming/deep link, responsive sheets, keyboard authoring and complete state restoration |
| Zone/camera | Scoped APIs and readiness steps | Rich dependency summary, safe reassignment, DAI-341 eligibility contract |
| Image/calibration | Upload, best-effort capture, immutable calibration APIs | Capture deployment integration, point-level accessible errors, stale-scene evidence |
| Draft/save | Autosave, explicit save, `ETag`/`If-Match` | Visible conflict comparison/export/merge recovery and navigation/session boundaries |
| Geometry validation | Server/PostGIS and client policy checks | Structured error codes/feature references and cross-camera conflict navigation |
| Publish/rollback | Idempotent publish, reasoned rollback, activation audit | Full diff/version/audit confirmation and unknown-outcome reconciliation UI |
| Multi-camera | Site-wide validation, unified preview, E2E coverage | Partition authoring/legend/conflict workflow at operator quality |
| GeoJSON | Import/export APIs | Preflight mapping/report, accessible progress, large-file recovery |
| Guard/runtime | Published parking/occupancy reads exist | Least-privilege published-map route with stale/degraded and list alternative |

## 15. Acceptance checklist

- [ ] Desktop and tablet cover readiness, zones, source, calibration, editor, validation, preview,
  history, import/export, publish, and rollback.
- [ ] Autosave and explicit Save expose truthful pending/saved/error/conflict states; draft changes
  never reach runtime before publish.
- [ ] Client validation is immediate and server validation is authoritative for polygon shape,
  frame/coverage bounds, overlap, code, zone, source/calibration, and cross-camera partitions.
- [ ] Publish and rollback include confirmation, version/diff summary, nonblank rollback reason,
  idempotency/concurrency behavior, atomic audit outcome, and safe failure recovery.
- [ ] Runtime and Guard views read published versions only; Guard is assigned-site, view-only, and
  receives stale/degraded behavior without commissioning data.
- [ ] No-camera, offline/stale camera, empty draft, autosave failure, stale lock, invalid polygon,
  duplicate code, overlap, and publish validation failure have explicit recovery.
- [ ] Single-camera and disjoint multi-camera sites are covered; cross-camera duplicate/overlap and
  partition overlap are rejected.
- [ ] DAI-340 validates direct links, cross-scope IDs, no/disabled site, optimistic conflict,
  idempotent unknown outcome, keyboard/touch, focus, status announcements, and responsive layouts.

