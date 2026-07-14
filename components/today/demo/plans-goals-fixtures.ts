import type { Goal, GoalOutcome } from "@/lib/db/schema";
import { buildGoalVM } from "@/lib/goals/outcome-values";
import { type MealSliceToday, mealSliceToday } from "@/lib/plans/meal-slice";
import type { PlanScheduleSession } from "@/lib/plans/schedule";
import type {
  PrimaryGoalData,
  TrainingTodayData,
} from "@/lib/today/plans-goals-data";
import type { PlanDays } from "@/lib/validation/meal-plan";
import {
  fixtureDayAnchorMs,
  type Persona,
} from "@/tests/fixtures/dashboard-states";

/**
 * FIXTURE ADAPTERS for the P56-E plans-and-goals summaries (FIX-30): map the
 * six deterministic personas onto the exact prop shapes the REAL components
 * take (never lookalike demos). The goal VMs run through the SAME
 * lib/goals/outcome-values.ts builder the live pages use, and the meal slice
 * runs through the SAME registered lib/plans/meal-slice.ts metric source, so
 * the harness exercises the real computation paths. All day math is anchored
 * to the fixture week (today = Wed 2026-07-08, America/Chicago).
 */

/* ------------------------------------------------------------- training */

function session(
  position: number,
  name: string,
  exercises: { name: string; sets: number; reps: string }[]
): PlanScheduleSession {
  return {
    id: `fixture-session-${position}`,
    position,
    name,
    weekday: null,
    exercises: exercises.map((e) => ({
      name: e.name,
      sets: e.sets,
      reps: e.reps,
      weight: null,
      unit: "lb" as const,
      note: null,
      restSeconds: null,
      supersetGroup: null,
      setPrescriptions: [],
    })),
  };
}

const PPL_SESSIONS: PlanScheduleSession[] = [
  session(0, "Day 1: Push", [
    { name: "Bench Press", sets: 4, reps: "5" },
    { name: "Overhead Press", sets: 3, reps: "8" },
    { name: "Incline Dumbbell Press", sets: 3, reps: "10" },
    { name: "Triceps Pushdown", sets: 3, reps: "12" },
    { name: "Lateral Raise", sets: 3, reps: "15" },
  ]),
  session(1, "Day 2: Pull", [
    { name: "Deadlift", sets: 3, reps: "5" },
    { name: "Barbell Row", sets: 4, reps: "8" },
    { name: "Lat Pulldown", sets: 3, reps: "10" },
    { name: "Face Pull", sets: 3, reps: "15" },
  ]),
  session(2, "Day 3: Legs", [
    { name: "Squat", sets: 4, reps: "5" },
    { name: "Romanian Deadlift", sets: 3, reps: "8" },
    { name: "Leg Press", sets: 3, reps: "10" },
    { name: "Calf Raise", sets: 4, reps: "12" },
  ]),
  session(3, "Day 4: Upper", [
    { name: "Bench Press", sets: 3, reps: "8" },
    { name: "Barbell Row", sets: 3, reps: "8" },
    { name: "Overhead Press", sets: 2, reps: "10" },
  ]),
];

