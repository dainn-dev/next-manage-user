<!-- Hallmark · pre-emit critique: P5 H5 E4 S5 R5 V4 -->
# Design — ParkVision Control

A locked design system for the ParkVision platform control plane. Every platform-admin page reads this file before visual changes. Extend this file when the system grows; do not invent route-local themes.

## Genre

**Modern-minimal, technical.** The interface is for internal operators who need to assess platform state, locate a tenant or account, and take safe corrective action without entering tenant operations.

## Macrostructure family

- **Marketing pages:** unchanged by this redesign.
- **App pages:** **Workbench** — compact functional heading, current-state strip, one shared query/action surface, then the primary operational dataset. Detail routes use the same shell with a tabbed work area.
- **Content pages:** unchanged by this redesign.

Workbench variation knobs for Platform pages:

- Overview: asymmetric KPI strip + recent activity ledger.
- Registry pages: filter command row + responsive table/card dataset.
- Tenant detail: identity header + exactly five task tabs.
- Risky actions: explicit consequence panel + required reason when supported by the API + pending lock + server-confirmed result.

## Theme — ParkVision Control

The theme preserves the product’s teal identity while replacing flat white/slate surfaces with cool-tinted OKLCH neutrals.

- `--color-paper` `oklch(98.5% 0.008 190)`
- `--color-paper-2` `oklch(96.5% 0.010 190)`
- `--color-paper-3` `oklch(93.5% 0.012 190)`
- `--color-ink` `oklch(20% 0.018 220)`
- `--color-ink-2` `oklch(31% 0.018 220)`
- `--color-rule` `oklch(88% 0.012 200)`
- `--color-accent` `oklch(52% 0.110 183)`
- `--color-focus` `oklch(56% 0.160 235)`

Accent footprint stays below 5% of a viewport. Teal marks active context and primary operations. Blue is reserved for focus and linked navigation. Status colors are reserved for state and always pair an icon or label with color.

## Typography

- Display: Fira Sans, weight 700, roman
- Body: Fira Sans, weight 400
- Mono: Fira Code, weight 500
- Display tracking: `-0.025em`
- Type scale anchor: `--text-display = clamp(2.25rem, 3vw + 1rem, 3.25rem)`

Fira Code is used only for identifiers, machine values, audit actions, and vertically aligned data. Headings are never italic.

## Spacing

A 4-point named scale lives in `tokens.css`. Platform components consume named tokens or mapped Tailwind utilities; route-local raw color and font values are forbidden.

## Motion

- Easings: `--ease-out`, `--ease-in`, and `--ease-in-out` from `tokens.css`.
- Reveal pattern: none for page sections; data appears in place.
- Interaction primitives: button press, drawer/dialog entrance, tab crossfade.
- Reduced-motion fallback: opacity-only, no longer than 150 ms.
- Only transform and opacity animate. Focus indicators appear instantly.

## Microinteractions stance

- Silent success when the changed state is visible.
- Failure feedback names what failed and offers a retry where possible.
- Hover affordances have focus and touch equivalents.
- Search result counts announce politely after the request settles.
- Risky lifecycle changes use explicit confirmation because they affect access and billing state.

## CTA voice

- Primary actions: compact teal control, verb-first label, 44 px touch target on coarse pointers.
- Secondary actions: neutral outlined control.
- Destructive actions: red is reserved for the final destructive control and consequence language.
- Clickable labels never wrap.

## Per-page allowances

- Platform app pages MUST NOT use decorative enrichment; function carries the page.
- Overview may show only metrics already returned by the platform overview API.
- No decorative charts. A KPI strip is preferred for the current headline values; tables are preferred when identity and exact values matter.
- Mobile datasets become task-oriented cards rather than compressed desktop tables.

## What pages MUST share

- ParkVision wordmark and Platform context.
- Teal accent placement and dark-mode hue continuity.
- Fira Sans + Fira Code roles.
- Compact headers, filter rhythm, status badges, pagination, empty/error/loading language.
- Responsive desktop rail and mobile drawer.
- Accessible breadcrumbs and live status announcements.

## What pages MAY differ on

- KPI-strip composition where real API metrics exist.
- Filter controls required by each dataset.
- Data density and the number of visible columns.
- Detail-tab contents and route-specific actions.

## Exports

### tokens.css

The canonical source is the project-root `tokens.css`. Core light tokens:

