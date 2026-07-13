import { Play } from "lucide-react";
import { AskChadButton } from "@/components/chad/ask-chad-button";
import { KpiHelp } from "@/components/dashboard/kpi";
import { PlanPanel } from "@/components/panels/roles";
import {
  type DayBar,
  PanelSparkline,
  type SparkPoint,
  WeekBars,
} from "@/components/panels/visuals";
import {
  UP_NEXT_PRIORITY_EXPLAINER,
  type UpNextToday,
} from "@/lib/today/up-next";
import { cn } from "@/lib/utils";

/**
 * THE /today "UP NEXT" PANEL (FIX-23). One prioritized, deterministic next
 * action (lib/today/up-next.ts consumes P34-D's rotation selector), with the
 * WHY always visible and the priority order one "?" away (the inspectability
 * law; the Oura one-big-thing pattern from the P56-D teardown). PlanPanel
 * role: one primary CTA, one named secondary, no logging controls.
 *
 * The visual is honest per kind: the plan rotation with your position in it
 * (training), the week's sleep bars with the missing night hollow (sleep),
 * the plan's real daily targets (meal plan), or the weight trend you're
 * reviewing (review). Never a decorative filler graphic.
 */

export type UpNextVisualData = {
  /** buildSleepWeek as DayBars (for the sleep kind). */
  sleepBars?: DayBar[];
  /** The meal plan's real daily targets (for the meal-plan kind). */
  mealChips?: { value: string; label: string }[];
  /** Recent trend-weight points (for the review kind). */
  weightSpark?: SparkPoint[];
  weightSparkGoal?: number;
};

function RotationStrip({
  rotation,
  nextPosition,
}: {
  rotation: { name: string; completedThisWeek: boolean }[];
  nextPosition: number;
}) {
  if (rotation.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        {rotation.map((s, i) => (
          <div
            aria-label={`${s.name}${i === nextPosition ? " (next)" : s.completedThisWeek ? " (done this week)" : ""}`}
            className={cn(
              "h-2 flex-1 rounded-full",
              i === nextPosition
                ? "bg-blood shadow-[var(--shadow-glow-blood)]"
                : s.completedThisWeek
                  ? "bg-positive"
                  : "bg-muted"
            )}
            key={`${s.name}-${i}`}
            role="img"
          />
        ))}
      </div>
      <p className="text-meta text-muted-foreground">
        Session {nextPosition + 1} of {rotation.length} in your rotation
      </p>
    </div>
  );
}

export function UpNextPanel({
  verdict,
  visual,
  className,
}: {
  verdict: UpNextToday;
  visual: UpNextVisualData;
  className?: string;
}) {
  const t = verdict.training;

  const headline =
    verdict.kind === "training" && t ? t.sessionName : verdict.title;

  const visualNode =
    verdict.kind === "training" && t ? (
      <div className="flex flex-col gap-3">
        <RotationStrip nextPosition={t.position} rotation={t.rotation} />
        {t.exercises.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {t.exercises.slice(0, 3).map((name) => (
              <span
                className="rounded-lg border border-border bg-background/40 px-2.5 py-1 text-body-sm text-muted-foreground"
                key={name}
              >
                {name}
              </span>
            ))}
            {t.exercises.length > 3 && (
              <span className="px-1 py-1 text-meta text-muted-foreground">
                +{t.exercises.length - 3} more
              </span>
            )}
          </div>
        )}
      </div>
    ) : verdict.kind === "sleep" && visual.sleepBars ? (
      <WeekBars barClassName="bg-chart-4" days={visual.sleepBars} />
    ) : verdict.kind === "meal-plan" && visual.mealChips?.length ? (
      <div className="flex flex-wrap gap-2">
        {visual.mealChips.map((c) => (
          <div
            className="flex items-baseline gap-1.5 rounded-xl border border-border bg-background/40 px-3 py-1.5"
            key={c.label}
          >
            <span className="font-display font-semibold text-sm leading-none">
              {c.value}
            </span>
            <span className="text-meta text-muted-foreground">{c.label}</span>
          </div>
        ))}
      </div>
    ) : visual.weightSpark && visual.weightSpark.length > 1 ? (
      <PanelSparkline
        className="text-chart-2"
        goal={visual.weightSparkGoal}
        height={56}
        points={visual.weightSpark}
      />
    ) : (
      // Honest fallback when no series exists yet: a hollow week, the same
      // designed-empty grammar the trackers use. Never a fake chart.
      <WeekBars
        days={Array.from({ length: 7 }, (_, i) => ({
          key: i,
          fraction: null,
        }))}
      />
    );

  return (
    <PlanPanel
      className={className}
      detailLink={
        verdict.secondary
          ? { label: verdict.secondary.label, href: verdict.secondary.href }
          : { label: "Progress", href: "/progress" }
      }
      empty={{
        // The selector always returns a verdict, so this designed state is
        // unreachable in practice; it exists because the contract requires it.
        absent: "Nothing queued up.",
        unlock: "Log your day and the next action appears here.",
      }}
      footer={{
        askChad: (
          <AskChadButton
            className="min-h-11 sm:min-h-8"
            prompt="Look at my dashboard. What should I do next today, and why?"
          />
        ),
        primary: { label: verdict.cta.label, href: verdict.cta.href },
      }}
      glow="blood"
      headline={
        <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
          <span className="min-w-0">{headline}</span>
          {verdict.kind === "training" && t && (
            <span className="text-body-sm text-muted-foreground">
              {t.planTitle}
            </span>
          )}
        </span>
      }
      icon={<Play className="size-4" />}
      lockedCapability="Members see one clear next action picked from their plan and logs."
      state="populated"
      title="Up next"
      tone="blood"
      visual={
        <div className="flex min-w-0 flex-col gap-3">
          <UpNextReason reason={verdict.reason} />
          {visualNode}
        </div>
      }
    />
  );
}

/** The reason line + the priority-order explainer (inspectability law). */
function UpNextReason({ reason }: { reason: string }) {
  return (
    <p className="flex items-center gap-1.5 text-body-sm text-muted-foreground">
      <span>{reason}</span>
      <KpiHelp label="How Up next is picked">
        {UP_NEXT_PRIORITY_EXPLAINER}
      </KpiHelp>
    </p>
  );
}
