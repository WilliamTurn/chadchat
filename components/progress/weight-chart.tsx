/**
 * A dependency-free weight-trend chart. Pure presentational SVG so it renders on
 * the server and scales to its container. The raw daily weigh-ins are drawn as
 * faint dots/line; a centered moving-average **trend line** rides over them so
 * the graph reads as a smooth trend instead of a noisy zigzag (the pro-app
 * standard — daily scale/water noise is filtered out). When a weight goal
 * exists, a dashed goal line is overlaid with a "X to go" readout.
 */

const MA_HALF_WINDOW = 3; // centered window of up to 7 points

/** Centered simple moving average over the weight series. */
function movingAverage(weights: number[]): number[] {
  return weights.map((_, i) => {
    const lo = Math.max(0, i - MA_HALF_WINDOW);
    const hi = Math.min(weights.length - 1, i + MA_HALF_WINDOW);
    let sum = 0;
    for (let j = lo; j <= hi; j++) {
      sum += weights[j];
    }
    return sum / (hi - lo + 1);
  });
}

function fmtDate(t: number): string {
  return new Date(t).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function WeightChart({
  points,
  unit,
  goalWeight = null,
}: {
  points: { t: number; weight: number }[];
  unit: string;
  goalWeight?: number | null;
}) {
  if (points.length === 0) {
    return null;
  }

  const W = 600;
  const H = 220;
  const pad = { t: 20, r: 16, b: 30, l: 16 };

  const trend = movingAverage(points.map((p) => p.weight));

  const ws = points.map((p) => p.weight);
  const ts = points.map((p) => p.t);
  // Include the goal in the visible range so its line is always on screen.
  const valuesForRange = goalWeight == null ? ws : [...ws, goalWeight];
  const minW = Math.min(...valuesForRange);
  const maxW = Math.max(...valuesForRange);
  const minT = Math.min(...ts);
  const maxT = Math.max(...ts);

  const range = maxW - minW;
  const yPad = range > 0 ? range * 0.15 : Math.max(maxW * 0.02, 1);
  const yMin = minW - yPad;
  const yMax = maxW + yPad;

  const x = (t: number) =>
    maxT === minT
      ? W / 2
      : pad.l + ((t - minT) / (maxT - minT)) * (W - pad.l - pad.r);
  const y = (w: number) =>
    yMax === yMin
      ? H / 2
      : pad.t + ((yMax - w) / (yMax - yMin)) * (H - pad.t - pad.b);

  const raw = points.map((p) => ({ cx: x(p.t), cy: y(p.weight) }));
  const trendCoords = points.map((p, i) => ({ cx: x(p.t), cy: y(trend[i]) }));
  const path = (cs: { cx: number; cy: number }[]) =>
    cs
      .map(
        (c, i) => `${i === 0 ? "M" : "L"}${c.cx.toFixed(1)} ${c.cy.toFixed(1)}`
      )
      .join(" ");

  const trendLine = path(trendCoords);
  const last = trendCoords.at(-1);
  const first = trendCoords[0];
  const area =
    last && first
      ? `${trendLine} L${last.cx.toFixed(1)} ${H - pad.b} L${first.cx.toFixed(
          1
        )} ${H - pad.b} Z`
      : "";

  const latest = points.at(-1)?.weight ?? 0;
  const goalY = goalWeight == null ? null : y(goalWeight);
  const toGo =
    goalWeight == null ? null : Math.round((latest - goalWeight) * 10) / 10;

  // Up to 3 x-axis date ticks (start / middle / end).
  const tickIdx =
    points.length === 1
      ? [0]
      : [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])];

  return (
    <div>
      <svg
        aria-label="Weight over time"
        className="h-auto w-full text-blood"
        preserveAspectRatio="none"
        role="img"
        viewBox={`0 0 ${W} ${H}`}
      >
        <title>Weight over time</title>
        <defs>
          <linearGradient id="weightFill" x1="0" x2="0" y1="0" y2="1">
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

        {/* goal-weight reference line */}
        {goalY != null && (
          <line
            className="text-emerald-500"
            stroke="currentColor"
            strokeDasharray="5 4"
            strokeWidth="1.5"
            x1={pad.l}
            x2={W - pad.r}
            y1={goalY}
            y2={goalY}
          />
        )}

        {trendCoords.length > 1 && (
          <path d={area} fill="url(#weightFill)" />
        )}

        {/* raw daily points: faint connecting line + dots */}
        {raw.length > 1 && (
          <path
            className="text-muted-foreground"
            d={path(raw)}
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.35"
            strokeWidth="1"
          />
        )}
        {raw.map((c, i) => (
          <circle
            className="text-muted-foreground"
            cx={c.cx}
            cy={c.cy}
            fill="currentColor"
            fillOpacity="0.45"
            key={points[i].t}
            r="2"
          />
        ))}

        {/* the smooth trend line */}
        {trendCoords.length > 1 && (
          <path
            d={trendLine}
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.5"
          />
        )}

        {/* latest-value marker + label */}
        {last && (
          <>
            <circle cx={last.cx} cy={last.cy} fill="currentColor" r="4.5" />
            <text
              className="fill-foreground font-semibold"
              fontSize="13"
              textAnchor={last.cx > W - 80 ? "end" : "middle"}
              x={Math.min(Math.max(last.cx, 24), W - 24)}
              y={Math.max(last.cy - 10, 12)}
            >
              {latest} {unit}
            </text>
          </>
        )}

        {/* x-axis date ticks */}
        {tickIdx.map((idx) => (
          <text
            className="fill-muted-foreground"
            fontSize="11"
            key={points[idx].t}
            textAnchor={idx === 0 ? "start" : idx === points.length - 1 ? "end" : "middle"}
            x={Math.min(Math.max(raw[idx].cx, pad.l), W - pad.r)}
            y={H - 10}
          >
            {fmtDate(points[idx].t)}
          </text>
        ))}
      </svg>

      {goalWeight != null && toGo != null && (
        <p className="mt-2 text-center text-muted-foreground text-sm">
          Goal{" "}
          <span className="font-medium text-emerald-500">
            {goalWeight} {unit}
          </span>{" "}
          ·{" "}
          {Math.abs(toGo) < 0.1 ? (
            <span className="font-medium text-foreground">goal reached 🎯</span>
          ) : (
            <span className="font-medium text-foreground">
              {Math.abs(toGo)} {unit} to go
            </span>
          )}
        </p>
      )}
    </div>
  );
}
