# P34-B / FIX-03 — URL-state and deep-link verification

- **Date:** 2026-07-13
- **Environment:** dev server ALREADY running at http://localhost:3600 (reused; never started/stopped/restarted). Repo path `C:\Users\jon17\Desktop\chadlatest\chadchat` (resolves through a link to `C:\Users\jon17\Desktop\chadchat`, which is where pnpm and the capture artifacts report).
- **Account:** stellarluxedecor@gmail.com (Elite "Marcus" showcase — 8 weeks of logs, workouts, weigh-ins; ≥2 weekly reports). Logged in once via /login on a fresh context; session reused for all checks.
- **Driver:** node Playwright — `chadchat/scripts/p34b-checks.mjs` (style follows `scripts/p2d-live.mjs` + `scripts/overlay-checks.mjs`). No MCP browser tools used.
- **Data safety:** READ-ONLY. Only navigation, range/filter/metric toggles, the custom-range picker's Apply (view-state only), drill-down open/close, day paging, search typing, and back/forward were exercised. Nothing logged, saved, deleted, or submitted.
- **Result:** **18 / 18 PASS.**
- **Shared-tree note:** another session's P34-D WIP has tsc errors in `lib/db/schema.ts`. It did not surface here — every authenticated page under test streamed and rendered normally (no 500s, no error boundaries); check 5 explicitly asserts no error boundary on /progress.
- **Suspense note:** all pages under test are authenticated and stream via Suspense; every check waits for the streamed control (range control / PR row / search input / heading) before asserting.

## PASS/FAIL table

| # | Route | Assertion | Result | URL / measured value |
|---|---|---|---|---|
| — | /login | Marcus account authenticates | PASS | landed http://localhost:3600/today |
| 1 | /progress | click range segment → `?range=1m`, shallow (no reload), active segment matches | PASS | `…/progress?range=1m`; range=1m; active=1M |
| 2 | /progress | reload `?range=1m` → segment active on first paint | PASS | `…/progress?range=1m`; active=1M |
| 3 | /progress | nav away via link + browser Back → segment + URL preserved | PASS | backUrl `…/progress?range=1m`; active=1M |
| 4 | /progress | custom picker Apply → `?range=custom&from&to`; reload → "Custom" segment active | PASS | wrote `…/progress?range=custom&from=2026-05-11&to=2026-07-06`; after reload custom button reads "Custom" |
| 5 | /progress | `?range=banana` → renders at default range, no crash / no error boundary | PASS | active=1W (valid default, not "banana"); errorBoundary=0 |
| 6 | /workouts | volume-chart range click → `?range=1m`; reload restores | PASS | clicked 1M; range=1m; after reload active=1M |
| 7 | /workouts | PR row click → panel opens AND `?pr=<name>` pushed as NEW history entry; Back closes + clears param | PASS | pr="Leg Press"; panelOpen=true; history 6→7 (push=true); after Back pr=null, 0 expanded rows |
| 8 | /workouts | deep link `?pr=Leg%20Press` → drill-down open on load | PASS | panelOpen=true; 1 expanded row; `…/workouts?pr=Leg%20Press` |
| 9 | /workouts/exercises | type "bench" → list filters instantly, `?q=bench` after debounce; **browser Back once LEAVES the page** (typing created ZERO history entries) | PASS | `?q=bench`; Back landed `/workouts` (left the library ⇒ 0 history entries from the 5-char burst) |
| 10 | /workouts/exercises | muscle chip → `?muscle=chest`; "All muscles" → param removed (clean URL); deep link `?q=press&muscle=chest` → pre-filtered, chip highlighted, input pre-filled | PASS | chip→muscle=chest; All muscles→muscle omitted (null); deep link input="press", Chest tab aria-selected=true |
| 11 | /nutrition | (regression) day-back arrow → `?day=YYYY-MM-DD`, heading changes; Back → today | PASS | `?day=2026-07-12`; heading left "Today"; Back → "Today", no day param |
| 12 | /nutrition | macro chart: metric segment → `?metric=protein`; range segment → `?range=`; reload restores both; `?metric=banana` → Calories default | PASS | metric=protein, range=all; after reload proteinActive=true, rangeActive=All; `?metric=banana` → "Cal" active=true |
| 13a | /hydration | range click → `?range=1w`; reload restores; range clicks REPLACE, so Back LEAVES the page (does not undo the click) | PASS | clicked 1W; range=1w; reload active=1W; Back landed `/today` (left /hydration ⇒ replace) |
| 13b | /sleep | same as 13a | PASS | clicked 1W; range=1w; reload active=1W; Back landed `/today` (left /sleep ⇒ replace) |
| 14 | /reports | older report open → `?report=<id>` pushed; Back closes; deep link renders it open + scrolled | PASS | report=ff22d08f-91e2-46c3-a03c-d921a6bc8b82; history 14→15 (push=true); details open=true; after Back report=null; deep-link open=true |
| 15 | /workouts/history | scroll → detail → Back restores scrollY within ~100px | PASS | scrolled to y1=700 (scrollH=2331); reached detail; after Back y2=700; **delta=0px** |
| 16 | /progress | a range click does NOT navigate the document (in-page `window.__p34bMarker` survives the URL change) | PASS | marker survived=true; url changed to `…/progress?range=1m` |