```css
:root {
  --color-paper: oklch(98.5% 0.008 190);
  --color-paper-2: oklch(96.5% 0.010 190);
  --color-paper-3: oklch(93.5% 0.012 190);
  --color-ink: oklch(20% 0.018 220);
  --color-ink-2: oklch(31% 0.018 220);
  --color-rule: oklch(88% 0.012 200);
  --color-rule-2: oklch(78% 0.018 200);
  --color-muted: oklch(52% 0.018 215);
  --color-neutral: oklch(40% 0.020 215);
  --color-accent: oklch(52% 0.110 183);
  --color-accent-ink: oklch(98.5% 0.008 190);
  --color-focus: oklch(56% 0.160 235);
  --font-display: var(--font-fira-sans), ui-sans-serif, sans-serif;
  --font-body: var(--font-fira-sans), ui-sans-serif, sans-serif;
  --font-outlier: var(--font-fira-code), ui-monospace, monospace;
  --space-3xs: 0.25rem;
  --space-2xs: 0.5rem;
  --space-xs: 0.75rem;
  --space-sm: 1rem;
  --space-md: 1.5rem;
  --space-lg: 2rem;
  --space-xl: 2.5rem;
  --space-2xl: 4rem;
  --space-3xl: 6rem;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in: cubic-bezier(0.7, 0, 0.84, 0);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --dur-micro: 120ms;
  --dur-short: 220ms;
  --dur-long: 420ms;
  --radius-card: 0.5rem;
  --radius-pill: 999px;
  --radius-input: 0.375rem;
}
```

### Tailwind v4 `@theme`

```css
@theme inline {
  --color-paper: var(--color-paper);
  --color-paper-2: var(--color-paper-2);
  --color-paper-3: var(--color-paper-3);
  --color-ink: var(--color-ink);
  --color-ink-2: var(--color-ink-2);
  --color-rule: var(--color-rule);
  --color-rule-2: var(--color-rule-2);
  --color-signal: var(--color-signal);
  --color-success: var(--color-success);
  --color-warning: var(--color-warning);
  --color-serious: var(--color-serious);
  --color-critical: var(--color-critical);
  --font-display: var(--font-display);
  --font-body: var(--font-body);
  --font-outlier: var(--font-outlier);
  --spacing-3xs: var(--space-3xs);
  --spacing-2xs: var(--space-2xs);
  --spacing-xs: var(--space-xs);
  --spacing-sm: var(--space-sm);
  --spacing-md: var(--space-md);
  --spacing-lg: var(--space-lg);
  --spacing-xl: var(--space-xl);
  --spacing-2xl: var(--space-2xl);
  --ease-out: var(--ease-out);
  --ease-in: var(--ease-in);
  --ease-in-out: var(--ease-in-out);
}
```

### DTCG `tokens.json`

```json
{
  "$schema": "https://design-tokens.github.io/community-group/format/",
  "color": {
    "paper": { "$value": "oklch(98.5% 0.008 190)", "$type": "color" },
    "paper-2": { "$value": "oklch(96.5% 0.010 190)", "$type": "color" },
    "paper-3": { "$value": "oklch(93.5% 0.012 190)", "$type": "color" },
    "ink": { "$value": "oklch(20% 0.018 220)", "$type": "color" },
    "ink-2": { "$value": "oklch(31% 0.018 220)", "$type": "color" },
    "rule": { "$value": "oklch(88% 0.012 200)", "$type": "color" },
    "accent": { "$value": "oklch(52% 0.110 183)", "$type": "color" },
    "focus": { "$value": "oklch(56% 0.160 235)", "$type": "color" }
  },
  "font": {
    "display": { "$value": "Fira Sans, ui-sans-serif, sans-serif", "$type": "fontFamily" },
    "body": { "$value": "Fira Sans, ui-sans-serif, sans-serif", "$type": "fontFamily" },
    "outlier": { "$value": "Fira Code, ui-monospace, monospace", "$type": "fontFamily" }
  },
  "space": {
    "3xs": { "$value": "0.25rem", "$type": "dimension" },
    "2xs": { "$value": "0.5rem", "$type": "dimension" },
    "xs": { "$value": "0.75rem", "$type": "dimension" },
    "sm": { "$value": "1rem", "$type": "dimension" },
    "md": { "$value": "1.5rem", "$type": "dimension" },
    "lg": { "$value": "2rem", "$type": "dimension" },
    "xl": { "$value": "2.5rem", "$type": "dimension" },
    "2xl": { "$value": "4rem", "$type": "dimension" }
  },
  "duration": {
    "micro": { "$value": "120ms", "$type": "duration" },
    "short": { "$value": "220ms", "$type": "duration" },
    "long": { "$value": "420ms", "$type": "duration" }
  }
}
```

### shadcn/ui CSS variables

```css
:root {
  --background: var(--color-paper);
  --foreground: var(--color-ink);
  --card: var(--color-paper-2);
  --card-foreground: var(--color-ink);
  --popover: var(--color-paper);
  --popover-foreground: var(--color-ink);
  --primary: var(--color-accent);
  --primary-foreground: var(--color-accent-ink);
  --secondary: var(--color-paper-3);
  --secondary-foreground: var(--color-ink-2);
  --muted: var(--color-paper-3);
  --muted-foreground: var(--color-muted);
  --accent: var(--color-paper-3);
  --accent-foreground: var(--color-ink);
  --destructive: var(--color-critical);
  --destructive-foreground: var(--color-accent-ink);
  --border: var(--color-rule);
  --input: var(--color-paper-2);
  --ring: var(--color-focus);
  --radius: var(--radius-card);
}
```
