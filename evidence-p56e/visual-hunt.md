# Visual hunt: /today summary cards (P56-E, directive-1a)

Date: 2026-07-13. Constraint set: dark tokenized theme (blood-red accent), Tailwind v4 + shadcn, recharts installed, NO new heavy npm deps (copy-paste or hand-adapt only). Relevant deps already in chadchat/package.json: `recharts`, `motion`, `framer-motion`, `radix-ui` (unified), `tailwindcss-animate`, `lucide-react`.

Existing in-house primitives (prefer composing these): `ProgressRing`, `GoalProgressBar`, `WeekBars`, `MiniBars`, `PanelSparkline`, `DeltaTag` (components/panels/visuals.tsx); `CalorieArc`, `RingGauge`, `LiquidGauge`, `NightColumns`, `NumberTicker`, `TrendChart`, `BreakdownBars`, `CalendarHeatmap` (components/charts/).

---

## (a) Rotation / step progression strips ("session 2 of 4")

### Candidates

**A1. Tremor Tracker** — https://tremor.so/docs/visualizations/tracker
- Looks like: a horizontal row of small rounded blocks (8px tall, full width), each block colored by state (emerald/red/yellow/gray), tooltip per block on hover. The uptime-monitor strip.
- Availability: copy-paste source in the docs; Tremor is open source (MIT, tremorlabs/tremor on GitHub, now Vercel-owned) — https://github.com/tremorlabs/tremor
- Deps: `@radix-ui/react-hover-card` (already covered by our unified `radix-ui` package) + a `cx` util (we have `clsx`/`tailwind-merge`). Zero new deps after hand-adaptation.
- Dark-theme fit: trivially — colors are plain Tailwind classes we swap for tokens (done-session = accent, current = ring/outline, upcoming = surface-inset).
- Fit: THE pattern for rotation position (4 blocks = 4 sessions, filled to position) AND for adherence-day strips (7 blocks = week). Coexists with, does not replace, the streak dot strips (owner law).

**A2. Origin UI steppers** — https://coss.com/origin (Origin UI, now coss.com origin; repo https://github.com/shadcn/originui)
- Looks like: numbered/dotted horizontal steppers with connecting lines, done/current/upcoming states; MIT copy-paste `.tsx`, Tailwind v4-ready since 2025-02.
- Deps: none beyond Radix in some variants.
- Fit: good for an explicit labeled "Session 1 -> 2 -> 3 -> 4" strip if we want numerals + connectors instead of blocks. Slightly heavier visually than A1 in a compact card.

**A3. shadcn-stepper (damianricobelli)** — https://github.com/damianricobelli/shadcn-stepper / https://www.shadcn.io/template/damianricobelli-shadcn-stepper
- Full-featured stepper primitive (MIT). Overkill for a display-only strip (built for interactive multi-step forms). Keep as fallback only.

### Verdict (a)
Adapt **Tremor Tracker** by hand into a token-styled `SegmentStrip` (positional blocks + current-session ring). It also directly serves the "Progress highlights" nutrition tile (7 day-blocks, in-target vs over). A2 only if the design review wants numbered steps.

---

## (b) Meal-timeline / slot progression visuals

### Candidates

**B1. Origin UI timeline collection** — https://coss.com/origin/timeline
- Looks like: 12 timeline variants (vertical rails with dots/icons, compact horizontal variants), React + Tailwind copy-paste, MIT, Tailwind v4.
- Deps: none.
- Dark fit: plain Tailwind classes, restyle to tokens directly.
- Fit: a 3-4 row compact vertical timeline (Breakfast done, Lunch done, Dinner = NEXT highlighted, Snack upcoming) is the honest "meal N of M" visual; the "next" node takes the accent.

**B2. Tremor Tracker again (horizontal slot strip)** — same source as A1.
- M slots as blocks with the next slot pulsing/outlined; plus a text line "Meal 3 of 4 · Dinner · 720 kcal / 45g protein". Cheapest correct option, shares one new component with (a).

