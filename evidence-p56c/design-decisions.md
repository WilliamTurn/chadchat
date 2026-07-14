# P56-C design decisions (FIX-25 / FIX-26 / FIX-27)

Session: P56-C, 2026-07-13. Companion evidence: `benchmark-teardown.md` (rule-8 ranking, sources), `visual-hunt.md` (directive-1a asset hunt), `harness/` and `live/` (verification runs).

## 1. Visual decision procedure compliance (owner directive 2026-07-13, 5a)

Order of operations actually followed: benchmark teardown FIRST (rankings per domain, table stakes, honest-evidence log), then a registry-ecosystem hunt (MagicUI, Aceternity, Motion Primitives, Origin UI, Kibo, Kokonut, tremor, number-flow, 21st.dev, shadcn.io, recharts/visx recipes, unicorn.studio), THEN the build. No hand-drawing happened before the hunt.

What the hunt returned, and what was chosen:

| Domain | Hunt candidates | Decision | Why |
|---|---|---|---|
| Hydration fill | Ein UI glass gauge (registry), pure SVG wave recipes, react-liquid-gauge (npm, unmaintained, d3 deps) | `components/charts/liquid-gauge.tsx`: in-stack SVG + motion wave vessel, refined from the in-house WaterTracker vessel | The vessel IS the category signature (WaterMinder, Waterllama). Zero new bytes (FIX-41 is an open perf P1); the npm option is dead code with d3 baggage; the registry option needs a post-add dependency audit for the same visual we already own and can hold to our tokens/reduced-motion/honesty rules |
| Nutrition energy | shadcn radial stacked (recharts RadialBar), MagicUI circular progress, react-activity-rings | `components/charts/calorie-arc.tsx`: 270 degree SVG gauge, remaining-first center, over-target critical flip | Remaining-first framing is the category hero (MacroFactor, MyFitnessPal). A recharts RadialBarChart at this panel scale costs chart runtime for a static arc; the bespoke arc is deterministic, animates by spring, and enforces the Color Law (over target = critical) in one place |
| Sleep week | Tremor spark/area (gaps via connectNulls), Tremor Tracker, hypnogram recipes | `components/charts/night-columns.tsx`: moonlit gradient columns vs a dashed goal line, hollow dashed slots for missing nights, quality-graded glow, per-night FIX-07 goals, DSH-64 placeholder variant | Duration columns vs goal line is the honest leader form (Apple Health, Gentler Streak). Scores, rings, and hypnograms need stage/HR data we do not have and would be fabricated. The elevation over a plain bar chart: gradient + quality glow + goal-met shadow + true gaps + per-night goal ticks |
| Headline numbers | number-flow (new ~6-8 KB pkg), MagicUI Number Ticker (motion) | `components/charts/number-ticker.tsx`: motion-based ticker, zero new deps | Same effect, no new package under the FIX-41 freeze. First render is the true value (no count-up theater); reduced motion snaps |

unicorn.studio: evaluated, NOT overlooked, and deliberately held OUT of these three panels. These are always-visible first-paint surfaces on /today; the runtime is about 29 KB gz before scene assets, needs a WebGL context per scene, and cannot natively express "missing day = hollow slot". That collides with FIX-41 (open P1), the honest-data laws, and the mobile-first gate. Its data-reactive scenes remain the live candidate for the wave's reward/celebration moments (P56-B's PR/milestone surfaces) where lazy-load at the moment of use is the rule. This is the "never forced, never overlooked" line from the owner clarification, applied.

## 2. Rule-9 new-primitive proposals (benchmark evidence, 2+ pro apps each)

All four land under `components/charts/**`, where new signature visual types are EXPECTED this wave (briefing rule 9). Each binds real registered-metric values, renders missing as gaps/hollow (data-state law), respects reduced motion, and draws from tokens (Color Law).

1. LiquidGauge: WaterMinder (fill vessel is the entire product identity), Waterllama (character fill), plus the in-house legacy vessel it refines.
2. CalorieArc: MacroFactor (remaining-first energy hero), MyFitnessPal Today calorie dial, Lose It budget framing.
3. NightColumns: Apple Health sleep duration columns + goal line, Gentler Streak nightly bars; RISE for the weekly shortfall insight line (rendered as the panel's footer status when the adherence claim clears claims.ts coverage).
4. NumberTicker: MagicUI Number Ticker pattern (registry-standard), reimplemented on installed motion.

## 3. Laws honored (spot list)

- One canonical value: every number renders a registered metric through `lib/contracts/units.ts` formatters; new metric `nutrition.week.daily` batch-registered per the README P5 list; panels consume `lib/today/panel-data.ts`, the one assembler per panel.
- FIX-07: all three panels grade each week day against that day's effective-dated target (`getNutritionTargetsByDay` / `getWaterGoalMlByDay` / `getSleepGoalMinutesByDay`), never the current pointer.
- Strip AND chart in every state (s181): typed slots make omission a type error; sleep's empty state carries the DSH-64 axis-only placeholder plus the hollow strip.
- Backfill (every-logger-needs-backfill): hydration via the /hydration backfill card (panel overflow deep-links #log-past-day); sleep via the log overlay's date field; nutrition via /nutrition#log-meal whose form carries the date field.
- Confirm-or-undo: exact-entry toastUndo on water quick-adds and fresh sleep logs; sleep replacements are announced pre-save and receipted; /sleep history delete now confirms with the named night (the old one-tap delete violated the law and was fixed in territory).
- s168 popup ban: the popover forms died (WaterTracker deleted; SleepPanel + sleep history rows on AdaptiveDialog overlays; meal logging stays on its owned page).
- Nothing auto-starts: AdaptiveDialog guarantees no autofocus; verified in the e2e run.
- FIX-41: ZERO new dependencies; all visuals compile from installed react/motion/svg.
- DEC-04: meal grading copy untouched.
- DEC-09: goal deletion / Future You FK untouched.
