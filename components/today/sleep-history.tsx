"use client";

/**
 * The /sleep "History" list — one row per logged night with edit + delete, so
 * a fat-fingered entry can finally be corrected or removed (audit P1-3: sleep
 * previously had no correction path anywhere in the app). Mirrors the
 * /progress weigh-in History rows: date + value on the left, quiet Edit /
 * Delete on the right.
 */

import { Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { removeSleep } from "@/app/today/actions";
import {
  formatSleepDuration,
  SleepLogForm,
} from "@/components/today/sleep-log-form";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
};

function EditNightButton({ entry }: { entry: SleepHistoryEntry }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        {/* min-h-11: 44px touch targets on the row actions (mobile gate). */}
        <Button
          className="min-h-11 text-muted-foreground"
          size="sm"
          variant="ghost"
        >
          Edit
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <SleepLogForm
          defaultDate={entry.iso}
          defaultMinutesTotal={entry.minutes}
          defaultQuality={entry.quality}
          mode="edit"
          onDone={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}

function DeleteNightButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      className="min-h-11 text-muted-foreground"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await removeSleep(id);
          if (result.ok) {
            router.refresh();
          } else {
            toast.error(result.error ?? "Couldn't delete that night.");
          }
        })
      }
      size="sm"
      variant="ghost"
    >
      {pending ? "Deleting…" : "Delete"}
    </Button>
  );
}

export function SleepHistory({
  entries,
  goalMinutes = SLEEP_GOAL_MINUTES,
}: {
  entries: SleepHistoryEntry[];
  /** The user's nightly target (DSH-40); defaults to the recommended 7h. */
  goalMinutes?: number;
}) {
  if (entries.length === 0) {
    return null;
  }
  return (
    <section>
      <h2 className="mb-4 font-medium text-lg">History</h2>
      {/* Desktop (LAY-1): night rows grid up (2-across from sm, 3 at xl) so
          weeks of history don't run one narrow column down the wide frame.
          Explicit grid-cols-1 + min-w-0 children (s182 gotcha: implicit
          columns size to max-content and overflow-x: clip hides the damage
          from scrollWidth checks). */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {entries.map((e) => {
          const hit = e.minutes >= goalMinutes;
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
                    {formatSleepDuration(e.minutes)}
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
                <DeleteNightButton id={e.id} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
