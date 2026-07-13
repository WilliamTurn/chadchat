"use client";

/**
 * The /hydration "Today's log": one row per individual water entry logged
 * today, newest first, with a per-entry Delete (LC-11). Water previously had
 * no itemized correction path anywhere: the card's "Undo last" only removes
 * the MOST RECENT entry, so a mis-tap from this morning was uncorrectable by
 * lunch. Mirrors the /sleep and /progress History rows: value + time on the
 * left, quiet Delete on the right. Time labels are formatted server-side in
 * the member's time zone.
 *
 * Deletion confirms with the NAMED entry via ConfirmActionDialog (P2-Z):
 * one-tap unrecoverable deletes are banned everywhere, history rows included
 * (owner confirm-or-undo law s185 / delete-entry-confirmed in panels.ts).
 */

import { GlassWater } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { removeWaterEntry } from "@/app/nutrition/actions";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/ui/confirm-undo";
import { cn } from "@/lib/utils";

export type WaterTodayEntry = {
  id: string;
  /** "8:14 AM" on the member's wall clock (formatted server-side). */
  timeLabel: string;
  /** "16 oz" */
  amountLabel: string;
};

function DeleteEntryButton({ entry }: { entry: WaterTodayEntry }) {
  const router = useRouter();
  // ConfirmActionDialog contract: resolve closes, a rejection keeps the
  // dialog open so the member can retry.
  async function destroy() {
    const result = await removeWaterEntry(entry.id);
    if (!result.ok) {
      toast.error(result.error ?? "Couldn't delete that entry.");
      throw new Error("Water entry delete failed");
    }
    router.refresh();
  }
  return (
    <ConfirmActionDialog
      confirmLabel="Delete entry"
      consequence="Today's total updates immediately."
      onConfirm={destroy}
      title={`Delete the ${entry.timeLabel} entry of ${entry.amountLabel}?`}
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
            <DeleteEntryButton entry={e} />
          </div>
        ))}
      </div>
    </section>
  );
}
