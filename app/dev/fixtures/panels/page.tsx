import Link from "next/link";
import {
  InsightProteinDemo,
  MilestonePrDemo,
  PlanTrainingDemo,
  QuickLogHydrationDemo,
  QuickLogSleepDemo,
  StatusCaloriesDemo,
  SummaryProgressDemo,
  TrendWeightDemo,
} from "@/components/panels/demo/panel-demos";
import { panelSpanClass } from "@/components/panels/panel-frame";
import { cn } from "@/lib/utils";
import { PERSONAS, type Persona } from "@/tests/fixtures/dashboard-states";

/**
 * PANEL COMPOSITION PAGE (P2-B harness, FIX-15 evidence surface).
 *
 * The eight demo panels composed on the REAL `grid-dashboard` (4/8/12
 * columns) at their role spans, in the states this persona's data resolves
 * to. This is where role-based sizing is verified as dynamic behavior:
 *
 *   - Span follows the role at every width (panelSpanClass), never symmetry.
 *   - Panels are `self-start`: a sparse or empty panel keeps its designed
 *     compact height next to a populated sibling. Equal-height rows died in
 *     FIX-15; if every card in a row measures identical here, that is a bug.
 *   - Height budgets are machine-readable (`data-height-min`/`-max`) so the
 *     screenshot suite and auditors can measure instead of eyeball.
 *
 * ?persona=<id> switches the member (default: consistent).
 */
export default async function PanelsCompositionPage({
  searchParams,
}: {
  searchParams: Promise<{ persona?: string }>;
}) {
  const { persona: personaParam } = await searchParams;
  const persona: Persona =
    PERSONAS.find((p) => p.id === personaParam) ??
    PERSONAS.find((p) => p.id === "consistent") ??
    PERSONAS[0];
  const x = persona.expected;

  const cells = [
    { key: "status", role: "status" as const, node: <StatusCaloriesDemo persona={persona} state={x.nutrition} /> },
    { key: "summary", role: "summary" as const, node: <SummaryProgressDemo persona={persona} state={x.body} /> },
    { key: "milestone", role: "milestone" as const, node: <MilestonePrDemo persona={persona} state={x.training} /> },
    { key: "quick-log-water", role: "quick-log" as const, node: <QuickLogHydrationDemo persona={persona} state={x.hydration} /> },
    { key: "quick-log-sleep", role: "quick-log" as const, node: <QuickLogSleepDemo persona={persona} state={x.sleep} /> },
    { key: "plan", role: "plan" as const, node: <PlanTrainingDemo persona={persona} state={x.training} /> },
    { key: "trend", role: "trend" as const, node: <TrendWeightDemo persona={persona} state={x.body} /> },
    { key: "insight", role: "insight" as const, node: <InsightProteinDemo persona={persona} state={x.nutrition} /> },
  ];

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h1 className="text-page-title">Panel composition</h1>
        <p className="max-w-prose text-body text-muted-foreground">
          All eight demo panels on the dashboard grid at their role spans, in
          the states this persona's data resolves to. Size follows
          information: sparse and empty panels keep their compact height next
          to populated siblings. Persona: <strong>{persona.id}</strong>
        </p>
        <nav className="flex flex-wrap gap-2">
          {PERSONAS.map((p) => (
            <Link
              className={cn(
                "rounded-lg border px-3 py-2 text-secondary transition-colors",
                p.id === persona.id
                  ? "border-foreground/40 bg-muted text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
              href={`/dev/fixtures/panels?persona=${p.id}`}
              key={p.id}
            >
              {p.id}
            </Link>
          ))}
        </nav>
      </div>

      <div className="grid-dashboard">
        {cells.map((cell) => (
          <div className={panelSpanClass(cell.role)} key={cell.key}>
            {cell.node}
          </div>
        ))}
      </div>
    </div>
  );
}
