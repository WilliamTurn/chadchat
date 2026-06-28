"use client";

/**
 * The /today streak strip: a flickering flame + count-up day total, plus a
 * 7-dot week strip (the Duolingo / Apple-Fitness pattern) showing which of the
 * last seven days had a logged action. The flame only flickers while a streak
 * is live; everything respects reduced motion.
 */

import { Flame } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { CountUp } from "@/components/dashboard/count-up";

export type WeekDay = {
  /** Single-letter weekday label (S, M, T, …). */
  label: string;
  /** The user logged something on this day. */
  active: boolean;
  /** This is today (rendered with a ring). */
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
          <div className="font-display font-bold text-2xl leading-none">
            <CountUp value={`${streak} day${streak === 1 ? "" : "s"}`} />
          </div>
          <div className="mt-1 text-muted-foreground text-sm">
            {lit
              ? "Current streak — keep showing up."
              : "No streak yet. Log something today to start one."}
          </div>
        </div>
      </div>

      {/* 7-day week strip */}
      <div className="flex items-end gap-2">
        {week.map((day, i) => (
          <div
            // Fixed 7-slot rolling window; index is a stable key here.
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length day slots
            className="flex flex-col items-center gap-1.5"
            key={i}
          >
            <span
              aria-hidden
              className={`size-3 rounded-full ${
                day.active
                  ? "bg-blood shadow-[0_0_8px_var(--color-blood)]"
                  : "bg-border"
              } ${day.isToday ? "ring-2 ring-blood/40 ring-offset-1 ring-offset-background" : ""}`}
            />
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
        ))}
      </div>
    </div>
  );
}
