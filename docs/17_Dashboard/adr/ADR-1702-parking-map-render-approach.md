# ADR-1702: Parking Map view renders via SVG overlay driven by the 08 designer's polygon data

- Status: Proposed
- Date: 2026-07-09
- Deciders: Principal Architect
- Context doc: 17_Dashboard

## Context

Today's frontend has **no map component and no camera/video component at all** (§1) — camera is
data-only via `Gate.cameraRtspUrl`. The target Parking Map view must render each site's slots
(`ParkingSlot.polygon GEOMETRY(Polygon)`, §4) as occupied/free/reserved/disabled, sourced from the
**Parking-Map Designer** (`08_Parking_Map_Designer`) that lets operators draw slot polygons over a
camera still or lot image and calibrate homography (§3.12). The dashboard's rendering approach must
consume the exact same polygon coordinate space the designer produces, and must update slot fill
color in near-real-time as occupancy events arrive (see `diagrams/realtime-update-sequence.mmd`).

## Decision

Render the Parking Map view as an **SVG overlay positioned over the site's calibrated background
image** (the same still/lot image used in the 08 designer), where each `ParkingSlot.polygon` becomes
an SVG `<polygon>` element in the same normalized coordinate space the designer writes. Slot fill
color is a pure function of `ParkingSlot.status`, updated in place via React state when a
`slot-occupancy-changed` STOMP message arrives (no full re-fetch/re-render of the whole map).
Interaction (hover/click for slot detail — plate, since-when) is handled via standard SVG event
handlers, consistent with shadcn/Tailwind's existing DOM-based styling rather than introducing a
canvas/WebGL rendering stack.

## Alternatives considered

- **HTML5 Canvas rendering** — pros: better raw performance at very high slot counts (thousands of
  polygons), single draw call redraw; cons: loses native DOM accessibility/hit-testing/CSS styling
  that SVG gives for free, requires hand-rolled hit-testing for hover/click, harder to reuse
  Tailwind/shadcn styling conventions the rest of the dashboard uses; most sites have on the order of
  tens to low hundreds of slots, well within SVG's comfortable range.
- **Third-party mapping library (Leaflet/Mapbox GL) treating slots as geo features** — pros: rich
  pan/zoom/clustering out of the box, natural fit if slots were plotted on a real-world basemap;
  cons: the source data is a calibrated image + local polygon coordinates (a parking lot photo, not
  GPS-referenced geo data), pulling in a full mapping library is disproportionate to "overlay
  shapes on a fixed image," and would require reprojecting the 08 designer's coordinate space into
  the library's geo/pixel model for no real benefit.
- **Server-rendered image (backend rasterizes the map to a PNG per request)** — pros: trivial client
  code; cons: defeats near-real-time updates (every occupancy change would require a new image
  round-trip), no client-side hover/click interactivity.

## Consequences

- Positive: the dashboard and the 08 designer share one polygon coordinate contract, so a slot drawn
  in the designer renders correctly in the dashboard with no coordinate-transform code; SVG keeps
  interaction and styling consistent with the rest of the shadcn/Tailwind-based UI; per-slot color
  updates are cheap DOM attribute writes, well suited to frequent STOMP-driven changes.
- Negative / trade-offs: very large sites (many hundreds of slots) may need virtualization or
  zone-level chunking of the SVG tree to stay smooth; SVG hit-testing for irregular/overlapping
  polygons needs care during design QA.
- Follow-ups: confirm the 08 designer's coordinate normalization (0-1 relative vs. pixel-absolute)
  as part of `08_Parking_Map_Designer`'s own ADRs so this view's parser matches exactly; revisit
  Canvas if a real deployment shows SVG performance degrading at scale.
