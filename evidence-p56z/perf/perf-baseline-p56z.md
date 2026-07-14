# P56-Z Performance Baseline — /today

**Date:** 2026-07-14
**Commit:** c9755bb (P56 wave-final build, worktree chadchat-p56z-build)
**Server:** production `next start` on http://localhost:3601 (already running; never started/stopped by this run)
**Script:** `scripts/p34z-perf-today.mjs` (PRESERVED tracker section-9 script, run unmodified)

**Method (verbatim from the script):** production build on :3601, dark theme (app
default), Pro test account (claude-testing@example.com) on `/today`, buffered
PerformanceObserver for LCP + layout-shift, median of 3 cold runs (fresh browser
context each). First-load JS = compressed transfer bytes (CDP `encodedDataLength`)
of the `.js` chunks the initial `/today` HTML document references (script src +
preloads), intersected with what was observed on the wire. Desktop viewport
1440x900 measures JS + LCP + CLS; phone viewport 390x844 measures LCP + CLS only.
Read-only; no save/delete; no real member data logged.

## Measured /today first-load JS (this run, c9755bb)

| Metric | Value |
| --- | --- |
| First-load JS (gz transfer) | **519.8 KB** |
| First-load file count | **30** |
| React #310 on any run | none (false) |

## First-load JS vs prior measurements

| Baseline | KB gz | Delta vs 519.8 |
| --- | --- | --- |
| Owner budget (FIX-41) | 350.0 | **+169.8 over budget** |
| P2-Z | 540.4 | -20.6 (improved) |
| P34-Z | 542.8 | -23.0 (improved) |
| P56-D end measurement | 540.7 | -20.9 (improved) |

## Core Web Vitals (medians of 3 cold runs)

| Viewport | LCP (median) | CLS (median) |
| --- | --- | --- |
| Desktop 1440x900 | 520 ms | 0.0000 |
| Phone 390x844 | 576 ms | 0.0000 |

Per-run LCP: desktop 732 / 496 / 520 ms; phone 524 / 576 / 580 ms.
CLS was 0.0000 on all six runs (zero observed layout shift, both viewports).

## Regression check

No regression. The measured first-load JS (519.8 KB / 30 files) is **lower** than
every prior wave measurement: 20.6 KB below P2-Z (540.4), 23.0 KB below P34-Z
(542.8), and 20.9 KB below the P56-D end measurement (540.7). LCP and CLS are
healthy on both viewports (LCP well under 1s, CLS exactly zero). The one standing
gap is the owner's 350 KB budget (FIX-41): first-load JS remains 169.8 KB over
budget, unchanged in character from prior waves (this wave reduced it by ~21 KB,
it did not cross the budget).

**Artifacts:**
- `chadchat/evidence-p56z/perf/perf-run-output.json` (full summary + all 6 raw runs)
- Source (worktree): `chadchat-p56z-build/evidence-p34z/perf-run-output.json`

## Close-commit note (P56-Z)

The measured build is `c9755bb` (the wave-final state at close start). The close commit that follows adds the review-battery fixes (goals-page canonicalization, plan-delete confirm dialog, action-label truncation class, doc notes); none adds a dependency or changes /today's client module graph beyond a className and a span wrapper, so the 519.8 KB gz stands as the wave-end FIX-41 number.
