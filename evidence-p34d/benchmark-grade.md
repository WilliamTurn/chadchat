# P34-D side-by-side grade: our plan/goal data model vs the ranked references

Rule-8 (FIX-40) grade for FIX-28/FIX-29, 2026-07-13. References and ranking:
`benchmark-teardown.md` (Hevy > Boostcamp > MacroFactor > TrainingPeaks > Strong;
Whoop/Apple for goal modeling). Grade scale per decision: MATCH (indistinguishable
from the reference's design), MATCH+ (exceeds it), DIVERGE (deliberate, reasoned
departure, argued inline).

| # | Design decision | Best reference | Ours | Grade |
|---|---|---|---|---|
| 1 | Prescription granularity | Hevy `RoutineSet`: set-level rows, type enum warmup/normal/failure/dropset, fixed reps XOR rep_range, nullable weight/duration/rpe | `PlanSessionSet`: same shape (position, type enum, reps XOR repRangeStart/End, weight, durationSeconds, rpe), materialized from the coach's per-exercise prescription; the raw reps string is kept at the exercise level as the display form | MATCH |
| 2 | Exercise-level fields | Hevy/Strong: rest_seconds and superset group id live on the EXERCISE, not the set | `PlanSessionExercise.restSeconds` + `supersetGroup` (nullable shared id, Hevy's supersets_id pattern) | MATCH |
| 3 | Exercise identity join | Hevy: `exercise_template_id` FK to a global library | `exerciseName` snapshot in library-canonical casing, resolved through P34-E's FIX-34 identity/alias layer at read time | MATCH (same capability; name-snapshot is this repo's established log-stability idiom, and the alias layer gives Hevy-grade canonicalization without rewriting history) |
| 4 | Scheduling model | Category consensus (Hevy/Strong/Boostcamp/TrainingPeaks-Standard): rotation, never calendar dates; day-of-week only as a hint | `PlanSession.position` rotation + nullable `weekday` hint; no calendar-dated rows; skipped days cost nothing | MATCH |
| 5 | Plan definition vs member progress | TrainingPeaks: template plan vs applied instance (two layers) | No separate plan_instance table: our plans are already per-member (Chad writes each member their own), and the member's position in the rotation is DERIVED from the completion event stream rather than stored as a mutable pointer | DIVERGE, deliberate: an instance table models plan SHARING, which does not exist in this product; deriving up-next from events cannot drift, and adding an instance table later is purely additive if plan sharing ever ships |
| 6 | Completion linkage | Hevy `workout.routine_id`; TrainingPeaks planned-vs-completed pairing | `PlanSessionCompletion` event rows (workoutId + planSessionId + sessionName snapshot + member-local completedDay), unique per workout | MATCH+ (Hevy's back-reference plus TrainingPeaks' explicit pairing, as immutable events that survive plan edits; neither reference survives a plan edit without losing history) |
| 7 | Adherence | Tier 2 frequency ratio (Fitbod/Whoop/Apple); Tier 3 per-session pairing (TrainingPeaks) | `weeklyPlanAdherence` (completed vs rotation size per member-local week) + `sessionCompletionStatuses` (per-session last-done pairing) | MATCH (both proven tiers; TrainingPeaks' tolerance-band coloring is a P5/P6 presentation concern the data already carries) |
| 8 | Up next | Hevy/Strong: none (their biggest hole); Boostcamp: positional pointer | `selectUpNextSession`: deterministic least-recently-completed with position tiebreak + member-facing reason string | MATCH+ vs Hevy/Strong (they have nothing), MATCH vs Boostcamp with better skip behavior (a skipped session is returned to before repeating a done one) |
| 9 | Prefill contract | Hevy: prescription columns from the routine, "previous" column from history (same-routine or any-workout) | Resolved schedule feeds the existing `buildPlanPrefill`/ghost pipeline: prescription as target label + prescribed weight, ghosts from last logged session of the exercise, plan prescription as fallback ghost | MATCH |
| 10 | Goal-outcome linkage | Universal leader pattern: goal = (metric_id, target_value), never freeform (MacroFactor/Whoop/Apple/Fitbod) | `GoalOutcome.metricId` = a REGISTERED MetricId from lib/contracts/metrics.ts, validated at the boundary; N outcomes per goal, ordered | MATCH+ (multi-outcome per goal; MacroFactor and Apple cap at one goal / fixed rings) |
| 11 | Unsupported outcomes | Leaders simply do not allow unmeasurable goals | Explicitly-unsupported outcomes (metricId null + required label + member-maintained currentValue), so a coach-written aspiration is stated honestly instead of rejected or faked | MATCH+ (a coaching product must accept goals the app cannot measure; the model makes the limitation explicit, which no reference does) |
| 12 | Legacy migration | TrainingPeaks/Hevy: n/a (no legacy corpus) | DEC-06 adapter: structured rows, else legacy days json, else raw document; storage failure degrades to the same typed schedule computed in memory; raw text never rewritten; verified over every real member plan (plan-adapter-scan-output.txt: 4/4 render, 0 blocked) | MATCH+ (no reference has to solve this; our solve preserves every member's plan) |
| 13 | Diet programs | MacroFactor: program styles + 7 weekday target rows summing to a weekly budget | NOT BUILT this wave: nutrition targets are P34-C's effective-dated FIX-07 territory (`NutritionTargetVersion`), and MealPlan is already structured; diet Plan documents render via the adapter | DIVERGE, scoping: the MacroFactor program model is the right P7+ reference when coached macro adjustment ships; building it now would fork C's target tables |

## Verdict

Every load-bearing decision is MATCH or MATCH+ against the best shipping
reference; the two DIVERGE rows are scoping calls argued above, not quality
gaps, and both have purely additive upgrade paths. The schema also clears the
wave's forward-carry requirements the references do not have: completion
events are timestamped milestone-able moments (P5/P6 reward visuals), every
number derives from a registered metric or a pure module (one-canonical-value
law), and insight-ready ids/day-anchors ride on every event (FIX-36A).
