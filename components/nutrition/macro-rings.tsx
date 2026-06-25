/**
 * Apple-style activity rings for the day's intake — pure dependency-free SVG so
 * it renders on the server and matches Chad's theme. Four concentric rings,
 * color-coded: calories (red), protein (blue), carbs (amber), fat (violet).
 * When a target is set the ring fills toward it and turns blood-red once
 * exceeded; with no target it shows the running total against a neutral track.
 */

type RingProps = {
  caloriesConsumed: number;
  caloriesTarget: number | null;
  proteinConsumed: number;
  proteinTarget: number | null;
  carbsConsumed: number;
  carbsTarget: number | null;
  fatConsumed: number;
  fatTarget: number | null;
};

const SIZE = 180;
const CENTER = SIZE / 2;
const STROKE = 12;
const GAP = 4;

function arc(radius: number, fraction: number) {
  const c = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, fraction));
  return { c, offset: c * (1 - clamped) };
}

function Ring({
  radius,
  fraction,
  color,
  over,
}: {
  radius: number;
  fraction: number | null;
  color: string;
  over: boolean;
}) {
  const { c, offset } = arc(radius, fraction ?? 0);
  return (
    <>
      <circle
        className="text-border/50"
        cx={CENTER}
        cy={CENTER}
        fill="none"
        r={radius}
        stroke="currentColor"
        strokeWidth={STROKE}
      />
      {fraction !== null && (
        <circle
          className={over ? "text-blood" : color}
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

function Stat({
  label,
  color,
  consumed,
  target,
  unit,
}: {
  label: string;
  color: string;
  consumed: number;
  target: number | null;
  unit: string;
}) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-muted-foreground text-xs">
        <span className={`size-2 rounded-full ${color}`} />
        {label}
      </dt>
      <dd className="font-display font-semibold text-lg">
        {Math.round(consumed)}
        <span className="ml-1 text-muted-foreground text-xs">
          {target ? `/ ${target}${unit}` : unit || "g"}
        </span>
      </dd>
    </div>
  );
}

export function MacroRings({
  caloriesConsumed,
  caloriesTarget,
  proteinConsumed,
  proteinTarget,
  carbsConsumed,
  carbsTarget,
  fatConsumed,
  fatTarget,
}: RingProps) {
  const rCal = CENTER - STROKE / 2 - 2;
  const rPro = rCal - STROKE - GAP;
  const rCarb = rPro - STROKE - GAP;
  const rFat = rCarb - STROKE - GAP;

  const calFrac = caloriesTarget ? caloriesConsumed / caloriesTarget : null;
  const proFrac = proteinTarget ? proteinConsumed / proteinTarget : null;
  const carbFrac = carbsTarget ? carbsConsumed / carbsTarget : null;
  const fatFrac = fatTarget ? fatConsumed / fatTarget : null;

  return (
    <div className="flex flex-wrap items-center gap-5">
      <svg
        aria-label="Today's calories and macros"
        className="shrink-0"
        height={SIZE}
        role="img"
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        width={SIZE}
      >
        <title>Today's calories and macros</title>
        <Ring
          color="text-blood"
          fraction={calFrac}
          over={(calFrac ?? 0) > 1}
          radius={rCal}
        />
        <Ring
          color="text-sky-400"
          fraction={proFrac}
          over={(proFrac ?? 0) > 1}
          radius={rPro}
        />
        <Ring
          color="text-amber-400"
          fraction={carbFrac}
          over={(carbFrac ?? 0) > 1}
          radius={rCarb}
        />
        <Ring
          color="text-violet-400"
          fraction={fatFrac}
          over={(fatFrac ?? 0) > 1}
          radius={rFat}
        />
        <text
          className="fill-foreground font-display font-bold"
          dominantBaseline="middle"
          fontSize="22"
          textAnchor="middle"
          x={CENTER}
          y={CENTER - 6}
        >
          {Math.round(caloriesConsumed)}
        </text>
        <text
          className="fill-muted-foreground"
          dominantBaseline="middle"
          fontSize="10"
          textAnchor="middle"
          x={CENTER}
          y={CENTER + 13}
        >
          {caloriesTarget ? `/ ${caloriesTarget} kcal` : "kcal today"}
        </text>
      </svg>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <Stat
          color="bg-blood"
          consumed={caloriesConsumed}
          label="Calories"
          target={caloriesTarget}
          unit=""
        />
        <Stat
          color="bg-sky-400"
          consumed={proteinConsumed}
          label="Protein"
          target={proteinTarget}
          unit="g"
        />
        <Stat
          color="bg-amber-400"
          consumed={carbsConsumed}
          label="Carbs"
          target={carbsTarget}
          unit="g"
        />
        <Stat
          color="bg-violet-400"
          consumed={fatConsumed}
          label="Fat"
          target={fatTarget}
          unit="g"
        />
      </dl>
    </div>
  );
}
