import { RewardProvider } from "@/components/dashboard/reward";
import { panelSpanClass } from "@/components/panels/panel-frame";
import {
  fixtureHydrationProps,
  fixtureNutritionProps,
  fixtureSleepProps,
} from "@/components/today/demo/today-panel-fixtures";
import { HydrationPanel } from "@/components/today/hydration-panel";
import { NutritionPanel } from "@/components/today/nutrition-panel";
import { SleepPanel } from "@/components/today/sleep-panel";
import { PERSONAS } from "@/tests/fixtures/dashboard-states";

/**
 * TODAY TRACKING PANELS harness page (P56-C, FIX-25/26/27). The three REAL
 * shipping panels (never lookalike demos) rendered for every fixture
 * persona, plus forced fetch-layer rows, so all seven designed states are
 * screenshotable:
 *
 *   empty      first-run (all three) and lapsed (nutrition, hydration)
 *   stale      lapsed (sleep: last entry 12 nights back, shown DATED)
 *   populated  sparse / consistent / overshoot personas
 *   locked     locked-basic persona (the panels' own teaser)
 *   loading    forced fetchState row
 *   error      forced fetchState row
 *
 * (Sparse is structurally unreachable for these three daily-status domains:
 * sparseBelowPoints is 1, so one log of the day is already the populated
 * treatment; the personas page asserts the same resolution.)
 *
 * Interactions here call the real server actions and surface their honest
 * failure toasts when unauthenticated; this page verifies composition and
 * states, the live logging paths are verified on /hydration, /sleep, /home.
 */
export default function TodayPanelsFixturePage() {
  return (
    <RewardProvider haptics={false} sound={false}>
      <div className="space-y-10">
        <div className="space-y-3">
          <h1 className="text-page-title">Today tracking panels</h1>
          <p className="max-w-prose text-body text-muted-foreground">
            FIX-25 Nutrition, FIX-26 Hydration, FIX-27 Sleep as typed
            QuickLogPanels on the P2 system, per persona. Strip AND chart in
            every state; missing days stay hollow; per-day targets are the
            FIX-07 effective-dated values.
          </p>
        </div>

        {PERSONAS.map((persona) => {
          const locked = persona.tier === "basic";
          const nutrition = fixtureNutritionProps(persona);
          const hydration = fixtureHydrationProps(persona);
          const sleep = fixtureSleepProps(persona);
          return (
            <section className="space-y-3" key={persona.id}>
              <h2 className="text-section-title">{persona.id}</h2>
              <p className="max-w-prose text-body-sm text-muted-foreground">
                {persona.description}
              </p>
              <div className="grid-dashboard">
                <div className={panelSpanClass("quick-log")}>
                  <NutritionPanel {...nutrition} locked={locked} />
                </div>
                <div className={panelSpanClass("quick-log")}>
                  <HydrationPanel {...hydration} locked={locked} />
                </div>
                <div className={panelSpanClass("quick-log")}>
                  <SleepPanel {...sleep} locked={locked} />
                </div>
              </div>
            </section>
          );
        })}

        {(["loading", "error"] as const).map((fetchState) => {
          const persona = PERSONAS.find((p) => p.id === "consistent");
          if (!persona) {
            return null;
          }
          const nutrition = fixtureNutritionProps(persona);
          const hydration = fixtureHydrationProps(persona);
          const sleep = fixtureSleepProps(persona);
          return (
            <section className="space-y-3" key={fetchState}>
              <h2 className="text-section-title">
                fetch layer: {fetchState}
              </h2>
              <div className="grid-dashboard">
                <div className={panelSpanClass("quick-log")}>
                  <NutritionPanel {...nutrition} fetchState={fetchState} />
                </div>
                <div className={panelSpanClass("quick-log")}>
                  <HydrationPanel {...hydration} fetchState={fetchState} />
                </div>
                <div className={panelSpanClass("quick-log")}>
                  <SleepPanel {...sleep} fetchState={fetchState} />
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </RewardProvider>
  );
}