**B3. In-house compose: `WeekBars`/`MiniBars` dot grammar + `GoalProgressBar`**
- components/panels/visuals.tsx already has designed-empty (hollow/dashed) treatments; a slot row can be built from the same visual language with zero imports. Fit: highest consistency, lowest wow.

### Verdict (b)
Default to **B2/B3 (shared SegmentStrip + text line)** for the compact card; pull one **Origin UI timeline** (B1) only if P5/P6 decides the meal card gets vertical room. No new deps either way.

---

## (c) Goal progress with reward glow

### Candidates

**C1. MagicUI Shine Border** — https://magicui.design/docs/components/shine-border
- Looks like: an animated shining border sweeping a card's edge; props for duration, shineColor (single or gradient array), borderWidth. Installed via shadcn registry (`shadcn add @magicui/shine-border`) or hand-copied; React + Tailwind only, no extra npm deps. MagicUI is MIT (github.com/magicuidesign/magicui).
- Dark fit: excellent — shineColor takes our accent red/emerald tokens; subtle at 1px.
- Fit: THE "reward glow" for a goal-reached or PR state on the Primary goal card (owner reward-glow direction). Conditional: only render when a target is hit, so it stays a reward, not wallpaper.

**C2. MagicUI Animated Circular Progress Bar** — https://magicui.design/docs/components/animated-circular-progress-bar
- Looks like: circular gauge whose value animates smoothly between updates; props min/max/value/gaugePrimaryColor/gaugeSecondaryColor; React + Tailwind, no extra deps, shadcn registry.
- Fit: we already own `ProgressRing`/`RingGauge` — do NOT import a lookalike; lift its animation approach (transition on stroke offset) into `ProgressRing` if the goal ring should animate on load/update.

**C3. Aceternity Glowing Effect / Card Spotlight** — https://ui.aceternity.com/components/glowing-effect , https://ui.aceternity.com/components/card-spotlight
- Looks like: Cursor-style adaptive border glow; spotlight radial gradient following pointer. Free copy-paste tier (200+ components), built on Tailwind + framer-motion (already installed).
- Dark fit: designed for dark UIs.
- Fit: stronger/flashier than C1; pointer-following effects are desktop-biased and risk decorating a card that is mostly read, not hovered. Reserve for the PR-celebration moment only if C1 reads too quiet at review.

**C4. recharts RadialBarChart (custom shape, partial arc)** — https://recharts.github.io/en-US/api/RadialBarChart/ , https://www.shadcn.io/examples/a-radial-chart-with-a-custom-shape
- Looks like: shadcn-charts-style radial with rounded caps and a center label; partial-arc gauge via start/endAngle. Zero new deps (recharts installed); shadcn charts examples are copy-paste.
- Fit: an upgrade path for the Primary goal visual if a bar reads too flat — but `CalorieArc`/`RingGauge` already cover this shape. Use only as a styling reference (rounded caps, center numeral) for the existing components.

**C5. number-flow (@number-flow/react)** — https://number-flow.barvian.me/ , https://github.com/barvian/number-flow
- Apple-grade animated numerals, MIT, ~7kB gz, dependency-free — but it IS a new npm dep, and we already ship `NumberTicker`. REJECTED under the no-new-deps rule; noted so nobody re-litigates it blind.

### Verdict (c)
`GoalProgressBar`/`ProgressRing` stay the workhorses; add **Shine Border (C1)** as the conditional goal-reached/PR glow, and port C2's value-animation into `ProgressRing`. C3 is the escalation option for PR celebration; C4/C5 are references only.

---

## (d) Compact stat tiles with sparklines

### Candidates

**D1. Tremor KPI-card blocks (SparkAreaChart grammar)** — https://blocks.tremor.so/ , https://www.tremor.so/
- Looks like: the industry-standard KPI tile — label, big value, delta badge, small spark chart bottom-right; 300+ blocks, copy-paste, recharts-based under the hood.
- Deps: none new after hand-adaptation (recharts present).
- Fit: as a LAYOUT grammar for the Progress highlights tiles. The internals we already own: `PanelSparkline` + `DeltaTag` + `NumberTicker` == a Tremor KPI card in our own tokens. Import nothing; copy the slot arrangement.

