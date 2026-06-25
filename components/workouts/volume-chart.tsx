/**
 * Dependency-free volume bar chart. Pure presentational SVG so it renders on
 * the server. Each bar is one day's total volume (lb) over time; the most
 * recent bar is highlighted with its value labelled.
 */

function fmtDate(t: number): string {
  return new Date(t).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function fmtK(n: number): string {
  return n >= 1000 ? `${Math.round(n / 100) / 10}k` : String(n);
}

export function VolumeChart({
  points,
}: {
  points: { t: number; volume: number }[];
}) {
  if (points.length === 0) {
    return null;
  }

  const W = 600;
  const H = 200;
  const pad = { t: 24, r: 12, b: 28, l: 12 };
  const maxV = Math.max(...points.map((p) => p.volume));
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const n = points.length;
  const slot = innerW / n;
  const barW = Math.min(slot * 0.6, 36);

  const tickIdx =
    n === 1
      ? [0]
      : [...new Set([0, Math.floor((n - 1) / 2), n - 1])];

  return (
    <svg
      aria-label="Workout volume over time"
      className="h-auto w-full text-blood"
      preserveAspectRatio="none"
      role="img"
      viewBox={`0 0 ${W} ${H}`}
    >
      <title>Workout volume over time</title>

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

      {points.map((p, i) => {
        const h = maxV > 0 ? (p.volume / maxV) * innerH : 0;
        const cx = pad.l + slot * i + slot / 2;
        const x = cx - barW / 2;
        const yTop = H - pad.b - h;
        const isLast = i === n - 1;
        return (
          <g key={`bar-${i}`}>
            <rect
              fill="currentColor"
              fillOpacity={isLast ? 0.9 : 0.35}
              height={Math.max(h, 1)}
              rx="3"
              width={barW}
              x={x}
              y={yTop}
            />
            {isLast && (
              <text
                className="fill-foreground font-semibold"
                fontSize="12"
                textAnchor={cx > W - 50 ? "end" : "middle"}
                x={Math.min(Math.max(cx, 18), W - 12)}
                y={yTop - 6}
              >
                {fmtK(p.volume)} lb
              </text>
            )}
          </g>
        );
      })}

      {tickIdx.map((idx) => {
        const cx = pad.l + slot * idx + slot / 2;
        return (
          <text
            className="fill-muted-foreground"
            fontSize="11"
            key={`tick-${idx}`}
            textAnchor={idx === 0 ? "start" : idx === n - 1 ? "end" : "middle"}
            x={Math.min(Math.max(cx, pad.l), W - pad.r)}
            y={H - 9}
          >
            {fmtDate(points[idx].t)}
          </text>
        );
      })}
    </svg>
  );
}
