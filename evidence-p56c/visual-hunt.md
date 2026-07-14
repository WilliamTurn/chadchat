# Panel Visual Asset Hunt (P56c)

Deep sweep of the component/registry ecosystem for signature, panel-scale visuals for three compact daily-tracker cards on a dark premium dashboard: Nutrition, Hydration, Sleep. Each card is roughly 300px tall, so the visual must read at small scale, bind to real fractions, render missing days as gaps (never fake fills), respect reduced motion, and be SSR/client friendly under Next App Router.

Hard rule reminder: NO new npm dependency without a gz-size case (an open first-load-JS perf P1 caps the budget). Copy-paste / shadcn-registry components that compile from deps already present (react, recharts 3.9, motion/react, tailwind v4, shadcn) are the preferred class. New-package options are listed with their approximate gzipped cost and flagged, not excluded.

Date of sweep: 2026-07-13. Sources were fetched live; nothing here is reconstructed from memory.

---

## 0. Dependency ground truth (what "free" means here)

Already installed, so components built only on these cost ZERO new bundle:
- react 19, recharts 3.9, motion/react (framer-motion successor), tailwind v4, shadcn/ui primitives.

That means:
- Any shadcn `charts/radial`, `charts/area`, `charts/radar` variant = zero new dep (pure recharts + tailwind).
- MagicUI copy-paste components that use `motion` = zero new dep (motion is present).
- Pure SVG/CSS copy-paste = zero new dep.
- Anything pulling d3 modules, a fresh charting lib, or a WebGL runtime = a flagged cost.

---

## 1. Registry-by-registry findings

### MagicUI (magicui.design)
Copy-paste via shadcn CLI, components live in your tree, styled with tailwind, animated with `motion`. Two are directly relevant.

- Animated Circular Progress Bar
  - URL: https://magicui.design/docs/components/animated-circular-progress-bar
  - Renders: a single-value circular gauge (primary arc over a secondary track), percentage in the center.
  - Install: `npx shadcn@latest add @magicui/animated-circular-progress-bar`
  - Deps: react + tailwind + motion (all present). ZERO new dep.
  - Props: `value`, `min` (default 0), `max` (default 100), `gaugePrimaryColor`, `gaugeSecondaryColor`, `className`. Client component (`"use client"`, uses useState/useEffect).
  - Reduced motion: NOT built in; the animation is a CSS/spring transition on value. Would need a `prefers-reduced-motion` guard added by us (trivial: skip the transition). Honest-data: track ring shows as the secondary color when value is low, so a missing/zero day reads as an empty ring, not a fake fill. Good.
  - Verdict fit: strong single-value gauge for hydration or a calorie-goal ring.

- Number Ticker
  - URL: https://magicui.design/docs/components/number-ticker
  - Renders: an animated count-up/down number. Pairs with any gauge or the center of a ring.
  - Install: `npx shadcn@latest add @magicui/number-ticker`
  - Deps: uses `motion` (useInView + useSpring under the hood). ZERO new dep.
  - Props: `value`, `direction` ("up"|"down"), `delay`, `decimalPlaces`, `startValue`, `className`. Client component.
  - Reduced motion: not documented; add a guard to render the final value instantly when reduced motion is set.
  - Verdict fit: this is the ZERO-dep animated-number answer, preferred over number-flow (below) because it adds no package. Use for calories, oz/ml, hours.

### number-flow (number-flow.barvian.me)
- URL: https://number-flow.barvian.me/ , repo https://github.com/barvian/number-flow
- Renders: best-in-class animated number with per-digit odometer flow, built on Intl.NumberFormat + Web Animations API, dependency-free itself.
- Install: `npm i @number-flow/react` (NEW PACKAGE).
- Cost flag: roughly 6 to 8 KB gzipped (dependency-free; the ~47KB figure quoted online is unminified dev source, not shipped). Small, but it IS a new dependency and would need a gz-size case against the perf P1.
- Verdict: only reach for this if MagicUI Number Ticker's motion-spring look is judged not premium enough. Otherwise Number Ticker wins on the zero-dep rule.

### shadcn/ui charts (ui.shadcn.com/charts/radial) + shadcn.io mirror
Pure recharts + tailwind, copy-paste or `npx shadcn add <url>`. ZERO new dep. This is the highest-leverage source because recharts 3.9 is already in the bundle.

