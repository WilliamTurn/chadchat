import { RewardProvider } from "@/components/dashboard/reward";
import { panelSpanClass } from "@/components/panels/panel-frame";
import {
  fixtureMealSliceProps,
  fixturePrimaryGoalProps,
  fixtureTrainingTodayProps,
} from "@/components/today/demo/plans-goals-fixtures";
import {
  fixtureHydrationProps,
  fixtureNutritionProps,
  fixtureSleepProps,
} from "@/components/today/demo/today-panel-fixtures";
import { GoalPrimary } from "@/components/today/goal-primary";
import { PlanMealToday } from "@/components/today/plan-meal-today";
import { PlanTrainingToday } from "@/components/today/plan-training-today";
import {
  NutritionHighlight,
  RecoveryHighlight,
  TrainingHighlight,
} from "@/components/today/progress-highlights";
import {
  hydrationWeekAtGoal,
  nutritionWeekAdherence,
  sleepWeekAtGoal,
} from "@/lib/today/highlights";
import { SLEEP_GOAL_MINUTES } from "@/lib/validation/sleep";
import { volumeSinceLb } from "@/lib/workouts/training-analytics";
import {
  fixtureDayAnchorMs,
  PERSONAS,
} from "@/tests/fixtures/dashboard-states";

/**
 * PLANS-AND-GOALS + PROGRESS-HIGHLIGHTS harness page (P56-E, FIX-30). The
 * REAL shipping summaries (never lookalike demos) rendered for every fixture
 * persona: Training today (empty / fresh plan / mid-rotation / lapsed /
 * trained-today reward / Basic document plan), Meal plan today (empty /
 * next-meal / covered reward / locked), Primary goal (empty / in-progress /
 * multi-outcome / reached reward / Basic outcome-locked), and the three
 * highlight tiles graded through the overview's registered source symbols.
 *
 * The goal VMs run through lib/goals/outcome-values.ts and the meal slices
 * through lib/plans/meal-slice.ts: the same modules the live pages consume.
 */
export default function PlansGoalsFixturePage() {
  return (
    <RewardProvider haptics={false} sound={false}>
      <div className="space-y-10">
        <div className="space-y-3">
          <h1 className="text-page-title">Plans, goals, and highlights</h1>
          <p className="max-w-prose text-body text-muted-foreground">
            FIX-30 Training today, Meal plan today, and Primary goal as typed
            plan/summary panels, plus the Progress-highlight tiles, per
            persona. Summaries reconcile with their authoritative detail; no
            duplicate destinations; missing days stay hollow.
          </p>
        </div>

        {PERSONAS.map((persona) => {
          const locked = persona.tier === "basic";
          const training = fixtureTrainingTodayProps(persona);
          const meal = fixtureMealSliceProps(persona);
          const goal = fixturePrimaryGoalProps(persona);
          const nutrition = fixtureNutritionProps(persona);
          const hydration = fixtureHydrationProps(persona);
          const sleep = fixtureSleepProps(persona);
          // Fixture instants sit at 18:00Z on midnight-UTC day anchors, so
          // the UTC-day floor is the member-local fixture day.
          const workoutDays = new Set(
            persona.workouts.map((w) => {
              const t = new Date(w.performedAt).getTime();
              return t - (t % 86_400_000);
            })
          );
          const week = [3, 2, 1, 0, -1, -2, -3].map((offset) => ({
            t: fixtureDayAnchorMs(offset),
            logged: workoutDays.has(fixtureDayAnchorMs(offset)),
            isToday: offset === 0,
            isFuture: offset < 0,
          }));
          return (
            <section className="space-y-3" key={persona.id}>
              <h2 className="text-section-title">{persona.id}</h2>
              <p className="max-w-prose text-body-sm text-muted-foreground">
                {persona.description}
              </p>
              <div className="grid-dashboard">
                <div className={panelSpanClass("plan")}>
                  <PlanTrainingToday
                    canStartWorkout={!locked}
                    data={training}
                  />
                </div>
                <div className={panelSpanClass("plan")}>
                  <PlanMealToday
                    locked={locked}
                    planTitle={meal.planTitle}
                    slice={meal.slice}
                  />
                </div>
                <div className={panelSpanClass("summary")}>
                  <GoalPrimary data={goal} />
                </div>
                <div className={panelSpanClass("summary")}>
                  <TrainingHighlight
                    data={
                      locked
                        ? null
                        : {
                            sessionsThisWeek: week.filter((d) => d.logged)
                              .length,
                            // The registered source symbol over the fixture
                            // history (UTC = fixture member-local here).
                            volumeWeekLb: volumeSinceLb(
                              persona.workouts,
                              fixtureDayAnchorMs(3),
                              "UTC"
                            ),
                            week,
                            completion: training?.adherence ?? null,
                          }
                    }
                    locked={locked}
                  />
                </div>
                <div className={panelSpanClass("summary")}>
                  <NutritionHighlight
                    locked={locked}
                    summary={
                      locked ? null : nutritionWeekAdherence(nutrition.week)
                    }
                  />
                </div>
                <div className={panelSpanClass("summary")}>
                  <RecoveryHighlight
                    hydration={
                      locked
                        ? null
                        : hydrationWeekAtGoal(
                            hydration.week.map((d) => ({
                              ...d,
                              goalMl: d.goalMl ?? persona.waterGoalMl,
                            }))
                          )
                    }
                    locked={locked}
                    sleep={
                      locked
                        ? null
                        : sleepWeekAtGoal(
                            sleep.week.map((n) => ({
                              ...n,
                              goalMinutes:
                                n.goalMinutes ??
                                persona.sleepGoalMinutes ??
                                SLEEP_GOAL_MINUTES,
                            }))
                          )
                    }
                  />
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </RewardProvider>
  );
}
