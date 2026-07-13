# Structured Plans Data-Model Teardown: Hevy, Strong, TrainingPeaks, MacroFactor, Boostcamp, Whoop, Apple Fitness

Rule-8 (FIX-40) written teardown for P34-D (FIX-28/FIX-29). Research date: 2026-07-13, delegated
research agent, reviewed by P34-D. Sources are public API docs, help-center articles, and
marketing/feature pages. Where a claim is inferred from UI descriptions rather than documented
schemas, it is flagged as inference. The side-by-side grade of OUR schema against this teardown
lives in `benchmark-grade.md`.

---

## 1. Ranking for our surface

Our schema must power four things: a plan detail page, an "Up next" recommendation, workout-logger prefill, and adherence/completion tracking. Ranked usefulness of the references:

| Rank | App | Why |
|---|---|---|
| 1 | **Hevy** | The only training app with a fully public, field-level schema (OpenAPI at api.hevyapp.com/docs). Its `routine -> exercises[] -> sets[]` shape with typed sets, rep ranges, per-exercise rest, and superset grouping is the industry-standard prescription granularity, and its "previous values vs routine values" distinction is exactly the logger-prefill contract we need. Gap: Hevy has no scheduling and no plan-level adherence, so it covers 2 of our 4 needs (plan content + prefill) but not up-next or adherence. |
| 2 | **Boostcamp** | The best consumer model for the parts Hevy lacks: programs structured as weeks x days (rotation, not calendar), a clear "what to do next session" pointer, and reschedule-if-life-happens semantics. No public schema, so all field detail is inferred from UI, but the *concepts* (program -> week -> day -> exercises, progression week over week) map directly to our plan detail page and up-next. |
| 3 | **MacroFactor** | The definitive diet-program reference: program styles (coached/collaborative/manual), per-day-of-week calorie shifting inside a weekly budget, weekly check-in adjustments, and a goal model (target weight + rate as % bodyweight/week + dynamic ETA) that is the cleanest goal-to-metric linkage in the industry. Directly informs our diet-plan tables and our goal schema. |
| 4 | **TrainingPeaks** | The canonical adherence model: planned workout on a date + completed workout + compliance thresholds (green/yellow/red). Its Standard vs Dynamic plan split is also the clearest articulation of rotation-relative vs calendar-absolute scheduling. But it is coach/endurance-oriented and calendar-heavy, which is the wrong default for a consumer lifting app. |
| 5 | **Strong** | Confirms the Hevy pattern (templates in folders, per-exercise rest defaults, prefill from history) but adds nothing Hevy's public schema doesn't already give us with more precision. Useful only as convergent evidence. |
| 6 | **Whoop / Apple Fitness** | Goal-modeling reference only: both prove that leader goals are always numeric targets on registered metrics (never freeform text), evaluated on a fixed cadence (daily rings, weekly plan). |

Bottom line: copy Hevy's prescription schema verbatim at the set level, wrap it in a Boostcamp-style week/day rotation container, borrow TrainingPeaks' planned-vs-completed compliance concept for adherence, and model diet programs and goals on MacroFactor.

---

## 2. Per-app teardown

### 2.1 Hevy (primary training reference)

**Source of truth:** public API, Swagger UI at https://api.hevyapp.com/docs/ ; full OpenAPI spec mirrored at https://github.com/chrisdoc/hevy-mcp/blob/main/openapi-spec.json (raw fetch of that spec is the basis for every field below).

**Hierarchy:** `RoutineFolder -> Routine -> RoutineExercise[] -> RoutineSet[]`, with a parallel `Workout` object for completed history that carries `routine_id` back-references.

**Actual JSON schemas (from the OpenAPI spec):**

`Routine`:
```
id: string
title: string
folder_id: number | null (optional)
created_at, updated_at: ISO 8601 strings
exercises: RoutineExercise[]
```

`RoutineExercise`:
```
index: number                      // ordering within routine
title: string                      // denormalized exercise name
exercise_template_id: string       // FK to global exercise library
supersets_id: number | null        // exercises sharing a value are one superset
rest_seconds: number | null        // rest timer lives at EXERCISE level, not set level
notes: string (optional)
sets: RoutineSet[]
```

