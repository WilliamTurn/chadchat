"use client";

/**
 * THE CHART GRAMMAR (FIX-18). Every shared chart renders inside this frame,
 * which owns the anatomy audit doc 05 and visual-excellence section 6 demand,
 * so no chart can ship missing a piece of it:
 *
 *   - specific title (the canonical metric name)
 *   - headline value + unit, via the contract formatters (units.ts): the
 *     chart is NEVER the only carrier of the value
 *   - time range (member phrase + optional segmented control, 44px touch)
 *   - goal/target framing when one exists (the goal line lives in the plot;
 *     the frame states it in text)
 *   - coverage caption when interpretation depends on logging ("4 of 7 days
 *     logged", data-state.ts phrasing)
 *   - text summary for screen readers (built by lib/chart/summary.ts), as the
 *     figure's accessible description
 *   - honest non-populated treatments: loading reserves the exact plot height
 *     (zero-shift law), error keeps trust and offers retry, empty is a
 *     designed compact state with no chart furniture, locked is a teaser and
 *     never an error tone.
 *
 * Embedding: `chrome=false` drops the card shell (and, with `compact`, the
 * title/headline row) so a panel that already renders its own header via the
 * P2-B panel frame can mount just the plot + captions. Chart-level state
 * treatments still apply either way.
 */

import { Lock } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type Coverage,
  formatCoverage,
  type MetricReading,
} from "@/lib/contracts/data-state";
import type { PanelState } from "@/lib/contracts/data-state";
import { formatQuantity, type UnitId } from "@/lib/contracts/units";
import { cn } from "@/lib/utils";
import { ChartRangeControl } from "./chart-range-control";
import type { ChartRangeState } from "./use-chart-window";

export type ChartLegendItem = {
  /** Swatch shape: solid line (trend), dot (raw points), dash (goal line). */
  swatch: "line" | "dot" | "dash";
  /** CSS color (palette constant or var(--token)). */
  color: string;
  label: string;
};

