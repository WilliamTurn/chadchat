/**
 * DETERMINISTIC DASHBOARD-STATE FIXTURES (DSH-66 / Phase 1, FIX-12).
 *
 * Six member personas that, between them, put every panel into every render
 * state (empty / sparse / populated / stale / loading / error / locked), so
 * every later phase can build, test, and SCREENSHOT the ugly states before
 * shipping, instead of only the happy populated desktop view.
 *
 * Everything is anchored to one fixed instant (no Date.now()), so a fixture
 * run today and a fixture run next year produce byte-identical data:
 *
 *   FIXTURE_NOW      = 2026-07-08T22:30:00Z  (5:30pm in America/Chicago)
 *   FIXTURE_TIMEZONE = America/Chicago       (a non-UTC zone on purpose,
 *                       so tz bugs surface in tests instead of production)
 *
 * Data is at the view-model level (the shapes the pure lib functions consume:
 * lib/workouts/stats WorkoutData, lib/chart/trend TimePoint, the daily-total
 * shapes lib/today/week builds from), not raw DB rows: contracts and UI
 * stories consume these shapes, and they are stable across schema changes.
 *
 * `loading` and `error` are fetch-layer states, not data shapes; the personas
 * carry data and any panel can be rendered in loading/error by overriding the
 * fetch input of resolvePanelState (see tests/unit/contracts.test.ts).
 */

import type { Coverage, PanelState } from "../../lib/contracts/data-state";
import type { WorkoutData } from "../../lib/workouts/stats";

export const FIXTURE_TIMEZONE = "America/Chicago";
export const FIXTURE_TODAY_ISO = "2026-07-08"; // a Wednesday
export const FIXTURE_NOW = new Date("2026-07-08T22:30:00.000Z");

const DAY_MS = 86_400_000;

/** 00:00-UTC anchor of the member-local day `daysAgo` days before today. */
export function fixtureDayAnchorMs(daysAgo: number): number {
  return Date.UTC(2026, 6, 8) - daysAgo * DAY_MS;
}

/** An instant during the member-local day `daysAgo` (18:00 UTC = 1pm CDT). */
export function fixtureInstant(daysAgo: number): Date {
  return new Date(fixtureDayAnchorMs(daysAgo) + 18 * 60 * 60 * 1000);
}

/** Coverage over a window, from the day-offsets that have logs. */
export function fixtureCoverage(
  loggedDaysAgo: readonly number[],
  windowDays: number,
  points = loggedDaysAgo.length
): Coverage {
  const spanDays =
    loggedDaysAgo.length >= 2
      ? Math.max(...loggedDaysAgo) - Math.min(...loggedDaysAgo)
      : 0;
  return {
    loggedDays: new Set(loggedDaysAgo).size,
    windowDays,
    points,
    spanDays,
  };
}

/* ------------------------------------------------------------------ types */

export type FixtureMeal = {
  title: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  recordedAt: Date;
};

export type FixtureWeighIn = { t: number; weight: number }; // lb
export type FixtureWaterDay = { t: number; ml: number };
export type FixtureSleepNight = {
  t: number;
  minutes: number;
  quality: number | null;
};

export type FixtureGoal = {
  title: string;
  metric: "weight";
  startValue: number;
  targetValue: number;
  unit: "lb";
};

export type PersonaExpectations = {
  nutrition: PanelState;
  hydration: PanelState;
  sleep: PanelState;
  training: PanelState;
  body: PanelState;
};

export type Persona = {
  id: string;
  description: string;
  /**
   * "basic" locks the Pro panels; "pro" sees everything but the Elite-gated
   * Weekly Report content (/reports renders the Elite teaser to Pro members;
   * pinned in lib/contracts/routes.ts, designed in P7); "elite" sees all.
   */
  tier: "basic" | "pro" | "elite";
  /** True only for the never-logged-anything, no-profile member. */
  firstRun: boolean;
  meals: FixtureMeal[];
  nutritionTarget: { calories: number; protein: number } | null;
  waterDaily: FixtureWaterDay[];
  waterGoalMl: number;
  sleepDaily: FixtureSleepNight[];
  sleepGoalMinutes: number | null;
  workouts: WorkoutData[];
  weighIns: FixtureWeighIn[];
  goal: FixtureGoal | null;
  /** The panel states the contracts must resolve to for this persona. */
  expected: PersonaExpectations;
};

/* ---------------------------------------------------------------- helpers */

function meal(
  daysAgo: number,
  title: string,
  calories: number,
  protein: number
): FixtureMeal {
  return {
    title,
    calories,
    protein,
    carbs: Math.round((calories * 0.4) / 4),
    fat: Math.round((calories * 0.25) / 9),
    recordedAt: fixtureInstant(daysAgo),
  };
}

