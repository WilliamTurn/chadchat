# P34-D schema design: structured training plans (FIX-28) + goal outcomes (FIX-29)

Status: DRAFT pending rule-8 teardown reconciliation (Hevy / MacroFactor / TrainingPeaks / Strong).
Written 2026-07-13 by session P34-D. Binding decisions: DEC-06 (raw legacy plan text preserved,
rendered via a reviewed adapter/fallback; no plan discarded or blocked). Additive schema only
(wave rule 6; shared prod Neon DB).

## 1. Current state (what exists on disk today)

- `Plan` row: `id, userId, title, detail (raw text, the document Chad wrote), kind (training|diet),
  status (active|achieved|archived), source, sourceChatId, days (json PlanDay[] | null), createdAt, updatedAt`.
  One active plan per kind (LC-15, enforced in `createPlan`).
- `PlanDay` (lib/validation/plan-days.ts): `{ name, exercises: [{ name, sets:int, reps:string,
  weight?:number|null, unit?:lb|kg, note?:string|null }] }`, 1..7 days, 1..15 exercises/day.
  Exercise names snapped to `lib/workouts/exercise-library.ts` canonical casing at normalize time.
- Legacy shapes in the wild: (a) plans with `days` json (Chad-saved since s134, or AI-backfilled
  via `syncPlanDays`), (b) text-only plans (`days` null) — the Workouts page offers a one-tap AI
  extraction, (c) diet plans (never carry days), (d) `detail` may be empty on user-typed quick plans.
- `Workout` has NO plan linkage today: starting "Day 2" prefills the logger
  (`lib/workouts/plan-prefill.ts` + `sessionFromPlanDay`) but the saved workout does not record
  which plan/session it came from. Adherence/completion is therefore impossible to compute — the
  gap FIX-28 exists to close.
- `Goal` row: single optional outcome (`metric` enum weight|bodyfat|measurement|custom|lift +
  `metricRef`, start/current/target/unit). FIX-29 gap: exactly one outcome max, enum not linked to
  the registered metric vocabulary in `lib/contracts/metrics.ts`.

## 2. Requirements pinned by contracts and the briefing

- ONE structured schedule powers: plan detail page, Up next (P6 FIX-23/30), workout selection
  (logger prefill), completion/adherence (metrics.ts `training.sessions.thisWeek` target kind
  "plan": "Structured training plan sessions/week (FIX-28)").
- DEC-06: every member plan renders; raw `detail` is never modified, discarded, or blocked.
- P34-E adopts the plan schema for plan-exercise references; the join point is the exercise NAME
  (thin), matching the repo idiom of name-snapshot joins (`WorkoutExercise.exerciseName`).
- Visual directive plumbing: session/day granularity, completion EVENTS (timestamped,
  milestone-able), insight-ready (source ids, coverage windows, event timestamps).
- Additive only: no drops/renames/type changes; existing `Plan.days` json keeps working.

## 3. New tables (all additive, PascalCase per repo convention)

### PlanSession — one prescribed session in a plan's schedule

| column | type | notes |
|---|---|---|
| id | uuid pk | stable identity completion events FK to |
| planId | uuid FK Plan | |
| userId | uuid FK User | owner-scoped like every table here |
| position | integer | rotation order, 0-based; unique (planId, position) among active rows |
| name | text | "Day 1: Upper" — the label the member taps |
| weekday | integer null | 0=Sunday..6=Saturday when the plan pins a session to a weekday; null = pure rotation (DEFAULT; teardown question) |
| active | boolean default true | soft removal: re-materialization never deletes rows (completion FKs survive plan edits) |
| sourceHash | text | hash of the source PlanDay json this row was materialized from (staleness guard) |
| createdAt / updatedAt | timestamp | |

### PlanSessionExercise — one exercise prescription in a session

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| planSessionId | uuid FK PlanSession | |
| userId | uuid FK User | |
| position | integer | order within the session |
| exerciseName | text | library-canonical casing; THE join point for P34-E |
| sets | integer | working sets |
| reps | text | "4-6", "AMRAP", "45s" — string on purpose (real programming) |
| weight | double null | prescribed load when named |
| unit | varchar lb\|kg | |
| note | text null | "RPE 8", "3 min rest" |
| createdAt / updatedAt | timestamp | |

(Granularity: per-exercise, matching PlanDay. Per-set prescription is the Hevy model — teardown
will confirm whether we add a per-set detail column NOW or leave it to a later wave. Bias:
per-exercise; our prescriptions are written by Chad as "4 x 8-12", and per-set rows would be
denormalized duplicates with no consumer this wave.)

