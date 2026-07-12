/**
 * CLAIM-GOVERNANCE CONTRACT (DSH-66 / Phase 1). What the product may ASSERT
 * from data, as a function of how much data there is. This governs every
 * derived statement on every surface: card captions, chart annotations, the
 * weekly report's factual claims, and the Coach insight's evidence line.
 *
 * What it is NOT: a tone control. Chad's voice, attitude, and coaching style
 * are off-limits to this contract (see copy-boundary.md). The one report rule
 * encoded here is data accuracy: a claim must be backed by logged data that
 * actually supports it. This is what would have stopped the "you lost
 * strength" report generated from zero strength data, without touching how
 * harshly Chad talks about data that DOES exist.
 *
 * Threshold defaults are owner-tunable product policy. They follow the
 * evidence discipline of the benchmark class (MacroFactor and Oura state
 * coverage and refuse trends on sparse data) and start deliberately
 * conservative. Changing them is a one-line edit here, reflected everywhere.
 */

import type { Coverage } from "./data-state";

/** Every kind of derived statement a surface can make about member data. */
export type ClaimKind =
  | "current-value" // "1,840 kcal so far today"
  | "trend-direction" // "trending down", a drawn trend line
  | "rate" // "-0.8 lb / week"
  | "eta" // "on pace to reach 180 lb by Sep 12 (estimate)"
  | "adherence" // "protein target met 4 of 7 logged days"
  | "comparison" // "volume up 12% vs last week"
  | "strength-change" // "bench est. 1RM up 10 lb" (per-exercise)
  | "record" // "new PR: 225 lb x 5"
  | "causal"; // "X happened because Y"

export type ClaimPolicy = {
  /** Minimum raw data points behind the claim. */
  minPoints: number;
  /** Minimum days between first and last point (0 = no span requirement). */
  minSpanDays: number;
  /** Minimum logged days inside the claim's window (0 = no requirement). */
  minLoggedDays: number;
  /** Human reason, used in "not enough data" microcopy and in review. */
  rationale: string;
};

/**
 * The thresholds. A claim kind missing from a metric's `allowedClaims`
 * (metric registry) is forbidden for that metric regardless of coverage.
 */
export const CLAIM_POLICIES: Record<
  Exclude<ClaimKind, "causal">,
  ClaimPolicy
> = {
  "current-value": {
    minPoints: 1,
    minSpanDays: 0,
    minLoggedDays: 0,
    rationale: "One logged value may always be stated as itself.",
  },
  "trend-direction": {
    minPoints: 3,
    // 6, not 7: a full Sunday-start calendar week spans 6 days first-to-last,
    // and the week-grain metrics must be able to earn their own trend claim.
    minSpanDays: 6,
    minLoggedDays: 0,
    rationale:
      "Two points always draw a line; three points across a full week is the floor for calling it a direction.",
  },
  rate: {
    minPoints: 5,
    minSpanDays: 14,
    minLoggedDays: 0,
    rationale:
      "A per-week rate quoted from under two weeks of data is noise presented as fact.",
  },
  eta: {
    minPoints: 5,
    minSpanDays: 21,
    minLoggedDays: 0,
    rationale:
      "Projecting a goal date needs a stable multi-week rate; ETAs are always labeled estimates and are additionally guarded by lib/chart/trend.ts projectToGoal (no ETA when flat or moving away).",
  },
  adherence: {
    minPoints: 1,
    minSpanDays: 0,
    minLoggedDays: 4,
    rationale:
      'An adherence percentage over a week means nothing at 1 of 7 days logged; below 4 logged days, state coverage instead ("2 of 7 days logged"). Adherence is always a multi-day-window claim: day-grain metrics evaluate it over their weekly cue window, never over one day.',
  },
  comparison: {
    minPoints: 2,
    minSpanDays: 0,
    // 3, not 4: a standard 3-sessions-per-week member must be able to hear
    // "volume up vs last week"; the caller checks BOTH periods against this.
    minLoggedDays: 3,
    rationale:
      "Period-over-period comparisons need both periods reasonably covered (a 3x/week training schedule qualifies); the caller must check BOTH periods against this policy. For session-grain metrics, loggedDays counts sessions; once structured plans exist (FIX-28, P4) a period that fully matches the member's prescribed schedule qualifies even below 3 (a 2x/week plan with both sessions logged is complete coverage).",
  },
  "strength-change": {
    minPoints: 3,
    minSpanDays: 14,
    minLoggedDays: 0,
    rationale:
      "A strength trend for an exercise needs at least three sessions OF THAT EXERCISE across two weeks. Zero sessions = no strength claim of any kind.",
  },
  record: {
    minPoints: 2,
    minSpanDays: 0,
    minLoggedDays: 0,
    rationale:
      "A PR is only a PR against prior history; the first-ever session is a baseline, not a record (matches lib/workouts/stats.ts prCountsByWorkout).",
  },
};

export type ClaimVerdict =
  | { allowed: true }
  | { allowed: false; reason: string };

/**
 * Where a claim is being made. "system" = UI microcopy, chart captions, and
 * report FACT sections. "coach-interpretation" = Chad's own coaching read,
 * framed as interpretation, in chat or the report's coaching sections.
 */
export type ClaimSurface = "system" | "coach-interpretation";

