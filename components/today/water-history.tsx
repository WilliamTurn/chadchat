import { Check } from "lucide-react";
import { formatOz, formatVolume } from "@/lib/today/water-units";
import { weekSlotDateLabel } from "@/lib/today/week";

/**
 * Day-by-day hydration history for the /hydration detail page (VF-6), matching
 * the /workouts History section: one row per logged day, newest first, with a
 * fill bar against the goal and a goal-hit check. Server-safe presentational.
 */

const HISTORY_DAYS = 30;

export function WaterHistory({
  days,
  goalMl,
}: {
  /** Daily totals, oldest → newest (tz-anchored day keys). */
  days: { t: number; ml: number }[];
  goalMl: number;
}) {
  const cutoff = Date.now() - HISTORY_DAYS * 86_400_000;
  const rows = days.filter((d) => d.t >= cutoff).reverse();
  if (rows.length === 0) {
    return null;
  }

  return (
    <section id="history">
      <h2 className="mb-3 font-medium text-muted-foreground text-sm uppercase tracking-wide">
        History · last 30 days
      </h2>
      <div className="flex flex-col gap-2">
        {rows.map((d) => {
          const hitGoal = d.ml >= goalMl;
          const pct = goalMl > 0 ? Math.min(d.ml / goalMl, 1) * 100 : 0;
          return (
            <div
              className="flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-3"
              key={d.t}
            >
              <span className="w-24 shrink-0 text-muted-foreground text-xs">
                {weekSlotDateLabel(new Date(d.t))}
              </span>
              <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-foreground/10">
                <div
                  className={`h-full rounded-full ${
                    hitGoal ? "bg-sky-400" : "bg-sky-400/40"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-16 shrink-0 text-right font-medium text-sm tabular-nums">
                {formatOz(d.ml)}
              </span>
              {hitGoal ? (
                <Check
                  aria-label={`Goal of ${formatVolume(goalMl)} hit`}
                  className="size-4 shrink-0 text-sky-400"
                />
              ) : (
                <span aria-hidden="true" className="size-4 shrink-0" />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
