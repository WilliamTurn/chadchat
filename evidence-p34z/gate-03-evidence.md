# GATE-03 (Navigation) — P34-Z fresh evidence run

**Date:** 2026-07-13
**Gate:** GATE-03 — FIX-03 (return state), FIX-20 (grouped desktop nav), FIX-21 (persistent mobile bottom nav)
**Server:** http://localhost:3600 (shared dev tree; NOT restarted by this run)
**Accounts:** Pro test account `claude-testing@example.com` (items 1–4, 6, 7); data-rich showcase account "Marcus" `stellarluxedecor@gmail.com` (item 5 — see note under item 5)
**Method:** node Playwright only (no MCP browser). Fresh contexts, cookies cleared per context. This is an INDEPENDENT re-drive, not a reuse of the build sessions' results.
**Scripts (all under `scripts/`, prefix `p34z-gate03`):** `-redirects.mjs`, `-nav.mjs`, `-water-goal.mjs`, `-db-check.ts`, `-probe.ts`, plus a fresh run of the build session's `p34b-checks.mjs` for item 5.
**Screenshots:** `evidence-p34z/gate03/`

## Verdict

| # | Item | Verdict |
|---|---|---|
| 1 | Alias redirects (15) | **PASS** — 15/15 |
| 2 | Grouped desktop nav @1440 (both themes) | **PASS** |
| 3 | Mobile bottom nav @320/360/390 (both themes) | **PASS** |
| 4 | Keyboard-safe bottom bar | **PASS** |
| 5 | Return-state restoration (FIX-03) | **PASS** — 18/18 |
| 6 | GATE-04 support: water-goal funnel | **PASS** (detail in `gate-03-04-live-run.md`) |
| 7 | Console errors | **PASS** — only the known pre-existing warning |

**GATE-03: PASS.** All three fixtures (FIX-03/20/21) verified by fresh evidence.

---

## Item 1 — Alias redirects (PASS, 15/15)

Unauthenticated, `maxRedirects=0`. Redirects run before the auth proxy, so they respond identically signed-out. Full table in `redirects-fresh.md`. All 15 responded **307** to the correct target:

`/chat→/`, `/coach→/`, `/water→/hydration`, `/weight→/progress`, `/body→/progress`, `/food→/nutrition`, `/meals→/nutrition`, `/calories→/nutrition`, `/workout→/workouts`, `/settings→/account`, `/billing→/account`, `/report→/reports`, `/quit→/quit-date`, `/quit-test→/quit-date`, `/dashboard→/today`.

## Item 2 — Grouped desktop nav @1440, both themes (PASS)

Driven on **/workouts/history** (a subroute) at 1440px, dark + light. Sidebar = `StandaloneSidebar` (LAY-2). Per theme:

- **Groups render**: captions `Track / Plan / Review` present; NO `More` / `Utility` / `Primary` caption (primary + utility groups are correctly uncaptioned). PASS both themes.
- **Primary group** links present (Dashboard). PASS.
- **Uncaptioned utility block** carries a hairline top border (1px) separating it from Review. PASS.
- **/quit-date utility entry**: link "Quit Test" present with a **Skull** lucide icon (svg class contains `skull`). PASS.
- **Subroute-aware selected state**: on /workouts/history the **Workouts** menu button has `data-active="true"` and is the ONLY active top-level link. PASS.
- Bottom bar absent at 1440 (confirmed). PASS.

Screenshots: `gate03/item2-sidebar-1440-dark.png`, `item2-sidebar-1440-light.png`.

## Item 3 — Mobile bottom nav @320/360/390, both themes (PASS)

`nav[aria-label="Primary"]` on /today, six viewport×theme combinations:

- **Present** at all three phone widths, both themes.
- **Exactly Today / Log / Progress / Coach / More**, in order, every combination.
- **Tap targets ≥ 44px**: measured 63–79 px wide × 59.5 px tall (all ≥ 44). PASS.
- **aria-current**: on /today, exactly the **Today** tab carries `aria-current="page"`. PASS.
- **Absent at 768 and 1440**: confirmed (bar not visible). PASS.
- **Log drawer**: opens the picker with all **5 logger destinations** — Log a meal (`/nutrition#log-meal`), Log water (`/hydration`), Log sleep (`/sleep`), Log a weigh-in (`/progress#log-entry`), Log a workout (`/workouts/new`). **No autofocus / no keyboard**: activeElement after open = `div`, `html[data-vk-open]` = false. PASS.
- **More sheet**: opens the grouped sheet — captions `Track / Plan / Review` present, Quit Test entry present. PASS.

