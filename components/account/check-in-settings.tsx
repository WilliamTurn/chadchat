"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { saveCheckInSettings } from "@/app/account/actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  EVENING_HOUR_CHOICES,
  MORNING_HOUR_CHOICES,
  maxDaysForFrequency,
} from "@/lib/checkins/schedule";
import type { CheckInFrequency } from "@/lib/db/schema";
import { formatReportHour, reportDayLabel } from "@/lib/reports/schedule";
import { cn } from "@/lib/utils";

const FREQUENCIES: { value: CheckInFrequency; label: string }[] = [
  { value: "daily", label: "Every day" },
  { value: "three_per_week", label: "A few days a week" },
  { value: "weekly", label: "One day a week" },
];

const DAY_CHIPS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Settings = {
  enabled: boolean;
  frequency: CheckInFrequency;
  days: number[];
  morningHour: number;
  eveningHour: number;
};

/** "On Mondays, Wednesdays and Fridays" / "Every Tuesday" style day phrase. */
function dayPhrase(frequency: CheckInFrequency, days: number[]): string {
  if (frequency === "daily") {
    return "Every day";
  }
  const labels = [...days].sort((a, b) => a - b).map(reportDayLabel);
  if (labels.length === 1) {
    return `Every ${labels[0]}`;
  }
  return `On ${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}`;
}

/**
 * The Elite check-in controls (FEAT-11 + FEAT-15): an on/off switch, a
 * frequency picker, day chips for the non-daily frequencies, and the exact
 * morning/evening delivery times, all in the member's own local time. The
 * browser's IANA timezone rides along silently on every save, same as the
 * weekly report. Optimistic: flips instantly, rolls back on failure.
 */
