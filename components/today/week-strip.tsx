"use client";

/**
 * The ONE shared 7-day dot-strip treatment (R2-1/R2-12): the hero streak dots
 * and the hydration card render through this so day labels, the Today marker,
 * and the hover tooltip (real date + value + status) all match. The sleep card
 * is a Recharts bar chart, not dots, but shares the same labels and tooltip
 * content via lib/today/week.ts.
 */

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type WeekStripDay = {
  /** Stable slot key (the day's anchor ms). */
  key: string | number;
  /** "Su".."Sa", or "Today" for the last slot. */
  label: string;
  /** "Mon, Jun 29" — the real date, shown in the tooltip. */
  dateLabel: string;
  isToday: boolean;
  /** Full class set for the dot (fill state + today ring), tone-specific. */
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
          const summary = `${day.dateLabel}: ${day.value}${
            day.status ? `, ${day.status}` : ""
          }`;
          return (
            <Tooltip key={day.key}>
              <TooltipTrigger asChild>
                <div
                  aria-label={summary}
                  className="flex cursor-default flex-col items-center gap-1.5"
                  tabIndex={0}
                >
                  <span aria-hidden className={day.dotClassName} />
                  <span
                    className={`text-[10px] ${
                      day.isToday
                        ? "font-semibold text-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    {day.label}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <span className="font-medium">{day.dateLabel}</span>
                <span aria-hidden>·</span>
                <span>{day.value}</span>
                {day.status ? (
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
