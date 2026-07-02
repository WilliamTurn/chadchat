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
        <Button className="text-muted-foreground" size="sm" variant="ghost">
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
      className="text-muted-foreground"
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

export function SleepHistory({ entries }: { entries: SleepHistoryEntry[] }) {
  if (entries.length === 0) {
    return null;
  }
  return (
    <section>
      <h2 className="mb-4 font-medium text-lg">History</h2>
      <div className="overflow-hidden rounded-2xl border border-border">
        {entries.map((e, i) => {
          const hit = e.minutes >= SLEEP_GOAL_MINUTES;
          const quality = e.quality;
          return (
            <div
              className={cn(
                "flex items-center justify-between gap-4 bg-card px-5 py-3.5",
                i > 0 && "border-border border-t"
              )}
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
              <div className="flex shrink-0 items-center gap-1">
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