export function CheckInSettings({
  initialEnabled,
  initialFrequency,
  initialDays,
  initialMorningHour,
  initialEveningHour,
}: {
  initialEnabled: boolean;
  initialFrequency: CheckInFrequency;
  initialDays: number[];
  initialMorningHour: number;
  initialEveningHour: number;
}) {
  const [settings, setSettings] = useState<Settings>({
    enabled: initialEnabled,
    frequency: initialFrequency,
    days: initialDays,
    morningHour: initialMorningHour,
    eveningHour: initialEveningHour,
  });
  const [isPending, startTransition] = useTransition();
  // Resolved after mount: the server doesn't know the browser's zone, and
  // rendering it during SSR would hydration-mismatch.
  const [timezone, setTimezone] = useState<string | null>(null);

  useEffect(() => {
    try {
      setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone ?? null);
    } catch {
      setTimezone(null);
    }
  }, []);

  function save(next: Settings, successMessage: string) {
    const prev = settings;
    setSettings(next);
    startTransition(async () => {
      try {
        await saveCheckInSettings({
          ...next,
          timezone:
            timezone ??
            Intl.DateTimeFormat().resolvedOptions().timeZone ??
            undefined,
        });
        toast.success(successMessage);
      } catch {
        setSettings(prev);
        toast.error("Couldn't save that. Try again.");
      }
    });
  }

  function pickFrequency(frequency: CheckInFrequency) {
    // Keep the day picks sane for the new frequency: one day for weekly, up
    // to three for a-few-days-a-week.
    const days = settings.days.slice(0, maxDaysForFrequency(frequency));
    const label = FREQUENCIES.find((f) => f.value === frequency)?.label ?? "";
    save(
      { ...settings, frequency, days },
      `Chad will check in ${label.toLowerCase()}.`
    );
  }

  function toggleDay(day: number) {
    const max = maxDaysForFrequency(settings.frequency);
    let days: number[];
    if (settings.days.includes(day)) {
      if (settings.days.length === 1) {
        toast.error("Keep at least one day, or switch check-ins off.");
        return;
      }
      days = settings.days.filter((d) => d !== day);
    } else if (max === 1) {
      days = [day];
    } else if (settings.days.length >= max) {
      toast.error(`Pick up to ${max} days. Unpick one first.`);
      return;
    } else {
      days = [...settings.days, day];
    }
    days = [...days].sort((a, b) => a - b);
    save(
      { ...settings, days },
      `Check-in days updated: ${days.map((d) => DAY_CHIPS[d]).join(", ")}.`
    );
  }

  const { enabled, frequency, days, morningHour, eveningHour } = settings;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="font-medium text-sm">Check-ins from Chad</h3>
          <p className="mt-1 text-muted-foreground text-sm">
            Chad emails you first: a morning brief to set the day, and an
            evening callout if you go quiet. Pick the days and times below.
          </p>
        </div>
        <Switch
          aria-label="Email check-ins from Chad"
          checked={enabled}
          disabled={isPending}
          onCheckedChange={(next) =>
            save(
              { ...settings, enabled: next },
              next
                ? "Check-ins are on. Chad will reach out."
                : "Check-ins are off. Chad will wait for you."
            )
          }
        />
      </div>

      {enabled && (
        <>
          <div className="inline-flex flex-wrap gap-1 self-start rounded-lg border border-border bg-background/40 p-1">
            {FREQUENCIES.map((f) => (
              <button
                className={cn(
                  "rounded-md px-3 py-1.5 font-medium text-sm transition-colors",
                  frequency === f.value
                    ? "bg-blood/10 text-blood"
                    : "text-muted-foreground hover:text-foreground"
                )}
                disabled={isPending}
                key={f.value}
                onClick={() => {
                  if (f.value !== frequency) {
                    pickFrequency(f.value);
                  }
                }}
                type="button"
              >
                {f.label}
              </button>
            ))}
          </div>

          {frequency !== "daily" && (
            <div className="flex flex-col gap-1.5">
              <span className="text-muted-foreground text-xs">
                {frequency === "weekly"
                  ? "Which day Chad emails you:"
                  : `Which days Chad emails you (up to ${maxDaysForFrequency(frequency)}):`}
              </span>
              <div className="flex flex-wrap gap-1">
                {DAY_CHIPS.map((label, day) => (
                  <button
                    aria-pressed={days.includes(day)}
                    className={cn(
                      "rounded-md border px-2.5 py-1.5 font-medium text-xs transition-colors",
                      days.includes(day)
                        ? "border-blood/40 bg-blood/10 text-blood"
                        : "border-border text-muted-foreground hover:text-foreground"
                    )}
                    disabled={isPending}
                    key={label}
                    onClick={() => toggleDay(day)}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm">
                Morning brief at
              </span>
              <Select
                disabled={isPending}
                onValueChange={(v) => {
                  const next = Number(v);
                  if (next !== morningHour) {
                    save(
                      { ...settings, morningHour: next },
                      `Morning brief now lands around ${formatReportHour(next)}.`
                    );
                  }
                }}
                value={String(morningHour)}
              >
                <SelectTrigger
                  aria-label="Morning brief time"
                  className="w-[7.5rem]"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MORNING_HOUR_CHOICES.map((h) => (
                    <SelectItem key={h} value={String(h)}>
                      {formatReportHour(h)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm">
                Evening callout at
              </span>
              <Select
                disabled={isPending}
                onValueChange={(v) => {
                  const next = Number(v);
                  if (next !== eveningHour) {
                    save(
                      { ...settings, eveningHour: next },
                      `Evening callout now lands around ${formatReportHour(next)}.`
                    );
                  }
                }}
                value={String(eveningHour)}
              >
                <SelectTrigger
                  aria-label="Evening callout time"
                  className="w-[7.5rem]"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENING_HOUR_CHOICES.map((h) => (
                    <SelectItem key={h} value={String(h)}>
                      {formatReportHour(h)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <p className="text-muted-foreground text-xs">
            {dayPhrase(frequency, days)}: a morning brief around{" "}
            {formatReportHour(morningHour)}, plus an evening callout around{" "}
            {formatReportHour(eveningHour)} if you go quiet.{" "}
            {timezone
              ? `Times are your local time (${timezone.replace(/_/g, " ")}).`
              : "Times are your local time."}
          </p>
          <p className="text-muted-foreground text-xs">
            Check-ins come from noreply@send.chadcoach.ai. If you don't see
            one, check your spam or promotions folder and mark it "Not spam"
            so the rest reach your inbox.
          </p>
        </>
      )}
    </div>
  );
}
