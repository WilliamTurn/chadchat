# FIX-41: /today first-load JS, P56-D measurement + attribution

Date: 2026-07-13. Method: the PRESERVED script `scripts/p34z-perf-today.mjs`
(unchanged), run by the delegated Opus agent against a production build of
commit `496d50e` (the P56-D Today-shell recomposition) served from an isolated
git worktree on :3601 (the shared :3600 dev server was never touched). Machine
output: `evidence-p56d/perf-run-output-p56d.json`. Attribution:
`scripts/p56d-attribute-chunks.mjs` (a helper that consumes the measurement
output and string-matches library signatures in the served chunks; it is not a
second measurement method).

## The end number (packet obligation: report either way)

| Measurement | P2-Z | P34-Z | P56-D (this) | Budget | Verdict |
|---|---|---|---|---|---|
| /today first-load JS, cold (gzip wire) | 540.4 / 30 | 542.8 / 30 | **540.7 KB / 31 files** | <= 350 KB | **FAIL, unchanged** (155% of budget) |
| LCP 1440x900 dark | 0.55 s | 0.53 s | **0.57 s** | <= 2.5 s | PASS |
| LCP 390x844 dark | n/a | 0.53 s | **0.46 s** | <= 2.5 s | PASS |
| CLS 1440 / 390 | 0.00 / 0.00 | 0.00 / 0.00 | **0.00 / 0.00** | <= 0.10 | PASS |

The Today-shell recomposition is NET-FLAT on first-load weight (-2.1 KB, +1
file = chunk-boundary churn): the new shell components are token/SVG/CSS
compositions with zero new dependencies (NumberFlow and Tremor were evaluated
and deliberately NOT added; the consistency matrix and status arcs are
hand-composed on the P2 primitives).

## Attribution: where the 540.7 KB lives

Top 12 chunks = ~363 KB of the 540.7; the rest is sub-14 KB fragments.

| Chunk | gz KB | Carries |
|---|---|---|
| 13n2nry661j61 | 99.4 | react + next-runtime + recharts/d3 + motion + Intl date logic (the vendor mega-chunk) |
| 0zbg2-5rg69hu | 71.5 | react-dom + react |
| 0c~992t59dnyd | 28.4 | next-runtime |
| 0f--rbc15u~9d | 25.2 | recharts + motion + zod |
| 17x5zirr2j9f5 | 23.0 | motion (nearly pure) |
| 007jry-p0sgw7 | 21.0 | Intl date logic |
| 0cz0t11ykstmh | 20.7 | motion (nearly pure) |
| 18cf-bdzuheen | 16.0 | motion + radix-ui + sonner |
| 0zay7b6g1a7tv | 15.2 | zod |
| 0icg3f3md7lmi | 15.0 | next-runtime |
| 0ycauw96xbjix | 14.5 | recharts + motion + date logic |
| 061~6fzqrsfdl | 13.2 | radix-ui |

Buckets:
1. **React + Next runtime floor: ~215 KB** (chunks 0 part, 1, 2, 9 + fragments).
   Irreducible without framework-level changes; alone it is 61% of the budget.
2. **motion/framer: the most pervasive reducible weight** — matched in 6 of the
   top 12 chunks incl. two nearly-pure ~21-23 KB chunks. It is smeared across
   first load instead of isolated.
3. **recharts + d3 in the first-load path** (chunks 0, 3, 10) even though every
   chart sits below the fold.
4. Fixed small costs: zod (~25 KB), radix-ui, sonner, Intl date logic.

## Why P56-D did not trim further (and what will)

The two attackable libraries enter through SHARED system files other P56
sessions are actively extending this wave: recharts via `components/charts/**`
(the P2 chart grammar every tracker/trend panel composes; P56-B is adding
signature chart primitives there right now) and motion via the overlay/drawer/
sidebar primitives. Lazy-loading only my page's chart mount would not remove
either library (they return with every chart-grammar panel), and a
chart-system-level split mid-wave would collide with three other sessions'
in-flight work. Deferring that refactor is the wave-safe call; the budget
formally gates GATE-06, not GATE-05/the Today slice.

**Concrete GATE-06 recommendations (from this attribution):**
1. Split the PLOT out of the chart grammar: `ChartFrame` stays server/static
   (title, headline, coverage, reserved height = zero-shift preserved) and the
   recharts plot body becomes a `next/dynamic` client leaf. One change in
   `components/charts/**` removes recharts+d3 from first load for every panel.
2. Quarantine motion: permanent chrome (flame flicker, count-ups) can run on
   CSS animations/transitions; keep `motion/react` for overlays that already
   load on interaction, and audit `LazyMotion`/`domAnimation` feature slimming.
3. Re-measure after 1+2; if the number still exceeds 350 KB, the remaining gap
   is the React/Next floor plus zod/radix, and the budget itself needs an owner
   conversation with these numbers on the table.