`RoutineSet`:
```
index: number
type: enum [warmup, normal, failure, dropset]
weight_kg: number | null           // fixed weight prescription (optional)
reps: number | null                // fixed rep prescription (optional)
rep_range: { start: number|null, end: number|null } | null   // e.g. 8-12; mutually alternative to fixed reps
distance_meters: number | null     // cardio/distance exercises
duration_seconds: number | null    // timed exercises (plank etc.)
rpe: number | null
custom_metric: number | null
```

`RoutineFolder`:
```
id: number
index: number       // manual sort order of folders
title: string
created_at, updated_at
```

`Workout` (completed history):
```
id: string
title: string
routine_id: string        // links completion back to the routine it was started from
description: string (optional)
start_time, end_time: ISO 8601
exercises: same shape as RoutineExercise (with performed sets)
```

Endpoints confirm the model: `GET/POST/PUT /v1/routines`, `GET/POST /v1/routine_folders`, `GET /v1/exercise_templates`, `GET/POST/PUT /v1/workouts` (https://github.com/chrisdoc/hevy-mcp/blob/main/openapi-spec.json).

**Key design facts:**

- **Set types are a first-class enum on the set row** (`warmup | normal | failure | dropset`), documented for users at https://help.hevyapp.com/hc/en-us/articles/34896293707927-Set-Types-in-Hevy-Explained-Drop-Sets-Warm-Up-Sets-and-More . Warmup sets are typically excluded from volume/PR stats (help article; inference on exact exclusion rules).
- **Rep prescriptions are either fixed `reps` OR a `rep_range {start, end}`**, both nullable, on the same set object. Weight is a nullable `weight_kg`. So a routine set can prescribe: nothing (just "3 sets"), reps only, reps + weight, or a rep range (spec fields above; user-facing description at https://www.hevyapp.com/features/exercise-programming-options/).
- **Rest timers live at the exercise level** (`rest_seconds` on `RoutineExercise`), one value per exercise, not per set (OpenAPI spec).
- **Supersets are modeled by a shared nullable group id** (`supersets_id`) on sibling exercises, not by a nesting container (OpenAPI spec).
- **"Programs" are just routine folders.** A PPL program = a folder titled "PPL" containing Push/Pull/Legs routines with a manual sort `index`. There is no week/day/rotation structure and no schedule in the schema (OpenAPI spec; folder UX at https://www.hevyapp.com/features/gym-routines/).
- **Start-workout prefill:** starting a routine opens a logger pre-populated with the routine's exercises/sets; the weight/reps columns show the routine's prescribed values, and a separate "previous" column shows what you actually did last time. A setting controls whether "previous" is pulled from the last time you did the exercise in *any* workout or the last time in the *same routine* (https://help.hevyapp.com/hc/en-us/articles/34105442929943-Previous-Workout-Values-Vs-Routine-Values-How-to-Adjust-in-Settings ; https://help.hevyapp.com/hc/en-us/articles/36011896355479-How-to-Use-Previous-Workout-Values-to-Improve-Performance-in-Hevy). Prefill logic therefore needs the tuple (exercise_template_id, routine_id, set index) to resolve "previous".
- **Completion links back via `workout.routine_id`** (OpenAPI spec). History is queried per exercise for charts and per routine for "previous values in same routine".
- **PRs are auto-detected metrics, not user goals:** heaviest weight, best estimated 1RM, best set volume (weight x reps), best session volume, most reps, best duration; detected live when a set is checked complete (https://help.hevyapp.com/hc/en-us/articles/35649367857175-Personal-Records-PRs-and-Set-Records-Explained-How-They-Work-in-the-Hevy-App ; https://help.hevyapp.com/hc/en-us/articles/38279531346455-Set-Records-vs-Personal-Records ; https://www.hevyapp.com/features/live-pr/).
- **Adherence in Hevy is only a weekly streak:** consecutive weeks with at least one logged workout, shown on a calendar (https://help.hevyapp.com/hc/en-us/articles/35380117933207-Track-Your-Workout-Consistency-with-the-Calendar-and-Streak-Features). There is no plan-vs-actual compliance because there is no plan schedule.

### 2.2 Strong (secondary training reference)

No public API. Evidence is help-center articles.

- **Template = a routine:** "a starting point for a workout" that "does not correspond to an actual workout that you performed"; you add exercises and sets to it exactly as you would in a live workout (https://help.strongapp.io/article/105-about-templates). Free tier caps templates at 3; PRO is unlimited (same article).
- **Folders group templates into de-facto programs** (e.g. a PPL folder), same pattern as Hevy (https://help.strongapp.io/article/105-about-templates).
- **Rest timer defaults to 2:00 per exercise, customizable per exercise via the exercise menu, and is not editable inside a template** (https://help.strongapp.io/article/231-rest-timer). So Strong also keys rest to the exercise, not the set.
- **Logger prefill:** performing a workout from a template lists exercises with sets under each; you log weight and reps against them and add sets ad hoc (https://help.strongapp.io/article/229-my-first-workout).
- **No scheduling, no rotation, no adherence model** beyond history and PRs (inference from the absence of any such feature in the help center and store listings, https://www.strong.app/). Strong's takeaway for us: it independently converges on the same folder/template/exercise/set + exercise-level rest + history-prefill design as Hevy, which strengthens the case for that shape as the category standard.

### 2.3 TrainingPeaks (structured plans reference)

Evidence: help-center articles for coaches and athletes.

- **Two plan types.** A **Standard Training Plan** is built on "generalized days (not associated with a specific date) organized by default into numbered weeks", i.e. a relative Week N / Day N structure. A **Dynamic Training Plan** is built on a live calendar with real dates that push to all subscribed athletes (https://help.trainingpeaks.com/hc/en-us/articles/204072514-How-to-create-a-new-Training-Plan-Coaches-only ; https://help.trainingpeaks.com/hc/en-us/articles/204072414-Dynamic-Training-Plans).
- **Applying a plan materializes it onto dates.** The athlete/coach applies a standard plan "starting or ending on a particular date" and TrainingPeaks "will automatically adjust the plan's workouts to match your selected date" (https://help.trainingpeaks.com/hc/en-us/articles/204072574-How-to-apply-a-Training-Plan-to-your-Athlete-s). So the master plan is relative (week/day), and application is a copy onto concrete calendar dates. This two-layer model (template plan vs applied instance) is the key TrainingPeaks concept.
- **Planned vs completed is the core record pair.** Each calendar workout carries planned values (duration, distance, TSS) and, after sync/logging, completed values; the Workout Card colorizes by compliance (https://help.trainingpeaks.com/hc/en-us/articles/204861204-Workout-Card-Overview).
- **Compliance coloring thresholds** (as summarized by BaseCamp, which runs on TrainingPeaks): green = completed within about +/-20% of planned value; yellow = roughly 50-79% or 121-150% of planned; orange = more than 50% off; red = planned workout not completed at all; grey = unplanned workout (completed with no plan) (https://www.joinbasecamp.com/support/compliancecolors ; https://help.trainingpeaks.com/hc/en-us/articles/204861204-Workout-Card-Overview). Compliance is computed against ONE primary metric per workout (duration, distance, or TSS), and the indicator shows which one (same sources).
- **Skipped days:** a planned workout with no completed pairing simply stays on its date and shows red. Dynamic plan workouts only propagate to current/future dates, never past ones (https://help.trainingpeaks.com/hc/en-us/articles/204072414-Dynamic-Training-Plans). Athletes can manually move/swap sessions on the calendar (https://www.trainingpeaks.com/learn/trainingpeaks-athlete-user-guide/ ; inference from described drag-and-drop UX).

### 2.4 MacroFactor (diet program reference)

Evidence: help center (help.macrofactorapp.com) and macrofactor.com feature pages.

**Program object.** A "macro program" is created under Strategy -> New Program, choosing one of three **program styles** (https://help.macrofactorapp.com/en/articles/242-create-a-new-macro-program ; https://help.macrofactorapp.com/en/articles/91-program-styles):

- **Coached:** app sets and adjusts everything weekly "based on your goals, your energy intake, and your changes in trend weight"; includes safety guardrails (calorie floor, fat minimums).
- **Collaborative:** app manages the weekly calorie budget; user distributes it into their own day-to-day calorie and macro targets, explicitly supporting "drastically different calorie targets day-to-day" (fasting days, social days). Guardrails are relaxed.
- **Manual:** user sets all daily calorie/macro targets; app makes no adjustments; no weekly budget is assigned.
Switching styles preserves history and does not reset goals (https://help.macrofactorapp.com/en/articles/91-program-styles).

**Coached-mode program fields** (https://help.macrofactorapp.com/en/articles/34-what-are-the-different-program-options-in-coached-mode):
- **Diet structure:** enum balanced | low_fat | low_carb | keto (low-carb caps carbs around 30% of calories or under ~200 g; keto is ketosis-compatible).
- **Calorie floor:** enum standard (1,200 kcal/day) | low | none.
- **Training type** (drives protein recommendation): lifting | cardio | both | none.
- **Calorie shifting:** enum even (identical targets all 7 days) | shift (reallocate calories to chosen days while keeping the weekly budget constant). This is MacroFactor's training-day/rest-day and weekend-flex mechanism: per-day-of-week multipliers over a fixed weekly budget.
- **Protein level:** low | moderate | high | extra high.

**Resulting daily targets:** each day of the week gets a calories + protein/carb/fat target row; the invariant is that the 7 daily calorie targets sum to the weekly budget (coached/collaborative) (https://help.macrofactorapp.com/en/articles/91-program-styles ; https://help.macrofactorapp.com/en/articles/34-what-are-the-different-program-options-in-coached-mode).

**Weekly check-in adjustment loop** (https://help.macrofactorapp.com/en/articles/222-how-does-macrofactor-make-adjustments-for-a-weight-gain-or-weight-loss-goal ; https://help.macrofactorapp.com/en/articles/247-introduction-to-check-ins-and-coaching-modules):
- Cadence: weekly, on a user-chosen check-in day.
- Inputs: (1) continuously recalculated **expenditure** (TDEE) derived from logged intake vs weight trajectory, (2) **trend weight** (smoothed, not daily scale weight), (3) the goal's **target rate of weight change**.
- Output: a new weekly calorie budget and new daily calorie/macro targets (protein tracks lean mass; carbs/fat split per diet structure), with a smoothing layer so targets do not whipsaw.
- Notably, adjustments respond to expenditure changes and the goal rate, not to "did you hit your targets", i.e. the algorithm is not punitive (same article).

**Goal object** (https://help.macrofactorapp.com/en/articles/90-set-a-new-goal ; https://macrofactor.com/goal-features/):
- `goal_type`: lose | maintain | gain.
- `target_weight`: number (absent for maintain).
- `target_rate`: percent of body weight per week, chosen on a slider with a recommended "green range" (documented cut range roughly 0.10% to 1.5% BW/week depending on body composition) (https://macrofactor.com/goal-features/ ; https://help.macrofactorapp.com/en/articles/202-what-should-i-do-if-i-m-pursuing-a-goal-with-a-strict-timeline).
- Derived **dynamic ETA**: projected goal-completion date recomputed from trend-weight progress; users chasing a deadline adjust `target_rate` until ETA lands before the deadline (https://help.macrofactorapp.com/en/articles/202-what-should-i-do-if-i-m-pursuing-a-goal-with-a-strict-timeline).
- Goal and program are separate objects: changing the goal takes effect on the program "following your next check-in", or immediately if you create a new program (https://help.macrofactorapp.com/en/articles/90-set-a-new-goal).

### 2.5 Boostcamp (rotation-based program reference)

No public schema; all inference from the product site and program pages.

- Programs are authored as a fixed duration (e.g. 12 weeks) with N training days per week (3-6); each day is a named session ("Day 1: Upper") listing exercises with sets, reps, and rest times (https://www.boostcamp.app/ ; example program pages such as https://www.boostcamp.app/coaches/bill-wong/4-day-upper-lower-program-moderate-volume). This is a **Week x Day rotation grid**, not a calendar.
- Auto-progression fills next session's weights from what you logged, "so you always know exactly what to do next session" (https://www.boostcamp.app/).
- Missed days: "the app lets you reschedule sessions if your week doesn't go to plan" (https://www.boostcamp.app/blogs/creating-the-perfect-workout-program ; UI-level claim, inference on mechanics). The next-up pointer is positional (your place in the week/day grid advances only when you complete a session), not date-driven (inference from the rotation structure and rescheduling language).

### 2.6 Goals linked to outcomes across leaders

- **MacroFactor:** goal = numeric target weight + numeric rate (% BW/week) on the registered trend-weight metric, with derived ETA; the diet program is generated from and re-aligned to the goal weekly (sections above; https://macrofactor.com/goal-features/).
- **Hevy / Strong:** no user-declared goals; "progress" is auto-detected PRs over registered per-exercise metrics (heaviest weight, est. 1RM, set volume, session volume, reps, duration) (https://help.hevyapp.com/hc/en-us/articles/35649367857175). The lesson: even without goal-setting UI, the metrics are registered and computed in one place so records can be detected live at set completion.
- **Apple Fitness:** three daily numeric goals on fixed metrics (Move = active kcal, Exercise = minutes, Stand = hours), user-adjustable, and schedulable **per day of week** (https://support.apple.com/guide/iphone/adjust-your-activity-ring-goals-iph9a08e004e/ios ; https://www.apple.com/watch/close-your-rings/). Completion is binary per ring per day; streaks derive from it.
- **Whoop:** "Weekly Plan" sets personalized numeric weekly targets on registered metrics/behaviors (sleep, strain, steps e.g. 7,000 vs 10,000), calibrated from a 30-day baseline, evaluated weekly (https://www.whoop.com/us/en/thelocker/set-and-reach-your-goals-with-weekly-plan/ ; https://support.whoop.com/s/article/Weekly-Plan).
- **Fitbod:** a user-set "Weekly Workout Goal" (days per week) drives streaks and previews (https://help.fitbod.me/hc/en-us/articles/360013245993-Weekly-Workout-Goal-Previews-Streaks).

**Universal pattern: a goal is always (metric_id, comparator, target_value, cadence), never freeform text.** Freeform aspirations, where they exist at all, are decoration on top of a numeric target.

---

## 3. Cross-cutting findings

### 3.1 Calendar dates vs repeating rotations

- **Rotation (day 1..N or grid of Week x Day): Hevy (folder of routines, fully unordered beyond folder index), Strong (same), Boostcamp (Week x Day grid), TrainingPeaks Standard plans (numbered weeks with generalized days).** Sources in section 2.
- **Calendar dates: TrainingPeaks applied/dynamic plans (every planned session sits on a real date)** (https://help.trainingpeaks.com/hc/en-us/articles/204072414-Dynamic-Training-Plans).
- **Day-of-week: MacroFactor daily targets and Apple ring goals vary by weekday** (https://help.macrofactorapp.com/en/articles/34-what-are-the-different-program-options-in-coached-mode ; https://support.apple.com/guide/iphone/adjust-your-activity-ring-goals-iph9a08e004e/ios).
- **Skipped days:** rotation apps simply do not advance (Hevy/Strong have no concept of "missed"; Boostcamp lets you reschedule within the week). Calendar apps mark the dated session red/incomplete and leave it in place (TrainingPeaks) (https://www.joinbasecamp.com/support/compliancecolors). The consumer-lifting consensus is strongly rotation: a missed Tuesday means Push day happens Wednesday, with zero data model consequence.

### 3.2 Adherence/completion computation

Three tiers observed:
1. **None (Hevy/Strong):** only a weekly streak = "at least one workout logged this week" (https://help.hevyapp.com/hc/en-us/articles/35380117933207).
2. **Frequency vs target (Fitbod, Whoop, Apple):** sessions done this week / weekly goal, or metric achieved / daily target; binary or ratio, evaluated per day or per week (https://help.fitbod.me/hc/en-us/articles/360013245993 ; https://support.whoop.com/s/article/Weekly-Plan ; https://support.apple.com/guide/iphone/adjust-your-activity-ring-goals-iph9a08e004e/ios).
3. **Planned-vs-completed pairing with tolerance bands (TrainingPeaks):** each planned session either has a paired completion (compare one primary metric, bucket into green/yellow/orange) or none (red); unplanned completions are grey (https://www.joinbasecamp.com/support/compliancecolors). This requires an explicit link row between the planned session and the completion event; TrainingPeaks pairs by date + auto-matching, Hevy's analog is `workout.routine_id`.

### 3.3 "Up next"

- **Hevy/Strong: no up-next.** The user opens the folder and picks a routine; the app's only assistance is showing previous values once inside (section 2.1/2.2). This is the biggest UX hole in the category leaders and the place a coach-led product can beat them.
- **Boostcamp: positional pointer.** Next = the first uncompleted day in the current week of the program grid; completing a session advances the pointer; weeks advance when their days are done (inference from program structure and "know exactly what to do next session" claims, https://www.boostcamp.app/).
- **TrainingPeaks: today's date.** Next = whatever is on the calendar today/next (https://www.trainingpeaks.com/learn/trainingpeaks-athlete-user-guide/).
- **MacroFactor: trivially "today"** because diet targets attach to every calendar day via day-of-week rules (section 2.4).

---

## 4. Recommendations for our schema

### 4.1 Scheduling model: rotation-first, with day-of-week hints, not calendar dates

Adopt the Boostcamp/TrainingPeaks-Standard shape: `plan -> plan_weeks (optional) -> plan_days (ordered) -> plan_day_exercises -> plan_day_sets`. A `plan_day` has `position` (1..N) and an optional `suggested_weekday` (nullable int). Do NOT materialize sessions onto calendar dates: every consumer lifting leader is rotation-based, skipped days then cost nothing, and "up next" is a pointer (`plan_instance.current_day_position`, advanced on completion) rather than a query over overdue dated rows. Keep a `plan_instance` (user_id, plan_id, started_at, current position) separate from the plan definition, mirroring TrainingPeaks' template-vs-applied split, so plans are editable/shareable without touching user progress (sections 2.3, 2.5, 3.1, 3.3).

### 4.2 Prescription granularity: set-level, copying Hevy's field names

Model prescriptions at the SET level exactly like Hevy's `RoutineSet`: `index`, `type enum('warmup','normal','failure','dropset')`, nullable `weight_kg`, nullable `reps`, nullable `rep_range_start`/`rep_range_end`, nullable `duration_seconds`, `distance_meters`, `rpe`. Put `rest_seconds`, `notes`, `superset_group_id` (nullable shared id, Hevy's `supersets_id` pattern), and `exercise_template_id` at the EXERCISE level. Both Hevy and Strong key rest to the exercise, and Hevy's nullable-everything set row cleanly expresses every prescription style from "3 sets" to "3x8-12 @ RPE 8" (section 2.1). Exercise-level-only prescriptions ("3x10" as a single row) cannot represent warmups, dropsets, or ramped top sets and would need migration later; go set-level now.

### 4.3 Completion-event modeling and adherence

Keep completed workouts as separate immutable events (`workout` with `started_at`, `finished_at`, performed exercises/sets) carrying a nullable `plan_instance_id` + `plan_day_id` back-reference, the generalization of Hevy's `workout.routine_id` (section 2.1). Adherence then has three cheap, proven derivations: (a) Hevy-style weekly streak (any workout this week), (b) Fitbod-style frequency ratio (workouts this week / plan days per week), and (c) TrainingPeaks-style per-session compliance (planned day has a linked completion or not; optionally bucket by % of prescribed sets completed, the lifting analog of TrainingPeaks' +/-20% duration bands) (sections 2.3, 3.2). Prefill contract: when starting a plan day, prescription columns come from `plan_day_sets`, and a "previous" column resolves per (exercise_template_id, plan_day_id, set index) with fallback to any workout, matching Hevy's same-routine/any-workout setting (section 2.1).

### 4.4 Diet-plan targets and goals

Model the diet program as MacroFactor does: a `macro_program` row with `style enum('coached','collaborative','manual')`, `diet_structure enum('balanced','low_fat','low_carb','keto')`, `calorie_floor`, `protein_level`, plus exactly SEVEN child rows (`program_day_targets`: weekday 0-6, calories, protein_g, carbs_g, fat_g) whose calories sum to a `weekly_budget`. That one weekday-keyed child table natively expresses training-day/rest-day shifting ("even" is just seven equal rows) (section 2.4). Adjustments are new program versions written at a weekly check-in, keyed to (expenditure estimate, trend weight, goal rate), never in-place mutations, preserving history like MacroFactor does. Goals are a separate table from programs: `goal(goal_type enum('lose','maintain','gain'), target_weight, target_rate_pct_bw_per_week, derived eta_date)`, plus training goals as `(metric_id, target_value, cadence)` rows following the universal leaders' pattern (MacroFactor, Apple, Whoop, Fitbod); never store a goal as freeform text (sections 2.4, 2.6). This also satisfies the project's one-canonical-value law: every adherence number, ETA, and PR is a registered metric computed in one module.

---

### Source index

- Hevy OpenAPI spec (mirror): https://github.com/chrisdoc/hevy-mcp/blob/main/openapi-spec.json (live Swagger: https://api.hevyapp.com/docs/)
- Hevy set types: https://help.hevyapp.com/hc/en-us/articles/34896293707927
- Hevy previous vs routine values: https://help.hevyapp.com/hc/en-us/articles/34105442929943 and https://help.hevyapp.com/hc/en-us/articles/36011896355479
- Hevy routines/folders: https://www.hevyapp.com/features/gym-routines/ ; programming options: https://www.hevyapp.com/features/exercise-programming-options/
- Hevy PRs: https://help.hevyapp.com/hc/en-us/articles/35649367857175 ; https://help.hevyapp.com/hc/en-us/articles/38279531346455 ; https://www.hevyapp.com/features/live-pr/
- Hevy streaks/calendar: https://help.hevyapp.com/hc/en-us/articles/35380117933207
- Strong templates: https://help.strongapp.io/article/105-about-templates ; rest timer: https://help.strongapp.io/article/231-rest-timer ; performing a workout: https://help.strongapp.io/article/229-my-first-workout
- TrainingPeaks create plan (Standard vs Dynamic): https://help.trainingpeaks.com/hc/en-us/articles/204072514 ; dynamic plans: https://help.trainingpeaks.com/hc/en-us/articles/204072414 ; apply plan: https://help.trainingpeaks.com/hc/en-us/articles/204072574 ; workout card: https://help.trainingpeaks.com/hc/en-us/articles/204861204 ; compliance colors: https://www.joinbasecamp.com/support/compliancecolors ; athlete guide: https://www.trainingpeaks.com/learn/trainingpeaks-athlete-user-guide/
- MacroFactor program styles: https://help.macrofactorapp.com/en/articles/91-program-styles ; coached options: https://help.macrofactorapp.com/en/articles/34-what-are-the-different-program-options-in-coached-mode ; create program: https://help.macrofactorapp.com/en/articles/242-create-a-new-macro-program ; set goal: https://help.macrofactorapp.com/en/articles/90-set-a-new-goal ; adjustments: https://help.macrofactorapp.com/en/articles/222-how-does-macrofactor-make-adjustments-for-a-weight-gain-or-weight-loss-goal ; check-ins: https://help.macrofactorapp.com/en/articles/247-introduction-to-check-ins-and-coaching-modules ; goal features: https://macrofactor.com/goal-features/ ; strict timeline/ETA: https://help.macrofactorapp.com/en/articles/202-what-should-i-do-if-i-m-pursuing-a-goal-with-a-strict-timeline
- Boostcamp: https://www.boostcamp.app/ ; https://www.boostcamp.app/coaches/bill-wong/4-day-upper-lower-program-moderate-volume ; https://www.boostcamp.app/blogs/creating-the-perfect-workout-program
- Apple ring goals: https://support.apple.com/guide/iphone/adjust-your-activity-ring-goals-iph9a08e004e/ios ; https://www.apple.com/watch/close-your-rings/
- Whoop Weekly Plan: https://www.whoop.com/us/en/thelocker/set-and-reach-your-goals-with-weekly-plan/ ; https://support.whoop.com/s/article/Weekly-Plan
- Fitbod weekly goal/streaks: https://help.fitbod.me/hc/en-us/articles/360013245993
