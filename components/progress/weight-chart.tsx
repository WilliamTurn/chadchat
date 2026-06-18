/**
 * A small, dependency-free weight-trend line chart. Pure presentational SVG so
 * it renders on the server and scales to its container (viewBox + non-uniform
 * aspect). One colour drives the whole thing via the `text-blood` accent +
 * currentColor, so it always matches Chad's theme.
 */
export function WeightChart({
  points,
  unit,
}: {
  points: { t: number; weight: number }[];
  unit: string;
}) {
  if (points.length === 0) {
    return null;
  }

  const W = 600;
  const H = 200;
  const pad = { t: 18, r: 16, b: 22, l: 16 };

  const ws = points.map((p) => p.weight);
  const ts = points.map((p) => p.t);
  const minW = Math.min(...ws);
  const maxW = Math.max(...ws);
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

  const coords = points.map((p) => ({ cx: x(p.t), cy: y(p.weight) }));
  const line = coords
    .map((c, i) => `${i === 0 ? "M" : "L"}${c.cx.toFixed(1)} ${c.cy.toFixed(1)}`)
    .join(" ");
  const last = coords[coords.length - 1];
  const first = coords[0];
  const area = `${line} L${last.cx.toFixed(1)} ${H - pad.b} L${first.cx.toFixed(
    1
  )} ${H - pad.b} Z`;

  const latest = points[points.length - 1].weight;

  return (
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
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
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

      {coords.length > 1 && <path d={area} fill="url(#weightFill)" />}
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
          key={points[i].t}
          r={i === coords.length - 1 ? 4.5 : 3}
        />
      ))}

      {/* latest value label */}
      <text
        className="fill-foreground font-semibold"
        fontSize="13"
        textAnchor={last.cx > W - 80 ? "end" : "middle"}
        x={Math.min(Math.max(last.cx, 24), W - 24)}
        y={Math.max(last.cy - 10, 12)}
      >
        {latest} {unit}
      </text>
    </svg>
  );
}
