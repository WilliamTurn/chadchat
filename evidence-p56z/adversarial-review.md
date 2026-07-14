# P56 Wave Close: Fresh-Context Adversarial Review (contract conformance + evidence truth)

| Field | Value |
|---|---|
| Reviewer | Fresh-context adversarial pass (P56-Z battery, GATE-05 input) |
| Date | 2026-07-14 |
| Mode | READ-ONLY. Code + docs only; no browser, no servers, no DB |
| Scope | P56-A..E completion claims vs the tree at `0f1ee38` (+ staged Z deletions), `lib/contracts/**` conformance, evidence spot-checks |

## Verdict: NARROW FAIL with fixables

One P1 (a member-facing correctness regression class introduced by this wave's canonicalization split across goal surfaces), two P2 conformance gaps, three P3 notes. Every one of the five completion-line factual claims I spot-checked against code is TRUE as written. All eight adversarial verification areas were exercised; details below.

---

## P1 findings

### P1-1: Lift-goal (est. 1RM) outcome values can now DISAGREE between /goals and /today//progress; alias-named goals lose their value on the new surfaces

The wave wired exercise-identity canonicalization into the goal-outcome path on /today and /progress, but /goals and /goals/[id] still compute the same goal's current est. 1RM over RAW history with their own view-model math. Before this wave all goal surfaces used raw history and agreed; after it, two computations of the same displayed number coexist (the DSH-26 class the one-canonical-value law exists to kill).

Evidence:

- `app/goals/page.tsx:124-135` - `const workoutData = recentWorkouts.map(toWorkoutData);` then `exercise1RMTrend(workoutData, g.metricRef)` - NO `canonicalizeWorkouts`, own `LiftProgress {current, first, points}` construction, not `lib/goals/outcome-values.ts`.
- `app/goals/[id]/page.tsx:186-190` - same raw-history computation.
- `lib/today/plans-goals-data.ts:200-201` - /today canonicalizes (`canonicalizeWorkouts(workouts, await getResolveOptions(user.id))`) before `buildGoalVM`.
- `app/progress/page.tsx:225-228, 604-618` - /progress canonicalizes and goes through the shared `buildGoalVM`.
- `lib/goals/outcome-values.ts:95-97` - `exercise1RMTrend(sources.canonicalWorkouts, o.metricRef)` matches `metricRef` by raw `trim().toLowerCase()` against CANONICAL display names. `metricRef` is never resolved through `resolveExerciseIdentity`.

Concrete member-facing failure modes (both require only an alias-split history or an alias-spelled goal, which prod demonstrably has - `evidence-p56b/dedup-demo-prod.md` shows real members with "Barbell Hip Thrust" -> "Hip Thrust" merges):

1. Goal `metricRef = "Bench Press"` (a curated alias), history logged under any spelling: after canonicalization every exercise is named "Barbell Bench Press", so `buildGoalVM`'s lookup finds NOTHING -> /today's primary-goal card and /progress's goal card show no current value / "outcomes tracked" fallback, while /goals shows a live number from raw history. The exact "two screens disagree" bug class, introduced where the surfaces previously agreed.
2. Goal `metricRef = "Barbell Bench Press"`, history alias-split: /today//progress show the correctly MERGED best (higher, right), /goals shows only the raw-name subset (lower, wrong). Same goal, two different numbers on screen at once.

Secondary input divergences in the same cluster (same law, smaller effect): /today hydrates 60 workouts (`app/today/page.tsx:97`), /goals uses `GOALS_WORKOUT_LIMIT`, /progress 200 - an e1rm whose last session falls outside one window but not another renders on one surface and not the other. And legacy MEASUREMENT goals: E's `latestMeasurementsByKind` fix covers /today + /progress, but /goals cards still carry the goal's stored manual `currentValue` (`app/goals/page.tsx:110`), so a measurement goal can still show a third, stale number on /goals.

Why P1: member-facing correctness (same goal, different values or value-vs-nothing across pages), and it undermines the structural half of P56-E's reconciliation claim - the live check "/today == /goals == /progress goal values" (briefing log, P56-E COMPLETE line) passed on data whose names happened to resolve identically; the code does not guarantee it. (The claim as an observed test result is not false; the guarantee implied by "one canonical value" does not hold for /goals.)

Fix shape (for the follow-up, not this reviewer): resolve `metricRef` through `resolveExerciseIdentity` inside `buildGoalVM` (or canonicalize the ref at the same point history is canonicalized), and route /goals + /goals/[id] lift/measurement current values through `lib/goals/outcome-values.ts` over the same canonicalized input.

---

## P2 findings

### P2-1: "Calories today" is computed in two live member-facing modules, and the registry pin for `nutrition.calories.today` is now stale

- Registry: `lib/contracts/metrics.ts:137-157` pins `nutrition.calories.today` to `lib/ai/dashboard.ts sumMacros`, with a derivation note that says the live cards "currently inline-reduce (app/today/page.tsx, app/nutrition/page.tsx); rewire them to this symbol."
- Actual /today path after this wave: `lib/today/panel-data.ts:154-177` -> `dailyMacroTrend` (`lib/nutrition/daily-macros.ts`) -> `buildMacroWeek` today slot. That is a THIRD module for the same quantity (registered as `nutrition.week.daily`, so the number does trace to A registered metric - but not to the one named "Calories today").
- /nutrition still inline-reduces with its own local helper: `app/nutrition/page.tsx:167` (`sumMacro`) and `:370` (`caloriesConsumed={sumMacro(meals, "calories")}`). The Phase-2 rewiring debt was not retired; a second parallel computation was added instead.
- `components/today/status-strip.tsx:38` documents the value as "sumMacros over the member-local today (registered source)" - factually wrong; the value arrives via `buildMacroWeek`.

Values agree in practice today (same rows, same member-local day bucketing via `calendarDayAnchorInTz`, integer rounding at both ends - verified `lib/nutrition/daily-macros.ts:34-57` vs the /nutrition day fetch), so this is not a member-visible bug yet. But the registry's own rule ("changing a definition ... is a product decision recorded in the tracker decision log, never a refactor", metrics.ts:20-24) was not followed: `nutrition.calories.today`'s derivation note is now false about where /today computes, and the one-module law is violated in structure for the app's most-displayed number. A gate should force the reconciliation: either repoint/retire `nutrition.calories.today` via the decision log or rewire the three call sites to one symbol.

### P2-2: `training.exercise.e1rm` registry derivation does not name canonicalization while its consumers split on it

`lib/contracts/metrics.ts:587-607` (`training.exercise.e1rm`) says only "Epley estimate over completed working sets" - nothing about canonicalized input - while `training.volume.dailyTrend` and the FIX-33 block explicitly say "computed over CANONICALIZED workouts." That silence is exactly the crack P1-1 lives in: two surfaces both call the pinned symbol (`exercise1RMTrend`) and both pass "the member's workouts", and the registry cannot arbitrate which input is canonical. Additive derivation-note fix + the P1-1 rewire close this. (Filed separately from P1-1 because it is the contract-layer gap, not the bug.)

---

## P3 findings

### P3-1: "On target" semantics fork between the nutrition week strip and the adherence tiles on the SAME /today page

- `components/today/nutrition-panel.tsx:159-189`: week-strip day grading is at-most ("full amber = a logged day at or under its calorie target, critical = over"; status strings "On target" / "Over target").
- `lib/progress/overview.ts:121-135` (`nutritionAdherenceWindow`, consumed by the Nutrition highlight via `lib/today/highlights.ts` and by /progress): within +/-10% band, deliberately symmetric ("both cut and bulk targets are numbers to HIT", doc-04 rationale).

A day logged at 55% of its calorie target reads "On target" in the panel strip and counts as a MISS in the adherence tile two bands below it. Both are registered metrics with internally honest derivations (`nutrition.week.daily` vs `nutrition.adherence.window`), so this is not a law break, but it is a member-visible coherence gap the design wave / decision log should adjudicate.

### P3-2: `QuitDateCard` is now a zero-importer dead export

`components/today/quit-date-card.tsx:22` - after P56-D removed the Today promotion (DEC-03, correctly), nothing imports `QuitDateCard` anywhere in the repo (grep: only its own definition). The wave's own convention (C/E deleted their replaced components) says delete it or disclose it; it was neither.

### P3-3: The sleep-tracker deletions are staged but uncommitted

`git status` in chadchat shows `D components/today/sleep-log-form.tsx` and `D components/today/sleep-tracker.tsx` staged, uncommitted (plus modified `scripts/design-lint-baseline.json`, `tests/visual-baseline.json`). Consistent with E's handoff ("deletion is yours [Z's]") and Z being mid-flight - flagged only so the wave close commits them; an interrupted close would leave the tree half-swept.

