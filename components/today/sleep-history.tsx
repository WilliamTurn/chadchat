"use client";

/**
 * The /sleep "History" list: one row per logged night with edit + delete, so
 * a fat-fingered entry can finally be corrected or removed (audit P1-3: sleep
 * previously had no correction path anywhere in the app). Mirrors the
 * /progress weigh-in History rows: date + value on the left, quiet Edit /
 * Delete on the right.
 *
 * P56-C (FIX-27) brought the rows onto the platform overlays: Edit opens the
 * shared LogSleepDialog (the FIX-17 AdaptiveDialog; the old popover form was
 * the banned s168 pattern), and Delete confirms with the NAMED night through
 * ConfirmActionDialog (destructive confirm-or-undo law; one-tap unrecoverable
 * deletes are banned, history rows included).
 */

import { Star } from "lucide-react";
import { useState, useTransition } from "react";
import { logSleep, removeSleep } from "@/app/today/actions";
import {
  LogSleepDialog,
  type SleepLogInput,
} from "@/components/today/sleep-overlays";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/ui/confirm-undo";
import { toastError, toastReceipt } from "@/components/ui/toast";
import { formatMinutesAsDuration } from "@/lib/contracts/units";
import { SLEEP_GOAL_MINUTES } from "@/lib/validation/sleep";
import { cn } from "@/lib/utils";

export type SleepHistoryEntry = {
  id: string;
  /** Calendar-day ISO of the night (feeds the edit form). */
  iso: string;
  /** "Sun, Jun 29" display label. */
  dateLabel: string;
  minutes: number;
  quality: number | null;
  /** The goal active on that night (FIX-07); falls back to the page goal. */
  goalMinutes?: number;
};

function EditNightButton({ entry }: { entry: SleepHistoryEntry }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function save(input: SleepLogInput) {
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof logSleep>>;
      try {
        result = await logSleep(input);
      } catch {
        result = { ok: false };
      }
      if (!result.ok) {
        toastError(result.error ?? "We couldn't save that night. Try again.");
        return;
      }
      setOpen(false);
      toastReceipt(
        `Sleep updated for ${entry.dateLabel}. ${formatMinutesAsDuration(input.minutes)}.`
      );
    });
  }

  return (
    <>
      {/* min-h-11: 44px touch targets on the row actions (mobile gate). */}
      <Button
        className="min-h-11 text-muted-foreground"
        onClick={() => setOpen(true)}
        size="sm"
        variant="ghost"
      >
        Edit
      </Button>
      <LogSleepDialog
        defaultDate={entry.iso}
        defaultMinutes={entry.minutes}
        defaultQuality={entry.quality}
        key={`${entry.iso}-${entry.minutes}-${entry.quality}`}
        mode="edit"
        onOpenChange={setOpen}
        onSave={save}
        open={open}
        pending={pending}
      />
    </>
  );
}

function DeleteNightButton({ entry }: { entry: SleepHistoryEntry }) {
  return (
    <ConfirmActionDialog
      confirmLabel="Delete night"
      consequence="Its hours leave your week, trends, and streaks."
      onConfirm={async () => {
        const result = await removeSleep(entry.id);
        if (!result.ok) {
          toastError(result.error ?? "We couldn't delete that night. Try again.");
          throw new Error("delete failed");
        }
        toastReceipt(`Deleted the night of ${entry.dateLabel}.`);
      }}
      title={`Delete the ${entry.dateLabel} night of ${formatMinutesAsDuration(entry.minutes)}?`}
      trigger={
        <Button
          className="min-h-11 text-muted-foreground"
          size="sm"
          variant="ghost"
        >
          Delete
        </Button>
      }
    />
  );
}

export function SleepHistory({
  entries,
  goalMinutes = SLEEP_GOAL_MINUTES,
}: {
  entries: SleepHistoryEntry[];
  /** The current nightly target (DSH-40); per-night goals override (FIX-07). */
  goalMinutes?: number;
}) {
  return (
    // scroll-mt clears the sticky header when the panel's named detail link
    // deep-links here (#history, the P34-Z anchor pattern). @container: the
    // section renders inside BOTH the wide frame and the sparse centered
    // max-w-xl column, so columns follow the CONTAINER, not the viewport
    // (pre-delivery audit P2: a lone first night was jammed into a 3-column
    // grid cell inside the centered column).
    <section className="scroll-mt-20 @container" id="history">
      <h2 className="mb-4 font-medium text-lg">History</h2>
      {entries.length === 0 ? (
        // Designed empty (never a missing anchor target).
        <p className="rounded-xl border border-border border-dashed bg-card/50 px-4 py-6 text-muted-foreground text-sm">
          No nights logged yet. Every night you log lands here with edit and
          delete.
        </p>
      ) : (
      <div className="grid grid-cols-1 gap-2 @2xl:grid-cols-2 @5xl:grid-cols-3">
        {entries.map((e) => {
          const hit = e.minutes >= (e.goalMinutes ?? goalMinutes);
          const quality = e.quality;
          return (
            <div
              className="flex min-w-0 items-center justify-between gap-4 rounded-xl border border-border bg-card px-4 py-3"
              key={e.id}
            >
              <div className="min-w-0">
                <div className="font-medium text-sm">
                  {e.dateLabel}
                  <span
                    className={cn(
                      "ml-2 tabular-nums",
                      hit ? "text-emerald-500" : "text-muted-foreground"
                    )}
                  >
                    {formatMinutesAsDuration(e.minutes)}
                  </span>
                </div>
                {quality != null && (
                  <span
                    aria-label={`Quality ${quality} of 5`}
                    className="mt-0.5 inline-flex items-center gap-0.5"
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        className={cn(
                          "size-3",
                          n <= quality
                            ? "fill-indigo-400 text-indigo-400"
                            : "text-muted-foreground/30"
                        )}
                        key={n}
                      />
                    ))}
                  </span>
                )}
              </div>
              {/* gap-2: keep the destructive Delete a full 8px clear of Edit
                  so a thumb aiming for one can't land on the other. */}
              <div className="flex shrink-0 items-center gap-2">
                <EditNightButton entry={e} />
                <DeleteNightButton entry={e} />
              </div>
            </div>
          );
        })}
      </div>
      )}
    </section>
  );
}