export function ChartFrame({
  title,
  state,
  headline,
  headlineLabel,
  reading,
  unit,
  goalText,
  range,
  rangeLabel,
  coverage,
  summary,
  legend,
  caption,
  height,
  chrome = true,
  compact = false,
  emptyMessage,
  emptyAction,
  lockedCapability,
  onRetry,
  className,
  children,
}: {
  /** Canonical metric/chart name ("Weight trend", "Calories"). */
  title: string;
  /** The resolved render state; the frame draws the designed treatment. */
  state: PanelState;
  /** Pre-formatted headline override (rare; duration strings etc.). */
  headline?: string;
  /** Label under the headline; REQUIRED wording for estimates ("Trend weight"). */
  headlineLabel?: string;
  /** The headline reading; formatted via units.ts. Unlogged reads "Not logged". */
  reading: MetricReading<number>;
  unit: UnitId;
  /** Text form of the goal ("Goal 180 lb"); the plot draws the line itself. */
  goalText?: string;
  /** Interactive range control (omit for fixed-window charts). */
  range?: ChartRangeState;
  /** Member phrase for a fixed window ("last 7 days") when `range` is absent. */
  rangeLabel?: string;
  /** Renders the coverage caption when logging is incomplete. */
  coverage?: Coverage;
  /** Plain-language summary (lib/chart/summary.ts); the figure's a11y text. */
  summary: string;
  legend?: ChartLegendItem[];
  /** Footer note (stale "Last logged Jun 26", methodology, verdicts). */
  caption?: ReactNode;
  /** Reserved plot height in px; loading reserves exactly this (zero-shift). */
  height: number;
  chrome?: boolean;
  /** Panel-embed mode: no title/headline row (the panel header carries them). */
  compact?: boolean;
  /** Designed empty state, one sentence ("Log your first weigh-in..."). */
  emptyMessage?: string;
  emptyAction?: ReactNode;
  /** One concrete sentence for the locked teaser. */
  lockedCapability?: string;
  onRetry?: () => void;
  className?: string;
  children: ReactNode;
}) {
  const activeRangeLabel = range?.rangeLabel ?? rangeLabel;
  // The headline never fakes data: empty forces "Not logged", locked shows no
  // value at all (a locked member's data is never fetched), loading shows a
  // placeholder skeleton where the value will land (zero-shift).
  const headlineText =
    state === "empty"
      ? "Not logged"
      : (headline ??
        (reading.status === "logged"
          ? formatQuantity(reading.value, unit)
          : "Not logged"));

  const showCoverage =
    coverage != null &&
    coverage.windowDays > 0 &&
    coverage.loggedDays < coverage.windowDays &&
    (state === "sparse" || state === "stale" || state === "populated");

  const body = (() => {
    switch (state) {
      case "loading":
        return (
          <div aria-hidden>
            <Skeleton className="w-full" style={{ height }} />
          </div>
        );
      case "error":
        return (
          <div
            className="flex flex-col items-center justify-center gap-3 rounded-xl bg-surface-inset px-6 text-center"
            style={{ minHeight: Math.min(height, 200) }}
          >
            <p className="text-body text-muted-foreground">
              We couldn't load this chart. Your logs are safe.
            </p>
            {onRetry && (
              <Button onClick={onRetry} size="sm" variant="outline">
                Try again
              </Button>
            )}
          </div>
        );
      case "empty":
        // Designed empty: no chart furniture, compact budget (doc 05).
        return (
          <div className="flex min-h-36 flex-col items-center justify-center gap-3 rounded-xl bg-surface-inset px-6 py-8 text-center">
            <p className="max-w-sm text-body text-muted-foreground">
              {emptyMessage ?? "Nothing logged here yet."}
            </p>
            {emptyAction}
          </div>
        );
      case "locked":
        return (
          <div className="flex min-h-36 flex-col items-center justify-center gap-3 rounded-xl border border-border border-dashed px-6 py-8 text-center">
            <Lock aria-hidden className="size-5 text-muted-foreground" />
            <p className="max-w-sm text-body text-muted-foreground">
              {lockedCapability ?? `${title} charts are a Pro feature.`}
            </p>
            <Button asChild size="sm" variant="outline">
              <Link href="/account">Upgrade to Pro</Link>
            </Button>
          </div>
        );
      default:
        // sparse / stale / populated all draw the honest plot. The plot node
        // (not the whole figure) is the a11y image so the range control and
        // links around it stay reachable; `summary` is its accessible name.
        return (
          <div aria-label={summary} role="img" style={{ height }}>
            {children}
          </div>
        );
    }
  })();

  const showPlotChrome =
    state === "sparse" || state === "stale" || state === "populated";

  return (
    <figure
      className={cn(
        chrome && "rounded-2xl border border-border bg-surface-card p-5 md:p-6",
        className
      )}
    >
      {!compact && (
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <div className="min-w-0">
            <h3 className="text-card-title text-muted-foreground">{title}</h3>
            {state === "loading" ? (
              <Skeleton aria-hidden className="mt-1 h-8 w-32" />
            ) : state === "locked" ? null : (
              <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
                <span className="text-metric tabular-nums">{headlineText}</span>
                {headlineLabel && (
                  <span className="text-secondary text-muted-foreground">
                    {headlineLabel}
                  </span>
                )}
              </div>
            )}
            {(goalText || activeRangeLabel) && showPlotChrome && (
              <p className="mt-0.5 text-secondary text-muted-foreground">
                {[goalText, activeRangeLabel].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
          {range && showPlotChrome && <ChartRangeControl control={range} />}
        </div>
      )}

      <div className={compact ? undefined : "mt-4"}>{body}</div>

      {showPlotChrome && (legend?.length || showCoverage || caption) ? (
        <figcaption className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {legend?.map((item) => (
            <span
              className="inline-flex items-center gap-1.5 text-meta text-muted-foreground"
              key={item.label}
            >
              <LegendSwatch color={item.color} swatch={item.swatch} />
              {item.label}
            </span>
          ))}
          {showCoverage && coverage && (
            <span className="text-meta text-muted-foreground">
              {formatCoverage(coverage)}
            </span>
          )}
          {caption && (
            <span className="text-meta text-muted-foreground">{caption}</span>
          )}
        </figcaption>
      ) : null}

      {/* The full text summary, for screen readers (grammar requirement). */}
      <p className="sr-only">{summary}</p>
    </figure>
  );
}

function LegendSwatch({
  swatch,
  color,
}: {
  swatch: ChartLegendItem["swatch"];
  color: string;
}) {
  if (swatch === "dot") {
    return (
      <span
        aria-hidden
        className="size-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="h-0.5 w-4 rounded-full"
      style={{
        backgroundColor: swatch === "dash" ? "transparent" : color,
        backgroundImage:
          swatch === "dash"
            ? `repeating-linear-gradient(90deg, ${color} 0 4px, transparent 4px 7px)`
            : undefined,
      }}
    />
  );
}
