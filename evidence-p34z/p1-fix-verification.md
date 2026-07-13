# P34-Z P1 — Fix Verification (delete funnels + materialization race)

Date: 2026-07-13
Env: dev server http://localhost:3600 (reused), shared prod Neon DB.
Method: node Playwright scripts (`scripts/p34z-fixverify-*`) + `npx tsx` DB checks.
Fixes under test:
- `lib/db/queries.ts` delete funnels (`deleteWorkout`, `deletePlan`, `deleteAllUserData`) now remove the new FK'd tables (PlanSession/PlanSessionExercise/PlanSessionSet/PlanSessionCompletion/GoalOutcome/ExerciseAlias/NutritionTargetVersion/UserTargetVersion, all ON DELETE no action).
- `lib/db/plan-goal-queries.ts` `materializeSchedule` now takes a `pg_advisory_xact_lock` per plan to stop double-inserted prescriptions under concurrent first views.

## Result summary

| Test | Verdict |
|------|---------|
| 1 — workout + plan delete (removes completion + schedule rows) | **PASS** |
| 2 — materialization race (6 parallel `/workouts`, no duplicates) | **PASS** |
| 3 — "Delete my data" funnel wipes all new tables | **PASS** |

Throwaway user id (Test 3, account row left for the closer): `af933c00-9d69-4249-9be8-cbb405d394ee`

---

## Test 1 — workout + plan delete (Pro test account claude-testing@example.com)

Seeded plan `d9c8299d-134e-4728-a680-ecadb119718b` (status active; account had 0 plans).

- **1b materialize** — loaded `/workouts`; schedule materialized to exactly the seeded prescription: 3 sessions, 8 exercise rows, 28 set rows. Per-session Day1=3ex/11sets, Day2=3ex/11sets, Day3=2ex/6sets, **no duplicate exercise names**.
- **1b start+finish** — started "Day 1: Upper" from Chad's Training Plan, pressed Finish → "Finish and save". Saved workout `5b85c7e6-d171-4a7c-ac23-c402fe02cafa`, landed on `/workouts/history/…?new=1`.
- **1c DB** — PlanSessionCompletion for plan = **1** (workoutId matches the saved workout, sessionName "Day 1: Upper"). PASS.
- **1d delete workout** — via history-detail "Delete this workout from your history" → "Delete workout". Redirected to `/workouts/history`, **no error toast, no console errors**. PASS.
- **1e DB** — workout row = **0**, its PlanSessionCompletion = **0** (funnel removed the completion that FKs the workout). PASS.
- **1f delete plan** — via `/today` "Your training" card trash → inline "Delete". Toast **"Plan deleted."**, no console errors. PASS.
- **1g DB** — plan row gone (`planExists:false`), PlanSession=0, PlanSessionExercise=0, PlanSessionSet=0, PlanSessionCompletion=0. PASS. (Doubled as seed cleanup.)

## Test 2 — materialization race

Seeded fresh plan `3ad9e542-9c57-4bf6-af40-9a58d40e58ac`. Logged in via Playwright, extracted session cookie, fired **6 parallel** authenticated `GET /workouts` (plain `fetch`, `Promise.all`) with **no prior warm request**.

- All 6 responses HTTP **200**.
- DB per PlanSession after the race — exactly ONE set of prescriptions, no duplicates:
  - sessionCount **3**, totalExerciseRows **8**, totalSetRows **28**
  - pos0 Day1: 3 ex / 11 sets; pos1 Day2: 3 ex / 11 sets; pos2 Day3: 2 ex / 6 sets
  - duplicateExerciseNames: **[]** on every session
- Matches the expected single materialization exactly → the advisory-lock fix holds. PASS.
- Seed cleaned via `p34d-seed-test-plan.ts --cleanup`.

## Test 3 — "Delete my data" funnel (throwaway account)

- **3a register** — `p34z-throwaway@example.com` / `Zz9-throwaway-check` registered through the `/register` UI. **No email-verification gate**: the account auto-logs-in and has full app access (reached `/account`, all nav visible). User id `af933c00-9d69-4249-9be8-cbb405d394ee`.
- **3b generate data** — Water goal / water logging / goals are **Pro-gated** (`requirePro`); a fresh account cannot write them via the UI. Findings:
  - Logged a glass of water through the genuine `/hydration` UI **after granting the throwaway user Pro** (its own row: subscriptionTier=pro/active) → WaterLog +1 (live app write path).
  - The "Edit daily hydration goal" dialog was too animation-flaky to drive reliably (Save button detached mid-click across two attempts).
  - To exercise the delete funnel against **every** named table, the remaining rows were inserted directly for this throwaway user (its own rows only): UserTargetVersion, NutritionTargetVersion, Goal, GoalOutcome, Plan+PlanSession+PlanSessionExercise+PlanSessionSet+PlanSessionCompletion(+Workout), ExerciseAlias.
  - Pre-delete counts (all ≥1): userTargetVersion 1, nutritionTargetVersion 1, waterLog 2, goal 1, goalOutcome 1, planSession 1, planSessionExercise 1, planSessionSet 1, planSessionCompletion 1, exerciseAlias 1, plan 1, workout 1.
- **3c delete** — `/account` → "Delete my data" → typed DELETE → "Delete everything". Toast **"Done. All of your data has been deleted."**, **no console errors, no FK error**. PASS.
- **3d DB** — every named table for this user id = **0**: UserTargetVersion 0, NutritionTargetVersion 0, WaterLog 0, Goal 0, GoalOutcome 0, PlanSession 0, PlanSessionExercise 0, PlanSessionSet 0, PlanSessionCompletion 0, ExerciseAlias 0 (plus plan 0, workout 0). The **account row survives** (`userExists:true`, still pro/active) — data-only wipe, as designed. The closer deletes the row afterward. PASS.

## Anomalies / notes

- A pre-existing React warning appears on save flows ("An async function with useActionState was called outside of a transition…"); unrelated to these fixes, present regardless.
- The hydration "Edit daily hydration goal" dialog Save button is animation-unstable under Playwright (not a data bug); a genuine UI UserTargetVersion write was therefore not captured — that table was populated by direct seed instead and verified deleted.
- Water goal, water logging, and goals are Pro-gated, so a brand-new (non-Pro) account cannot generate data in those new tables via the UI; the throwaway account was granted Pro on its own row to exercise the real write path.

Screenshots: `evidence-p34z/fixverify/` (t1-01…t1-07, t3-01…t3-08).
