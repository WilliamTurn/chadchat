"use client";

/**
 * Interactive workout-volume trend. Each bar is one day's total training volume
 * (lb), oldest → newest. Built on Recharts via the shadcn chart primitive and
 * the shared dashboard chart system (ChartCard / Kpi / useChartRange) — same
 * engine and look as the weight tracker — so volume scrubs and reads like every
 * other dashboard. The most recent day is highlighted; hover/scrub any bar for
 * its date and volume.
 */

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import { ChartCard } from "@/components/dashboard/chart-card";
import { Kpi } from "@/components/dashboard/kpi";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart";
import { useChartRange } from "@/hooks/use-chart-range";
import { useMountReveal } from "@/hooks/use-mount-reveal";
import { formatTick } from "@/lib/chart/format";

const ACCENT = "#a4161a"; // brand blood red

const ASK_CHAD_PROMPT =
  "Look at my training volume trend over time. Am I progressively overloading, stalling, or backing off — and what should I do about it?";

const chartConfig = {
  volume: { label: "Volume", color: ACCENT },
} satisfies ChartConfig;

type Point = { t: number; volume: number };

/** Compact axis number, e.g. "12k" / "850". */
function fmtK(n: number): string {
  return n >= 1000 ? `${Math.round(n / 100) / 10}k` : String(Math.round(n));
}

/**
 * One bar, drawn as a rounded-top path so we can grow it up from the axis with a
 * staggered, per-bar CSS animation (Recharts only animates the whole series in
 * lockstep). The most recent day reads at full opacity; the rest sit back.
 */
function StaggeredBar(props: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  index?: number;
  payload?: Point;
  lastT?: number;
  animate?: boolean;
}) {
  const { x, y, width, height, index = 0, payload, lastT, animate } = props;
  if (x == null || y == null || width == null || height == null) {
    return null;
  }
  const isLatest = payload?.t === lastT;
  const r = Math.min(3, width / 2, height);
  const d = `M${x},${y + height} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + width - r},${y} Q${x + width},${y} ${x + width},${y + r} L${x + width},${y + height} Z`;
  return (
    <path
      d={d}
      fill={ACCENT}
      fillOpacity={isLatest ? 0.95 : 0.4}
      style={
        animate
          ? {
              transformBox: "fill-box",
              transformOrigin: "bottom",
              animation: "bar-grow 460ms cubic-bezier(0.22, 1, 0.36, 1) both",
              animationDelay: `${Math.min(index, 24) * 45}ms`,
            }
          : undefined
      }
    />
  );
}

export function VolumeChart({ points }: { points: Point[] }) {
  // Hold the mount reveal open long enough to cover the full left→right stagger
  // (base duration + per-bar delay), so no bar gets cut off mid-grow. Computed
  // from the fixed point count so a range toggle doesn't re-trigger it.
  const reveal = useMountReveal(460 + Math.min(points.length, 24) * 45);
  const { rows, control } = useChartRange(points, { minPoints: 6 });

  const stats = useMemo(() => {
    if (rows.length === 0) {
      return null;
    }
    const latest = rows.at(-1)?.volume ?? 0;
    const top = Math.max(...rows.map((r) => r.volume));
    const avg = rows.reduce((s, r) => s + r.volume, 0) / rows.length;
    return { latest, top, avg };
  }, [rows]);

  const yMax = useMemo(() => {
    if (rows.length === 0) {
      return 1;
    }
    return Math.max(...rows.map((r) => r.volume)) * 1.15;
  }, [rows]);

  if (points.length === 0) {
    return null;
  }

  const lastT = rows.at(-1)?.t;

  return (
    <ChartCard
      askChadPrompt={ASK_CHAD_PROMPT}
      kpis={
        stats && (
          <>
            <Kpi
              label="Latest session"
              size="lg"
              value={`${stats.latest.toLocaleString()} lb`}
            />
            <Kpi label="Top day" value={`${stats.top.toLocaleString()} lb`} />
          </>
        )
      }
      range={control}
      title="Volume trend"
    >
      <ChartContainer className="h-[220px] w-full" config={chartConfig}>
        <BarChart
          barCategoryGap="20%"
          data={rows}
          margin={{ top: 8, right: 8, bottom: 0, left: -8 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            axisLine={false}
            dataKey="t"
            interval="preserveStartEnd"
            scale="band"
            tickFormatter={formatTick}
            tickLine={false}
            tickMargin={8}
            type="category"
          />
          <YAxis
            axisLine={false}
            domain={[0, yMax]}
            tickCount={4}
            tickFormatter={fmtK}
            tickLine={false}
            tickMargin={4}
            width={40}
          />
          <ChartTooltip
            content={<VolumeTooltip />}
            cursor={{ fill: "var(--muted-foreground)", fillOpacity: 0.08 }}
          />
          {stats && rows.length >= 3 && (
            <ReferenceLine
              label={{
                value: `avg ${fmtK(stats.avg)}`,
                position: "insideTopLeft",
                fill: "var(--muted-foreground)",
                fontSize: 11,
              }}
              stroke="var(--muted-foreground)"
              strokeDasharray="5 4"
              strokeOpacity={0.45}
              strokeWidth={1.5}
              y={stats.avg}
            />
          )}
          <Bar
            dataKey="volume"
            isAnimationActive={false}
            maxBarSize={36}
            shape={<StaggeredBar animate={reveal} lastT={lastT} />}
          />
        </BarChart>
      </ChartContainer>
    </ChartCard>
  );
}

function VolumeTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload?: Point }[];
}) {
  if (!active || !payload?.length) {
    return null;
  }
  const row = payload[0]?.payload;
  if (!row) {
    return null;
  }
  return (
    <div className="min-w-[10rem] rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-xl">
      <div className="mb-1.5 font-medium">{formatTick(row.t)}</div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span
            className="size-2 shrink-0 rounded-[2px]"
            style={{ backgroundColor: ACCENT }}
          />
          <span className="text-muted-foreground">Volume</span>
        </div>
        <span className="ml-auto font-medium text-foreground tabular-nums">
          {row.volume.toLocaleString()} lb
        </span>
      </div>
    </div>
  );
}
