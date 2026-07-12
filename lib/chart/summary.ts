/**
 * CHART TEXT SUMMARY (FIX-18). Every shared chart carries a plain-language
 * summary so no value is only reachable by decoding pixels: it is rendered
 * for screen readers on the chart figure and reused as the accessible name
 * (visual-excellence standard, section 6). Pure and deterministic; built
 * from the same contract formatters the visible chart uses, so the summary
 * can never disagree with the drawing.
 */

import { formatCoverage, type MetricReading } from "@/lib/contracts/data-state";
import { formatQuantity, type UnitId } from "@/lib/contracts/units";

export function buildChartSummary(opts: {
  /** Canonical metric/chart name ("Weight trend", "Calories"). */
  title: string;
  /** Member-facing window ("last 30 days", "this week"). */
  rangeLabel: string;
  reading: MetricReading<number>;
  unit: UnitId;
  /** Goal/target when one exists; labeled in the summary. */
  goal?: { value: number; label?: string } | null;
  /** Extra clauses (verdicts, deltas) appended verbatim. */
  extra?: readonly string[];
}): string {
  const parts: string[] = [];
  const r = opts.reading;
  if (r.status === "unlogged") {
    parts.push(`${opts.title}, ${opts.rangeLabel}: not logged yet.`);
    return parts.join(" ");
  }
  const estimated = r.estimated ? " (estimated)" : "";
  parts.push(
    `${opts.title}, ${opts.rangeLabel}: ${formatQuantity(r.value, opts.unit)}${estimated}.`
  );
  if (opts.goal) {
    parts.push(
      `${opts.goal.label ?? "Goal"} ${formatQuantity(opts.goal.value, opts.unit)}.`
    );
  }
  if (r.coverage.windowDays > 0 && r.coverage.loggedDays < r.coverage.windowDays) {
    parts.push(`${formatCoverage(r.coverage)}.`);
  }
  for (const clause of opts.extra ?? []) {
    parts.push(clause.endsWith(".") ? clause : `${clause}.`);
  }
  return parts.join(" ");
}