/**
 * May this claim be made from this coverage? Pure; every surface calls this
 * instead of eyeballing.
 *
 * `causal` evaluation (the executable copy-boundary rule, so Phase 7 never
 * has to choose between violating this contract and silently editing Chad's
 * persona): on "system" surfaces causal claims are a hard no at any
 * coverage. On "coach-interpretation" surfaces Chad MAY assert causation in
 * his own voice IFF a ClaimEvidence envelope is attached (`hasEvidence`) and
 * the underlying facts each cleared their own policies; that is a
 * data-accuracy rule, not a tone rule, and his attitude is untouched.
 */
export function canClaim(
  kind: ClaimKind,
  coverage: Coverage,
  opts: { surface?: ClaimSurface; hasEvidence?: boolean } = {}
): ClaimVerdict {
  const surface = opts.surface ?? "system";
  if (kind === "causal") {
    if (surface === "coach-interpretation" && opts.hasEvidence) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason:
        surface === "coach-interpretation"
          ? "Chad may assert causation only with a ClaimEvidence envelope attached (data accuracy, not tone)."
          : "System surfaces never assert causation; describe what changed and let coverage speak.",
    };
  }
  const p = CLAIM_POLICIES[kind];
  if (coverage.points < p.minPoints) {
    return {
      allowed: false,
      reason: `Needs ${p.minPoints}+ data points; have ${coverage.points}. ${p.rationale}`,
    };
  }
  if (coverage.spanDays < p.minSpanDays) {
    return {
      allowed: false,
      reason: `Needs ${p.minSpanDays}+ days of span; have ${Math.round(coverage.spanDays)}. ${p.rationale}`,
    };
  }
  if (coverage.loggedDays < p.minLoggedDays) {
    return {
      allowed: false,
      reason: `Needs ${p.minLoggedDays}+ logged days in the window; have ${coverage.loggedDays}. ${p.rationale}`,
    };
  }
  return { allowed: true };
}

/* --------------------------------------------------------------------------
 * Goal standing (the DSH-62 fix, specified once)
 *
 * /progress said "Moving away from your goal" and "100% there" while /goals
 * said "Goal reached", because one surface keyed "reached" off `toGo != 0`
 * while the shared calc clamped pct to 100. The contract: REACHED is a
 * direction-aware comparison against the target, never a zero-remainder
 * check, and every surface derives its verdict from ONE standing value.
 * ------------------------------------------------------------------------ */

export type GoalStanding =
  | "insufficient-data" // below the rate threshold; no DIRECTION language
  | "on-track" // moving toward the target
  | "off-track" // moving away from the target
  | "holding" // rate is negligible in either direction
  | "reached"; // at or past the target in the goal's direction

/**
 * True when `current` is at or past `target` in the goal's own direction.
 * A 180 lb loss target is reached at 179.4; a 225 lb strength target is
 * reached at 230. Overshoot IS reached; surfaces may add "X lb past your
 * goal" as positive framing but never "moving away" or a nonzero "to go".
 */
export function isGoalReached(
  start: number,
  target: number,
  current: number,
  epsilon = 0.05
): boolean {
  const direction = Math.sign(target - start);
  if (direction === 0) {
    return Math.abs(current - target) <= epsilon;
  }
  return (current - target) * direction >= -epsilon;
}

/**
 * The one goal-standing derivation. `ratePerWeek` is signed in the metric's
 * own unit (from lib/chart/trend.ts ratePerWeek); `holdingBelow` is the
 * absolute weekly rate under which we call it holding rather than moving.
 *
 * Direction verdicts (on-track / off-track / holding) gate on the RATE
 * policy (5 points across 14 days), not the looser trend-direction policy:
 * they are statements about the rate's sign, and this file's own rate
 * rationale says a rate quoted from under two weeks of data is noise. A
 * member 6 days in with 3 weigh-ins gets "insufficient-data" (the surface
 * states coverage and progress facts), never a scary "moving away" banner
 * derived from water weight.
 *
 * `holdingBelow` defaults to 0.25 (in the metric's unit per week): daily EMA
 * wobble on body weight is larger than 0.1 lb/week, and a maintaining member
 * must not see on-track/off-track flap day to day.
 */
export function goalStanding(args: {
  start: number;
  target: number;
  current: number;
  ratePerWeek: number;
  coverage: Coverage;
  /** Weekly rate below which direction language is not used. */
  holdingBelow?: number;
}): GoalStanding {
  const { start, target, current, ratePerWeek, coverage } = args;
  // Reached deliberately precedes the coverage gate: being at/past the target
  // is a current-value fact (one honest data point suffices), not a trend
  // claim. Direction language below IS a rate claim, so it stays gated.
  if (isGoalReached(start, target, current)) {
    return "reached";
  }
  if (!canClaim("rate", coverage).allowed) {
    return "insufficient-data";
  }
  const holdingBelow = args.holdingBelow ?? 0.25;
  if (Math.abs(ratePerWeek) < holdingBelow) {
    return "holding";
  }
  const towardGoal = Math.sign(target - current) === Math.sign(ratePerWeek);
  return towardGoal ? "on-track" : "off-track";
}

/* --------------------------------------------------------------------------
 * Evidence envelope
 *
 * Every interpreted statement (weekly-report finding, Coach insight) carries
 * this, so a claim is traceable to the data behind it. Enforced structurally
 * from Phase 7 (FIX-36A/36B); defined here so Phases 2 to 6 build surfaces
 * that can display it.
 * ------------------------------------------------------------------------ */

export type ClaimEvidence = {
  /** Metric registry ids the statement is derived from. */
  metricIds: string[];
  /** Member-local calendar window the data was read over. */
  window: { startISO: string; endISO: string };
  coverage: Coverage;
  /** When the statement was generated (ISO instant). */
  generatedAtISO: string;
};
