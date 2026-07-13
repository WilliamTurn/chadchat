/**
 * RING GAUGE (new signature visual type, P56-A, per briefing rule 9's
 * new-primitive path). A single-arc progress ring with the value in the
 * center: the canonical "share of goal" form in category-leading products
 * (Apple Activity rings, WHOOP's recovery/strain rings, Oura's score arc,
 * MyFitnessPal's calorie ring; reference captures in
 * evidence-p56a/references/).
 *
 * Honesty rules: the arc renders ONLY a true 0..1 fraction the caller
 * computed from a registered metric; there is no implicit clamp-to-full
 * (overshoot callers cap at 1 and say so in text). The center carries the
 * value; the ring is reinforcement, never the sole carrier (chart grammar).
 *
 * Server-safe: pure SVG, no hooks.
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function RingGauge({
  fraction,
  color = "var(--chart-2)",
  size = 96,
  strokeWidth = 9,
  children,
  className,
}: {
  /** 0..1, already computed from a registered metric. */
  fraction: number;
  color?: string;
  size?: number;
  strokeWidth?: number;
  /** Center content (the value + a short label). */
  children?: ReactNode;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(1, fraction));
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;

  return (
    <div
      aria-hidden
      className={cn("relative inline-flex shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <svg
        className="-rotate-90"
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        width={size}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={r}
          stroke="var(--border)"
          strokeOpacity={0.8}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={r}
          stroke={color}
          strokeDasharray={`${c * clamped} ${c}`}
          strokeLinecap="round"
          strokeWidth={strokeWidth}
          style={{ transition: "stroke-dasharray 400ms ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {children}
      </div>
    </div>
  );
}