---

## Areas checked and CLEAN

1. **One-canonical-value sampling (12+ displayed numbers traced)** - Status strip calories/water/sleep/training (`components/today/status-strip.tsx` formats only; values arrive from `lib/today/panel-data.ts` assemblers and `buildWorkoutWeek`/`buildLastNight`, the pinned sources; the sessions-vs-planned pairing is the REGISTERED TargetDef for `training.sessions.thisWeek`, not a metric conflation); hydration/sleep/nutrition panel headlines and strips; TrainingHighlight volume via `volumeSinceLb` (same symbol as /workouts:227 and `training-data.ts:224` - one symbol, three surfaces, and /today's raw-input use is correct because volume is name-independent, as the page comment states); Nutrition/Recovery highlights via the overview's own source symbols (`lib/today/highlights.ts:1-66` imports `nutritionAdherenceWindow`/`hydrationWindow`/`sleepWindow` from `lib/progress/overview.ts` - E's "graded through the overview's OWN source symbols" claim is TRUE); consistency "N of 7" from `getActivityDaysSince`; trend weight via the pinned `ema`; goal values via shared `buildGoalVM` on /today and /progress. Except for the P1/P2 items above, no per-card math forks found.
2. **B's raw-key-echo superset claim** - `lib/workouts/training-analytics.ts:37-59` (`withAliasKeyEchoes`): never overwrites (`rawKey in out` guard), echo lookup key construction (`canonicalName.trim().toLowerCase()`) exactly matches how `lastSetsByExercise`/`prBaselineByExercise` key canonicalized workouts. Hunted for a droppable echo: `prBaselineByExercise` creates an entry for every exercise unconditionally (`stats.ts:383,402`), so its echoes always land; `lastSetsByExercise` omits set-less exercises, so a missing echo occurs only when NO variant has a completed working set - identical to pre-FIX-33 behavior. Member-custom names resolve to self in both the canonicalization and the echo pass (same `opts`), so no custom is folded. STRICT SUPERSET holds. Unit tests cover both properties (`tests/unit/training-analytics.test.ts:137-161`).
3. **E's measurement fix** - `lib/db/queries.ts:1398-1406` orders `asc(recordedAt)`; `lib/goals/outcome-values.ts:55-63` last-write-wins = latest; consumed by BOTH `app/progress/page.tsx:604` and `lib/today/plans-goals-data.ts:204`. No stale first-wins copy remains (`buildGoalVM` exists only in the shared module; /progress imports it, lines 73-75). Kind casing safe: DB kinds are the lowercase `MEASUREMENT_KINDS` enum, lookup lowercases `metricRef`. TRUE. (Residual /goals gap noted under P1-1.)
4. **E's meal-slice determinism + timezone** - `lib/plans/meal-slice.ts` is pure over 00:00-UTC member-local day anchors; the caller `lib/today/plans-goals-data.ts:147-155` derives them with `calendarDayAnchorInTz(mealPlan.createdAt, user.timezone)` and `todayAnchorInTz(user.timezone)` - the lib/date.ts *InTz convention, no raw UTC Date math; anchor differences are exact DAY_MS multiples so the `Math.round` is exact; negative elapsed clamped; plan-order progression by `mealsLoggedToday` with an explicit all-covered state. 8 unit tests exist (`tests/unit/meal-slice.test.ts`). CLEAN.
5. **C's per-day target grading** - `lib/today/panel-data.ts` attaches `goalMl`/`goalMinutes`/`target` PER DAY from `getWaterGoalMlByDay`/`getSleepGoalMinutesByDay`/`getNutritionTargetsByDay`; consumers grade each day against its own value: `hydration-panel.tsx:130` (`day.goalMl ?? safeGoal`), `sleep-panel.tsx:151-174` (`n.minutes >= n.goalMinutes`), `nutrition-panel.tsx:165-189` (`day.target?.calories`), and the /today Up-next sleep bars (`app/today/page.tsx:347-356`). The highlights adapters pass per-day maps into the overview symbols. No today-pointer grading found anywhere in the new code. CLEAN.
6. **Registry drift** - `/progress/body`, `/progress/training`, `/account/appearance`, `/plans` all registered (`lib/contracts/routes.ts:299-315, 345-352, 425-433`) with real pages on disk; the drift tests are real (`tests/unit/contracts.test.ts:65-127`: metric source symbols on disk, every route has `app/<path>/page.tsx`, nav-links names match, path uniqueness). The codebase's convention is literal hrefs validated by these tests (no runtime route helper exists to bypass); all new literal hrefs I found target registered paths; `lib/nav-links.ts:187` weigh-in action correctly retargeted to `/progress/body#log-entry`; no stale `href="/progress"`-as-body or `/progress#log-entry` links remain in app/components/lib.
7. **Evidence-truth spot checks (5/5 TRUE)** - (a) B "prCountsByWorkout now DERIVED from prEventsByWorkout": `lib/workouts/stats.ts:497-506`, exactly as claimed, single computation. (b) D "AskChadButton 44px floor at its base": `components/chad/ask-chad-button.tsx:30` `min-h-11 ... sm:min-h-8`. (c) C "WaterTracker REPLACED and DELETED": file gone; repo-wide grep finds only explanatory comments; `/hydration` mounts `HydrationPanel`. (d) A "next.config.ts /weight + /body redirects": `chadchat/next.config.ts:28-29`, both -> `/progress/body`, temporary (307) as documented. (e) E "PlanList mounted verbatim at /plans": `app/plans/page.tsx:98-105` mounts the existing `components/today/plan-list.tsx` with plans/pastPlans/memory hint intact; `/plans` registered. Also re-verified: B's db-handle consolidation (`alias-queries.ts:4` imports the shared `db`), SEC-3 still dormant (`decideExerciseAlias` zero callers), D's hamburger removal (`components/nav/standalone-header.tsx` - no Sheet, AccountMenu at every width).
8. **Orphan sweep** - `water-tracker.tsx`, `sleep-tracker.tsx`+`sleep-log-form.tsx` (staged deletions, P3-3), `stat-pills.tsx`, `streak-strip.tsx`, `hero-customizer` - all absent from the tree with zero lingering imports (comment references only). The one missed orphan is `QuitDateCard` (P3-2). `lib/today/up-next.ts` is deterministic and consumes P34-D's `selectUpNextSession` verbatim as claimed.

## Not re-filed (already tracked)

WeekBars/MiniBars square treatment; unicorn raw-scene embed (owner ruling stands); heatmap ramp/owner review; DEC-10 heights; dialog X 34px; FIX-41 budget (540.7 vs 350); SEC-3 dormant scoping; `app-guide.ts` stale wording; `panel-demos.tsx` Math.round bucketing; /meal-plan 1-kcal tab rounding; meal-plan title em-dash generator.
