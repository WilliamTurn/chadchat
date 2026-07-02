import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { formatTick } from "@/lib/chart/format";

/**
 * The one shared scrub-tooltip body for every dashboard chart (VF-8). Each
 * chart's custom Recharts `content` component unwraps its own payload, then
 * renders this: bold UTC-stable date, color-dotted label→value rows, and an
 * optional footer line (goal-hit notes, "Not logged", …) — so weight, volume,
 * nutrition, water, sleep and 1RM all speak the same tooltip language.
 */
export function ChartTip({
  t,
  rows = [],
  children,
}: {
  /** The day's ms timestamp — rendered as the bold header via `formatTick`. */
  t: number;
  rows?: TipRow[];
  /** Optional extra footer content below the rows. */
  children?: ReactNode;
}) {
  return (
    <div className="min-w-[10rem] rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-xl">
      <div className="mb-1.5 font-medium">{formatTick(t)}</div>
      {rows.length > 0 && (
        <div className="flex flex-col gap-1">
          {rows.map((r) => (
            <TipRowLine key={r.label} {...r} />
          ))}
        </div>
      )}
      {children}
    </div>
  );
}

export type TipRow = {
  /** Swatch color; omit for a plain text row. */
  color?: string;
  label: string;
  value: string;
  /** Emphasize the label (e.g. the active metric in the nutrition tooltip). */
  em?: boolean;
};

function TipRowLine({ color, label, value, em }: TipRow) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-1.5">
        {color && (
          <span
            className="size-2 shrink-0 rounded-[2px]"
            style={{ backgroundColor: color }}
          />
        )}
        <span
          className={cn(
            "text-muted-foreground",
            em && "font-medium text-foreground"
          )}
        >
          {label}
        </span>
      </div>
      <span className="ml-auto font-medium text-foreground tabular-nums">
        {value}
      </span>
    </div>
  );
}
