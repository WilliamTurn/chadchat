# FIX-10 Cross-Surface Refresh Proof — Hydration Pilot (P2-Z / DSH-66)

**Result: ALL 9 CHECKS PASS.** Logging water on `/today` revalidated `/hydration`
so a **client-side** navigation to `/hydration` showed the fresh total with **no
manual reload** — the mutation-receipt behavior FIX-10 introduced.

## Environment
- App: chadchat (Next.js), dev server already running at `http://localhost:3600` (not started/restarted by this run).
- Shared **production** Neon DB — every entry created below was deleted in cleanup.
- Test account: `claude-testing@example.com` (Pro), fresh browser context (no prior cookies).
- Driver: node Playwright script (`@playwright/test` chromium, headless), viewport 1366x900.
- Script: `evidence-p34c/p34c-refresh-proof.mjs` — re-runnable with `node evidence-p34c/p34c-refresh-proof.mjs`.
- Date: 2026-07-13. Amount logged: **33 oz** (custom entry — distinctive, odd, not a preset; round-trips to exactly 33 oz).

## What was exercised
`/today` renders the pilot **HydrationPanel** (quick-log overlay → `logWaterAmount`
server action). `/hydration` renders the **WaterTracker** deep surface. Both derive
from the same day total, so they are the two dependent surfaces FIX-10's receipt
must keep in sync across a client-side nav.

## Steps & observed numbers

| # | Step | Observed |
|---|------|----------|
| 1 | Login at `/login` (email+password form, not Google) | Redirected to `/today` — authenticated |
| 2 | `/hydration` baseline total | **0 oz** (aria: "Hydration 0% of goal: 0 oz of 1 gal, 128 oz to go.") — screenshot `refresh-01-hydration-before.png` |
| 3 | Client-side nav `/hydration`→`/today` (clicked sidebar Dashboard link) | Soft nav confirmed (JS sentinel survived — no hard reload). Panel showed **0 oz**, matching baseline. |
| 3 | Logged **33 oz** via panel "Log water" overlay → Custom amount → "Add water" | Sonner receipt toast "**Added 33 oz. 33 oz of 128 oz today.**" with Undo — screenshot `refresh-02-today-logged.png` |
| 5 | `/today` panel reflected new total immediately | **33 oz** (= 0 + 33) shown in the WATER panel headline |
| 4 | Client-side nav `/today`→`/hydration` (clicked sidebar Hydration link, no reload) | Soft nav confirmed (fresh JS sentinel survived). Total = **33 oz** (aria: "Hydration 26% of goal: 33 oz of 1 gal, 95 oz to go."). New "33 oz · 7:05 AM" row present in Today's log — screenshot `refresh-03-hydration-after.png` |
| 6 | Cleanup: deleted the entry from `/hydration` Today's log; named confirm dialog | Dialog title: "**Delete the 7:05 AM entry of 33 oz?**" → confirmed with "Delete entry". Total returned to **0 oz**; no residual 33 oz row — screenshot `refresh-04-cleanup.png` |

## Verdicts (PASS/FAIL)
1. PASS — Login succeeds (left `/login`) → `/today`
2. PASS — `/hydration`→`/today` was a client-side nav (no hard reload)
3. PASS — `/today` Water panel matches `/hydration` baseline on arrival (0 = 0)
4. PASS — **Step 5:** `/today` panel reflects new total immediately (+33 oz → 33)
5. PASS — `/today`→`/hydration` was a client-side nav (no hard reload)
6. PASS — **Step 4 (the FIX-10 assertion):** `/hydration` total increased by 33 oz after client-side nav, no reload (0 → 33)
7. PASS — New entry appears in `/hydration` Today's log (33 oz row)
8. PASS — **Step 6:** cleanup deleted the entry; total returned to baseline (33 → 0)
9. PASS — No leftover test entry remains after cleanup

## Cleanup confirmation
The single 33 oz entry created during the test was deleted through the named
confirm dialog. Final `/hydration` today total returned to the step-2 baseline
(**0 oz**) and no 33 oz row remains. DB left as found.

## Anomalies / notes
- **Login hydration race (test-harness issue, not a FIX-10 issue).** The `/login`
  form is a client `onSubmit` over a `noValidate <form>`. Clicking "Sign in" before
  React hydrates the handler triggers a **native GET form submission** — credentials
  land in the URL query string (`/login?email=...&password=...`) and no auth
  happens. The script now waits for hydration and retries on that race. Worth
  flagging separately: a real user who submits fast on a cold/slow load could hit
  the same native GET submit (credentials exposed in the URL / no login). Outside
  this task's scope but a legitimate `/login` robustness finding.
- **Pre-existing console error (unrelated to FIX-10):** one React warning on the
  login page — *"An async function with useActionState was called outside of a
  transition..."*. It does not block login and is unrelated to the hydration refresh
  path. No console/page errors were observed on `/today` or `/hydration`.
- `/hydration` history showed "2 of 7 days logged / 37 oz avg" from a prior day's
  data; today's baseline was still a clean 0 oz, so it did not affect any assertion.
