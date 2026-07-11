"use client";

/**
 * The /hydration "Today's log" — one row per individual water entry logged
 * today, newest first, with a per-entry Delete (LC-11). Water previously had
 * no itemized correction path anywhere: the card's "Undo last" only removes
 * the MOST RECENT entry, so a mis-tap from this morning was uncorrectable by
 * lunch. Mirrors the /sleep and /progress History rows: value + time on the
 * left, quiet Delete on the right. Time labels are formatted server-side in
 * the member's time zone.
 */

import { GlassWater } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { removeWaterEntry } from "@/app/nutrition/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type WaterTodayEntry = {
  id: string;
  /** "8:14 AM" on the member's wall clock (formatted server-side). */
  timeLabel: string;
  /** "16 oz" */
  amountLabel: string;
};

function DeleteEntryButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      className="min-h-11 text-muted-foreground"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await removeWaterEntry(id);
          if (result.ok) {
            router.refresh();
          } else {
            toast.error(result.error ?? "Couldn't delete that entry.");
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

export function WaterTodayLog({ entries }: { entries: WaterTodayEntry[] }) {
  if (entries.length === 0) {
    return null;
  }
  return (
    <section>
      <h2 className="mb-3 font-medium text-muted-foreground text-sm uppercase tracking-wide">
        Today's log
      </h2>
      <div className="overflow-hidden rounded-2xl border border-border">
        {entries.map((e, i) => (
          <div
            className={cn(
              "flex items-center justify-between gap-4 bg-card px-5 py-3",
              i > 0 && "border-border border-t"
            )}
            key={e.id}
          >
            <div className="flex min-w-0 items-center gap-3">
              <GlassWater className="size-4 shrink-0 text-sky-400" />
              <span className="font-medium text-sm tabular-nums">
                {e.amountLabel}
              </span>
              <span className="text-muted-foreground text-xs">
                {e.timeLabel}
              </span>
            </div>
            <DeleteEntryButton id={e.id} />
          </div>
        ))}
      </div>
    </section>
  );
}
