# P34-B / FIX-03: Restorable-state inventory and the URL grammar

Written 2026-07-13 by P34-B before implementation. Companion to `url-state-teardown.md` (the rule-8 benchmark; the checklist numbers cited below are its section 5).

## What each route must restore

| Route | State | Held today | URL plan | History semantics |
|---|---|---|---|---|
| /nutrition | viewed diary day | server `?day=YYYY-MM-DD` (BT1-3, already live) | keep as is | push (DayNav/Open-day are Links) |
| /nutrition | macro chart range | `useChartRange` useState | `?range=1w\|1m\|3m\|6m\|1y\|all` | replace |
| /nutrition | macro metric toggle | useState `metric` | `?metric=protein\|carbs\|fat` (calories = default, omitted) | replace |
| /hydration | water trend range | `useChartWindow` useState | `?range=` | replace |
| /sleep | sleep trend range | `useChartWindow` useState | `?range=` | replace |
| /progress | weight chart range + custom window (DSH-52) | `useChartRange` useState | `?range=`, custom = `?range=custom&from=YYYY-MM-DD&to=YYYY-MM-DD` | replace |
| /workouts | volume chart range | `useChartRange` useState | `?range=` | replace |
| /workouts | PR drill-down exercise | useState `openName` | `?pr=<exercise name>` | push on open, replace on close (Back closes the panel) |
| /workouts/exercises | library search text | useState `query` | `?q=` (debounced) | replace |
| /workouts/exercises | muscle-group filter | useState `muscle` | `?muscle=<group>` (all = default, omitted) | replace |
| /workouts/history | scroll (list -> detail -> Back) | native | no params | verify native restoration |
| /goals | scroll/back only (no filters exist) | native | no params | verify |
| /plans/[id] | scroll only (document) | native | no params | verify |
| /reports | which older report is open | uncontrolled `<details>` (lost on Back) | `?report=<id>` (server-honored + client-synced) | push on open, replace on close |

Deliberately NOT in the URL (Linear's durable-vs-ephemeral split, checklist 6):
- form input state (AnalyzeForm mode/fields, log forms) - entry state, not view state
- dialog/confirm open flags, hover/scrub positions - ephemeral chrome
- collapsible "Earlier" day groups on /nutrition - server-deterministic (first open), cosmetic

## DEC-02 composition (decided 2026-07-13)

Progress categories are REAL ROUTES: `/progress/body`, `/progress/training`, etc. Category is PATH state (checklist 13), never a query param. The grammar reserves query params for view state within a page, so category pages compose as `/progress/body?range=3m&from=...&to=...` with zero convention changes. P5 builds those pages; every helper below is path-agnostic (it reads `usePathname()` at write time), so they inherit restoration for free.

## The grammar rules (encoding checklist 2/3/4/8/10/11/12/15)

1. One shared module owns parse + serialize: `lib/url-state.ts` (pure, React-free) + `hooks/use-url-state.ts` (the reactive read/write core) + `hooks/use-url-chart-range.ts` (drop-in URL-synced versions of the two existing range hooks). No component reads raw `searchParams.get()` for these params.
2. Tokens are human-readable: range keys `1w/1m/3m/6m/1y/all` (the app's existing member-facing keys), calendar days as `YYYY-MM-DD`. No epochs in UI URLs.
3. Params at their default are OMITTED; setting back to default deletes the param (canonical URLs, checklist 15).
4. Invalid/unknown values fail safe to the default; they never throw and never render a broken control.
5. Filter/range/search changes write via shallow `history.replaceState` (no server round-trip, no history spam); "open a thing" state (PR drill-down, older report) writes `pushState` so Back closes it; day navigation stays real Link navigation (server data changes, checklist 12's exception).
6. Text input debounces the URL write (~350ms); the UI state is instant.
7. Back/forward (popstate) re-syncs component state from `useSearchParams` reactively - restoration is the URL, not a parallel store.
8. Chart range state COMPOSES with the existing hooks: `useChartWindow` (P2-C) via its published `initialKey` + `setKey`, `useChartRange` (legacy s45) via new additive `initial*` opts. Neither hook's behavior changes when no URL param is present.

## Verification plan (exit criteria)

Node-Playwright (Opus agent) on the shared :3600 dev server, per route:
- deep link with params -> control state matches the URL on first paint
- change state -> URL updates (canonical, defaults omitted); reload -> state restored
- navigate list -> detail -> Back -> filters/range AND scroll restored
- browser back/forward across pushed states (nutrition days, PR open, report open) walks the view history
- garbage params (`?range=banana&metric=%%%`) -> page renders at defaults
- history hygiene: a 6-character search burst adds ZERO history entries (replace+debounce)

Zero visual diffs proven via `pnpm screenshot:diff` on the touched surfaces (param-less renders must be pixel-identical).

## Side-by-side grade vs the benchmark

Filled in after verification: `side-by-side-grade.md`.
