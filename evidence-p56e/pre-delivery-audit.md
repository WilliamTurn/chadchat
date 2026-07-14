# P56-E Pre-delivery audit (FIX-30 + Progress highlights + panel mounts)

Auditor: pre-delivery-auditor, 2026-07-13. Dev server localhost:3600 (untouched), node Playwright scripts in `evidence-p56e/scripts/10-13*.mjs`, machine output in `evidence-p56e/audit/`. Browser work strictly read-only (login form only; zero log/save/delete/edit interactions).

## VERDICT: SHIP-WITH-FIXES

No P1. One P2 (panel-title truncation on the new mounts) plus P3 polish items. Everything else on all five dimensions verified clean with evidence.

---

## Findings

### P2-1. New panel titles truncate: unreadable card names on desktop AND phone

The five new panel mounts never pass `wrapTitle`, so their canonical titles ellipsize whenever the header row gets tight. DOM-verified (scrollWidth > clientWidth) and visible in screenshots:

- 1440px desktop, live /today (`audit/today-1440-dark.png`): "MEAL ..." (Meal plan today) and "PRIMARY G..." (Primary goal) in the xl:col-span-3 cells of the Plans-and-goals band.
- 390px phone (`audit/today-390-dark-audit.png`): "TRAINING THIS ..." (163/140px), "NUTRITION ADH..." (186/137px), "RECOVERY CO..." (201/132px).

This violates the labels law (instantly self-explanatory) and P56-C's own rule, which added `wrapTitle` exactly so "a panel's own name must never truncate" (components/today/nutrition-panel.tsx:202-204 uses it; the new mounts do not).

Fix: pass `wrapTitle` in components/today/plan-meal-today.tsx, components/today/goal-primary.tsx, and all three tiles in components/today/progress-highlights.tsx (PlanPanel/SummaryPanel already accept it). One prop per call site.

### P3 items

- **P3-1 Em-dash in a touched file's placeholder.** components/today/plan-editor.tsx:175 textarea placeholder still reads "Day 1 — Upper". Member-visible; pre-existing and queued under COPY-1, but this session fixed the em-dash in the very next copy line of the same dialog, so noting it.
- **P3-2 Planned-day-total rounding disagrees with /meal-plan's own day panel.** /today meal card shows "2,134 kcal Day 3 total" (the registered metric reads the plan document's `day.totals`); /meal-plan's day detail shows "2,135 calories planned" (it sums the meals). /meal-plan is ALREADY internally inconsistent (its day tab says 2,134, its panel 2,135), so this is a pre-existing sibling defect the new metric surfaces, not a P56-E error; the new card matches the plan document and the /meal-plan tab. Queue a reconciliation on /meal-plan.
- **P3-3 Stale goal-outcome values are not dated.** Lapsed harness persona shows "Trend weight 202.1 lb / 180 lb" (12 days old) with no dated framing, contradicting the persona's own description ("values render DATED"). Exact parity with the /progress overview (shared buildGoalVM has no staleness field), so not a new regression; improvement belongs to the shared module.
- **P3-4 Rotation "next" matched by index, not identity.** components/today/plan-training-today.tsx:50 marks the next segment via `i === verdict.session.position`. Positions are contiguous 0-based by construction today (scheduleFromPlanDays; re-materialization on any hash change), so it is correct, but matching the session id would be robust against future position gaps.
- **P3-5 Empty meal card has two controls to one destination.** Empty-state PlanMealToday renders the required identity link "Open meal plan" plus the action "Build a meal plan", both -> /meal-plan, with different labels ("Open" also overpromises when no plan exists). Framework-driven (identity renders in every state); consider an empty-state detail-label override.
- **P3-6 Basic member's goal outcome says "Not logged".** Below Pro, /today never fetches weigh-ins, so a Basic member WITH weigh-in history sees "Trend weight Not logged / 220 lbs" (weight metric is Pro access). "Not logged" is not strictly the truth ("Pro computes this" is). Edge case.
- **P3-7 Pre-existing sibling issues observed (not P56-E surfaces, listed for the tracker):** (a) /dev/fixtures/today-panels logs a dev console error, `new Date()` inside LogSleepDialog client component without Suspense (Next prerender diagnostic; page renders, 24 panels, status 200); (b) AA contrast failures on the consistency strip's future weekday labels (about 2.08:1 both themes) and the header "Pro" badge (2.48:1 dark) — both predate this session.

---

## Verified clean (with evidence)

