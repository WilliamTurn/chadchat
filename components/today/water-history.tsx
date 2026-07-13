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
    <section className="scroll-mt-20" id="history">
      <h2 className="mb-3 font-medium text-muted-foreground text-sm uppercase tracking-wide">
        History · last 30 days
      </h2>
      {/* Desktop (LAY-1): day rows grid 2-across at xl so 30 days don't run a
          single narrow column down a wide frame. Explicit grid-cols-1 +
          min-w-0 children (s182 gotcha: implicit columns size to max-content
          and overflow-x: clip hides the damage from scrollWidth checks). */}
      <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
        {rows.map((d) => {
          const hitGoal = d.ml >= goalMl;
          const pct = goalMl > 0 ? Math.min(d.ml / goalMl, 1) * 100 : 0;
          return (
            <div
              className="flex min-w-0 items-center gap-4 rounded-xl border border-border bg-card px-4 py-3"
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
