/**
 * Dependency-free est-1RM trend line for a single exercise. Pure presentational
 * SVG (same approach as WeightChart/VolumeChart) so it scales to its container.
 * Each point is one session's best estimated 1RM (lb), oldest → newest, drawn as
 * a filled-area line with dots and the latest value labelled.
 */

import { formatCalendarDayMs } from "@/lib/date";

function fmtDate(t: number): string {
  return formatCalendarDayMs(t);
}

export function ExerciseTrendChart({
  points,
  unit = "lb",
}: {
  points: { t: number; value: number }[];
  unit?: string;
}) {
  if (points.length === 0) {
    return null;
  }

  const W = 600;
  const H = 200;
  const pad = { t: 22, r: 16, b: 28, l: 16 };

  const vs = points.map((p) => p.value);
  const ts = points.map((p) => p.t);
  const minV = Math.min(...vs);
  const maxV = Math.max(...vs);
  const minT = Math.min(...ts);
  const maxT = Math.max(...ts);

  const range = maxV - minV;
  const yPad = range > 0 ? range * 0.15 : Math.max(maxV * 0.05, 1);
  const yMin = minV - yPad;
  const yMax = maxV + yPad;

  const x = (t: number) =>
    maxT === minT
      ? W / 2
      : pad.l + ((t - minT) / (maxT - minT)) * (W - pad.l - pad.r);
  const y = (v: number) =>
    yMax === yMin
      ? H / 2
      : pad.t + ((yMax - v) / (yMax - yMin)) * (H - pad.t - pad.b);

  const coords = points.map((p) => ({ cx: x(p.t), cy: y(p.value) }));
  const line = coords
    .map((c, i) => `${i === 0 ? "M" : "L"}${c.cx.toFixed(1)} ${c.cy.toFixed(1)}`)
    .join(" ");
  const last = coords.at(-1);
  const first = coords[0];
  const area =
    last && first
      ? `${line} L${last.cx.toFixed(1)} ${H - pad.b} L${first.cx.toFixed(1)} ${
          H - pad.b
        } Z`
      : "";

  const latest = points.at(-1)?.value ?? 0;

  const tickIdx =
    points.length === 1
      ? [0]
      : [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])];

  return (
    <svg
      aria-label="Estimated 1RM over time"
      className="h-auto w-full text-blood"
      preserveAspectRatio="none"
      role="img"
      viewBox={`0 0 ${W} ${H}`}
    >
      <title>Estimated 1RM over time</title>
      <defs>
        <linearGradient id="oneRmFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.18" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* baseline */}
      <line
        className="text-border"
        stroke="currentColor"
        strokeWidth="1"
        x1={pad.l}
        x2={W - pad.r}
        y1={H - pad.b}
        y2={H - pad.b}
      />

      {coords.length > 1 && <path d={area} fill="url(#oneRmFill)" />}

      {coords.length > 1 && (
        <path
          d={line}
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.5"
        />
      )}

      {coords.map((c, i) => (
        <circle
          cx={c.cx}
          cy={c.cy}
          fill="currentColor"
          fillOpacity={i === coords.length - 1 ? 1 : 0.55}
          key={points[i].t}
          r={i === coords.length - 1 ? 4.5 : 2.5}
        />
      ))}

      {/* latest-value label */}
      {last && (
        <text
          className="fill-foreground font-semibold"
          fontSize="13"
          textAnchor={last.cx > W - 80 ? "end" : "middle"}
          x={Math.min(Math.max(last.cx, 24), W - 24)}
          y={Math.max(last.cy - 10, 12)}
        >
          {latest} {unit}
        </text>
      )}

      {/* x-axis date ticks */}
      {tickIdx.map((idx) => (
        <text
          className="fill-muted-foreground"
          fontSize="11"
          key={points[idx].t}
          textAnchor={
            idx === 0 ? "start" : idx === points.length - 1 ? "end" : "middle"
          }
          x={Math.min(Math.max(coords[idx].cx, pad.l), W - pad.r)}
          y={H - 9}
        >
          {fmtDate(points[idx].t)}
        </text>
      ))}
    </svg>
  );
}
