"use client";

// Single-series progress chart (estimated strength over time).
// One hue, thin 2px line, visible point markers with a surface ring,
// recessive grid, crosshair + tooltip on hover/touch, direct label on the
// latest point, and a plain-language trend sentence so the line never needs
// decoding. Theme-aware via currentColor-friendly CSS variables.

import { useMemo, useRef, useState } from "react";
import { formatWeight } from "./format";

export interface ChartPoint {
  date: number;
  value: number;
  /** e.g. "185 lb × 8", the set that produced this value. */
  label: string;
}

const W = 640;
const H = 240;
const PAD = { top: 18, right: 16, bottom: 28, left: 44 };
// RC-3 (RUN-66/TRN-21): a strength-progress line is movement toward a goal,
// so it draws in the emerald progress token, not blood.
const LINE = "var(--progress)";

function shortDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function ProgressChart({ points }: { points: ChartPoint[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const geometry = useMemo(() => {
    if (points.length < 2) {
      return null;
    }
    const xs = points.map((p) => p.date);
    const ys = points.map((p) => p.value);
    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    const yRawMin = Math.min(...ys);
    const yRawMax = Math.max(...ys);
    const span = Math.max(yRawMax - yRawMin, 10);
    const yMin = Math.max(0, yRawMin - span * 0.25);
    const yMax = yRawMax + span * 0.25;
    const x = (t: number) =>
      PAD.left +
      ((t - xMin) / Math.max(xMax - xMin, 1)) * (W - PAD.left - PAD.right);
    const y = (v: number) =>
      H - PAD.bottom - ((v - yMin) / (yMax - yMin)) * (H - PAD.top - PAD.bottom);
    const coords = points.map((p) => ({ ...p, cx: x(p.date), cy: y(p.value) }));
    const ticks: number[] = [];
    for (let i = 0; i <= 2; i++) {
      ticks.push(Math.round((yMin + ((yMax - yMin) * (i + 0.5)) / 3) / 5) * 5);
    }
    return { coords, ticks, y };
  }, [points]);

  if (!geometry) {
    return (
      <div className="rounded-xl bg-background px-4 py-6 text-center">
        <p className="font-semibold text-[14px] text-foreground">
          Not enough data to chart yet
        </p>
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          Log this exercise in two different workouts and your progress line
          appears here.
        </p>
      </div>
    );
  }

  const { coords, ticks, y } = geometry;
  const path = coords
    .map((c, i) => `${i === 0 ? "M" : "L"}${c.cx.toFixed(1)},${c.cy.toFixed(1)}`)
    .join(" ");
  const last = coords[coords.length - 1];
  const first = coords[0];
  const delta = last.value - first.value;

  const weeks = Math.max(
    1,
    Math.round((last.date - first.date) / (7 * 86_400_000))
  );
  const trend =
    Math.abs(delta) < 2.5
      ? `Holding steady around ${formatWeight(Math.round(last.value))} lb over the last ${weeks} ${weeks === 1 ? "week" : "weeks"}.`
      : delta > 0
        ? `Up ${formatWeight(Math.round(delta))} lb in the last ${weeks} ${weeks === 1 ? "week" : "weeks"}.`
        : `Down ${formatWeight(Math.round(-delta))} lb over the last ${weeks} ${weeks === 1 ? "week" : "weeks"}. Dips happen on lighter days.`;

  function locate(clientX: number) {
    const svg = svgRef.current;
    if (!svg) {
      return;
    }
    const rect = svg.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * W;
    let nearest = 0;
    let best = Number.POSITIVE_INFINITY;
    coords.forEach((c, i) => {
      const d = Math.abs(c.cx - px);
      if (d < best) {
        best = d;
        nearest = i;
      }
    });
    setHoverIndex(nearest);
  }

  const hover = hoverIndex !== null ? coords[hoverIndex] : null;

  return (
    <div>
      <p className="mb-2 font-semibold text-[13.5px] text-foreground">{trend}</p>
      <div className="relative">
        {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: hover/touch scrubbing is a pointer-only enhancement; the trend summary above conveys the data without it. */}
        <svg
          aria-label={`Estimated strength over time, from ${formatWeight(first.value)} to ${formatWeight(last.value)} pounds`}
          className="w-full touch-none select-none"
          onMouseLeave={() => setHoverIndex(null)}
          onMouseMove={(e) => locate(e.clientX)}
          onTouchEnd={() => setHoverIndex(null)}
          onTouchMove={(e) => locate(e.touches[0].clientX)}
          onTouchStart={(e) => locate(e.touches[0].clientX)}
          ref={svgRef}
          role="img"
          viewBox={`0 0 ${W} ${H}`}
        >
          {/* Recessive grid + y labels */}
          {ticks.map((t) => (
            <g key={t}>
              <line
                stroke="currentColor"
                strokeOpacity="0.08"
                strokeWidth="1"
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y(t)}
                y2={y(t)}
              />
              <text
                fill="currentColor"
                fillOpacity="0.45"
                fontFamily="var(--font-mono)"
                fontSize="11"
                textAnchor="end"
                x={PAD.left - 8}
                y={y(t) + 4}
              >
                {t}
              </text>
            </g>
          ))}

          {/* x labels: first and last date */}
          <text
            fill="currentColor"
            fillOpacity="0.45"
            fontSize="11"
            textAnchor="start"
            x={first.cx}
            y={H - 8}
          >
            {shortDate(first.date)}
          </text>
          <text
            fill="currentColor"
            fillOpacity="0.45"
            fontSize="11"
            textAnchor="end"
            x={last.cx}
            y={H - 8}
          >
            {shortDate(last.date)}
          </text>

          {/* Crosshair */}
          {hover && (
            <line
              stroke="currentColor"
              strokeOpacity="0.2"
              strokeWidth="1"
              x1={hover.cx}
              x2={hover.cx}
              y1={PAD.top}
              y2={H - PAD.bottom}
            />
          )}

          {/* The line */}
          <path
            d={path}
            fill="none"
            stroke={LINE}
            strokeLinejoin="round"
            strokeWidth="2"
          />

          {/* Point markers with surface ring */}
          {coords.map((c, i) => (
            <circle
              cx={c.cx}
              cy={c.cy}
              fill={LINE}
              key={c.date}
              r={hoverIndex === i ? 5.5 : 4}
              stroke="var(--card)"
              strokeWidth="2"
            />
          ))}

          {/* Direct label on the latest point */}
          <text
            fill="currentColor"
            fontFamily="var(--font-mono)"
            fontSize="12"
            fontWeight="700"
            textAnchor="end"
            x={Math.min(last.cx, W - PAD.right - 4)}
            y={last.cy - 10}
          >
            {formatWeight(Math.round(last.value))} lb
          </text>
        </svg>

        {/* Tooltip */}
        {hover && (
          <div
            className="-top-1 pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg border border-input bg-popover px-2.5 py-1.5 text-center shadow-lg"
            style={{ left: `${(hover.cx / W) * 100}%` }}
          >
            <div className="whitespace-nowrap font-bold font-mono text-[13px] text-foreground tabular-nums">
              {formatWeight(Math.round(hover.value))} lb
            </div>
            <div className="whitespace-nowrap text-[11px] text-muted-foreground">
              {shortDate(hover.date)} · best set {hover.label}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