Screenshots: `gate03/item3-mobile-{320,360,390}-{dark,light}.png`, `item3-log-drawer-390-dark.png`, `item3-more-sheet-390-dark.png`.

## Item 4 — Keyboard-safe bottom bar (PASS)

At 390px, both an editable-input scenario proven:

- **Chat composer** (`/`): focusing the composer sets `html[data-vk-open]`; the bar translates fully off-screen (`translate-y-full`, barTop=844 = viewport bottom). On blur, `data-vk-open` is removed and the translate class is gone (bar returns). PASS.
- **Nutrition logger** (`/nutrition`): focusing the logger input sets `html[data-vk-open]` and the bar is off-screen (barTop=844); on blur it is restored. PASS.

The bar hides while an editable holds focus (it never rides over the input) and returns on blur. Screenshots with focus held: `gate03/item4-keyboard-chat-390.png`, `item4-keyboard-nutrition-390.png`.

## Item 5 — Return-state restoration / FIX-03 (PASS, 18/18)

Fresh re-drive of the FIX-03 battery (`scripts/p34b-checks.mjs`), full output in `return-state-fresh.log`. **Account note:** run on the data-rich showcase account `stellarluxedecor@gmail.com` (the same account the P34-B build session used), NOT the Pro test account. The Pro test account has **0 progress entries and 0 weekly reports** (verified via `p34z-gate03-probe.ts`: workouts 6, progressEntries 0, weeklyReports 0), so it cannot exercise the /progress-chart, /reports, or scroll-restoration routes. The showcase account exercises every wired route with real state; this is the meaningful independent FIX-03 verification.

All wired routes from the item-5 list PASS:

| Route / behavior | Checks | Result |
|---|---|---|
| /progress `?range` + `?range=custom&from&to` (+ garbage fail-safe, Back preserves) | 1–5 | PASS |
| /workouts `?range` (volume) | 6 | PASS |
| /workouts `?pr` push-on-open, Back closes, deep-link opens | 7, 8 | PASS |
| /workouts/exercises `?q` debounced (0 history entries), `?muscle` + deep link | 9, 10 | PASS |
| /nutrition `?day` regression + `?metric`/`?range` reload-restore + garbage default | 11, 12 | PASS |
| /hydration `?range` (replace; reload restores; Back leaves page) | 13a | PASS |
| /sleep `?range` (replace; reload restores; Back leaves page) | 13b | PASS |
| /reports `?report` push, Back closes, deep link opens+scrolls | 14 | PASS |
| /workouts/history list→detail→Back scroll restoration | 15 | PASS — **delta 0px** (scrolled y=700, restored y=700) |
| range click does not navigate the document (SPA marker survives) | 16 | PASS |

For each: state set via UI, URL updated, cold reload restores state, and browser Back/Forward restore correctly, exactly as the item-5 spec requires.

## Item 6 — GATE-04 support: water-goal append-only funnel (PASS)

Full detail in `gate-03-04-live-run.md`. Summary: on the Pro test account, changed the water goal 128→100 oz via the UI (saved, no error, reflected on cold reload), then restored to 128 oz. DB verify (`p34z-gate03-db-check.ts`): `UserTargetVersion(kind=water)` went from **0 → 3** append-only rows — the 100 oz change (effectiveDay=today), an epoch-anchored backfill of the prior 128 oz default (preserving pre-today adherence, FIX-07 core), and the 128 oz restore (effectiveDay=today). Nothing was updated or deleted; the effective goal is restored to 128 oz.

## Item 7 — Console errors (PASS)

Across every page driven in items 2–4 and item 6, **one** unique console error was captured:

- `An async function with useActionState was called outside of a transition...` — the **known pre-existing** warning noted in the task.

The other known item (SessionMiniBar hydration mismatch) did not surface on the pages driven this run. No new / product-breaking console errors observed.

---

## Notes for the closer

- No code changed. Scripts added under `scripts/` (prefix `p34z-gate03`); evidence under `evidence-p34z/`. Nothing committed.
- Item 6 intentionally left 3 append-only `UserTargetVersion(water)` rows on `claude-testing@example.com` as proof; effective goal restored to default (128 oz).
- Item 5 used the showcase account for data coverage; the Pro test account is too sparse (0 progress/0 reports) to exercise those routes.
