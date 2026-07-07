/**
 * The Quit Date prediction heuristics (FEAT-21). Deterministic by design: the
 * model never picks the date, code does, from the published churn predictors
 * the spec cites (survival-analysis models predict fitness-app churn to a 1-3
 * week mean error; fewer than 3 workouts in the first 14 days = 3-4x churn;
 * the longest streak someone has EVER held is the strongest signal of how
 * long the next attempt lasts). No imports: this module is pure so the unit
 * tests can run it directly under node --test.
 */

export const APPS_TRIED_VALUES = ["none", "1-2", "3-5", "6+"] as const;
export type AppsTried = (typeof APPS_TRIED_VALUES)[number];

export const RESTART_VALUES = [
  "first-time",
  "2-3",
  "4-6",
  "lost-count",
] as const;
export type Restarts = (typeof RESTART_VALUES)[number];

export const STREAK_VALUES = [
  "under-1w",
  "1-2w",
  "3-4w",
  "1-3m",
  "3m-plus",
] as const;
export type LongestStreak = (typeof STREAK_VALUES)[number];

export const KILLER_VALUES = [
  "work",
  "injury",
  "slow-results",
  "boredom",
  "life-event",
  "no-reason",
] as const;
export type LastKiller = (typeof KILLER_VALUES)[number];

export const LIFE_LOAD_VALUES = ["calm", "normal", "heavy", "chaos"] as const;
export type LifeLoad = (typeof LIFE_LOAD_VALUES)[number];

/** The Autopsy intake, as validated by lib/quit/content.ts. */
export type AutopsyAnswers = {
  appsTried: AppsTried;
  restarts: Restarts;
  longestStreak: LongestStreak;
  lastKiller: LastKiller;
  lifeLoad: LifeLoad;
  confession: string;
};

// The prediction window. The floor keeps even the worst confession inside a
// believable coaching window (a sub-10-day date reads as an insult, not a
// diagnosis); the ceiling keeps every date near-term enough to feel real.
export const MIN_QUIT_DAY = 10;
const CLAMP_CEILING = 88; // pre-de-rounding ceiling; see below
export const MAX_QUIT_DAY = 89;

// Base: day 28. The category's churn cliff is weeks 2-4 ("week three is where
// it dies"), so an average history lands there and the modifiers pull the
// serial quitter earlier and the proven streak-holder later.
const BASE_DAY = 28;

const STREAK_ADJ: Record<LongestStreak, number> = {
  "under-1w": -10,
  "1-2w": -6,
  "3-4w": -1,
  "1-3m": 7,
  "3m-plus": 14,
};

const RESTART_ADJ: Record<Restarts, number> = {
  "first-time": 4,
  "2-3": 0,
  "4-6": -4,
  "lost-count": -8,
};

const APPS_ADJ: Record<AppsTried, number> = {
  none: 2,
  "1-2": 0,
  "3-5": -3,
  "6+": -6,
};

const LIFE_ADJ: Record<LifeLoad, number> = {
  calm: 4,
  normal: 0,
  heavy: -5,
  chaos: -9,
};

/**
 * The predicted quit day as a day-of-membership count (day 1 = signup day).
 * trainingDaysPerWeek comes from the member's saved profile when they set it;
 * planning fewer than 3 sessions a week is one of the published 3-4x churn
 * flags, so it pulls the date in.
 */
export function predictQuitDay(
  answers: Pick<
    AutopsyAnswers,
    "appsTried" | "restarts" | "longestStreak" | "lifeLoad"
  >,
  trainingDaysPerWeek: number | null
): number {
  let day =
    BASE_DAY +
    STREAK_ADJ[answers.longestStreak] +
    RESTART_ADJ[answers.restarts] +
    APPS_ADJ[answers.appsTried] +
    LIFE_ADJ[answers.lifeLoad];

  if (trainingDaysPerWeek != null) {
    if (trainingDaysPerWeek < 3) {
      day -= 5;
    } else if (trainingDaysPerWeek >= 5) {
      day += 2;
    }
  }

  day = Math.min(CLAMP_CEILING, Math.max(MIN_QUIT_DAY, day));

  return deRoundDay(day);
}

/**
 * De-round: a date that lands on a multiple of 5 or 7 reads as a made-up
 * round number ("three weeks"); a specific day ("Day 23") lands as a
 * diagnosis. Bump until it is neither. Terminates fast: runs of consecutive
 * integers all divisible by 5 or 7 are at most two long.
 */
export function deRoundDay(day: number): number {
  let d = day;
  while (d % 5 === 0 || d % 7 === 0) {
    d += 1;
  }
  return d;
}

// The reissue (FEAT-22): a beaten prediction earns a new, HARDER one — the
// next date sits meaningfully further out than the one they just outlived, so
// the loop stays a challenge instead of an insult. Growth is proportional to
// what they already survived, bounded so early dates don't crawl and late
// dates don't balloon.
const REISSUE_MIN_GROWTH_DAYS = 11;
const REISSUE_MAX_GROWTH_DAYS = 60;
const REISSUE_GROWTH_FACTOR = 0.6;
// The new date must always land at least this far past the day they beat the
// old one on, so a slow resolution never issues a date that's already close.
const REISSUE_MIN_RUNWAY_DAYS = 13;

/**
 * The next predicted quit day after the member beat `previousDayCount`.
 * `currentDay` is their day-of-membership when the beat resolved. Same
 * de-rounding contract as predictQuitDay; deterministic by design.
 */
export function reissueQuitDay(
  previousDayCount: number,
  currentDay: number
): number {
  const growth = Math.min(
    REISSUE_MAX_GROWTH_DAYS,
    Math.max(
      REISSUE_MIN_GROWTH_DAYS,
      Math.round(previousDayCount * REISSUE_GROWTH_FACTOR)
    )
  );
  const day = Math.max(
    previousDayCount + growth,
    currentDay + REISSUE_MIN_RUNWAY_DAYS
  );
  return deRoundDay(day);
}

/** Short label of HOW this member is predicted to fail, from their own
 * stated killer of the last attempt. Stored on the QuitPrediction row. */
export function failureModeFor(lastKiller: LastKiller): string {
  const modes: Record<LastKiller, string> = {
    work: "Work gets busy, one skipped week becomes forever",
    injury: "A minor tweak becomes the exit",
    "slow-results": "The scale stalls and the motivation goes with it",
    boredom: "The novelty wears off",
    "life-event": "Life throws a curveball and the routine never recovers",
    "no-reason": "The quiet fade: no drama, just gone",
  };
  return modes[lastKiller];
}
