"use client";

/**
 * The /hydration "Log a past day" card, hydration's backfill path (DSH-57 /
 * excellence-standards §12: every logger lets the member log past dates).
 * Speaks the same grammar as the rest of the water logging: a calendar-day
 * picker like the sleep form's, ounce presets like the tracker's custom
 * popover, and a one-tap Undo in the success toast wired to the created
 * entry's id (the same delete the itemized Today's log uses). Each add is one
 * entry on that day; repeat to add more.
 */

import { CalendarDays } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";
import { logWaterForDay, removeWaterEntry } from "@/app/nutrition/actions";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCalendarDay, todayLocalISO } from "@/lib/date";
import { ozToMl } from "@/lib/today/water-units";

// Same one-shot ceiling as the tracker's custom add (DSH-48): up to a gallon
// per entry, so a typo can't poison a day's total.
const MAX_OZ = 128;

/** Yesterday on the member's device clock, as a calendar-day ISO. */
function yesterdayLocalISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function WaterBackfill() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [date, setDate] = useState(yesterdayLocalISO());
  const [value, setValue] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const oz = Number(value);
    if (!Number.isFinite(oz) || oz <= 0) {
      toast.error("Enter how much you drank, in ounces.");
      return;
    }
    if (oz > MAX_OZ) {
      toast.error(
        `That's more than a gallon. Log up to ${MAX_OZ} oz at a time.`
      );
      return;
    }
    const dayLabel = formatCalendarDay(new Date(`${date}T12:00:00Z`), {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    startTransition(async () => {
      const result = await logWaterForDay({ day: date, amountMl: ozToMl(oz) });
      if (result.ok) {
        setValue("");
        const id = result.id;
        toast.success(
          `Added ${oz} oz to ${dayLabel}.`,
          id
            ? {
                action: {
                  label: "Undo",
                  onClick: async () => {
                    const undone = await removeWaterEntry(id);
                    if (undone.ok) {
                      toast.success("Removed.");
                      router.refresh();
                    } else {
                      toast.error(undone.error ?? "Couldn't undo that.");
                    }
                  },
                },
              }
            : undefined
        );
        router.refresh();
      } else {
        toast.error(result.error ?? "Couldn't log that.");
      }
    });
  }

  return (
    // scroll-mt clears the sticky header when the panels' "Log a past day"
    // overflow deep-links here (#log-past-day, the P34-Z anchor pattern).
    <section
      className="scroll-mt-20 rounded-2xl border border-border bg-card p-5"
      id="log-past-day"
    >
      <h2 className="flex items-center gap-2 font-medium text-sm">
        <CalendarDays className="size-4 text-sky-400" />
        Log a past day
      </h2>
      <p className="mt-1 text-muted-foreground text-xs">
        Missed logging? Add the water you drank to an earlier day.
      </p>
      <form className="mt-4 flex flex-col gap-3" onSubmit={onSubmit}>
        <div className="flex flex-col gap-2">
          <Label className="text-xs" htmlFor="water-backfill-date">
            Day
          </Label>
          <DatePicker
            className="h-11"
            id="water-backfill-date"
            max={todayLocalISO()}
            onChange={setDate}
            value={date}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label className="text-xs" htmlFor="water-backfill-oz">
            Amount (ounces)
          </Label>
          <div className="flex gap-2">
            {[20, 32, 64].map((preset) => (
              <Button
                className="h-11 flex-1 px-0 text-xs"
                key={preset}
                onClick={() => setValue(String(preset))}
                type="button"
                variant="secondary"
              >
                {preset} oz
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              aria-label="Water amount in ounces"
              className="h-11"
              id="water-backfill-oz"
              inputMode="numeric"
              onChange={(e) => setValue(e.target.value)}
              placeholder="e.g. 64"
              value={value}
            />
            <Button className="h-11 shrink-0" disabled={pending} type="submit">
              {pending ? "Adding…" : "Add water"}
            </Button>
          </div>
        </div>
      </form>
    </section>
  );
}
