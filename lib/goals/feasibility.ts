/**
 * Goal feasibility math (MOB-19): the live "is this pace realistic?" guidance
 * on the goal form: the coaching moment MyFitnessPal reduces to a hard floor
 * and lifting apps skip entirely. Pure and React-free.
 */

export type RateBand = "safe" | "aggressive" | "extreme";

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

/** Parse a target-date string ("Sep 30, 2026", "2026-09-30") into a Date.
 *  Free text like "by summer" returns null: no feasibility math, no error. */
export function parseTargetDate(raw: string | null | undefined): Date | null {
  const v = raw?.trim();
  if (!v) {
    return null;
  }
  // A date-only ISO string ("2026-09-30", what a native date input emits) is
  // LOCAL midnight to the member; Date.parse would read it as UTC midnight
  // and formatting could then show the previous day. Build it locally.
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  }
  const t = Date.parse(v);
  if (Number.isNaN(t)) {
    return null;
  }
  return new Date(t);
}

export function weeksUntil(date: Date, from: Date = new Date()): number {
  return (date.getTime() - from.getTime()) / MS_PER_WEEK;
}

export type WeightFeasibility = {
  direction: "lose" | "gain";
  totalChange: number;
  /** Weeks until the parsed target date; null when the date isn't parseable. */
  weeks: number | null;
  /** Required change per week to land on the date; null without a date. */
  ratePerWeek: number | null;
  /** % of start weight per week; the unit-agnostic banding basis. */
  ratePctPerWeek: number | null;
  band: RateBand | null;
  /** Date you'd land at a sustainable pace, for the "realistic finish" line. */
  sustainableDate: Date;
  /** The sustainable pace used for that projection (same unit as inputs). */
  sustainableRate: number;
};

/**
 * Bodyweight-goal feasibility. Banding follows mainstream coaching guidance:
 * losing ≤1% of bodyweight per week is sustainable (≈ the classic 0.5–2
 * lb/week range MyFitnessPal caps at), up to 1.5% is aggressive, beyond that
 * you're shedding muscle; gaining ≤0.5%/week is a lean gain, up to 1% is
 * aggressive, beyond is mostly fat.
 */
export function weightFeasibility({
  start,
  target,
  targetDate,
}: {
  start: number;
  target: number;
  targetDate: string | null;
}): WeightFeasibility | null {
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(target) ||
    start <= 0 ||
    start === target
  ) {
    return null;
  }
  const direction = target < start ? "lose" : "gain";
  const totalChange = Math.abs(target - start);

  const date = parseTargetDate(targetDate);
  const weeks = date ? Math.max(0.1, weeksUntil(date)) : null;
  const ratePerWeek = weeks ? totalChange / weeks : null;
  const ratePctPerWeek = ratePerWeek ? (ratePerWeek / start) * 100 : null;

  let band: RateBand | null = null;
  if (ratePctPerWeek != null) {
    const safeCap = direction === "lose" ? 1 : 0.5;
    const aggressiveCap = direction === "lose" ? 1.5 : 1;
    band =
      ratePctPerWeek <= safeCap
        ? "safe"
        : ratePctPerWeek <= aggressiveCap
          ? "aggressive"
          : "extreme";
  }

  // The projection line: where a sustainable pace actually lands you.
  const sustainablePct = direction === "lose" ? 0.75 : 0.35;
  const sustainableRate =
    Math.round(((sustainablePct / 100) * start + Number.EPSILON) * 10) / 10;
  const sustainableWeeks = totalChange / ((sustainablePct / 100) * start);
  const sustainableDate = new Date(
    Date.now() + sustainableWeeks * MS_PER_WEEK
  );

  return {
    direction,
    totalChange: Math.round(totalChange * 10) / 10,
    weeks: weeks ? Math.round(weeks * 10) / 10 : null,
    ratePerWeek: ratePerWeek ? Math.round(ratePerWeek * 10) / 10 : null,
    ratePctPerWeek: ratePctPerWeek
      ? Math.round(ratePctPerWeek * 100) / 100
      : null,
    band,
    sustainableDate,
    sustainableRate,
  };
}

export type LiftFeasibility = {
  gain: number;
  weeks: number | null;
  ratePerWeek: number | null;
  band: RateBand | null;
};

/**
 * Lift-goal feasibility, judged against the target date when one is set.
 * Strength moves slower than motivation: ~2.5 lb/week on a big lift is
 * already strong steady progress for a non-beginner; 5 lb/week is a
 * beginner-gains pace; past that the date is fantasy.
 */
export function liftFeasibility({
  currentE1rm,
  target,
  targetDate,
}: {
  currentE1rm: number | null;
  target: number;
  targetDate: string | null;
}): LiftFeasibility | null {
  if (currentE1rm == null || !Number.isFinite(target) || target <= currentE1rm) {
    return null;
  }
  const gain = Math.round((target - currentE1rm) * 10) / 10;
  const date = parseTargetDate(targetDate);
  const weeks = date ? Math.max(0.1, weeksUntil(date)) : null;
  const ratePerWeek = weeks ? gain / weeks : null;
  const band: RateBand | null =
    ratePerWeek == null
      ? null
      : ratePerWeek <= 2.5
        ? "safe"
        : ratePerWeek <= 5
          ? "aggressive"
          : "extreme";
  return {
    gain,
    weeks: weeks ? Math.round(weeks * 10) / 10 : null,
    ratePerWeek: ratePerWeek ? Math.round(ratePerWeek * 10) / 10 : null,
    band,
  };
}

/**
 * One plain sentence describing the pace a weight goal demands, for Chad's
 * system-prompt goal block: the required rate to hit the member's date and
 * whether that pace is sustainable, aggressive, or beyond physiology (with
 * the realistic landing date when it is). Null for non-weight goals or when
 * the numbers aren't set. Start-value based, the same math the goal form
 * shows the member.
 */
export function goalPaceLine(goal: {
  metric?: string | null;
  startValue?: number | null;
  targetValue?: number | null;
  unit?: string | null;
  targetDate?: string | null;
}): string | null {
  if (
    goal.metric !== "weight" ||
    goal.startValue == null ||
    goal.targetValue == null
  ) {
    return null;
  }
  const f = weightFeasibility({
    start: goal.startValue,
    target: goal.targetValue,
    targetDate: goal.targetDate ?? null,
  });
  if (!f) {
    return null;
  }
  const unit = goal.unit?.trim() || "lb";
  if (f.ratePerWeek == null || f.band == null) {
    return `No target date set yet; at a sustainable ${f.sustainableRate} ${unit}/week this goal lands around ${formatTargetDate(f.sustainableDate)}. Settle a date with the client.`;
  }
  const verb = f.direction === "lose" ? "losing" : "gaining";
  if (f.band === "safe") {
    return `Hitting their date requires ${verb} about ${f.ratePerWeek} ${unit}/week: a sustainable pace.`;
  }
  if (f.band === "aggressive") {
    return `Hitting their date requires ${verb} about ${f.ratePerWeek} ${unit}/week: an aggressive pace that demands a strict plan and hard training frequency.`;
  }
  return `Hitting their date requires ${verb} about ${f.ratePerWeek} ${unit}/week: faster than a body can actually deliver. A sustainable ${f.sustainableRate} ${unit}/week lands around ${formatTargetDate(f.sustainableDate)}; renegotiate the date.`;
}

/** "Sep 30, 2026", the exact format the quick-deadline chips write, chosen
 *  because Date.parse reads it back (so feasibility math keeps working). */
export function formatTargetDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function dateWeeksFromNow(weeks: number): Date {
  return new Date(Date.now() + weeks * MS_PER_WEEK);
}