### PlanSessionCompletion — the completion EVENT stream (adherence + milestones)

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| userId | uuid FK User | |
| planId | uuid FK Plan | denormalized for cheap per-plan queries |
| planSessionId | uuid FK PlanSession | which prescribed session was run |
| workoutId | uuid FK Workout | the logged session that completed it |
| sessionName | text | SNAPSHOT of the session name at completion time (honest history through plan edits, WorkoutExercise idiom) |
| completedDay | timestamp | the member-local day anchor (noon-UTC convention via lib/date.ts) the completion counts toward |
| createdAt | timestamp | the event instant (insight/milestone timestamp) |

### GoalOutcome — a goal linked to N measurable outcomes (FIX-29)

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| goalId | uuid FK Goal | |
| userId | uuid FK User | |
| position | integer | display order; 0 = primary outcome |
| metricId | text null | a REGISTERED MetricId from lib/contracts/metrics.ts (e.g. "body.weight.trend", "training.exercise.e1rm"); null = explicitly unsupported outcome |
| metricRef | text null | the entity the metric refers to (exercise name for e1rm, measurement kind for body.measurement) |
| label | text null | member-facing wording; REQUIRED when metricId is null ("Body fat % — tracked manually") |
| startValue / targetValue | double null | |
| currentValue | double null | manual current for unsupported/manual outcomes only (registered metrics read their source module) |
| unit | text null | |
| createdAt / updatedAt | timestamp | |

Invariant (validation layer, not DB): `metricId != null` XOR (`metricId == null` AND `label != null`).
Runtime zod refine checks `metricId in METRICS`. metrics.ts stays untouched (contract, not mine to edit).

## 4. The adapter (DEC-06) — lib/plans/**

`lib/plans/schedule.ts` exposes ONE accessor: `resolvePlanSchedule(plan, sessions) -> PlanScheduleView`:

1. **structured**: active PlanSession rows exist and match `sourceHash` → typed schedule from tables.
2. **legacy-days**: `Plan.days` json parses (`parsePlanDays`) → same typed schedule, materialization pending.
3. **document**: text-only (or unparseable days) → document view; raw `detail` renders as markdown
   (existing PlanDoc path); the existing one-tap AI extraction remains the upgrade path.
   NO plan is blocked: every branch renders; `detail` is never rewritten.

Materialization (`ensureStructuredPlan`): deterministic days-json → rows (no AI), lazy on first
read, following the established `syncPlanDays` lazy-backfill idiom. Upsert by (planId, position);
rows removed by an edit go `active=false` (completion FKs survive). `sourceHash` guards staleness
after `updatePlanDays` edits.

`lib/plans/up-next.ts`: deterministic next-session selector over (schedule, completions):
first active session by position with no completion in the current rotation cycle; ties and
"all done" resolved by least-recently-completed. Pure, unit-tested; P6 FIX-23 consumes it.

`lib/plans/adherence.ts`: sessions/week target = count of active sessions (schedule is a weekly
rotation, 1..7 days, pinned by plan-days.ts) + completion counting per member-local week
(lib/date.ts helpers). Effective-dated interplay with FIX-07 noted: completions are events,
so historical adherence never rewrites.

`lib/goals/outcomes.ts`: legacy Goal.metric -> outcomes mapping (pure):
- weight → `body.weight.trend` (supported)
- lift → `training.exercise.e1rm` + metricRef (supported)
- measurement → `body.measurement` + metricRef (supported)
- bodyfat → unsupported (no registered metric), label "Body fat %", manual currentValue
- custom → unsupported, label from the goal's own wording
- null → no measurable outcomes (document goal)

`lib/db/plan-queries.ts` (NEW module; queries.ts is P34-C's): CRUD for the four tables +
the joined schedule fetch. Error idiom mirrors queries.ts (ChatbotError wrapping).

## 5. What this wave does NOT do (scope fences)

- No UI rebuild: plan detail renders through the adapter (disclosure line for the page edit);
  Up next / Today composition is P6.
- Diet plans stay documents (MealPlan is already structured elsewhere; nutrition targets are
  P34-C's effective-dated territory).
- No data-rewriting migration: tables start empty and fill lazily/forward.
- No Chad prompt/tool-description changes; savePlan keeps writing `days` json (the adapter
  materializes on read).
- metrics.ts / claims.ts untouched (contracts are law; changes go to the decision log).
