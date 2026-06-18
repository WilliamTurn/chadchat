/**
 * Apple-style activity rings for the day's intake, pure dependency-free SVG so
 * it renders on the server and matches Chad's theme via currentColor. Outer ring
 * = calories, inner ring = protein. When a target is set the ring fills toward
 * it (and turns blood-red once exceeded); with no target it shows the running
 * total against a neutral track.
 */

type RingProps = {
  caloriesConsumed: number;
  caloriesTarget: number | null;
  proteinConsumed: number;
  proteinTarget: number | null;
};

const SIZE = 168;
const CENTER = SIZE / 2;
const STROKE = 13;
const GAP = 6;

function arc(radius: number, fraction: number) {
  const c = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, fraction));
  return { c, offset: c * (1 - clamped) };
}

function Ring({
  radius,
  fraction,
  over,
}: {
  radius: number;
  fraction: number | null;
  over: boolean;
}) {
  const { c, offset } = arc(radius, fraction ?? 0);
  return (
    <>
      <circle
        className="text-border/60"
        cx={CENTER}
        cy={CENTER}
        fill="none"
        r={radius}
        stroke="currentColor"
        strokeWidth={STROKE}
      />
      {fraction !== null && (
        <circle
          className={over ? "text-blood" : "text-foreground"}
          cx={CENTER}
          cy={CENTER}
          fill="none"
          r={radius}
          stroke="currentColor"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          strokeWidth={STROKE}
          style={{ transition: "stroke-dashoffset 700ms var(--ease-spring)" }}
          transform={`rotate(-90 ${CENTER} ${CENTER})`}
        />
      )}
    </>
  );
}

export function MacroRings({
  caloriesConsumed,
  caloriesTarget,
  proteinConsumed,
  proteinTarget,
}: RingProps) {
  const outerR = CENTER - STROKE / 2 - 2;
  const innerR = outerR - STROKE - GAP;

  const calFrac = caloriesTarget ? caloriesConsumed / caloriesTarget : null;
  const proFrac = proteinTarget ? proteinConsumed / proteinTarget : null;

  return (
    <div className="flex items-center gap-5">
      <svg
        aria-label="Today's calories and protein"
        className="shrink-0"
        height={SIZE}
        role="img"
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        width={SIZE}
      >
        <title>Today's calories and protein</title>
        <Ring fraction={calFrac} over={(calFrac ?? 0) > 1} radius={outerR} />
        <Ring fraction={proFrac} over={(proFrac ?? 0) > 1} radius={innerR} />
        <text
          className="fill-foreground font-display font-bold"
          dominantBaseline="middle"
          fontSize="30"
          textAnchor="middle"
          x={CENTER}
          y={CENTER - 8}
        >
          {Math.round(caloriesConsumed)}
        </text>
        <text
          className="fill-muted-foreground"
          dominantBaseline="middle"
          fontSize="11"
          textAnchor="middle"
          x={CENTER}
          y={CENTER + 14}
        >
          {caloriesTarget ? `/ ${caloriesTarget} kcal` : "kcal today"}
        </text>
      </svg>

      <dl className="flex flex-col gap-3 text-sm">
        <div>
          <dt className="text-muted-foreground text-xs">Calories</dt>
          <dd className="font-display font-semibold text-lg">
            {Math.round(caloriesConsumed)}
            <span className="ml-1 text-muted-foreground text-xs">
              {caloriesTarget ? `/ ${caloriesTarget}` : "kcal"}
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">Protein</dt>
          <dd className="font-display font-semibold text-lg">
            {Math.round(proteinConsumed)}
            <span className="ml-1 text-muted-foreground text-xs">
              {proteinTarget ? `/ ${proteinTarget} g` : "g"}
            </span>
          </dd>
        </div>
      </dl>
    </div>
  );
}