function workout(
  daysAgo: number,
  title: string,
  benchTopWeightLb: number
): WorkoutData {
  return {
    id: `fixture-workout-${daysAgo}`,
    title,
    performedAt: fixtureInstant(daysAgo).toISOString(),
    durationSeconds: 3600,
    notes: null,
    exercises: [
      {
        name: "Bench Press",
        muscleGroup: "chest",
        kind: "weighted",
        supersetGroup: null,
        notes: null,
        sets: [
          {
            weight: Math.round(benchTopWeightLb * 0.6),
            reps: 10,
            unit: "lb",
            rpe: null,
            setType: "warmup",
            completed: true,
          },
          {
            weight: benchTopWeightLb,
            reps: 5,
            unit: "lb",
            rpe: 8,
            setType: "working",
            completed: true,
          },
          {
            weight: benchTopWeightLb,
            reps: 5,
            unit: "lb",
            rpe: 9,
            setType: "working",
            completed: true,
          },
        ],
      },
      {
        name: "Barbell Row",
        muscleGroup: "back",
        kind: "weighted",
        supersetGroup: null,
        notes: null,
        sets: [
          {
            weight: Math.round(benchTopWeightLb * 0.85),
            reps: 8,
            unit: "lb",
            rpe: null,
            setType: "working",
            completed: true,
          },
        ],
      },
    ],
  };
}

/* --------------------------------------------------------------- personas */

/** 1. Brand-new member: nothing logged, no profile. Every panel EMPTY. */
export const firstRunPersona: Persona = {
  id: "first-run",
  description:
    "Signed up today, finished /welcome, logged nothing. The page must carry ONE dominant CTA and designed empty states everywhere.",
  tier: "pro",
  firstRun: true,
  meals: [],
  nutritionTarget: null,
  waterDaily: [],
  waterGoalMl: 3785,
  sleepDaily: [],
  sleepGoalMinutes: null,
  workouts: [],
  weighIns: [],
  goal: null,
  expected: {
    nutrition: "empty",
    hydration: "empty",
    sleep: "empty",
    training: "empty",
    body: "empty",
  },
};

/** 2. Two days in: real but thin data. SPARSE everywhere; no trend claims. */
export const sparsePersona: Persona = {
  id: "sparse",
  description:
    "Second day of use. 2 days of partial logs. Panels show honest facts + coverage; trend/adherence/rate claims are all denied.",
  tier: "pro",
  firstRun: false,
  meals: [
    meal(1, "Chicken and rice", 650, 45),
    meal(0, "Protein oatmeal", 420, 32),
  ],
  nutritionTarget: { calories: 2300, protein: 190 },
  waterDaily: [
    { t: fixtureDayAnchorMs(1), ml: 1480 },
    { t: fixtureDayAnchorMs(0), ml: 890 },
  ],
  waterGoalMl: 3785,
  sleepDaily: [{ t: fixtureDayAnchorMs(0), minutes: 402, quality: 3 }],
  sleepGoalMinutes: 480,
  workouts: [workout(1, "Upper A", 185)],
  weighIns: [{ t: fixtureDayAnchorMs(1), weight: 205.0 }],
  goal: {
    title: "Cut to 180",
    metric: "weight",
    startValue: 205,
    targetValue: 180,
    unit: "lb",
  },
  expected: {
    nutrition: "populated", // today's totals are current-value facts
    hydration: "populated",
    sleep: "populated",
    training: "sparse", // 1 session: below every trend threshold
    body: "sparse", // 1 weigh-in: value shown, no trend line
  },
};

/** 3. Four consistent weeks: the full rewarding treatment. POPULATED. */
export const consistentPersona: Persona = (() => {
  const meals: FixtureMeal[] = [];
  const waterDaily: FixtureWaterDay[] = [];
  const sleepDaily: FixtureSleepNight[] = [];
  const workouts: WorkoutData[] = [];
  const weighIns: FixtureWeighIn[] = [];
  for (let d = 27; d >= 0; d--) {
    meals.push(
      meal(d, "Breakfast", 520, 35),
      meal(d, "Lunch", 780, 52),
      meal(d, "Dinner", 840, 58)
    );
    waterDaily.push({ t: fixtureDayAnchorMs(d), ml: 3200 + (d % 3) * 300 });
    sleepDaily.push({
      t: fixtureDayAnchorMs(d),
      minutes: 430 + (d % 4) * 15,
      quality: 3 + (d % 3),
    });
    // Weigh-ins every other day, trending down 205 -> ~198.
    if (d % 2 === 1) {
      weighIns.push({
        t: fixtureDayAnchorMs(d),
        weight: Math.round((198.4 + d * 0.25) * 10) / 10,
      });
    }
    // Train Mon/Wed/Fri-ish: every ~2.3 days, bench creeping up.
    if (d % 7 === 0 || d % 7 === 2 || d % 7 === 4) {
      workouts.push(workout(d, "Upper A", 185 + Math.floor((27 - d) / 7) * 5));
    }
  }
  return {
    id: "consistent",
    description:
      "Four weeks of steady logging, weight trending toward goal, bench climbing. Every claim class is allowed; this is the reference for the rewarding populated treatment.",
    tier: "pro" as const,
    firstRun: false,
    meals,
    nutritionTarget: { calories: 2300, protein: 190 },
    waterDaily,
    waterGoalMl: 3785,
    sleepDaily,
    sleepGoalMinutes: 480,
    workouts,
    weighIns,
    goal: {
      title: "Cut to 180",
      metric: "weight" as const,
      startValue: 205,
      targetValue: 180,
      unit: "lb" as const,
    },
    expected: {
      nutrition: "populated" as const,
      hydration: "populated" as const,
      sleep: "populated" as const,
      training: "populated" as const,
      body: "populated" as const,
    },
  };
})();

