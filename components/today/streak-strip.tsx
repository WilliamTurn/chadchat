"use client";

/**
 * The /today streak strip: a flickering flame + count-up day total, plus the
 * shared 7-day dot strip (the Duolingo / Apple-Fitness pattern) showing which
 * of the last seven days had a logged action. The flame only flickers while a
 * streak is live; everything respects reduced motion.
 *
 * The copy states what a streak means in plain language (R2-2), and a "?"
 * popover spells out exactly what counts. Dots render through the shared
 * WeekStrip so labels, the Today marker, and the date tooltip match the
 * tracker cards (R2-1).
 */

import { Flame } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { CountUp } from "@/components/dashboard/count-up";
import { KpiHelp } from "@/components/dashboard/kpi";
import { WeekStrip } from "@/components/today/week-strip";

export type WeekDay = {
  /** Strip label: two-letter weekday, or "Today" for the last slot. */
  label: string;
  /** "Mon, Jun 29" — the real date, for the tooltip. */
  dateLabel: string;
  /** The user logged something on this day. */
  active: boolean;
  /** This is today (bold label + ring). */
  isToday: boolean;
};

export function StreakStrip({
  streak,
  week,
}: {
  streak: number;
  week: WeekDay[];
}) {
  const reduced = useReducedMotion() ?? false;
  const lit = streak > 0;

  const meaning = lit
    ? streak === 1
      ? "You've logged something today. Come back tomorrow to make it 2."
      : `You've logged something ${streak} days in a row. Keep it going.`
    : "No streak yet. Log something today to start one.";

  return (
    <div className="relative mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-background/40 px-4 py-3">
      <div className="flex items-center gap-3">
        <motion.span
          animate={
            lit && !reduced
              ? { scale: [1, 1.12, 0.97, 1.06, 1], rotate: [0, -3, 2, -1, 0] }
              : undefined
          }
          className="inline-flex"
          transition={
            lit && !reduced
              ? {
                  duration: 1.8,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: "easeInOut",
                }
              : undefined
          }
        >
          <Flame
            className={lit ? "size-7 text-blood" : "size-7 text-muted-foreground"}
            fill={lit ? "currentColor" : "none"}
            strokeWidth={2.5}
          />
        </motion.span>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-display font-bold text-2xl leading-none">
              <CountUp value={`${streak} day${streak === 1 ? "" : "s"}`} />
            </span>
            <span className="text-muted-foreground text-sm">streak</span>
            <KpiHelp label="Your streak">
              Consecutive days with at least one log. Anything counts: a meal,
              water, sleep, a workout, or a weigh-in. Miss a day and it resets.
            </KpiHelp>
          </div>
          <div className="mt-1 text-muted-foreground text-sm">{meaning}</div>
        </div>
      </div>

      {/* 7-day week strip (shared treatment) */}
      <WeekStrip
        days={week.map((day) => ({
          key: day.dateLabel,
          label: day.label,
          dateLabel: day.dateLabel,
          isToday: day.isToday,
          dotClassName: `size-3 rounded-full ${
            day.active
              ? "bg-blood shadow-[0_0_8px_var(--color-blood)]"
              : "bg-border"
          } ${day.isToday ? "ring-2 ring-blood/40 ring-offset-1 ring-offset-background" : ""}`,
          value: day.active ? "Logged activity" : "Nothing logged",
        }))}
      />
    </div>
  );
}
