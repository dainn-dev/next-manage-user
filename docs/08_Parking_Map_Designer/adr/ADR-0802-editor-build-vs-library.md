# ADR-0802: SVG/Canvas polygon editor — build vs adopt a library

- Status: Proposed
- Date: 2026-07-09
- Deciders: Principal Architect
- Context doc: 08_Parking_Map_Designer

## Context

The frontend (`frontend/`, Next.js 14 + Tailwind v4 + shadcn/ui) has no drawing/canvas library
today and no map component of any kind — recharts is the only visualization dependency in the
repo, and it is a charting library, not a geometry editor. The rest of the frontend deliberately
avoids heavy dependencies where a small hand-rolled implementation suffices (no react-query/SWR,
no global state library — plain `fetch`-based API clients and React Context, per the repo's
existing conventions). The Parking Map Designer needs: draw/edit polygons over a background
image, drag vertices, snap/validate in real time, and (in calibration mode) place labeled
reference points on the same canvas — a bounded, well-understood feature set, not a general
mapping application.

## Decision

Build a **custom SVG-based polygon editor** in React (native SVG elements, pointer event
handlers for vertex drag/add/remove), rather than adopting a general-purpose canvas/graphics
library (e.g. Fabric.js, Konva/react-konva) or a geo-mapping library (e.g. Leaflet/OpenLayers with
an image overlay). SVG is chosen over raw `<canvas>` because it gives each vertex/edge a real DOM
node — simpler hit-testing, easier styling with Tailwind, and easier accessibility affordances
(focus outlines, keyboard vertex nudging) than manual canvas hit-testing would require.

## Alternatives considered

- **react-konva / Fabric.js** — mature canvas abstractions with built-in drag/transform handling,
  would save initial implementation time. But they pull in a sizeable dependency for a narrow use
  case, fight against the SVG+Tailwind styling approach used everywhere else in the frontend, and
  raw `<canvas>` hit-testing/accessibility has to be reimplemented regardless of the library.
- **Leaflet/OpenLayers with a static image overlay ("non-geographic CRS" mode)** — these libraries
  are excellent at exactly this (image-as-map, polygon drawing plugins exist), but they are
  fundamentally geographic mapping libraries; adopting one here to draw non-geographic pixel
  polygons is a mismatch of tool to problem and adds a large dependency the rest of the platform
  does not otherwise need (recall: no map library exists anywhere in the repo today).

## Consequences

- Positive: no new heavy dependency; consistent with the frontend's existing "hand-rolled, small
  surface area" convention; full control over UX details specific to this tool (slot labeling,
  zone assignment, calibration-point mode on the same canvas).
- Negative / trade-offs: more upfront engineering effort than adopting a library — drag/resize,
  snapping, and multi-select must be implemented from scratch; must be revisited if future
  requirements grow well beyond polygon+point editing (e.g. free-form drawing, raster masks for
  `09_AI_Calibration`'s ROI mask, which may warrant a `<canvas>`-based sub-tool instead).
- Follow-ups: if the ROI/exclusion-mask editor in `09_AI_Calibration` needs freehand painting
  rather than polygons, evaluate a small canvas-based component scoped to that one feature rather
  than retrofitting the whole SVG editor.
