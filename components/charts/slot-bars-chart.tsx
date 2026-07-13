"use client";

/**
 * SLOT BAR CHARTS (FIX-18): the "daily adherence" and "frequency" chart types
 * from audit doc 05.
 *
 * DailyBarsChart draws one slot per WINDOW day (lib/chart/window.ts
 * toDaySlots), so the axis is the window itself (DSH-60) and an unlogged day
 * is a visible GAP in the bar rhythm with a "Not logged" tooltip, never a
 * zero-height bar (data-state law). The coverage caption in the ChartFrame
 * states the gap count in words.
 *
 * WeeklyBarsChart draws counts of logged events per trailing 7-day bin. For
 * counts, zero IS a truthful observed value (the owner-approved carve-out in
 * data-state.ts), so a zero week renders a minimal stub bar, not a gap.
 *
 * Color Law: ordinary bars draw in the chart's domain accent; a day that MEETS
 * an at-least target turns emerald (toward/at goal); a day that EXCEEDS an
 * at-most target turns critical (genuine alert). Domain color never
 * substitutes for state color.
 */

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTip } from "@/components/dashboard/chart-tip";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart";
import { useMountReveal } from "@/hooks/use-mount-reveal";
import {
  formatAxisQuantity,
  formatShortDate,
  formatTick,
  formatWeekdayTick,
  niceScale,
} from "@/lib/chart/format";
import type { DaySlot, WeekSlot } from "@/lib/chart/window";
import { formatQuantity, type UnitId } from "@/lib/contracts/units";

export type BarTarget = {
  value: number;
  /** Named reference label ("Goal 128 oz", "Limit 2,300 kcal"). */
  label: string;
  /** Which side of the target is the alert side. */
  direction: "atLeast" | "atMost";
};

function barFill(
  value: number,
  target: BarTarget | null | undefined,
  domainColor: string
): string {
  if (!target) {
    return domainColor;
  }
  if (target.direction === "atLeast" && value >= target.value) {
    return "var(--positive)";
  }
  if (target.direction === "atMost" && value > target.value) {
    return "var(--critical)";
  }
  return domainColor;
}