- Radial (stacked sections)
  - URL: https://www.shadcn.io/examples/a-radial-chart-with-stacked-sections
  - Renders: concentric stacked arcs in one RadialBarChart using multiple `RadialBar` with `stackId='a'`, `cornerRadius`, optional `endAngle={180}` for a semicircle gauge, centered total text via a polar label.
  - Install: `npx shadcn@latest add https://www.shadcn.io/r/a-radial-chart-with-stacked-sections.json`
  - Deps: recharts (present). ZERO new dep.
  - Honest-data: each macro binds to its own value; a zero macro renders as no arc segment (true gap). Good.
  - Verdict: the macro visual. Protein/carbs/fat as three concentric bands with calories as the center number.

- Radial (single value with centered text) and Radial (shape/label/grid) variants
  - URL: https://ui.shadcn.com/charts/radial (variants: simple, label, grid, text, shape, stacked)
  - Renders: single-value radial gauge with a big centered number (the "text" variant) or a custom-shape arc.
  - Install: copy-paste from the page or the per-variant shadcn add URL.
  - Verdict: the recharts-native alternative to MagicUI's gauge for hydration or a single calorie ring, staying inside recharts if we want one charting engine.

### Tremor (tremor.so, raw.tremor.so)
Copy-paste React on top of recharts + radix + tailwind. ZERO new dep beyond recharts. Best for the compact trend/mini visuals.

- Spark Chart (SparkAreaChart / SparkLineChart / SparkBarChart)
  - URL: https://www.tremor.so/docs/visualizations/spark-chart
  - Renders: axis-less micro area/line/bar, ideal at panel scale.
  - Install: copy-paste the component file plus a small `chartUtils.ts`; requires recharts (present). ZERO new dep.
  - Props: `data`, `index`, `categories`, `colors`, `autoMinValue`, `min/maxValue`, `connectNulls`; area adds `type` (default|stacked|percent) and `fill` (gradient|solid|none); bar adds `barCategoryGap`.
  - Honest-data: `connectNulls={false}` leaves true gaps for missing days. Good.
  - Verdict: strong sleep week visual (7 nightly bars) and a general nutrition/hydration trend strip.

- Tracker
  - URL: referenced in the Tremor visualizations sidebar (tremor.so/docs/visualizations/tracker).
  - Renders: a row of small state blocks (think uptime tracker), each colored by state with a tooltip; missing entries render as an empty/gray block.
  - Install: copy-paste; tailwind only, no recharts needed. ZERO new dep.
  - Verdict: excellent honest 7-day or 14-day streak strip for sleep-goal-met / hydration-goal-met; empty slot = true gap by design. Directly supports the "streak strips never removed" law.

### Origin UI (originui.com / github shadcn/originui, origin-space/originui)
- URL: https://originui.com , https://github.com/shadcn/originui
- What it is: a large copy-paste tailwind v4 + radix + react-aria collection. ZERO new dep.
- Relevance: mostly forms, inputs, sliders, navigation, feedback widgets. It has sliders and progress primitives but NO signature domain charts (no liquid gauge, no activity ring, no sleep chart). 
- Verdict: not a source for the three signature visuals; keep it in mind only for the numeric input controls on the log dialogs, not the card hero visual.

### Kibo UI (kibo-ui.com / github haydenbleasel/kibo, shadcnblocks/kibo)
- URL: https://www.kibo-ui.com
- What it is: complex stateful shadcn-registry components (Gantt, Kanban, code editor, color picker, QR, dropzone, AI chat elements). ZERO new dep for most, but heavy.
- Relevance: it is explicitly NOT a charting library and ships nothing panel-scale for nutrition/hydration/sleep.
- Verdict: no fit for these panels.

