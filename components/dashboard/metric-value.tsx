"use client";

import type { ReactNode } from "react";
import { CountUp } from "@/components/dashboard/count-up";
import { KpiHelp } from "@/components/dashboard/kpi";
import { formatQuantity, type UnitId } from "@/lib/contracts/units";
import { cn } from "@/lib/utils";

/**
 * MetricValue (RC-8): the one way a displayed stat becomes visible text, so a
 * scopeless number ("Workouts logged: 6", of what? since when?) is
 * unrepresentable. Two things are REQUIRED at the type level:
 *
 *   - `unit` (a {@link UnitId}); the value formats once here through the
 *     canonical `formatQuantity`, never a hand-rolled `${n} ${unit}`.
 *   - a scope: either `scope` (the number states its own span) OR
 *     `scopeInChart` (the number sits under a chart whose visible range
 *     control already labels the span). Passing NEITHER does not compile.
 *
 * It renders the number and a caption (`label · scope`) within the caller's
 * existing tile; it owns no colors, sizes, or spacing beyond the shared
 * defaults, so it drops into a surface without restyling it. `layout:"pieces"`
 * returns the number and caption as a fragment for a tile that arranges them
 * itself (e.g. a responsive order swap).
 */

/**
 * The time spans a number may declare, in plain member words (no jargon;
 * design-lint's jargon-leak rule catches internal analysis phrasing shown raw
 * to members). Add a
 * phrase when a real surface needs one, so every scope stays a reviewed choice.
 */
export type MetricScope =
  | "all time"
  | "today"
  | "this week"
  | "this month"
  | "this year"
  | "last 7 days"
  | "last 14 days"
  | "last 30 days"
  | "last 90 days"
  | "last 12 weeks";

type MetricValueBase = {
  /** Raw number; formatted once here through the canonical unit formatter. */
  value: number;
  /** Required unit; "count" is a plain tally. The formatter supplies the
   *  space and suffix so no caller hand-rolls the unit string. */
  unit: UnitId;
  /** The metric's name ("Workouts logged", "Volume"): answers "of what?". */
  label: string;
  /** Optional plain-English explainer (the shared "?" popover). */
  help?: ReactNode;
  /** "stack" owns a vertical wrapper; "pieces" returns a fragment so an
   *  existing tile positions the number and caption itself. */
  layout?: "stack" | "pieces";
  /** Render the caption above the number (a tile that reads label-then-value). */
  captionFirst?: boolean;
  className?: string;
  /** Extra classes on the number, so each surface keeps its own size. */
  valueClassName?: string;
  /** Extra classes on the caption (e.g. a tile's responsive order). */
  captionClassName?: string;
};

/**
 * REQUIRED scope. A call site passes EITHER `scope` OR `scopeInChart`; passing
 * neither is a type error, which is the recurrence gate: a scopeless call site
 * no longer compiles.
 */
export type ScopeProp =
  | { scope: MetricScope; scopeInChart?: never }
  | { scopeInChart: true; scope?: never };

export type MetricValueProps = MetricValueBase & ScopeProp;

/** Pure: the formatted number string, always via the canonical formatter. */
export function metricValueText(value: number, unit: UnitId): string {
  return formatQuantity(value, unit);
}

/**
 * Pure: the scope phrase shown beside the label, or null when the span is
 * carried by an enclosing chart's range control (the deliberate escape).
 */
export function metricScopeText(props: ScopeProp): MetricScope | null {
  return "scopeInChart" in props && props.scopeInChart ? null : props.scope;
}

export function MetricValue(props: MetricValueProps) {
  const {
    value,
    unit,
    label,
    help,
    layout = "stack",
    captionFirst = false,
    className,
    valueClassName,
    captionClassName,
  } = props;
  const scope = metricScopeText(props);

  const number = (
    <div
      className={cn(
        "whitespace-nowrap font-semibold text-xl tracking-tight tabular-nums",
        valueClassName
      )}
    >
      <CountUp value={metricValueText(value, unit)} />
    </div>
  );

  const caption = (
    <div
      className={cn(
        "flex items-center gap-1 text-muted-foreground text-xs",
        captionClassName
      )}
    >
      <span>
        {label}
        {scope && (
          <span className="ml-1 text-muted-foreground/70">· {scope}</span>
        )}
      </span>
      {help && <KpiHelp label={label}>{help}</KpiHelp>}
    </div>
  );

  const ordered = captionFirst ? (
    <>
      {caption}
      {number}
    </>
  ) : (
    <>
      {number}
      {caption}
    </>
  );

  if (layout === "pieces") {
    return ordered;
  }
  return (
    <div className={cn("flex min-w-0 flex-col gap-0.5", className)}>
      {ordered}
    </div>
  );
}
