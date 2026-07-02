"use client";

/**
 * The shared "log a night's sleep" form — used by the Sleep & recovery card's
 * popover (create) and the /sleep history rows (edit). Owning the form in one
 * place keeps the two paths identical: same fields, same validation, same
 * server action.
 *
 * Correction-path guarantees (audit P1-3):
 * - Re-picking an already-logged night is no longer a *silent* overwrite — the
 *   form says what it will replace before you save.
 * - A fresh log offers a one-tap "Undo" in its toast (matches the water card),
 *   wired to the created entry's id.
 */

import { Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";
import { logSleep, removeSleep } from "@/app/today/actions";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCalendarDay, todayLocalISO } from "@/lib/date";
import { cn } from "@/lib/utils";

export const QUALITY_LABELS: Record<number, string> = {
  1: "Poor",
  2: "Fair",
  3: "OK",
  4: "Good",
  5: "Great",
};

const HOUR_OPTIONS = Array.from({ length: 13 }, (_, i) => i); // 0–12
const MINUTE_OPTIONS = [0, 15, 30, 45];

/** "7h 30m" / "45m" / "0h". */
export function formatSleepDuration(minutes: number): string {
  if (minutes <= 0) {
    return "0h";
  }
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) {
    return `${m}m`;
  }
  if (m === 0) {
    return `${h}h`;
  }
  return `${h}h ${m}m`;
}

/** An already-logged night, for the "this replaces …" hint. */
export type LoggedNight = { iso: string; minutes: number };

export function SleepLogForm({
  mode = "create",
  defaultDate,
  defaultMinutesTotal,
  defaultQuality = null,
  loggedNights = [],
  onDone,
}: {
  /** "edit" locks the date to the night being corrected. */
  mode?: "create" | "edit";
  /** Calendar-day ISO the date field starts at (edit: the fixed night). */
  defaultDate?: string;
  defaultMinutesTotal?: number;
  defaultQuality?: number | null;
  /** Nights that already have an entry, so an overwrite is announced. */
  loggedNights?: LoggedNight[];
  /** Called after a successful save (close the popover, etc.). */
  onDone?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [date, setDate] = useState(defaultDate ?? todayLocalISO());
  const [hours, setHours] = useState(
    defaultMinutesTotal != null ? String(Math.floor(defaultMinutesTotal / 60)) : "7"
  );
  const [minutes, setMinutes] = useState(
    defaultMinutesTotal != null ? String(defaultMinutesTotal % 60) : "30"
  );
  const [quality, setQuality] = useState<number | null>(defaultQuality);

  // The entry the selected night would replace (create mode only — an edit is
  // an intentional replacement).
  const replacing =
    mode === "create"
      ? (loggedNights.find((n) => n.iso === date) ?? null)
      : null;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const total = Number(hours) * 60 + Number(minutes);
    if (!Number.isFinite(total) || total <= 0) {
      toast.error("Enter how long you slept.");
      return;
    }
    startTransition(async () => {
      const result = await logSleep({
        recordedAt: date,
        minutes: total,
        quality,
      });
      if (result.ok) {
        if (mode === "edit" || !result.id) {
          toast.success(mode === "edit" ? "Sleep updated." : "Sleep logged.");
        } else {
          const id = result.id;
          toast.success("Sleep logged.", {
            action: {
              label: "Undo",
              onClick: async () => {
                const undone = await removeSleep(id);
                if (undone.ok) {
                  toast.success("Removed.");
                  router.refresh();
                } else {
                  toast.error(undone.error ?? "Couldn't undo that.");
                }
              },
            },
          });
        }
        router.refresh();
        onDone?.();
      } else {
        toast.error(result.error ?? "Couldn't log that.");
      }
    });
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={onSubmit}>
      <div className="flex flex-col gap-1.5">
        <span className="font-medium text-sm">
          {mode === "edit" ? "Edit sleep" : "Log sleep"}
        </span>
        <span className="text-muted-foreground text-xs">
          {mode === "edit"
            ? `Night of ${formatCalendarDay(new Date(`${date}T12:00:00Z`), {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}.`
            : "How long did you sleep last night?"}
        </span>
      </div>

      {mode === "create" && (
        <div className="flex flex-col gap-2">
          <Label className="text-xs" htmlFor="sleep-date">
            Night of
          </Label>
          <DatePicker
            id="sleep-date"
            max={todayLocalISO()}
            onChange={setDate}
            value={date}
          />
          {replacing && (
            <p className="text-amber-500 text-xs dark:text-amber-400">
              Replaces the {formatSleepDuration(replacing.minutes)} already
              logged for this night.
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label className="text-xs">Time asleep</Label>
        <div className="flex items-center gap-2">
          <Select onValueChange={setHours} value={hours}>
            <SelectTrigger aria-label="Hours slept" className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HOUR_OPTIONS.map((h) => (
                <SelectItem key={h} value={String(h)}>
                  {h} h
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select onValueChange={setMinutes} value={minutes}>
            <SelectTrigger aria-label="Minutes slept" className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MINUTE_OPTIONS.map((m) => (
                <SelectItem key={m} value={String(m)}>
                  {m} m
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label className="text-xs">Quality (optional)</Label>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              aria-label={`${n} star${n === 1 ? "" : "s"}: ${QUALITY_LABELS[n]}`}
              aria-pressed={quality != null && n <= quality}
              className="rounded p-0.5 transition-transform hover:scale-110"
              key={n}
              onClick={() => setQuality((q) => (q === n ? null : n))}
              type="button"
            >
              <Star
                className={cn(
                  "size-5",
                  quality != null && n <= quality
                    ? "fill-indigo-400 text-indigo-400"
                    : "text-muted-foreground/40"
                )}
              />
            </button>
          ))}
          {quality != null && (
            <span className="ml-1 text-muted-foreground text-xs">
              {QUALITY_LABELS[quality]}
            </span>
          )}
        </div>
      </div>

      <Button className="mt-1" disabled={pending} type="submit">
        {pending ? "Saving…" : mode === "edit" ? "Save changes" : "Log sleep"}
      </Button>
    </form>
  );
}
