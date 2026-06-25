/**
 * Presentational PR list (server-rendered). One row per exercise showing the
 * best estimated 1RM plus the heaviest logged set. Sorted by est. 1RM upstream.
 */

import { Trophy } from "lucide-react";
import type { PersonalRecord } from "@/lib/workouts/stats";

export function PersonalRecords({ records }: { records: PersonalRecord[] }) {
  if (records.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {records.map((r) => (
        <div
          className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3"
          key={r.exerciseName}
        >
          <div className="min-w-0">
            <div className="truncate font-medium text-sm">{r.exerciseName}</div>
            <div className="text-muted-foreground text-xs">
              {r.bestWeight != null
                ? `Top set ${r.bestWeight}${r.bestWeightUnit}${r.bestWeightReps != null ? ` × ${r.bestWeightReps}` : ""}`
                : r.bestReps != null
                  ? `Best ${r.bestReps} reps`
                  : "Logged"}
            </div>
          </div>
          {r.bestEst1RM != null ? (
            <div className="flex shrink-0 items-center gap-1.5 text-right">
              <Trophy className="size-4 text-amber-500" />
              <div>
                <div className="font-display font-semibold text-base leading-none">
                  {r.bestEst1RM}
                  <span className="ml-0.5 font-normal text-muted-foreground text-xs">
                    {r.est1RMUnit}
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
                  est. 1RM
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
