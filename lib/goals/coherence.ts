/**
 * Coherence nudges for the goal surfaces (P2-4), shared by /today and /goals:
 * (a) an active goal whose text names a daily calorie figure that disagrees
 * with the Calorie Tracker target, and (b) two active goals tracking the same
 * metric, whose progress bars anchor on different start values and so can
 * contradict each other on one screen.
 */

/** The slice of a goal these checks need. */
export type CoherenceGoal = {
  id: string;
  title: string;
  detail: string | null;
  metric: "weight" | "bodyfat" | "measurement" | "custom" | "lift" | null;
  metricRef: string | null;
};

export type CalorieConflict = {
  goalTitle: string;
  mentioned: number;
  target: number;
};

/** A daily calorie figure named in free text ("1,800 cal", "calories capped at
 *  1,800"). Bounded to a sane daily range so gram counts and dates never match. */
export function mentionedCalories(text: string): number | null {
  const m =
    text.match(/(\d[\d,]{2,4})\s*(?:k?cals?\b|calories?\b)/i) ??
    text.match(/\bcalories?\b[^.\d]{0,40}(\d[\d,]{2,4})/i);
  if (!m) {
    return null;
  }
  const n = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(n) && n >= 800 && n <= 10_000 ? n : null;
}

/** First active goal whose text names a calorie figure that disagrees with the
 *  Calorie Tracker target. Null when the target is unset or everything agrees. */
export function findCalorieConflict(
  goals: CoherenceGoal[],
  targetCalories: number | null | undefined
): CalorieConflict | null {
  if (!targetCalories) {
    return null;
  }
  for (const g of goals) {
    const mentioned = mentionedCalories(`${g.title} ${g.detail ?? ""}`);
    if (mentioned != null && mentioned !== targetCalories) {
      return { goalTitle: g.title, mentioned, target: targetCalories };
    }
  }
  return null;
}

/** Ids of active goals that track the same metric as another active goal.
 *  Only metrics where two goals genuinely measure the same thing: weight,
 *  body fat, or the same lift. Two "measurement" goals can be different body
 *  parts, and "custom" goals have no comparable metric. */
export function findOverlapIds(goals: CoherenceGoal[]): string[] {
  const overlapIds: string[] = [];
  const byMetric = new Map<string, string[]>();
  for (const g of goals) {
    if (g.metric === "weight" || g.metric === "bodyfat") {
      byMetric.set(g.metric, [...(byMetric.get(g.metric) ?? []), g.id]);
    } else if (g.metric === "lift" && g.metricRef) {
      const key = `lift:${g.metricRef.trim().toLowerCase()}`;
      byMetric.set(key, [...(byMetric.get(key) ?? []), g.id]);
    }
  }
  for (const ids of byMetric.values()) {
    if (ids.length > 1) {
      overlapIds.push(...ids);
    }
  }
  return overlapIds;
}
