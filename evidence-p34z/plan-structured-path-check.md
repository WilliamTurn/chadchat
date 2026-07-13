# P34-Z post-migration structured-path verification (2026-07-13)

Delegated Opus e2e agent. Node Playwright (`scripts/p34z-plan-check.mjs`) against the
already-running dev server on `http://localhost:3600`; DB assertions via
`scripts/p34z-db-check.ts` (`npx tsx`). Fresh browser context, no cookies.

Migration 0037 is APPLIED on the shared Neon DB (PlanSession* tables exist and are
writable). Seeded plan under test: id `07cf1686-d738-4336-b183-ad9b2a330200`, actual
title in DB `P34-D Verification Split (safe to delete)` (the /workouts section heading
is the hard-coded "Chad's Training Plan"), status `active`, kind `training`, sole active
training plan on the Pro test account (`claude-testing@example.com`,
userId `c073b912-082f-43aa-9e77-da9fffb8b4f1`).

## Method

1. Logged in via the `/login` credentials form (landed on `/today`).
2. Loaded `/workouts` once -> lazy materialization created the PlanSession* rows from the
   plan `days` json. Section rendered 3 day cards (Day 1: Upper, Day 2: Lower,
   Day 3: Full Body) with Start buttons. Screenshot `01-workouts-plan-section.png`.
3. Clicked "Start Day 1: Upper" -> logger prefilled from the schedule
   (`02-session-prefill.png`) -> "Finish" (`03-finish-dialog.png`, mark-all-unchecked
   pre-ticked) -> "Finish and save" -> landed on
   `/workouts/history/4f6e0894-1d86-452c-84f3-8e8c5ce7c635?new=1`
   ("Workout complete", `04-workout-saved.png`).
4. Loaded `/plans/07cf1686-...` and read the Weekly schedule section
   (`05-plan-schedule.png`).
5. Re-opened the saved workout detail (`06-workout-detail.png`), then ran the DB
   idempotency probe (see note under item c).

## Results

### (a) Completion row exists — PASS
`PlanSessionCompletion` for the plan: exactly 1 row.
- id `8dd333b4-e9a7-4652-b5a1-1bf772451cc7`
- workoutId `4f6e0894-1d86-452c-84f3-8e8c5ce7c635`
- planSessionId `c87948b5-e449-4a3e-a125-a2f53e90563c` (Day 1: Upper, position 0)
- sessionName `Day 1: Upper`
- completedDay `2026-07-13T00:00:00.000Z`

PlanSession rows materialized for the plan: 3
- pos 0 Day 1: Upper — `c87948b5-e449-4a3e-a125-a2f53e90563c`
- pos 1 Day 2: Lower — `3df67452-e33d-4a9c-b567-c2105c4405b7`
- pos 2 Day 3: Full Body — `824ba674-42ed-486f-a5ea-1a54281c8eea`

### (b) "Last done" today + "Up next" advanced to Day 2 — PASS
Weekly schedule on `/plans/[id]` (verified in DOM and visually in
`05-plan-schedule.png`):
- Header: "1 of 3 sessions done this week".
- Day 1: Upper -> "Last done Jul 13", no "Up next" badge, not "Not done yet".
- Day 2: Lower -> "Up next" badge present, "Not done yet".
- Day 3: Full Body -> "Not done yet", no badge.

The Up next verdict advanced off the completed Day 1 to Day 2 (first never-completed
session by rotation position), matching `selectUpNextSession`.

### (c) No double-record — PASS
The unique index `PlanSessionCompletion_workoutId_unique` + `onConflictDoNothing(workoutId)`
in `recordPlanSessionCompletion` guarantees one completion per workoutId.

Note on the "edit path": the app has NO in-place edit-into-logger re-save flow for a saved
workout. The workout detail page (`/workouts/history/[id]`) offers only Repeat (mints a new
workoutId — a different completion, by design) and Delete; `editWorkout` never calls
`recordPlanSessionCompletion`. So the literal "re-save unchanged" path cannot exist to be
double-counted. To exercise the guard directly, the DB probe re-inserted the existing
completion with the same workoutId (`scripts/p34z-db-check.ts --replay`), i.e. an exact
double-submit: row count stayed at 1 (still id `8dd333b4-...`). Guard confirmed.

## Screenshots (chadchat/evidence-p34z/)
- `01-workouts-plan-section.png` — /workouts plan section, 3 day cards + Start buttons
- `02-session-prefill.png` — logger prefilled for Day 1 from the schedule
- `03-finish-dialog.png` — Finish confirm dialog (mark-all-unchecked pre-ticked)
- `04-workout-saved.png` — "Workout complete" (history detail, `?new=1`)
- `05-plan-schedule.png` — plan Weekly schedule: Day 1 Last done Jul 13, Day 2 Up next
- `06-workout-detail.png` — saved workout re-opened

## Console errors seen
1 only, pre-existing and unrelated to plan surfaces: "An async function with
useActionState was called outside of a transition..." (app-wide warning). No pageerrors,
no plan/completion errors.

## IDs for cleanup (closer handles the seed; NOT cleaned by this run)
- planId `07cf1686-d738-4336-b183-ad9b2a330200`
- workoutId `4f6e0894-1d86-452c-84f3-8e8c5ce7c635` (in `Workout`, plus its exercises/sets)
- PlanSessionCompletion id `8dd333b4-e9a7-4652-b5a1-1bf772451cc7`
- PlanSession ids: `c87948b5-e449-4a3e-a125-a2f53e90563c`,
  `3df67452-e33d-4a9c-b567-c2105c4405b7`, `824ba674-42ed-486f-a5ea-1a54281c8eea`
  (plus their PlanSessionExercise / PlanSessionSet children)

Overall: PASS on (a), (b), (c).