export function fixtureTrainingTodayProps(
  persona: Persona
): TrainingTodayData | null {
  switch (persona.id) {
    case "first-run":
      return null;
    case "sparse":
      // A plan adopted yesterday, nothing completed yet: the verdict is the
      // first session of the rotation.
      return {
        planId: "fixture-plan-sparse",
        planTitle: "Beginner Full Body",
        kind: "structured",
        verdict: {
          session: PPL_SESSIONS[0],
          reason: "The first session of your rotation.",
        },
        trainedToday: false,
        completedTodayName: null,
        rotation: PPL_SESSIONS.slice(0, 3).map((s) => ({
          name: s.name,
          completedThisWeek: false,
        })),
        adherence: { completedThisWeek: 0, plannedPerWeek: 3 },
        completions: [],
      };
    case "consistent":
      // Mid-week on a 4-day rotation: two sessions down, Legs is next.
      return {
        planId: "fixture-plan-consistent",
        planTitle: "PPL + Upper",
        kind: "structured",
        verdict: {
          session: PPL_SESSIONS[2],
          reason: "Your least recent session in the rotation.",
        },
        trainedToday: false,
        completedTodayName: null,
        rotation: PPL_SESSIONS.map((s, i) => ({
          name: s.name,
          completedThisWeek: i < 2,
        })),
        adherence: { completedThisWeek: 2, plannedPerWeek: 4 },
        completions: [
          { planSessionId: "fixture-session-0", completedDayMs: fixtureDayAnchorMs(2) },
          { planSessionId: "fixture-session-1", completedDayMs: fixtureDayAnchorMs(1) },
        ],
      };
    case "lapsed":
      // The plan survives a lapse: nothing this week, the rotation waits.
      return {
        planId: "fixture-plan-lapsed",
        planTitle: "PPL + Upper",
        kind: "structured",
        verdict: {
          session: PPL_SESSIONS[1],
          reason: "Your least recent session in the rotation.",
        },
        trainedToday: false,
        completedTodayName: null,
        rotation: PPL_SESSIONS.map((s) => ({
          name: s.name,
          completedThisWeek: false,
        })),
        adherence: { completedThisWeek: 0, plannedPerWeek: 4 },
        completions: [
          { planSessionId: "fixture-session-0", completedDayMs: fixtureDayAnchorMs(12) },
        ],
      };
    case "overshoot":
      // Trained today: the reward state, still answering "what's next".
      return {
        planId: "fixture-plan-overshoot",
        planTitle: "PPL + Upper",
        kind: "structured",
        verdict: {
          session: PPL_SESSIONS[3],
          reason: "Your least recent session in the rotation.",
        },
        trainedToday: true,
        completedTodayName: "Day 3: Legs",
        rotation: PPL_SESSIONS.map((s, i) => ({
          name: s.name,
          completedThisWeek: i <= 2,
        })),
        adherence: { completedThisWeek: 3, plannedPerWeek: 4 },
        completions: [
          { planSessionId: "fixture-session-2", completedDayMs: fixtureDayAnchorMs(0) },
        ],
      };
    case "locked-basic":
      // Plans are a member capability: a Basic member's document plan still
      // summarizes and opens; only the Start CTA is withheld (page passes
      // canStartWorkout=false).
      return {
        planId: "fixture-plan-basic",
        planTitle: "Coach starter plan",
        kind: "document",
        verdict: null,
        trainedToday: false,
        completedTodayName: null,
        rotation: [],
        adherence: null,
        completions: [],
      };
    default:
      return null;
  }
}

/* ------------------------------------------------------------ meal slice */

function fixtureMeal(
  slot: "breakfast" | "lunch" | "dinner" | "snack",
  title: string,
  calories: number,
  protein: number
) {
  return {
    slot,
    title,
    foods: [
      {
        name: title,
        grams: 300,
        calories,
        protein,
        carbs: Math.round((calories * 0.4) / 4),
        fat: Math.round((calories * 0.25) / 9),
        fdcId: null,
        fdcDescription: null,
        per100g: null,
      },
    ],
    totals: {
      calories,
      protein,
      carbs: Math.round((calories * 0.4) / 4),
      fat: Math.round((calories * 0.25) / 9),
    },
  };
}

const FIXTURE_PLAN_DAYS: PlanDays = [
  {
    label: "Day 1",
    meals: [
      fixtureMeal("breakfast", "Oats, whey & berries", 520, 42),
      fixtureMeal("lunch", "Chicken rice bowl", 640, 51),
      fixtureMeal("dinner", "Salmon & potatoes", 700, 45),
      fixtureMeal("snack", "Greek yogurt & almonds", 340, 28),
    ],
    totals: { calories: 2200, protein: 166, carbs: 220, fat: 61 },
  },
  {
    label: "Day 2",
    meals: [
      fixtureMeal("breakfast", "Egg scramble & toast", 480, 38),
      fixtureMeal("lunch", "Turkey wrap & fruit", 600, 48),
      fixtureMeal("dinner", "Lean beef chili", 760, 52),
      fixtureMeal("snack", "Cottage cheese bowl", 360, 30),
    ],
    totals: { calories: 2200, protein: 168, carbs: 215, fat: 62 },
  },
  {
    label: "Day 3",
    meals: [
      fixtureMeal("breakfast", "Protein pancakes", 540, 40),
      fixtureMeal("lunch", "Tuna pasta salad", 620, 47),
      fixtureMeal("dinner", "Chicken stir-fry", 700, 50),
      fixtureMeal("snack", "Casein shake", 340, 35),
    ],
    totals: { calories: 2200, protein: 172, carbs: 218, fat: 58 },
  },
];

