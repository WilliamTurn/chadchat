# P56-E design decisions (FIX-30 + Progress highlights)

Session P56-E, 2026-07-14. Decisions a reviewer would ask about, with the
rule or evidence behind each. Benchmarks: `benchmark-teardown.md`; visual
hunt: `visual-hunt.md`.

## 1. The meal-plan "today's day" rule (plans.mealSlice.today)

Meal plans are 1-7 template days with no calendar pinning (the /meal-plan
viewer is a free day switcher). Any "today's day" rule is therefore a
convention; the chosen one is **rotation semantics anchored on the plan's
creation day** (member-local days elapsed since creation, modulo plan
length), because (a) it matches P34-D's training-rotation positional model,
the app's one existing rotation vocabulary; (b) it is deterministic and
advances exactly once per member-local midnight; (c) it works for every plan
length. The alternative (weekday-indexed mapping) only makes sense for
exactly-7-day plans and implies "Day 1 = a fixed weekday", which the plan
documents never promise. The rule is registered in the metric derivation and
stated to the member in the card's reason line (inspectability law).

Meal progression = the day's meals **in plan order**, advanced by
`nutrition.meals.today` (the registered logged-meal count). Slot-matching
against logged meal categories was rejected: logged meals often carry no
category, and a count-based rule is deterministic and safe when data is
missing. Covered state renders explicitly; a next meal is never fabricated.

## 2. The old Workout log card is replaced, not kept

The 03-spec's Plans & Goals section is Training today / Meal plan today /
Primary goal; workout execution enters through Training today's one Start
CTA (T3), and the old card's remaining jobs moved to named destinations:
last-session detail = /workouts#history (linked from the trained-today
state), sessions + volume this week = the Training highlight tile,
week strip = the status strip + consistency matrix (already on the page).
Freestyle members (no plan) keep a Today workout entry: the Training-today
empty state's one action is "Start a workout" -> /workouts.

## 3. Plan management relocated to /plans (new index route)

Unmounting PlanList from /today would have stranded add-plan, past-plans +
reactivate, diet-plan visibility, and the memory-plan hint (PlanList's only
mount). Briefing 3.4: capabilities are relocated, never silently removed
(the DEC-05 pattern). /plans mounts the EXISTING PlanList verbatim;
per-plan edit/delete already live at /plans/[id] (PlanDoc). Registered in
routes.ts (additive); not in any nav group (reached from the Training-today
card's "All plans" link), consistent with /goals/new etc.

## 4. No duplicate destinations (the FIX-30 acceptance line)

Old meal-plan card carried View plan + Open plan (both /meal-plan): the
audit's example. New cards: one named destination per target per card.
Training today: detailLink /plans/{id} + primary /workouts (document plans
flip: primary Open plan /plans/{id}, detailLink All plans /plans). Meal
plan today: ONE destination (Open meal plan), no footer primary. Primary
goal: detailLink /goals/{id}, quiet All goals line -> /goals (different
destinations). Nutrition + Recovery highlight tiles both name /progress
(their categories are overview sections; the only real category routes this
wave are /progress/body and /progress/training): two differently-named
links to the overview, zero within-card duplicates.

## 5. Milestone tile and vs-prior deltas deferred (scope)

03-spec section 4 lists a "Latest milestone/PR" highlight; honest PR events
need full-history replay (B's prEventsByWorkout over uncapped history), and
/today deliberately hydrates only 60 workouts (FIX-41 pressure). Wiring a
capped replay would fabricate PRs. Deferred with a pointer: the Training
tile links to /progress/training, where B's source-linked timeline lives.
Same reasoning for H4 (vs-prior-week deltas): the C assemblers fetch the
current week only; doubling every fetch for a delta line was out of
proportion mid-wave. Both are queued as polish in the completion line.

## 6. Panel roles and states

Training today + Meal plan today = PlanPanel ("the next actionable slice of
a plan, not the document"); Primary goal + highlight tiles = SummaryPanel
(no actions; doorways). My components carry no fetchState prop: they render
from RSC-fetched data under the page Suspense boundary (loading = skeleton,
error = the page boundary), unlike C's panels whose client mutations need
fetch-layer states. Locked states render through the frame's designed
teaser (locked prop), never hidden sections.

## 7. Goal-outcome value resolution extracted to one module

/progress's private buildGoalVM was the only computation of outcome current
values (FIX-29). Copying it would have recreated the DSH-26
two-surfaces-disagree bug the program exists to kill, so it moved verbatim
to lib/goals/outcome-values.ts and both surfaces import it (disclosed edit
to app/progress/page.tsx). One real bug found and fixed during extraction:
the measurement-outcome loop was first-wins over an OLDEST-first query, so
goal outcomes showed the oldest reading while /progress/body headlines the
latest; the shared latestMeasurementsByKind helper fixes both surfaces.

## 8. e1rm depth bound

/today hydrates 60 workouts (pre-existing FIX-41 bound). Goal e1rm current
values canonicalize those 60 through the FIX-34 identity layer (same
resolve options as /progress). The LATEST e1rm value is identical to the
deeper surfaces whenever the exercise appears in the member's last 60
workouts; an exercise absent that long reads "Not logged" here while
/progress (400) may still show a value. Accepted and documented: the
alternative doubles /today's workout fetch for a stale-lift edge case.

## 9. SegmentStrip (rule-9 new primitive)

One new visual primitive, components/charts/segment-strip.tsx: a bounded
step-progression strip (rotation sessions, planned meals, graded days).
Benchmark evidence (2+ pro apps): tremor's Tracker component and
TrainingPeaks' compliance strip (see visual-hunt.md + teardown T4/T5);
hand-built on semantic tokens (done=positive, next=domain accent + reward
glow, missed=critical, unlogged=hollow dashed) with per-segment aria
labels, never color-only. Zero dependencies added.
