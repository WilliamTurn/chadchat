"use client";

import { Check, ChevronDown } from "lucide-react";
import { useState } from "react";
import { removeWaterEntry } from "@/app/nutrition/actions";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/ui/confirm-undo";
import { toastError, toastReceipt } from "@/components/ui/toast";
import { formatOz, formatVolume } from "@/lib/today/water-units";
import { weekSlotDateLabel } from "@/lib/today/week";
import { cn } from "@/lib/utils";

/**
 * Day-by-day hydration history for the /hydration detail page (VF-6), matching
 * the /workouts History section: one row per logged day, newest first, with a
 * fill bar against THAT day's effective-dated goal (FIX-07) and a goal-hit
 * check.
 *
 * P56-C (FIX-26) completed the logger capability law here: each day expands
 * to its individual entries, and every entry has a named-confirmation Delete
 * (destructive confirm-or-undo law; a mistyped backfill was previously
 * permanently uncorrectable once the Undo toast passed). Correction path =
 * delete the wrong entry + backfill the right amount. The empty state is a
 * designed section, never a missing anchor target.
 */

const HISTORY_DAYS = 30;

export type WaterHistoryEntry = {
  id: string;
  /** "4:47 PM" in the member's timezone (noon for backfilled days). */
  timeLabel: string;
  amountLabel: string;
};

export type WaterHistoryDay = {
  /** The day's 00:00-UTC anchor ms. */
  t: number;
  ml: number;
  /** The goal active on that day (FIX-07 effective-dated). */
  goalMl: number;
  /** The day's individual entries, oldest first. */
  entries: WaterHistoryEntry[];
};

function DayEntries({
  dateLabel,
  entries,
}: {
  dateLabel: string;
  entries: WaterHistoryEntry[];
}) {
  if (entries.length === 0) {
    return (
      <p className="px-1 pb-1 text-muted-foreground text-xs">
        No individual entries in the last {HISTORY_DAYS} days for this day.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-1 pb-1">
      {entries.map((e) => (
        <li
          className="flex items-center justify-between gap-3 rounded-lg bg-background/40 py-1 pr-1 pl-3"
          key={e.id}
        >
          <span className="text-muted-foreground text-xs tabular-nums">
            {e.timeLabel}
          </span>
          <span className="min-w-0 flex-1 text-right font-medium text-sm tabular-nums">
            {e.amountLabel}
          </span>
          <ConfirmActionDialog
            confirmLabel="Delete entry"
            consequence="Its ounces leave this day's total, your streaks, and your trend."
            onConfirm={async () => {
              const result = await removeWaterEntry(e.id);
              if (!result.ok) {
                toastError(
                  result.error ?? "We couldn't delete that entry. Try again."
                );
                throw new Error("delete failed");
              }
              toastReceipt(
                `Deleted the ${dateLabel} entry of ${e.amountLabel}.`
              );
            }}
            title={`Delete the ${dateLabel} entry of ${e.amountLabel}?`}
            trigger={
              <Button
                className="min-h-11 text-muted-foreground sm:min-h-8"
                size="sm"
                variant="ghost"
              >
                Delete
              </Button>
            }
          />
        </li>
      ))}
    </ul>
  );
}

function DayRow({ day, hitGoal }: { day: WaterHistoryDay; hitGoal: boolean }) {
  const [open, setOpen] = useState(false);
  const dateLabel = weekSlotDateLabel(new Date(day.t));
  const pct = day.goalMl > 0 ? Math.min(day.ml / day.goalMl, 1) * 100 : 0;
  return (
    <div className="min-w-0 rounded-xl border border-border bg-card px-4 py-2">
      <Button
        aria-expanded={open}
        className="flex h-auto min-h-11 w-full items-center justify-start gap-4 px-0 text-left font-normal hover:bg-transparent"
        onClick={() => setOpen((v) => !v)}
        type="button"
        variant="ghost"
      >
        <span className="w-24 shrink-0 text-muted-foreground text-xs">
          {dateLabel}
        </span>
        <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-foreground/10">
          <div
            className={`h-full rounded-full ${
              hitGoal
                ? "bg-sky-600 dark:bg-sky-400"
                : "bg-sky-600/40 dark:bg-sky-400/40"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="w-16 shrink-0 text-right font-medium text-sm tabular-nums">
          {formatOz(day.ml)}
        </span>
        {hitGoal ? (
          <Check
            aria-label={`Goal of ${formatVolume(day.goalMl)} hit`}
            className="size-4 shrink-0 text-sky-600 dark:text-sky-400"
          />
        ) : (
          <span aria-hidden="true" className="size-4 shrink-0" />
        )}
        <ChevronDown
          aria-hidden
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </Button>
      {open && <DayEntries dateLabel={dateLabel} entries={day.entries} />}
    </div>
  );
}

export function WaterHistory({ days }: { days: WaterHistoryDay[] }) {
  const cutoff = Date.now() - HISTORY_DAYS * 86_400_000;
  const rows = days.filter((d) => d.t >= cutoff).reverse();

  return (
    <section className="scroll-mt-20" id="history">
      <h2 className="mb-3 font-medium text-muted-foreground text-sm uppercase tracking-wide">
        Hydration History · last 30 days
      </h2>
      {rows.length === 0 ? (
        // Designed empty (never a missing anchor target): what is absent and
        // what appears once they log (first-run.md).
        <p className="rounded-xl border border-border border-dashed bg-card/50 px-4 py-6 text-muted-foreground text-sm">
          No days logged in the last 30 days. Water you log lands here, day by
          day, with every entry editable.
        </p>
      ) : (
        /* Desktop (LAY-1): day rows grid 2-across at xl so 30 days don't run
           a single narrow column down a wide frame. Explicit grid-cols-1 +
           min-w-0 children (s182 gotcha). */
        <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
          {rows.map((d) => (
            <DayRow day={d} hitGoal={d.ml >= d.goalMl} key={d.t} />
          ))}
        </div>
      )}
    </section>
  );
}
