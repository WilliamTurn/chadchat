/**
 * CALENDAR HEATMAP (new signature visual type, P56-A, per briefing rule 9's
 * new-primitive path). A weekday-rows x week-columns grid of member-local
 * days, the canonical consistency form in category-leading products:
 * GitHub's contribution graph, Strava's training log, Gentler Streak's
 * activity calendar, WHOOP's calendar view (reference captures in
 * evidence-p56a/references/).
 *
 * Two honest encodings share the grid:
 *   - intensity: 0..max count per day (consistency: how many domains logged),
 *     alpha-stepped from one hue via color-mix so both themes derive from
 *     the same token.
 *   - categorical: named per-day statuses (adherence: hit / missed), each
 *     with its own token color.
 *
 * Honesty rules baked in: an UNLOGGED day renders hollow (border only),
 * never as a zero-colored cell; days after `todayMs` render invisible
 * placeholders (the future is not data); every cell carries its date and
 * value as a native tooltip + aria-label, and callers put the full text
 * summary on the surrounding frame per the chart grammar.
 *
 * Server-safe: pure markup, no hooks, no recharts.
 */

import { MS_PER_DAY } from "@/lib/chart/trend";
import { formatShortDate } from "@/lib/chart/format";
import { cn } from "@/lib/utils";

export type HeatmapCell = {
  /** 00:00-UTC anchor of the member-local day. */
  t: number;
  /**
   * Intensity mode: 0..maxLevel (0 = logged nothing that day is NOT this;
   * pass null for unlogged). Categorical mode: index into `categories`.
   */
  level: number | null;
};

export type HeatmapCategory = {
  /** CSS color (token var or palette constant). */
  color: string;
  /** Member-facing word for the tooltip ("within target"). */
  label: string;
};

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

/** Tokenized intensity: the hue is the token, the step is opacity. */
function intensityOpacity(level: number, maxLevel: number): number {
  return 0.35 + (Math.min(level, maxLevel) / Math.max(1, maxLevel)) * 0.65;
}

const CELL_GAP = 3;

export function CalendarHeatmap({
  cells,
  color = "var(--chart-2)",
  maxLevel = 1,
  categories,
  todayMs,
  tipLabel,
  showWeekdayLabels = true,
  className,
}: {
  /** One cell per day, oldest first, contiguous. */
  cells: readonly HeatmapCell[];
  /** Intensity hue (ignored in categorical mode). */
  color?: string;
  /** Intensity ceiling (a level at/above this renders full-strength). */
  maxLevel?: number;
  /** Categorical mode: level indexes into these instead of the ramp. */
  categories?: readonly HeatmapCategory[];
  /** 00:00-UTC anchor of the member-local today; later cells render blank. */
  todayMs: number;
  /** Tooltip noun for intensity mode ("domains logged"). */
  tipLabel: string;
  showWeekdayLabels?: boolean;
  className?: string;
}) {
  if (cells.length === 0) {
    return null;
  }

  // Column-per-week layout (fixed height at any window length). Pad the
  // first week so cells land on their true weekday rows.
  const firstWeekday = new Date(cells[0].t).getUTCDay();
  const padded: (HeatmapCell | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...cells,
  ];
  const weeks: (HeatmapCell | null)[][] = [];
  for (let i = 0; i < padded.length; i += 7) {
    weeks.push(padded.slice(i, i + 7));
  }

  return (
    <div aria-hidden className={cn("flex min-w-0 gap-1.5", className)}>
      {showWeekdayLabels && (
        <div
          className="grid shrink-0 grid-rows-7"
          style={{ gap: CELL_GAP }}
        >
          {/* 12px + full muted-foreground: the a11y floor for caption text
              (FIX-19); alternating rows keep tall glyphs from colliding when
              cells run small. */}
          {WEEKDAY_LABELS.map((d, i) => (
            <span
              className="flex items-center text-muted-foreground leading-none"
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed weekday order
              key={i}
              style={{ fontSize: 12 }}
            >
              {i % 2 === 1 ? d : ""}
            </span>
          ))}
        </div>
      )}
      {/* Cell size is CAPPED (max-w-4): cells are aspect-square, so an
          uncapped stretched column balloons cell HEIGHT past any frame (the
          P56-B live finding: 5 week-columns in a wide card painted 900px+ of
          cells over the sections below). Many-week windows still shrink to
          fit via flex-1; few-week windows cluster left at 16px cells, the
          GitHub-calendar look. */}
      <div className="flex min-w-0 flex-1" style={{ gap: CELL_GAP }}>
        {weeks.map((week, wi) => (
          <div
            className="grid w-full max-w-4 flex-1 grid-rows-7"
            // biome-ignore lint/suspicious/noArrayIndexKey: contiguous weeks
            key={wi}
            style={{ gap: CELL_GAP }}
          >
            {Array.from({ length: 7 }, (_, di) => {
              const cell = week[di] ?? null;
              if (!cell || cell.t > todayMs) {
                // Leading pad / future day: invisible placeholder.
                return (
                  <span
                    aria-hidden
                    className="aspect-square w-full rounded-sm"
                    // biome-ignore lint/suspicious/noArrayIndexKey: fixed 7-row grid
                    key={di}
                  />
                );
              }
              const date = formatShortDate(cell.t);
              let style: React.CSSProperties | undefined;
              let title: string;
              if (cell.level == null) {
                style = undefined;
                title = `${date}: not logged`;
              } else if (categories) {
                const cat = categories[Math.min(cell.level, categories.length - 1)];
                style = { backgroundColor: cat.color };
                title = `${date}: ${cat.label}`;
              } else {
                style = {
                  backgroundColor: color,
                  opacity: intensityOpacity(cell.level, maxLevel),
                };
                title = `${date}: ${cell.level} ${tipLabel}`;
              }
              return (
                <span
                  className={cn(
                    "aspect-square w-full rounded-sm",
                    cell.level == null && "border border-border/70"
                  )}
                  key={cell.t}
                  style={style}
                  title={title}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
