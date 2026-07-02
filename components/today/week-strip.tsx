"use client";

/**
 * The ONE shared 7-day dot-strip treatment (R2-1/R2-12): the hero streak dots
 * and the hydration card render through this so day labels, the today-cue,
 * and the hover tooltip (real date + value + status) all match. The sleep
 * card is a Recharts bar chart, not dots, but shares the same labels and
 * tooltip content via lib/today/week.ts.
 *
 * The strip is the user's Sunday-start calendar week (VF-10), and the
 * today-cue is STRUCTURAL (VF-11): today's dot gets a high-contrast
 * foreground ring, not a red-on-red halo and not a literal "Today" label.
 * Days later this week render as quiet hollow "upcoming" slots regardless of
 * the caller's fill class.
 */

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type WeekStripDay = {
  /** Stable slot key (the day's anchor ms). */
  key: string | number;
  /** "Su".."Sa". */
  label: string;
  /** "Mon, Jun 29" — the real date, shown in the tooltip. */
  dateLabel: string;
  isToday: boolean;
  /** After today this week: the strip renders it as a hollow slot. */
  isFuture?: boolean;
  /** Fill classes for the dot (logged/empty state), tone-specific. */
  dotClassName: string;
  /** Tooltip value line, e.g. "40 oz" / "Logged" / "Nothing logged". */
  value: string;
  /** Optional tooltip status, e.g. "Goal hit". */
  status?: string;
};

export function WeekStrip({ days }: { days: WeekStripDay[] }) {
  return (
    <TooltipProvider>
      <div className="flex items-end gap-2">
        {days.map((day) => {
          const value = day.isFuture ? "Upcoming" : day.value;
          const summary = `${day.dateLabel}: ${value}${
            day.status && !day.isFuture ? `, ${day.status}` : ""
          }`;
          return (
            <Tooltip key={day.key}>
              <TooltipTrigger asChild>
                <div
                  aria-label={summary}
                  className="flex cursor-default flex-col items-center gap-1.5"
                  tabIndex={0}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "size-3 rounded-full",
                      day.isFuture
                        ? "border border-border bg-transparent"
                        : day.dotClassName,
                      // Structural today-cue (VF-11): one high-contrast ring,
                      // the same on every strip tone.
                      day.isToday &&
                        "ring-2 ring-foreground/80 ring-offset-2 ring-offset-background"
                    )}
                  />
                  <span
                    className={cn(
                      "text-[10px]",
                      day.isToday
                        ? "font-semibold text-foreground"
                        : day.isFuture
                          ? "text-muted-foreground/50"
                          : "text-muted-foreground"
                    )}
                  >
                    {day.label}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <span className="font-medium">{day.dateLabel}</span>
                <span aria-hidden>·</span>
                <span>{value}</span>
                {day.status && !day.isFuture ? (
                  <>
                    <span aria-hidden>·</span>
                    <span>{day.status}</span>
                  </>
                ) : null}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
