import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * PANEL-SCALE VISUAL PRIMITIVES (P2-B). The compact rings/bars/sparklines the
 * panel role contract requires in every panel's `visual` slot (owner law
 * s181; scale note in lib/contracts/panels.ts: ring/bar on status cells,
 * strip + chart on trackers). These are NOT the shared chart system: full
 * charts (axes, ranges, scrubbing, coverage captions) are P2-C's
 * `components/charts/**`, and trend panels adopt them at integration (P2-Z).
 *
 * Everything here is deterministic, server-safe SVG/CSS: no animation state,
 * no randomness, colors via currentColor so callers stay on semantic tokens
 * (emerald toward goal, blood away, domain accents; the Color Law).
 */

/** Compact completion ring (the Whoop/Oura/Apple ring language). */
export function ProgressRing({
  fraction,
  label,
  className,
  size = 56,
}: {
  /** 0..1+; the arc clamps at a full lap, the label may exceed 100%. */
  fraction: number;
  /** Center text; defaults to the rounded percent. */
  label?: ReactNode;
  /** Color class for the arc (e.g. "text-positive-text"). */
  className?: string;
  size?: number;
}) {
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const filled = Math.min(Math.max(fraction, 0), 1);
  return (
    <div
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg
        aria-hidden
        className="-rotate-90"
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        width={size}
      >
        <circle
          className="stroke-border"
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={r}
          strokeWidth={stroke}
        />
        <circle
          className={cn("stroke-current", className)}
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={r}
          strokeDasharray={`${c * filled} ${c}`}
          strokeLinecap={filled > 0 ? "round" : "butt"}
          strokeWidth={stroke}
        />
      </svg>
      <span className="absolute font-semibold text-meta tabular-nums">
        {label ?? `${Math.round(fraction * 100)}%`}
      </span>
    </div>
  );
}

/** Thin horizontal goal bar (today's progress toward a daily target). */
export function GoalProgressBar({
  fraction,
  className,
}: {
  fraction: number;
  /** Fill color class (e.g. "bg-positive"). */
  className?: string;
}) {
  const filled = Math.min(Math.max(fraction, 0), 1);
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-inset">
      <div
        className={cn("h-full rounded-full", className)}
        style={{ width: `${filled * 100}%` }}
      />
    </div>
  );
}

export type DayBar = {
  key: string | number;
  /** 0..1+ of the day's goal; null = not logged (hollow slot, never zero). */
  fraction: number | null;
  isToday?: boolean;
  isFuture?: boolean;
};

/**
 * Seven-day goal bars (the hydration-card strip pattern). Unlogged days are
 * hollow slots: missing is never drawn as a zero-height bar (data-state law).
 */
export function WeekBars({
  days,
  className,
  barClassName,
}: {
  days: DayBar[];
  className?: string;
  /** Fill color class for logged bars (e.g. "bg-sky-400"). */
  barClassName?: string;
}) {
  return (
    <div className={cn("flex h-12 items-end gap-1.5", className)}>
      {days.map((day) => {
        const logged = day.fraction != null && !day.isFuture;
        const h = logged
          ? Math.max(0.12, Math.min(day.fraction as number, 1))
          : 1;
        return (
          <div
            className="flex h-full flex-1 items-end"
            key={day.key}
          >
            <div
              className={cn(
                "w-full rounded-sm",
                logged
                  ? barClassName
                  : "border border-border border-dashed bg-transparent opacity-60",
                day.isFuture && "opacity-40",
                day.isToday && "ring-1 ring-foreground/60"
              )}
              style={{ height: `${h * 100}%` }}
            />
          </div>
        );
      })}
    </div>
  );
}

/** Small value bars (PR progressions, per-day macro bars). */
export function MiniBars({
  values,
  highlightLast,
  hollow,
  className,
  barClassName,
}: {
  values: number[];
  /** Emphasize the newest bar (milestone treatment). */
  highlightLast?: boolean;
  /** Designed-empty treatment: dashed outlines, so an empty panel can never
   *  be mistaken for a loading skeleton. */
  hollow?: boolean;
  className?: string;
  barClassName?: string;
}) {
  const max = Math.max(...values, 1);
  return (
    <div className={cn("flex h-12 items-end gap-1.5", className)}>
      {values.map((v, i) => (
        <div
          className={cn(
            "flex-1 rounded-sm",
            hollow
              ? "border border-border border-dashed bg-transparent"
              : highlightLast && i === values.length - 1
                ? barClassName
                : "bg-muted",
            !(hollow || highlightLast) && barClassName
          )}
          // biome-ignore lint/suspicious/noArrayIndexKey: static fixture bars
          key={i}
          style={{ height: `${Math.max(12, (v / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

export type SparkPoint = {
  /** 0..1 position across the WINDOW (true date position, DSH-60). */
  x: number;
  value: number;
};

/**
 * Window-honest sparkline: points sit at their true positions across the
 * selected window and never stretch to the frame edges (DSH-60). Gaps stay
 * gaps. Goal line optional, dashed, muted.
 */
export function PanelSparkline({
  points,
  goal,
  className,
  height = 72,
}: {
  points: SparkPoint[];
  /** Goal value in the same y units, drawn as a dashed line. */
  goal?: number;
  /** Line color class (e.g. "text-emerald-500"). */
  className?: string;
  height?: number;
}) {
  const W = 300;
  const H = 80;
  const PAD = 8;
  const values = points.map((p) => p.value);
  const lo = Math.min(...values, goal ?? Number.POSITIVE_INFINITY);
  const hi = Math.max(...values, goal ?? Number.NEGATIVE_INFINITY);
  const span = hi - lo || 1;
  const yOf = (v: number) => H - PAD - ((v - lo) / span) * (H - PAD * 2);
  const xOf = (x: number) => PAD + x * (W - PAD * 2);
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${xOf(p.x).toFixed(1)},${yOf(p.value).toFixed(1)}`)
    .join(" ");

  return (
    <svg
      aria-hidden
      className={cn("w-full", className)}
      preserveAspectRatio="xMidYMid meet"
      style={{ maxHeight: height }}
      viewBox={`0 0 ${W} ${H}`}
    >
      {goal != null && (
        <line
          className="stroke-border"
          strokeDasharray="4 4"
          strokeWidth={1.5}
          x1={PAD}
          x2={W - PAD}
          y1={yOf(goal)}
          y2={yOf(goal)}
        />
      )}
      {points.length > 1 && (
        <path
          className="stroke-current"
          d={path}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2.5}
        />
      )}
      {points.map((p) => (
        <circle
          className="fill-current"
          cx={xOf(p.x)}
          cy={yOf(p.value)}
          key={p.x}
          r={points.length > 1 ? 2.5 : 3.5}
        />
      ))}
    </svg>
  );
}

/** Direction chip next to a headline ("-1.6 lb" + meaning-colored arrow). */
export function DeltaTag({
  text,
  direction,
  className,
}: {
  text: string;
  /** Colored by MEANING (toward goal = positive), not by sign. */
  direction: "positive" | "critical" | "neutral";
  className?: string;
}) {
  const tone =
    direction === "positive"
      ? "bg-positive/15 text-positive-text"
      : direction === "critical"
        ? "bg-critical/15 text-critical-text"
        : "bg-muted text-muted-foreground";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 font-medium text-meta tabular-nums",
        tone,
        className
      )}
    >
      {text}
    </span>
  );
}