### Kokonut UI (kokonutui.com / github kokonut-labs/kokonutui)
- URL: https://kokonutui.com
- What it is: 100+ tailwind + shadcn + motion copy-paste components; strong on decorative cards, particle buttons, liquid-glass cards, animated backgrounds/text. ZERO new dep (uses motion).
- Relevant items:
  - Liquid Glass Card (https://kokonutui.com/docs/components/liquid-glass-card): a glassmorphism card shell, useful as the premium container/skin for a panel, not the data visual itself.
  - Particle Button / Card Flip / animated backgrounds: reward-moment candidates, not always-on trackers.
- Verdict: use as card chrome / reward flourish, not as the honest data visual. No native gauge/ring/sleep chart.

### Aceternity UI (ui.aceternity.com)
- URL: https://ui.aceternity.com/components
- What it is: 200+ tailwind + framer-motion copy-paste effects (Background Gradient, Background Beams, Card Spotlight, Hover Border Gradient, etc.). ZERO new dep (uses framer-motion/motion).
- Relevance: pure ambiance/spotlight/beam effects. Great for reward and celebration moments (PR hit, streak milestone) and for a premium card border/glow, but it renders no data.
- Verdict: reward/celebration layer and card polish, never the tracker visual. Aligns with "tokenized glow/flourish for reward moments" without touching first-paint data.

### 21st.dev (21st.dev community registry)
- URL: https://21st.dev , github serafimcloud/21st
- What it is: the largest shadcn-based community marketplace; components install via shadcn CLI. Quality varies; many are re-publishes of MagicUI/Aceternity primitives (e.g. it hosts the same Animated Circular Progress Bar). ZERO new dep for the tailwind/motion ones.
- Relevance: a discovery surface rather than a distinct source. The gauge/ring/number primitives it surfaces are the same ones catalogued above.
- Verdict: use as a search index; the concrete winners are the canonical MagicUI / shadcn / Tremor entries, not 21st-only originals.

### shadcn.io / shadcnblocks (aggregators)
- URL: https://www.shadcn.io/chart-examples , https://www.shadcnblocks.com/components/chart
- What it is: 70+ recharts chart examples with dark-theme, copy-paste or shadcn add URLs. ZERO new dep.
- Verdict: the practical catalog for the recharts radial/area/radar variants above; primary place to grab the stacked-radial macro chart and spark/area sleep chart JSON.

---

## 2. Domain-specific specialist components

### Hydration (liquid / water fill)
- react-liquid-gauge (trendmicro-frontend)
  - URL: https://github.com/trendmicro-frontend/react-liquid-gauge , npm react-liquid-gauge (npm page 403s to fetchers; data taken from the GitHub repo).
  - Renders: the canonical animated SVG water-wave circle with rise + wave animation, gradient fill, centered percent text.
  - Install: `npm i react-liquid-gauge` (NEW PACKAGE).
  - Deps flag: pulls `d3-color`, `d3-interpolate`, and `d3-ease` (peer react/react-dom). These are micro-modules, roughly 2 to 5 KB gzipped each, so call it about 8 to 12 KB gz added. Last release v1.2.4 in Nov 2017: works with modern React but is UNMAINTAINED.
  - Props: `value` (0 to 100), `width/height`, `percent`, `riseAnimation`, `waveAnimation`, `waveAmplitude`, `waveFrequency`, `gradient`, `gradientStops`, `waveAnimationEasing` (d3-ease), full style hooks, `textRenderer`.
  - Honest-data: `value` binds directly to the real fraction; 0 renders an empty vessel (no fake fill). Reduced motion: set `riseAnimation={false} waveAnimation={false}`. Good on both.
  - Verdict (a) hydration: battle-tested look but stale and carries a d3 cost; acceptable only with a gz-size case.

- Ein UI Liquid Glass Gauge
  - URL: https://ui.eindev.ir/docs/components/glass-gauge
  - Renders: circular gauge with an animated liquid fill and glass styling; size + color/gradient variants, label.
  - Install: `npx shadcn@latest add @einui/glass-gauge` (COPY-PASTE into your tree).
  - Deps: not separately listed; it is a shadcn-registry copy-paste, so it compiles from react + tailwind (motion optional). Treat as ZERO or near-zero new dep pending a read of the emitted file.
  - Props: `value`/percentage, `size` (sm/md/lg), color scheme, `label`.
  - Honest-data: value-bound fill, empty at 0. Reduced-motion: verify on install (likely a CSS transition to gate).
  - Verdict (a) hydration: the preferred liquid option under the no-new-dep rule; get the same wave look without the d3 install. Confirm the copied file's dep list after `add`.

- Pure CSS/SVG wave fill (hand-composed, zero dep)
  - Refs: https://github.com/coiger/fill-water-animation (pure CSS clip-path wave), CSS wave generators (codefronts.com, uisurgeon.com) that emit SVG + React + tailwind.
  - Renders: a wave surface via an SVG path animated with `translateX`, the fill height driven by the real fraction (clip-path or a masked rect).
  - Install: copy the ~40 lines; ZERO new dep.
  - Honest-data: height maps 1:1 to the fraction; reduced motion just freezes the wave translate. Fully controllable.
  - Verdict (a) hydration: the fallback if we want a bespoke, exactly-on-brand vessel with zero dependency and full reduced-motion control. More build effort than Ein UI but total ownership.

### Nutrition (calorie / macro)
- shadcn radial stacked (recharts) [see 1] = the macro visual, zero dep.
- MagicUI Animated Circular Progress Bar or shadcn radial "text" variant = single calorie-goal ring, zero dep.
- react-activity-rings (JonasDoesThings / @jonasdoesthings)
  - URL: https://github.com/JonasDoesThings/react-activity-rings , npm react-activity-rings
  - Renders: Apple-Watch concentric rings in pure SVG, can exceed 100% like the watch, dark/light, configurable size (72px default), optional legend.
  - Install: `npm i react-activity-rings` (NEW PACKAGE) or copy the small SVG source (it is tiny, essentially two circles per ring).
  - Deps flag: SVG-only, no charting dep; roughly a couple KB gz. Small, still a new package unless we copy the source (its MIT license permits copy, which sidesteps the dep entirely).
  - Honest-data: each ring binds to a fraction; a 0 ring is just the track. Reduced motion: pass the no-animation option / static render.
  - Verdict (b) nutrition: the most literally "Apple rings" macro option; prefer copying its SVG source over installing to honor the no-new-dep rule. If we already commit to recharts, the stacked-radial covers the same idea with zero dep.

### Sleep (week visual)
- Tremor Spark/Area chart or shadcn area variant = 7 nightly bars/area, zero dep (recharts).
- Tremor Tracker = honest 7/14-day goal-met streak strip, zero dep (tailwind only).
- Sleep hypnogram (single-night detail, recharts)
  - URL: https://www.wellally.tech/blog/build-react-sleep-hypnogram-chart-recharts
  - Renders: a stage chart using recharts with `type="stepAfter"` so stages read as discrete states (Awake/REM/Light/Deep), with ReferenceLine annotations for bedtime/wake.
  - Install: recipe/copy-paste; recharts (present). ZERO new dep.
  - Honest-data: stages come from real enums mapped to numbers; missing segments left as gaps. Reduced motion: recharts `isAnimationActive={false}`.
  - Verdict (c) sleep: this is the premium single-night visual if we have stage data. For a week card where we only have hours + goal-met, the Spark bars + Tracker strip combo is the honest, panel-scale choice; reserve the hypnogram for a sleep detail page.
- calendar heatmap minis (streak context)
  - URLs: https://github.com/gurbaaz27/shadcn-calendar-heatmap , https://github.com/fishdev20/shadcn-heatmap
  - Renders: GitHub-style contribution grid, tailwind + shadcn, no charting lib, dark mode, tooltips/legend.
  - Install: copy-paste; ZERO new dep.
  - Honest-data: intensity 0 to 4 with 0 as an empty cell (true gap). Reduced motion: static by default.
  - Verdict: strong secondary "consistency" visual for any of the three domains, and a natural mate to the streak-strip law.

---

## 3. unicorn.studio assessment

What it is and is best at:
- No-code WebGL scene builder (unicorn.studio) for enchanting motion/interactive backgrounds. Best at hero-scale ambient WebGL: fluid/gradient scenes, particle fields, pointer-reactive shaders.
- Runtime variables: you publish a scene, then push `data-us-vars` (declarative) or `initialVariables` / live variable updates (JS) to react to data (brandColor, intensity, image, numeric params). Source: unicorn.studio/docs/variables.
- Embed mechanics: a `<div>` with `data-us-project`, plus flags `data-us-lazyload="true"` (init only when in viewport), `data-us-production="true"` (serve scene JSON from CDN, better caching), scale/DPI/fps knobs. Source: unicorn.studio/docs/embed and /docs/performance.
- React wrapper: `unicornstudio-react` (github diegopeixoto), `import UnicornScene from "unicornstudio-react/next"` for App Router, `lazyLoad={true}` by default, `variables`/`preset`/`onVariableChange` props, must run under `"use client"` (WebGL is client-only). A community Next loader exists too (github insprd/unicorn-loader).

The cost that matters here:
- Runtime library is about 29 KB gzipped, and that is BEFORE any scene JSON, shaders, or textures, and before the GPU/WebGL context cost. WebGL caps at 16 contexts per page and the vendor explicitly recommends no more than 10 scenes per page. Each context has real memory and battery cost, worse on mobile (our mobile-first gate).

Fit judgment for an ALWAYS-VISIBLE compact daily tracker panel on first paint:
- Not appropriate as the primary, always-on visual for Nutrition/Hydration/Sleep. Reasons:
  1. First-load-JS perf P1: a 29 KB runtime plus scene assets on first paint is exactly what the budget forbids; three live WebGL panels would also burn WebGL contexts and mobile battery on the most-viewed screen.
  2. Honest-data: a shader scene does not natively render "missing day = hollow slot"; precise fractional/quantized truth (7 discrete nights, an exact oz fill) is far cleaner in SVG/recharts than in a fluid shader.
  3. Reduced motion: gating a WebGL scene to a respectable static frame is possible but clumsy versus simply not animating an SVG.
  4. Readability at ~300px: shader ambiance competes with the number and the fraction; the card's job is instant legibility.
- Where it IS a great fit: lazy-loaded reward/celebration moments (streak milestone, new PR, goal-crushed overlay) and possibly one hero/ambient background elsewhere, always with `lazyload` + `production` and never counted in first-load JS. This matches the owner's "Unicorn Studio is a candidate for ANY visual flourish, never forced, never overlooked" while keeping it out of the always-on tracker first paint.

Overall unicorn.studio recommendation: keep it OUT of the three always-visible tracker panels' first paint; hold it as a lazy-loaded reward/celebration layer (goal-hit, streak, PR) where its data-reactive variables can shine without taxing the dashboard's initial load or the mobile budget.

---

## 4. Honest-data / reduced-motion / SSR compliance snapshot

| Candidate | New dep? | Approx gz cost | Missing-day = true gap | Reduced motion | SSR/App Router |
| --- | --- | --- | --- | --- | --- |
| shadcn radial stacked (recharts) | no | 0 | yes (no arc) | isAnimationActive=false | client chart, fine |
| shadcn radial "text" gauge | no | 0 | yes (empty track) | isAnimationActive=false | client chart |
| MagicUI Animated Circular Progress Bar | no | 0 | yes (track shows) | add PRM guard | "use client" |
| MagicUI Number Ticker | no | 0 | n/a (number) | add PRM guard | "use client" |
| number-flow (@number-flow/react) | YES | ~6 to 8 KB | n/a | respects PRM (WAAPI) | client, ok |
| Tremor Spark/Area | no | 0 | yes (connectNulls=false) | isAnimationActive=false | client chart |
| Tremor Tracker | no | 0 | yes (empty block) | static | ok |
| Ein UI Liquid Glass Gauge | verify (copy-paste) | ~0 | yes (empty at 0) | verify/gate CSS | verify "use client" |
| react-liquid-gauge | YES (or copy) | ~8 to 12 KB (d3) | yes (empty vessel) | flags off | client |
| Pure CSS/SVG wave | no | 0 | yes (height-bound) | freeze translate | ok |
| react-activity-rings | YES (or copy SVG) | ~2 KB | yes (track) | static option | ok |
| Sleep hypnogram (recharts) | no | 0 | yes (gaps) | isAnimationActive=false | client chart |
| shadcn calendar heatmap | no | 0 | yes (empty cell) | static | ok |
| unicorn.studio (WebGL) | YES | ~29 KB + assets | no (not native) | clumsy | client only |

---

## 5. Source list

- https://magicui.design/docs/components/animated-circular-progress-bar
- https://magicui.design/docs/components/number-ticker
- https://number-flow.barvian.me/ , https://github.com/barvian/number-flow
- https://ui.shadcn.com/charts/radial
- https://www.shadcn.io/examples/a-radial-chart-with-stacked-sections
- https://www.shadcn.io/chart-examples , https://www.shadcnblocks.com/components/chart
- https://www.tremor.so/docs/visualizations/spark-chart , https://www.tremor.so/ , https://raw.tremor.so/
- https://originui.com , https://github.com/shadcn/originui
- https://www.kibo-ui.com , https://github.com/haydenbleasel/kibo
- https://kokonutui.com , https://kokonutui.com/docs/components/liquid-glass-card
- https://ui.aceternity.com/components
- https://21st.dev , https://github.com/serafimcloud/21st
- https://github.com/trendmicro-frontend/react-liquid-gauge
- https://ui.eindev.ir/docs/components/glass-gauge
- https://github.com/coiger/fill-water-animation , https://codefronts.com/generators/css-wave-generator/
- https://github.com/JonasDoesThings/react-activity-rings
- https://www.wellally.tech/blog/build-react-sleep-hypnogram-chart-recharts
- https://github.com/gurbaaz27/shadcn-calendar-heatmap , https://github.com/fishdev20/shadcn-heatmap
- https://www.unicorn.studio/docs/embed/ , https://www.unicorn.studio/docs/variables/ , https://www.unicorn.studio/docs/performance/
- https://github.com/diegopeixoto/unicornstudio-react , https://github.com/insprd/unicorn-loader
