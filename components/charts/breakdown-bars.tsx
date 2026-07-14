/**
 * BREAKDOWN BARS (new signature visual type, P56-B, per briefing rule 9's
 * new-primitive path). A labeled horizontal share-of-total breakdown: the
 * canonical categorical-composition form in category-leading products
 * (Hevy's set-count-per-muscle-group breakdown, Garmin's Load Focus split,
 * Strava's activity-mix bars; teardown in evidence-p56b/benchmark-teardown.md
 * section 4). NOT a time series: rows are categories, so this is the honest
 * form where a time-axis bar wall would be wrong.
 *
 * Honesty rules: values are counts/quantities of one registered metric,
 * passed pre-computed; shares derive from the visible total only; every row
 * carries its value as text (the bar is reinforcement, never the sole
 * carrier). Callers put the full text summary on the surrounding frame per
 * the chart grammar.
 *
 * Server-safe: pure markup, no hooks, no recharts.
 */

import { cn } from "@/lib/utils";

export type BreakdownRow = {
  /** Member-facing category label ("Chest", "Back"). */
  label: string;
  value: number;
  /** Optional row accent; defaults to the shared `color`. */
  color?: string;
};

export function BreakdownBars({
  rows,
  color = "var(--chart-5)",
  formatValue = (v: number) => String(v),
  maxRows,
  className,
}: {
  /** Categories, largest first (callers sort; this component never re-ranks). */
  rows: readonly BreakdownRow[];
  /** Shared bar accent (lib/chart/palette DOMAIN.*). */
  color?: string;
  formatValue?: (value: number) => string;
  /** Rows beyond this collapse into one explicit "Other" row. */
  maxRows?: number;
  className?: string;
}) {
  const visible =
    maxRows != null && rows.length > maxRows
      ? [
          ...rows.slice(0, maxRows),
          {
            label: "Other",
            value: rows.slice(maxRows).reduce((s, r) => s + r.value, 0),
          },
        ]
      : [...rows];
  const max = Math.max(...visible.map((r) => r.value), 1);
  const total = visible.reduce((s, r) => s + r.value, 0) || 1;

  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      {visible.map((row) => {
        const share = Math.round((row.value / total) * 100);
        return (
          <div className="flex items-center gap-3" key={row.label}>
            <span className="w-16 shrink-0 truncate text-body-sm text-muted-foreground sm:w-20">
              {row.label}
            </span>
            <div className="h-3 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-inset">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(2, (row.value / max) * 100)}%`,
                  backgroundColor: row.color ?? color,
                  opacity: row.label === "Other" ? 0.45 : 0.9,
                }}
              />
            </div>
            <span className="shrink-0 text-meta text-muted-foreground tabular-nums">
              {formatValue(row.value)} · {share}%
            </span>
          </div>
        );
      })}
    </div>
  );
}