export function DailyBarsChart({
  slots,
  unit,
  color,
  tipLabel,
  target,
  axisSuffix,
  yScale,
  formatAxisTick,
  formatValue,
  compact = false,
}: {
  /** One slot per window day, in DISPLAY units; null = unlogged (gap). */
  slots: readonly DaySlot[];
  unit: UnitId;
  /** Domain accent (lib/chart/palette DOMAIN.*). */
  color: string;
  /** Tooltip row label ("Water", "Calories"). */
  tipLabel: string;
  target?: BarTarget | null;
  /** Glued y-tick suffix ("oz"); empty string for unitless ticks. */
  axisSuffix?: string;
  /** niceScale overrides (sleep passes unit: 60 for whole-hour ticks). */
  yScale?: { unit?: number; steps?: number[] };
  /** Y-tick formatter override (sleep renders minutes as "8h"). */
  formatAxisTick?: (value: number) => string;
  /** Tooltip value formatter; defaults to the contract quantity formatter. */
  formatValue?: (value: number) => string;
  compact?: boolean;
}) {
  const reveal = useMountReveal();
  const suffix = axisSuffix ?? "";
  const fmtValue = formatValue ?? ((v: number) => formatQuantity(v, unit));

  const { max, ticks } = useMemo(() => {
    const peak = Math.max(
      ...slots.map((s) => s.value ?? 0),
      target?.value ?? 0,
      1
    );
    return niceScale(peak, {
      maxIntervals: compact ? 3 : 4,
      unit: yScale?.unit,
      steps: yScale?.steps,
    });
  }, [slots, target, compact, yScale]);

  const days = slots.length;
  const tickFormatter = days <= 14 ? formatWeekdayTick : formatTick;
  const interval = Math.max(0, Math.ceil(days / (compact ? 5 : 7)) - 1);

  // Recharts never activates hover on a null-valued slot, which would make
  // the "Not logged" tooltip unreachable. Each unlogged day gets a full-height
  // TRANSPARENT stacked "hit" bar purely as a hover target; the visible chart
  // stays an honest gap.
  const rows = useMemo(
    () =>
      slots.map((s) => ({
        ...s,
        hit: s.value == null ? max : null,
      })),
    [slots, max]
  );

  const chartConfig = {
    value: { label: tipLabel, color },
  } satisfies ChartConfig;

  return (
    <ChartContainer className="h-full w-full" config={chartConfig}>
      <BarChart
        data={rows}
        margin={{ top: 8, left: 4, bottom: 0, right: compact ? -8 : 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis
          axisLine={false}
          dataKey="t"
          fontSize={11}
          interval={interval}
          tickFormatter={tickFormatter}
          tickLine={false}
          tickMargin={8}
        />
        {/* Right-aligned sparse axis (MacroFactor/Linear convention). */}
        <YAxis
          axisLine={false}
          domain={[0, max]}
          fontSize={11}
          orientation="right"
          tickFormatter={
            formatAxisTick ?? ((v: number) => formatAxisQuantity(v, suffix))
          }
          tickLine={false}
          tickMargin={4}
          ticks={ticks}
          width={46}
        />
        <ChartTooltip
          content={
            <SlotTooltip color={color} fmtValue={fmtValue} tipLabel={tipLabel} />
          }
          cursor={{ fillOpacity: 0.06 }}
        />
        {/* The goal line is unlabeled in the plot (MacroFactor convention);
            the ChartFrame header and legend state it in text. */}
        {target && (
          <ReferenceLine
            stroke="var(--color-goal-line)"
            strokeDasharray="5 4"
            strokeWidth={2}
            y={target.value}
          />
        )}
        {/* Invisible hover target for unlogged days (see `rows` above). */}
        <Bar dataKey="hit" fill="transparent" isAnimationActive={false} stackId="slot" />
        <Bar
          animationDuration={600}
          animationEasing="ease-out"
          dataKey="value"
          isAnimationActive={reveal}
          radius={[4, 4, 0, 0]}
          stackId="slot"
        >
          {slots.map((s) => (
            <Cell
              fill={s.value == null ? "transparent" : barFill(s.value, target, color)}
              key={s.t}
            />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

export function WeeklyBarsChart({
  slots,
  color,
  tipLabel,
  target,
  formatValue,
  compact = false,
}: {
  /** Trailing 7-day bins (lib/chart/window.ts toWeekSlots); values are counts. */
  slots: readonly WeekSlot[];
  color: string;
  tipLabel: string;
  target?: BarTarget | null;
  formatValue?: (value: number) => string;
  compact?: boolean;
}) {
  const reveal = useMountReveal();
  const fmtValue = formatValue ?? ((v: number) => `${v}`);

  const { max, ticks } = useMemo(() => {
    const peak = Math.max(...slots.map((s) => s.value), target?.value ?? 0, 1);
    return niceScale(peak, { maxIntervals: 4, steps: [1, 2, 5, 10] });
  }, [slots, target]);

  const chartConfig = {
    value: { label: tipLabel, color },
  } satisfies ChartConfig;

  return (
    <ChartContainer className="h-full w-full" config={chartConfig}>
      <BarChart
        data={slots as WeekSlot[]}
        margin={{ top: 8, left: 4, bottom: 0, right: compact ? -16 : -8 }}
      >
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis
          axisLine={false}
          dataKey="t"
          fontSize={11}
          tickFormatter={(t: number) => `Wk of ${formatShortDate(t)}`}
          tickLine={false}
          tickMargin={8}
        />
        <YAxis
          allowDecimals={false}
          axisLine={false}
          domain={[0, max]}
          fontSize={11}
          orientation="right"
          tickLine={false}
          tickMargin={4}
          ticks={ticks}
          width={28}
        />
        <ChartTooltip
          content={
            <SlotTooltip
              color={color}
              fmtValue={fmtValue}
              tipLabel={tipLabel}
              weekBins
            />
          }
          cursor={{ fillOpacity: 0.06 }}
        />
        {/* Unlabeled goal line; the frame header and legend carry the text. */}
        {target && (
          <ReferenceLine
            stroke="var(--color-goal-line)"
            strokeDasharray="5 4"
            strokeWidth={2}
            y={target.value}
          />
        )}
        {/* minPointSize keeps a truthful zero COUNT visible as a stub. */}
        <Bar
          animationDuration={600}
          animationEasing="ease-out"
          dataKey="value"
          fill={color}
          isAnimationActive={reveal}
          minPointSize={2}
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ChartContainer>
  );
}

/**
 * NOTE: the prop is `tipLabel`, never `label`: recharts clones the tooltip
 * content element and injects its own `label` (the x-axis value), which would
 * silently overwrite ours with a raw epoch number.
 */
function SlotTooltip({
  active,
  payload,
  tipLabel,
  color,
  fmtValue,
  weekBins = false,
}: {
  active?: boolean;
  payload?: { payload?: { t: number; value: number | null } }[];
  tipLabel: string;
  color: string;
  fmtValue: (value: number) => string;
  weekBins?: boolean;
}) {
  if (!active || !payload?.length) {
    return null;
  }
  const row = payload[0]?.payload;
  if (!row) {
    return null;
  }
  if (row.value == null) {
    return (
      <ChartTip rows={[{ label: tipLabel, value: "Not logged" }]} t={row.t} />
    );
  }
  return (
    <ChartTip
      rows={[
        {
          color,
          label: weekBins ? `${tipLabel} (week)` : tipLabel,
          value: fmtValue(row.value),
        },
      ]}
      t={row.t}
    />
  );
}