export function fixtureMealSliceProps(persona: Persona): {
  slice: MealSliceToday | null;
  planTitle: string | null;
} {
  const slice = (mealsLoggedToday: number, planStartDaysAgo: number) =>
    mealSliceToday({
      days: FIXTURE_PLAN_DAYS,
      planStartDayMs: fixtureDayAnchorMs(planStartDaysAgo),
      todayDayMs: fixtureDayAnchorMs(0),
      mealsLoggedToday,
    });
  switch (persona.id) {
    case "first-run":
      return { slice: null, planTitle: null };
    case "sparse":
      // Plan adopted yesterday, nothing logged today: first meal of Day 2.
      return { slice: slice(0, 1), planTitle: "2,200 cal cut" };
    case "consistent":
      // Two meals down mid-rotation: meal 3 of 4 is next.
      return { slice: slice(2, 7), planTitle: "2,200 cal cut" };
    case "lapsed":
      return { slice: slice(0, 16), planTitle: "2,200 cal cut" };
    case "overshoot":
      // Every planned meal covered: the completed reward state.
      return { slice: slice(4, 9), planTitle: "2,200 cal cut" };
    case "locked-basic":
      return { slice: null, planTitle: null };
    default:
      return { slice: null, planTitle: null };
  }
}

/* ---------------------------------------------------------- primary goal */

function fixtureGoalRow(
  persona: Persona,
  overrides: Partial<Goal> = {}
): Goal {
  const g = persona.goal;
  return {
    id: `fixture-goal-${persona.id}`,
    userId: "fixture-user",
    title: g?.title ?? "Get to 200 lb",
    detail: null,
    targetDate: null,
    status: "active",
    metric: g?.metric ?? "weight",
    metricRef: null,
    startValue: g?.startValue ?? 220,
    currentValue: null,
    targetValue: g?.targetValue ?? 200,
    unit: g?.unit ?? "lb",
    createdAt: new Date(fixtureDayAnchorMs(30)),
    updatedAt: new Date(fixtureDayAnchorMs(1)),
    ...overrides,
  } as Goal;
}

function e1rmOutcomeRow(goalId: string): GoalOutcome {
  return {
    id: `${goalId}-outcome-bench`,
    goalId,
    position: 1,
    metricId: "training.exercise.e1rm",
    metricRef: "Bench Press",
    label: null,
    startValue: 205,
    targetValue: 245,
    currentValue: null,
    unit: "lb",
    createdAt: new Date(fixtureDayAnchorMs(30)),
  } as GoalOutcome;
}

function weightOutcomeRow(
  goalId: string,
  startValue: number,
  targetValue: number
): GoalOutcome {
  return {
    id: `${goalId}-outcome-weight`,
    goalId,
    position: 0,
    metricId: "body.weight.trend",
    metricRef: null,
    label: null,
    startValue,
    targetValue,
    currentValue: null,
    unit: "lb",
    createdAt: new Date(fixtureDayAnchorMs(30)),
  } as GoalOutcome;
}

export function fixturePrimaryGoalProps(
  persona: Persona
): PrimaryGoalData | null {
  if (!persona.goal) {
    return null;
  }
  const goal = fixtureGoalRow(persona);
  // The last fixture weigh-in stands in for trend weight (the harness has no
  // EMA series; live pages pass the real canonical trend value).
  const trendWeight = persona.weighIns.at(-1)?.weight ?? null;
  const outcomeRows =
    persona.id === "consistent" || persona.id === "overshoot"
      ? [
          weightOutcomeRow(
            goal.id,
            persona.goal.startValue,
            persona.goal.targetValue
          ),
          e1rmOutcomeRow(goal.id),
        ]
      : [];
  return {
    vm: buildGoalVM(goal, outcomeRows, {
      trendWeight,
      trendUnit: "lb",
      canonicalWorkouts: persona.workouts,
      latestMeasurementByKind: new Map(),
    }),
    otherActiveGoals: persona.id === "consistent" ? 1 : 0,
  };
}
