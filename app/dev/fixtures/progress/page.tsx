import Link from "next/link";
import {
  BodySection,
  ConsistencySection,
  GoalSection,
  GoalsEmptySection,
  HydrationSection,
  MilestoneSection,
  NutritionSection,
  OverviewBand,
  ReportsSection,
  SleepSection,
  TrainingSection,
} from "@/components/progress/overview/sections";
import { buildOverviewDemoVMs } from "@/components/progress/overview/demo/overview-demo";
import { cn } from "@/lib/utils";
import { PERSONAS, type Persona } from "@/tests/fixtures/dashboard-states";

/**
 * PROGRESS OVERVIEW MATRIX (P56-A harness, FIX-32). The nine cross-domain
 * sections fed by the deterministic fixture personas through the same pure
 * computation modules the live /progress page uses. Every section renders in
 * every persona: visible, explicitly empty, or explicitly locked; never
 * silently absent.
 *
 * ?persona=<id> selects the fixture member (default: consistent).
 */
export default async function ProgressOverviewMatrixPage({
  searchParams,
}: {
  searchParams: Promise<{ persona?: string }>;
}) {
  const { persona: personaParam } = await searchParams;
  const persona: Persona =
    PERSONAS.find((p) => p.id === personaParam) ??
    PERSONAS.find((p) => p.id === "consistent") ??
    PERSONAS[0];

  const vms = buildOverviewDemoVMs(persona);

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h1 className="text-page-title">Progress overview</h1>
        <p className="max-w-prose text-body text-muted-foreground">
          The cross-domain overview (FIX-32): goals, body, training, nutrition,
          sleep, hydration, consistency, milestones, and reports; each section
          visible or explicitly empty/locked, every number from its registered
          metric's one source module. Persona: <strong>{persona.id}</strong>
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
              href={`/dev/fixtures/progress?persona=${p.id}`}
              key={p.id}
            >
              {p.id}
            </Link>
          ))}
        </nav>
      </div>

      <div className="grid-dashboard" data-testid="progress-overview">
        <OverviewBand title="Goals" />
        <div className="col-span-4" data-testid="section-goals">
          {vms.goal ? <GoalSection vm={vms.goal} /> : <GoalsEmptySection />}
        </div>

        <OverviewBand title="Outcomes" />
        <div
          className="col-span-4 md:col-span-8 xl:col-span-6"
          data-testid="section-body"
        >
          <BodySection vm={vms.body} />
        </div>
        <div
          className="col-span-4 md:col-span-8 xl:col-span-6"
          data-testid="section-training"
        >
          <TrainingSection vm={vms.training} />
        </div>

        <OverviewBand title="Daily habits" />
        <div
          className="col-span-4 md:col-span-4 xl:col-span-4"
          data-testid="section-nutrition"
        >
          <NutritionSection vm={vms.nutrition} />
        </div>
        <div
          className="col-span-4 md:col-span-4 xl:col-span-4"
          data-testid="section-sleep"
        >
          <SleepSection vm={vms.sleep} />
        </div>
        <div
          className="col-span-4 md:col-span-4 xl:col-span-4"
          data-testid="section-hydration"
        >
          <HydrationSection vm={vms.hydration} />
        </div>

        <OverviewBand title="Consistency and review" />
        <div
          className="col-span-4 md:col-span-8 xl:col-span-4"
          data-testid="section-consistency"
        >
          <ConsistencySection vm={vms.consistency} />
        </div>
        <div
          className="col-span-4 md:col-span-4 xl:col-span-4"
          data-testid="section-milestones"
        >
          <MilestoneSection vm={vms.milestone} />
        </div>
        <div
          className="col-span-4 md:col-span-4 xl:col-span-4"
          data-testid="section-reports"
        >
          <ReportsSection vm={vms.reports} />
        </div>
      </div>
    </div>
  );
}
