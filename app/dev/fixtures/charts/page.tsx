import Link from "next/link";
import type { ReactNode } from "react";
import {
  CaloriesBarsChartDemo,
  type ChartDemoProps,
  HydrationBarsChartDemo,
  SleepBarsChartDemo,
  TrainingFrequencyChartDemo,
  WeightTrendChartDemo,
} from "@/components/charts/demo/chart-demos";
import type { PanelState } from "@/lib/contracts/data-state";
import { PANEL_STATES_TO_DESIGN } from "@/lib/contracts/panels";
import { cn } from "@/lib/utils";
import { PERSONAS, type Persona } from "@/tests/fixtures/dashboard-states";

/**
 * CHART SYSTEM MATRIX (P2-C harness, FIX-18).
 *
 * Three sections, all fed by the deterministic fixture personas:
 *   1. Grammar states: the weight trend chart forced through all seven data
 *      states, proving the frame's designed treatments.
 *   2. Chart types: every shared chart type (trend, daily bars x 3 domains,
 *      weekly frequency) at the persona's real state.
 *   3. Compact variants: the panel-embed form (chrome off, no header row)
 *      that TrendPanel adopts at P2-Z integration.
 *
 * ?persona=<id> selects the fixture member (default: consistent).
 */
export default async function ChartsMatrixPage({
  searchParams,
}: {
  searchParams: Promise<{ persona?: string }>;
}) {
  const { persona: personaParam } = await searchParams;
  const persona: Persona =
    PERSONAS.find((p) => p.id === personaParam) ??
    PERSONAS.find((p) => p.id === "consistent") ??
    PERSONAS[0];

  const demos: { name: string; render: (p: ChartDemoProps) => ReactNode }[] = [
    { name: "Weight trend", render: (p) => <WeightTrendChartDemo {...p} /> },
    { name: "Calories", render: (p) => <CaloriesBarsChartDemo {...p} /> },
    { name: "Water", render: (p) => <HydrationBarsChartDemo {...p} /> },
    { name: "Sleep", render: (p) => <SleepBarsChartDemo {...p} /> },
    {
      name: "Workouts per week",
      render: (p) => <TrainingFrequencyChartDemo {...p} />,
    },
  ];

  return (
    <div className="space-y-12">
      <div className="space-y-3">
        <h1 className="text-page-title">Chart system</h1>
        <p className="max-w-prose text-body text-muted-foreground">
          The shared chart grammar (FIX-18): title, headline value, unit, time
          range, goal line, coverage caption, text summary, and honest
          missing-data encoding. Axes span the window, never the data extent
          (DSH-60). Persona: <strong>{persona.id}</strong>
        </p>
        <nav className="flex flex-wrap gap-2">
          {PERSONAS.map((p) => (
            <Link
              className={cn(
                "rounded-lg border px-3 py-2 text-body-sm transition-colors",
                p.id === persona.id
                  ? "border-foreground/40 bg-muted text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
              href={`/dev/fixtures/charts?persona=${p.id}`}
              key={p.id}
            >
              {p.id}
            </Link>
          ))}
        </nav>
      </div>

      <section className="space-y-4" data-testid="chart-grammar-states">
        <div className="space-y-1">
          <h2 className="text-section-title">Grammar states</h2>
          <p className="text-body-sm text-muted-foreground">
            The weight trend chart forced through all seven render states.
            Loading reserves the plot height (zero-shift); empty and locked are
            designed treatments with no chart furniture.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {PANEL_STATES_TO_DESIGN.map((state) => (
            <div data-state={state} data-testid={`chart-state-${state}`} key={state}>
              <StateBadge state={state} />
              <div className="mt-2">
                <WeightTrendChartDemo persona={persona} state={state} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4" data-testid="chart-types">
        <div className="space-y-1">
          <h2 className="text-section-title">Chart types</h2>
          <p className="text-body-sm text-muted-foreground">
            Every shared chart type on this persona's real data: trend line
            (raw + smoothed + goal), daily adherence bars vs target across
            three domains, and weekly frequency counts.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {demos.map((d) => (
            <div data-testid={`chart-type-${d.name}`} key={d.name}>
              {d.render({ persona, state: "populated" })}
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4" data-testid="chart-compact">
        <div className="space-y-1">
          <h2 className="text-section-title">Compact variants (panel embed)</h2>
          <p className="text-body-sm text-muted-foreground">
            The chrome-off compact form a panel's visual slot mounts (TrendPanel
            adopts these at P2-Z integration). The panel header carries title
            and headline; the chart keeps its captions and text summary.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {demos.map((d) => (
            <div
              className="rounded-2xl border border-border bg-surface-card p-4"
              data-testid={`chart-compact-${d.name}`}
              key={d.name}
            >
              <p className="mb-2 text-card-title text-muted-foreground">
                {d.name}
              </p>
              {d.render({ persona, state: "populated", compact: true })}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

const STATE_TONES: Record<PanelState, string> = {
  locked: "bg-chart-4/15 text-sleep-text",
  loading: "bg-muted text-muted-foreground",
  error: "bg-critical-text/10 text-critical-text",
  empty: "bg-muted text-muted-foreground",
  sparse: "bg-attention/15 text-attention-text",
  stale: "bg-attention/15 text-attention-text",
  populated: "bg-positive/15 text-positive-text",
};

function StateBadge({ state }: { state: PanelState }) {
  return (
    <span
      className={cn(
        "rounded-md px-2 py-0.5 font-medium text-meta uppercase tracking-wide",
        STATE_TONES[state]
      )}
    >
      {state}
    </span>
  );
}