/** 4. Lapsed member: good history, silent for 12 days. STALE, shown dated. */
export const lapsedPersona: Persona = {
  id: "lapsed",
  description:
    "Logged well three weeks ago, nothing for 12 days. Values render DATED (never framed as current); the panels prompt one fresh log each.",
  tier: "pro",
  firstRun: false,
  meals: [meal(12, "Burrito bowl", 900, 48)],
  nutritionTarget: { calories: 2300, protein: 190 },
  waterDaily: [
    { t: fixtureDayAnchorMs(14), ml: 3400 },
    { t: fixtureDayAnchorMs(13), ml: 2900 },
    { t: fixtureDayAnchorMs(12), ml: 3785 },
  ],
  waterGoalMl: 3785,
  sleepDaily: [
    { t: fixtureDayAnchorMs(14), minutes: 465, quality: 4 },
    { t: fixtureDayAnchorMs(13), minutes: 445, quality: 3 },
    { t: fixtureDayAnchorMs(12), minutes: 480, quality: 4 },
  ],
  sleepGoalMinutes: 480,
  workouts: [
    workout(14, "Upper A", 195),
    workout(13, "Push B", 190),
    workout(12, "Lower A", 275),
  ],
  weighIns: [
    { t: fixtureDayAnchorMs(16), weight: 203.2 },
    { t: fixtureDayAnchorMs(14), weight: 202.8 },
    { t: fixtureDayAnchorMs(12), weight: 202.1 },
  ],
  goal: {
    title: "Cut to 180",
    metric: "weight",
    startValue: 205,
    targetValue: 180,
    unit: "lb",
  },
  expected: {
    nutrition: "empty", // nothing logged TODAY; day-grain metrics read unlogged
    hydration: "empty",
    sleep: "stale", // last night is 12 days old: dated, never "last night"
    training: "populated", // history metrics stay valid
    body: "stale", // weigh-in 12 days old: dated
  },
};

/**
 * 5. Overshoot member: trend weight PAST a loss target (the DSH-62 case).
 * /progress and /goals must BOTH read "reached", never "moving away".
 */
export const overshootPersona: Persona = (() => {
  const weighIns: FixtureWeighIn[] = [];
  // 6 weeks, 178.5 -> 179.5 band, all past the 180 loss target.
  for (let d = 42; d >= 0; d -= 2) {
    weighIns.push({
      t: fixtureDayAnchorMs(d),
      weight: Math.round((178.6 + (d % 5) * 0.2) * 10) / 10,
    });
  }
  return {
    id: "overshoot",
    description:
      "Started at 205, target 180, now holding ~178.7. Goal standing is REACHED (overshoot is reached); any 'to goal' remainder or 'moving away' banner is the DSH-62 bug.",
    tier: "pro" as const,
    firstRun: false,
    meals: [meal(0, "Salmon bowl", 720, 46)],
    nutritionTarget: { calories: 2600, protein: 180 },
    waterDaily: [{ t: fixtureDayAnchorMs(0), ml: 2400 }],
    waterGoalMl: 3785,
    sleepDaily: [{ t: fixtureDayAnchorMs(0), minutes: 460, quality: 4 }],
    sleepGoalMinutes: 480,
    workouts: [workout(2, "Upper A", 205), workout(0, "Lower A", 295)],
    weighIns,
    goal: {
      title: "Cut to 180",
      metric: "weight" as const,
      startValue: 205,
      targetValue: 180,
      unit: "lb" as const,
    },
    expected: {
      nutrition: "populated" as const,
      hydration: "populated" as const,
      sleep: "populated" as const,
      training: "sparse" as const, // 2 sessions in window
      body: "populated" as const,
    },
  };
})();

/** 6. Basic-tier member: Pro data panels LOCKED, never empty or broken. */
export const lockedBasicPersona: Persona = {
  id: "locked-basic",
  description:
    "Active Basic subscriber. Pro panels render the locked teaser (capability + upgrade path); goals remain available. Locked must never be styled as empty or error.",
  tier: "basic",
  firstRun: false,
  meals: [],
  nutritionTarget: null,
  waterDaily: [],
  waterGoalMl: 3785,
  sleepDaily: [],
  sleepGoalMinutes: null,
  workouts: [],
  weighIns: [],
  goal: {
    title: "Cut to 180",
    metric: "weight",
    startValue: 205,
    targetValue: 180,
    unit: "lb",
  },
  expected: {
    nutrition: "locked",
    hydration: "locked",
    sleep: "locked",
    training: "locked",
    body: "locked",
  },
};

export const PERSONAS = [
  firstRunPersona,
  sparsePersona,
  consistentPersona,
  lapsedPersona,
  overshootPersona,
  lockedBasicPersona,
] as const;
