import { Target, Trophy } from "lucide-react";
import Link from "next/link";
import { SummaryPanel } from "@/components/panels/roles";
import { GoalProgressBar } from "@/components/panels/visuals";
import { Button } from "@/components/ui/button";
import type { PrimaryGoalData } from "@/lib/today/plans-goals-data";
import { cn } from "@/lib/utils";

/**
 * PRIMARY GOAL (FIX-30). One featured goal on Today (the 03-spec rule), its
 * linked outcomes resolved through the SAME shared module as the /progress
 * overview (lib/goals/outcome-values.ts), so the two surfaces can never
 * disagree. Absolute current-vs-target numbers, never percent alone (the
 * WHOOP/Apple grammar from the rule-8 teardown); a reached outcome gets the
 * tokenized reward treatment (owner reward-glow order). SummaryPanel role:
 * no actions; goal management lives at the named destinations.
 */

const OUTCOME_LIMIT = 3;

export function GoalPrimary({
  data,
  className,
}: {
  /** null = no active goals (the designed empty state). */
  data: PrimaryGoalData | null;
  className?: string;
}) {
  const vm = data?.vm ?? null;
  const reached = vm?.outcomes.some((o) => o.reached) === true;
  const allReached =
    vm != null && vm.outcomes.length > 0 && vm.outcomes.every((o) => o.reached);

  return (
    <SummaryPanel
      className={className}
      detailLink={
        vm
          ? { label: "Goal details", href: `/goals/${vm.id}` }
          : { label: "Goals", href: "/goals" }
      }
      empty={{
        absent: "No active goals.",
        unlock:
          "Set a goal and its live progress leads your dashboard from here.",
        action: (
          <Button
            asChild
            className="min-h-11 sm:min-h-8"
            size="sm"
            variant="outline"
          >
            <Link href="/goals/new">Set a goal</Link>
          </Button>
        ),
      }}
      glow={reached ? "emerald" : "violet"}
      headline={
        vm ? (
          <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
            <span className="min-w-0">{vm.title}</span>
            <span
              className={cn(
                "text-body-sm",
                allReached
                  ? "font-medium text-positive-text"
                  : "text-muted-foreground"
              )}
            >
              {vm.headline}
            </span>
          </span>
        ) : (
          "No active goals"
        )
      }
      icon={<Target className="size-4" />}
      lockedCapability="Members set goals and watch every linked outcome move from the dashboard."
      state={vm ? vm.state : "empty"}
      title="Primary goal"
      wrapTitle
      tone="violet"
      visual={
        vm ? (
          <div className="flex min-w-0 flex-col gap-2.5">
            {vm.outcomes.slice(0, OUTCOME_LIMIT).map((o) => (
              <OutcomeRow key={o.label} o={o} />
            ))}
            {vm.outcomes.length > OUTCOME_LIMIT && (
              <p className="text-meta text-muted-foreground">
                {vm.outcomes.length - OUTCOME_LIMIT} more in goal details
              </p>
            )}
            {data && data.otherActiveGoals > 0 && (
              <p className="text-meta text-muted-foreground">
                <Link
                  // 44px phone hit area, pulled back so the text keeps its
                  // quiet inline position (the ModuleHeader link pattern).
                  className="-my-3 inline-flex min-h-11 items-center underline-offset-4 hover:underline sm:my-0 sm:min-h-0"
                  href="/goals"
                >
                  All goals ({data.otherActiveGoals + 1})
                </Link>
              </p>
            )}
          </div>
        ) : null
      }
    />
  );
}

function OutcomeRow({
  o,
}: {
  o: NonNullable<PrimaryGoalData["vm"]>["outcomes"][number];
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex min-w-0 items-baseline gap-1.5 truncate text-body-sm text-foreground">
          {o.reached && (
            <Trophy
              aria-label="Reached"
              className="size-3.5 self-center text-positive-text"
            />
          )}
          {o.label}
        </span>
        <span className="shrink-0 text-meta text-muted-foreground tabular-nums">
          {o.currentText ?? (o.supported ? "Not logged" : "Tracked by hand")}
          {o.targetText ? ` / ${o.targetText}` : ""}
        </span>
      </div>
      {o.fraction != null ? (
        <div className="mt-1.5">
          <GoalProgressBar
            className={cn(
              "bg-positive",
              o.reached && "shadow-[var(--shadow-glow-positive)]"
            )}
            fraction={o.fraction}
          />
        </div>
      ) : (
        <div className="mt-1.5 h-2 rounded-full border border-border/70 border-dashed" />
      )}
    </div>
  );
}
