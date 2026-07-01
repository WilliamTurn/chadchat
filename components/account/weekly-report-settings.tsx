"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { saveWeeklyReportSettings } from "@/app/account/actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  formatReportHour,
  REPORT_DAY_OPTIONS,
  reportDayLabel,
} from "@/lib/reports/schedule";

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => hour);

/**
 * The Elite weekly-report controls (FEAT-12): an on/off switch plus a
 * day-of-week + time picker, in the member's own local time. Their IANA
 * timezone is captured silently from the browser on every save — never asked
 * as a question — so the hourly cron can deliver at the right local moment.
 * Optimistic like CheckInSettings — flips instantly, rolls back on failure.
 */
export function WeeklyReportSettings({
  initialEnabled,
  initialDay,
  initialHour,
}: {
  initialEnabled: boolean;
  initialDay: number;
  initialHour: number;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [day, setDay] = useState(initialDay);
  const [hour, setHour] = useState(initialHour);
  const [isPending, startTransition] = useTransition();
  // Resolved after mount — the server doesn't know the browser's zone, and
  // rendering it during SSR would hydration-mismatch.
  const [timezone, setTimezone] = useState<string | null>(null);

  useEffect(() => {
    try {
      setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone ?? null);
    } catch {
      setTimezone(null);
    }
  }, []);

  function save(
    next: { enabled: boolean; day: number; hour: number },
    successMessage: string
  ) {
    const prev = { enabled, day, hour };
    setEnabled(next.enabled);
    setDay(next.day);
    setHour(next.hour);
    startTransition(async () => {
      try {
        await saveWeeklyReportSettings({
          ...next,
          timezone:
            timezone ??
            Intl.DateTimeFormat().resolvedOptions().timeZone ??
            undefined,
        });
        toast.success(successMessage);
      } catch {
        setEnabled(prev.enabled);
        setDay(prev.day);
        setHour(prev.hour);
        toast.error("Couldn't save that. Try again.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="font-medium text-sm">Weekly report from Chad</h3>
          <p className="mt-1 text-muted-foreground text-sm">
            A full written review of your week — training, nutrition, weight
            trend, and next week's adjustments — emailed and saved to{" "}
            <Link
              className="text-foreground underline underline-offset-4"
              href="/reports"
            >
              your reports
            </Link>
            .
          </p>
        </div>
        <Switch
          aria-label="Weekly report from Chad"
          checked={enabled}
          disabled={isPending}
          onCheckedChange={(next) =>
            save(
              { enabled: next, day, hour },
              next
                ? "Weekly reports are on."
                : "Weekly reports are off. Chad will stop writing them."
            )
          }
        />
      </div>

      {enabled && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              disabled={isPending}
              onValueChange={(v) => {
                const nextDay = Number(v);
                if (nextDay !== day) {
                  save(
                    { enabled, day: nextDay, hour },
                    `Your report now lands every ${reportDayLabel(nextDay)}.`
                  );
                }
              }}
              value={String(day)}
            >
              <SelectTrigger
                aria-label="Report day"
                className="w-[9.5rem]"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REPORT_DAY_OPTIONS.map((d) => (
                  <SelectItem key={d.value} value={String(d.value)}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-muted-foreground text-sm">at</span>
            <Select
              disabled={isPending}
              onValueChange={(v) => {
                const nextHour = Number(v);
                if (nextHour !== hour) {
                  save(
                    { enabled, day, hour: nextHour },
                    `Your report now lands around ${formatReportHour(nextHour)}.`
                  );
                }
              }}
              value={String(hour)}
            >
              <SelectTrigger
                aria-label="Report time"
                className="w-[7.5rem]"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HOUR_OPTIONS.map((h) => (
                  <SelectItem key={h} value={String(h)}>
                    {formatReportHour(h)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-muted-foreground text-xs">
            {timezone
              ? `Times are your local time (${timezone.replace(/_/g, " ")}).`
              : "Times are your local time."}{" "}
            Reports come from noreply@send.chadcoach.ai — if one doesn't show
            up, check spam and mark it "Not spam".
          </p>
        </>
      )}
    </div>
  );
}
