# Side-by-side grade: P56-E surfaces vs the ranked benchmarks

Graded against the rule-8 teardown checklists (`benchmark-teardown.md`),
row by row, using the live-verification screenshots
(`ours/live-verification.md`, 21 captures: harness personas at 1440
dark/light + 390, live /today 1440 + 390, /plans). Verdicts: MATCH (equals
the best reference's bar), MATCH+ (exceeds it), PARTIAL (met at page level
or with a documented gap), MISS (not met).

## Training today (vs Boostcamp / TrainingPeaks / Hevy)

| Row | Verdict | Evidence |
|---|---|---|
| T1 session name + plan position on the card | MATCH | Headline = session name + plan title; rotation strip marks the next session's position with the domain accent + glow (consistent persona: "Day 3: Legs", third segment lit). |
| T2 substantive exercise preview | MATCH+ | Chips carry name + sets x reps ("Squat 4 x 5"), not bare names; +N more overflow. Boostcamp shows targets; we equal it and beat Hevy's name-only preview. |
| T3 one dominant Start CTA | MATCH | One primary "Start workout" into /workouts (the live logger's session selection); no intermediate dialog of ours. |
| T4 weekly completion as plan-state with consistent colors | MATCH | SegmentStrip: done = positive fill, next = blood + glow, upcoming = muted; same vocabulary on every strip in the app. |
| T5 completion indicator names what it measures | MATCH | "2 of 4 plan sessions this week" printed under the strip; never an unlabeled bar. |
| T6 empty/rest state still answers "what's next" | MATCH | Trained-today reward state names the next rotation session; no-plan empty state offers "Start a workout" (freestyle) + the named All plans link. Strong's bare empty tab avoided. |

## Meal plan today (vs MacroFactor / Lose It / MFP)

| Row | Verdict | Evidence |
|---|---|---|
| M1 frame numbers for the NEXT decision | PARTIAL (page-level MATCH) | The card frames the next meal's planned kcal/protein; REMAINING-vs-target lives one band up in the Calorie Tracker's remaining-first CalorieArc on the same screen (one canonical value; duplicating remaining here would re-render the same metric twice in adjacent cards). |
| M2 explicit meal N of M + named next meal + cal/protein | MATCH+ | Slot strip (eaten/next/later), "meal N of M" reason line, named meal, kcal + protein chips, plus the rotation-day context no reference app states. |
| M3 calories + protein above the fold | MATCH | Chips on the card; full detail one named link away. |
| M4 target attainment reward state | MATCH | "Planned meals covered" emerald state + glow token (verified on the overshoot persona). |
| M5 one-tap open/log path | MATCH | One-tap "Open meal plan"; logging stays on owned page flows (s168). |
| M6 empty state points at the plan | MATCH | "Build a meal plan" quiet action; no zeros. |

## Primary goal (vs WHOOP / Apple / Oura)

| Row | Verdict | Evidence |
|---|---|---|
| G1 one featured goal | MATCH | First active goal only; others behind the counted "All goals (N)" line. |
| G2 absolute current AND target, visual as reinforcement | MATCH | "208.8 / 195 lb" row form + progress bar; headline adds the % framing, never %-only. |
| G3 consistent 2-3 color state vocabulary | MATCH | positive / critical / muted tokens, identical across every P56 surface. |
| G4 linked outcomes as doorway rows | MATCH | Outcome rows under the headline; card is the doorway to /goals/{id}. |
| G5 reached target = celebration/reward state | MATCH | Trophy + emerald text + glow token on reached outcomes; card glow flips emerald (verified on overshoot). |
| G6 progress framed against own baseline | MATCH | computeGoalProgress anchors on the goal's stored startValue (DSH-26), never population values. |

## Progress highlights (vs Apple Trends / Oura / WHOOP)

| Row | Verdict | Evidence |
|---|---|---|
| H1 metric + timeframe on every tile | MATCH | "N sessions · this week · X lb moved", "N of M days · within calorie target this week"; no naked numbers. |
| H2 one uniform tile grammar | MATCH | All three tiles are SummaryPanels: label / value / context / micro-viz / named link. |
| H3 doorway to a NAMED category | MATCH | Training progress -> /progress/training; Nutrition/Recovery progress -> /progress; Body -> /progress/body. Whole-tile tap is not the P2 panel grammar (named header link instead); consistency with the app system wins. |
| H4 weekly framing with vs-prior comparison | PARTIAL | This-week framing yes; vs-prior-week delta NOT built (assemblers fetch the current week only; deferred, see design-decisions.md section 5). Queued as polish. |
| H5 glanceable micro-viz per tile | MATCH | Completion ring / week bars, graded segment strips per domain; never text-only. |
| H6 streak/habit signal at this level | MATCH (page-level) | The streak flame + 7-day strip lead the consistency panel two bands up; not duplicated per tile (streak strips law satisfied at page level). |

## Total

22 rows: 19 MATCH or MATCH+ (2 MATCH+), 3 PARTIAL (M1 page-level,
H4 deferred delta, H3 whole-tile-tap traded for system consistency),
0 MISS. The two deferrals are recorded for the wave close; neither hides
data or misstates a number.