### 1. Code correctness
- **buildGoalVM extraction is verbatim** (diff-compared line by line); the ONLY behavior change is the documented latest-measurement fix, and it is a REAL bug fix: getBodyMeasurementsByUserId orders `asc(recordedAt)` (lib/db/queries.ts:1406), so the old first-wins loop surfaced the OLDEST reading; the new last-wins helper matches /progress/body's headline. /progress now imports the shared module; typecheck exit 0.
- **Meal-slice rotation rule**: deterministic, member-local day anchors via calendarDayAnchorInTz/todayAnchorInTz with user.timezone (lib/today/plans-goals-data.ts:149-153); modulo rotation; plan-order meal progression; explicit covered state; clock-skew clamp; empty/unreadable plan -> null with an honest open-the-plan fallback. 8/8 unit tests pass (tests/unit/meal-slice.test.ts, node:test).
- **Up next rewiring behavior-identical**: old inline block vs getTrainingTodayData compared line by line — same resolvePlanScheduleView, same completions mapping, same selectUpNextSession verdict, same trainedToday semantics (completedDayMs === todayAnchorMs), same sorted rotation with completedThisWeek, same weeklyPlanAdherence plannedPerWeek. Pro gate on the Up next snapshot unchanged.
- **Status-strip values same numbers**: nutrition totals/mealsToday from the P56-C assembler use the identical recordedAt-or-createdAt member-local bucketing as the old sumMacros(todaysMeals); hydration goal effective-dated with the same DEFAULT_WATER_GOAL_ML fallback. Two documented deliberate deltas, both law-aligned: sleep bars now grade each night against its own effective-dated goal (FIX-07) and the sleep goal falls back to the 480-min default consistently with the shipped SleepPanel; Up next meal chips prefer the live daily target (LC-2), plan snapshot fallback.
- **/progress refactor**: overview goal cards render correctly live (audit/sibling-progress-1440-dark.png) and reconcile with /goals (same single active goal, same outcome line).

### 2. Owner laws on the new surfaces
- Every displayed number traces to a registered source: plans.mealSlice.today registered in lib/contracts/metrics.ts with source module/symbol; goal values via the shared outcome-values module; highlight windows via lib/progress/overview.ts source symbols through lib/today/highlights.ts; contracts test suite passes (288/288 across tests/unit).
- Missing is never zero: first-run persona shows designed empty copy on ALL six new cards including highlight tiles (zero fake "0 kcal"/"0 sessions"); unlogged strip segments are hollow dashed.
- One primary action per panel (typed: footer.primary is one object; SummaryPanel takes no actions). No mutations anywhere in the new components (all server components, links + AskChad only); nothing auto-starts (no client hooks, no timers).
- No duplicate destinations in populated states (the FIX-30 View plan/Open plan pair is gone; the document-plan card swaps its detail link to /plans because its primary IS "Open plan"). Empty-state exception noted as P3-5.
- No em-dashes in the new member-facing copy (scan clean; P3-1 is pre-existing in a touched file; the /plans "2,200 cal cut — 3 meals/day" string is the stored meal-plan TITLE, member data, not shipped copy).

### 3. Harness states (adversarial re-probe, audit/harness-results.json)
- first-run: no fake zeros anywhere. locked-basic: locked tiles render capability teasers only; zero member data in locked panels; the document plan and goal title shown are member-tier capabilities by design, and the Pro-gated weigh-in value is withheld. lapsed: plan/meal cards honestly current (rotation day IS today), week tiles honestly empty; goal staleness dating noted as P3-3. overshoot: reward states honest ("Planned meals covered", trained-today still names the next session).
- 320px: document overflow 0px; only decorative pointer-events-none glow divs cross the edge (clipped). No layout break (audit/harness-320-dark.png).
- Console: zero errors on the plans-goals harness at 1440 and 320.

### 4. Live /today + /plans (Pro test account, read-only)
- Rendering correct at 1440 and 390, zero console errors on both pages, both themes screenshotted (audit/*.png).
- AA contrast (canvas-normalized computed colors, composited backgrounds): all P56-E copy lines pass 4.5:1 in BOTH themes — SegmentStrip caption/reason lines, the "of N" context lines, meal chips, adherence lines (97 sampled nodes on /today, 19 on /plans; the only sub-AA nodes are the pre-existing sibling elements in P3-7 and false positives over images).
- Touch targets at 390: no interactive element in the new bands under 44px (min-h-11 floors present; measured).
- Cross-surface truth: today's meal card (Egg whites, whole eggs & toast, 670 kcal, 55g protein, Day 3) matches /meal-plan's day-3 breakfast EXACTLY; "Day 3 total 2,134 kcal" matches the /meal-plan day tab; the goal card matches /progress verbatim ("1 outcome tracked, Trend weight Not logged / 220 lbs" — honest for an account with no weigh-ins).

### 5. Siblings
- /progress, /goals, /meal-plan, /workouts: all 200, zero console errors, render correct (audit/sibling-*.png), goal numbers reconcile across /today, /progress, /goals.
- /plans (new): renders the relocated PlanList (empty state on this account) + the meal-plan pointer card with the live plan title; zero console errors.
- /dev/fixtures/today-panels: renders all 24 of C's panels; the one console error is pre-existing (P3-7a), not touched by this session.

## Required before "done"
Fix P2-1 (wrapTitle on the five new mounts) and re-screenshot 390 + 1440. P3 items may ship as tracked follow-ups.