### Notes on specific checks
- **Check 9 (history hygiene, the critical one):** the exercise library was reached via an in-app link from /workouts so a prior page existed on the stack. After typing a 5-char burst and the debounced `?q=bench` write, a single browser Back left `/workouts/exercises` entirely and landed on `/workouts` — proving the debounced `replaceState` writes added zero history entries.
- **Check 7 vs 13 (push vs replace):** PR drill-down (check 7) increments `history.length` by exactly 1 (pushState — Back closes the panel), whereas range toggles on hydration/sleep (check 13) do NOT add an entry (replaceState — Back leaves the page). The two conventions are demonstrated to behave oppositely, as designed.
- **Check 4 (custom window):** applying the picker with its seeded full-data span produced a real `range=custom&from=2026-05-11&to=2026-07-06` window that survived reload; the picker's segment label switched to "Custom".

## Visual-regression diff (`pnpm screenshot:diff`)

Captured a fresh set first (`pnpm screenshot:fixtures`, 364 images = 26 harness pages × 7 widths × 2 themes), then ran the gate against the reviewed win32 baseline (frozen 2026-07-13).

- **Gate result:** `182 changed, 0 missing, 0 new` (exit 1).
- **Breakdown:** all 182 changed images are **light-theme only** (`*/light-*.png`); **0 dark-theme images changed**; **0 of the changed images are P34-B product surfaces**. The 182 are every light-theme render of the shared FIXTURE-HARNESS pages: `tokens`, `personas`, `roles-*`, `panels-*`, `overlays*`, `forms`, `charts-*` (full list below).
- **Attribution — NOT P34-B:** P34-B is pure URL-state behavior. It touched only `lib/url-state.ts`, `hooks/use-url-state.ts`, `hooks/use-url-chart-range.ts`, and `urlState`/param opt-ins on the product chart/filter components; it added no rendering, styling, or theme-token code. None of the fixture-harness pages mount any URL-state component, and the DARK render of every one of these same pages is byte-identical to baseline. A uniform light-theme-wide shift with identical dark renders is a global light-theme/token drift originating outside P34-B (another session's shared-tree WIP or a stale light baseline), not a regression introduced by this change.
- **Action:** baseline NOT re-approved (`screenshot:approve` not run) — the drift is not P34-B's to freeze.

### Full list of drifted images (all light theme, all 7 widths each)
Page groups: `tokens`, `personas`, `roles-consistent`, `roles-first-run`, `roles-sparse`, `roles-lapsed`, `roles-overshoot`, `roles-locked`, `panels-consistent`, `panels-first-run`, `panels-sparse`, `panels-lapsed`, `panels-overshoot`, `panels-locked`, `overlays`, `overlays-quicklog`, `overlays-edit`, `overlays-confirm`, `overlays-sheet`, `forms`, `charts-consistent`, `charts-first-run`, `charts-sparse`, `charts-lapsed`, `charts-overshoot`, `charts-locked` — each at `light-{1440,1280,1024,768,390,360,320}.png` (26 × 7 = 182).

## Screenshots (evidence-p34b/shots/)
- `04-progress-custom-restored.png` — /progress after reload with `?range=custom&from&to` (Custom segment active)
- `07-workouts-pr-open.png` — /workouts PR drill-down open (Leg Press) with `?pr=` in URL
- `08-workouts-pr-deeplink.png` — /workouts deep-linked `?pr=Leg%20Press` open on load
- `10-exercises-deeplink-filtered.png` — /workouts/exercises deep link `?q=press&muscle=chest` pre-filtered
- `14-reports-open.png` — /reports older report opened via `?report=<id>`