**D2. Motion Primitives AnimatedNumber / SlidingNumber** — https://motion-primitives.com/docs/sliding-number
- Looks like: odometer-style digit slides on value change; copy-paste components built on `motion` (installed) + Tailwind, MIT.
- Fit: if `NumberTicker` (count-up) is the wrong feel for tile values that UPDATE in place (e.g. live weekly volume), SlidingNumber's per-digit slide is the classier treatment; hand-copy one file.

**D3. 21st.dev community stat cards** — https://21st.dev (registry of community shadcn components; also reachable via the Magic MCP in this repo)
- Availability: per-component licensing varies by author; must check each. Quality uneven.
- Fit: idea mine for tile compositions during P5/P6 build; nothing there is load-bearing given D1's grammar + our primitives. Do not block on it.

**D4. shadcn/ui official charts** — https://ui.shadcn.com/docs/components (charts section) , https://www.shadcn.io/examples
- Copy-paste recharts wrappers already theme-token aware (CSS variables). Fit: reference for making `PanelSparkline`/`TrendChart` tooltips and colors read exactly like the rest of the shadcn surface.

### Verdict (d)
No imports needed: compose `PanelSparkline` + `DeltaTag` + `NumberTicker` in the **Tremor KPI slot grammar** (D1). Add **SlidingNumber** (D2, one hand-copied file on installed `motion`) only if in-place value updates appear in the band.

---

## Shortlist (max 6) with integration notes

| # | Candidate | Surface | Integration note |
|---|---|---|---|
| 1 | Tremor **Tracker** (hand-adapted as `SegmentStrip`) | (a) rotation strip, (b) meal slots, (d) nutrition-adherence days | One new in-house file under components/panels/; swap its hover-card for our existing tooltip pattern, colors -> tokens (done=accent, current=ring outline, upcoming=surface-inset). Zero new deps. |
| 2 | MagicUI **Shine Border** | (c) reward glow | Hand-copy (or `shadcn add @magicui/shine-border`); render conditionally around the Primary goal card ONLY when an outcome hits target / PR fires; shineColor = emerald or brand red token. |
| 3 | MagicUI **Animated Circular Progress Bar** (pattern only) | (c) goal ring | Do not import — port its animated stroke transition into our `ProgressRing` (components/panels/visuals.tsx:18) so the goal arc animates to value on mount. |
| 4 | **Tremor KPI-card grammar** (blocks.tremor.so, layout only) | (d) highlights tiles | Compose existing `PanelSparkline` + `DeltaTag` + `NumberTicker` into that slot arrangement (label / value / delta / micro-viz); import nothing. |
| 5 | Motion Primitives **SlidingNumber** | (d) tile values that update in place | One hand-copied file; runs on already-installed `motion`; use only where values change live, else keep `NumberTicker`. |
| 6 | Origin UI **timeline** (coss.com/origin/timeline) | (b) meal card, if vertical room granted | Pick the most compact of the 12 variants, restyle dots/rail to tokens; MIT copy-paste, Tailwind v4-ready, no deps. |

**Rejected/reserve:** number-flow (new npm dep; `NumberTicker` exists), Aceternity Glowing Effect/Card Spotlight (reserve for PR celebration if Shine Border is too quiet; pointer effects are desktop-biased), shadcn-stepper (interactive-form machinery, display-only need), Kibo UI (MIT registry, https://www.kibo-ui.com/ — nothing in its catalog beats the picks above for these four visuals), 21st.dev (idea mine only, per-component license check required).

**Net new surface area:** 3 hand-copied/adapted files max (SegmentStrip, ShineBorder, SlidingNumber), 0 new npm dependencies; everything else composes or restyles what components/panels/visuals.tsx and components/charts/ already ship.
