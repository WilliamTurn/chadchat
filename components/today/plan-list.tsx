"use client";

import { Dumbbell, RotateCcw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { removePlan, updatePlanRecord } from "@/app/home/actions";
import { AskChadButton } from "@/components/chad/ask-chad-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/ui/confirm-undo";
import { ModuleFooter, ModuleHeader } from "./module-card";
import { type EditablePlan, PlanEditor } from "./plan-editor";
import { PlanStatusBadge } from "./plan-status-badge";

/**
 * Pull the day structure out of a free-text training plan: lines like
 * "Day 1 — Upper", "Day 2: Lower", "**Day 3 - Push**". Returns the per-day
 * labels (the label may be "" when the line is just "Day N"). Best-effort and
 * purely additive — an unparseable plan simply shows no split summary.
 */
function parsePlanDays(detail: string): string[] {
  const labels: string[] = [];
  for (const raw of detail.split(/\r?\n/)) {
    const line = raw.replace(/[*_#>`]/g, "").trim();
    const match = line.match(/^day\s*\d+\b\s*[—:\-–.)]*\s*(.*)$/i);
    if (match) {
      labels.push(match[1].trim());
    }
  }
  return labels;
}

/** A compact "4-day split · Upper / Lower / …" strip for a training plan. */
function SplitSummary({ detail }: { detail: string }) {
  const days = parsePlanDays(detail);
  if (days.length < 2) {
    return null;
  }
  const named = days.filter(Boolean).slice(0, 4);
  const moreNamed = days.filter(Boolean).length > named.length;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      <span className="flex items-center gap-1">
        {days.slice(0, 7).map((_, i) => (
          // Fixed positional dots; index is a stable key here.
          // biome-ignore lint/suspicious/noArrayIndexKey: positional day dots
          <span className="size-1.5 rounded-full bg-blood/70" key={i} />
        ))}
      </span>
      <span className="font-medium text-muted-foreground">
        {days.length}-day split
      </span>
      {named.length > 0 && (
        <span className="min-w-0 truncate text-muted-foreground">
          · {named.join(" / ")}
          {moreNamed ? " …" : ""}
        </span>
      )}
    </div>
  );
}

function PlanItem({ plan }: { plan: EditablePlan }) {
  return (
    <div className="rounded-xl border border-border bg-background/40 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium leading-snug">{plan.title}</p>
          <Badge className="mt-1" variant="secondary">
            {plan.kind === "diet" ? "Diet" : "Training"}
          </Badge>
        </div>
        <PlanStatusBadge status={plan.status} />
      </div>
      {plan.kind === "training" && <SplitSummary detail={plan.detail} />}
      <div className="mt-1 flex items-center gap-1">
        {/* The plan's full-page document (R2-9), not a cramped dialog. */}
        <Button asChild className="px-0 text-blood" size="sm" variant="link">
          <Link href={`/plans/${plan.id}`}>View full plan</Link>
        </Button>
        <PlanEditor plan={plan} variant="icon" />
        <RowDeletePlan plan={plan} />
      </div>
    </div>
  );
}

/**
 * A direct row delete for a plan, on the shared named-confirm platform:
 * deleting a member's whole plan names the exact plan and its consequence
 * (destructive confirm-or-undo law; P56-Z audit P2 replaced the bare inline
 * Delete/Cancel flip here).
 */
function RowDeletePlan({ plan }: { plan: EditablePlan }) {
  const router = useRouter();

  return (
    <ConfirmActionDialog
      confirmLabel="Delete plan"
      consequence="It leaves Today and your plans list immediately. Workouts and meals you already logged stay."
      onConfirm={async () => {
        const result = await removePlan(plan.id);
        if (!result.ok) {
          toast.error(result.error ?? "Couldn't delete that plan.");
          throw new Error("plan delete failed");
        }
        toast.success("Plan deleted.");
        router.refresh();
      }}
      title={`Delete the ${plan.kind === "diet" ? "diet" : "training"} plan "${plan.title}"?`}
      trigger={
        <Button
          aria-label={`Delete plan: ${plan.title}`}
          className="size-11 text-muted-foreground sm:size-7"
          size="icon"
          variant="ghost"
        >
          <Trash2 className="size-3.5" />
        </Button>
      }
    />
  );
}

/**
 * One archived/completed plan: status badge, View, and a one-click "Make
 * current" (mirrors the goals card's PastGoalItem). Keeps the LC-15
 * auto-archive recoverable: reactivating retires whichever plan of that kind
 * is current now.
 */
function PastPlanItem({ plan }: { plan: EditablePlan }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onReactivate() {
    startTransition(async () => {
      const result = await updatePlanRecord({ ...plan, status: "active" });
      if (result.ok) {
        toast.success("That's your current plan again.");
        router.refresh();
      } else {
        toast.error(result.error ?? "Couldn't reactivate that.");
      }
    });
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-background/40 px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <p className="truncate text-sm">{plan.title}</p>
        <PlanStatusBadge status={plan.status} />
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button asChild className="px-0 text-blood" size="sm" variant="link">
          <Link href={`/plans/${plan.id}`}>View</Link>
        </Button>
        <Button
          aria-label="Make this the current plan"
          className="size-11 text-muted-foreground sm:size-7"
          disabled={pending}
          onClick={onReactivate}
          size="icon"
          variant="ghost"
        >
          <RotateCcw className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

/**
 * The /home "Your training" card body: lists the user's saved training/diet
 * plans (the full documents), with an Add control and an empty state that falls
 * back to the one-line plan Chad has in memory until a real one is saved.
 * Archived/completed plans collapse into a "Past plans" disclosure so the
 * single-current rule's auto-archive stays recoverable (LC-15).
 */
export function PlanList({
  plans,
  memoryPlanHint,
  pastPlans = [],
  quiet = false,
}: {
  plans: EditablePlan[];
  memoryPlanHint: string | null;
  pastPlans?: EditablePlan[];
  /** First-run (P1-4): the empty state describes what will appear here instead
   *  of adding another CTA to the chorus — the hero owns the one first action. */
  quiet?: boolean;
}) {
  return (
    <>
      <ModuleHeader
        icon={<Dumbbell className="size-4" />}
        title="Your training"
        tone="blood"
        viewHref="/workouts"
      />

      {plans.length > 0 ? (
        <div className="flex flex-col gap-2">
          {plans.map((p) => (
            <PlanItem key={p.id} plan={p} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-start gap-3">
          {memoryPlanHint ? (
            <div className="rounded-xl border border-border border-dashed bg-background/40 p-3">
              <p className="line-clamp-4 whitespace-pre-line text-sm leading-relaxed">
                {memoryPlanHint}
              </p>
              <p className="mt-1 text-muted-foreground text-xs">
                Pulled from your chats. Save it as a plan to keep, edit, and
                export the full thing.
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              {quiet
                ? "Your training plan will live here once Chad builds it. Tell him about yourself and he'll put your split together."
                : "No plan on file yet. Ask Chad to build your split, then save it here, or add your own."}
            </p>
          )}
          {!quiet && <PlanEditor variant="cta" />}
        </div>
      )}

      {pastPlans.length > 0 && (
        <details className="group mt-4 border-border border-t pt-3">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-muted-foreground text-sm hover:text-foreground">
            <span className="transition-transform group-open:rotate-90">›</span>
            Past plans ({pastPlans.length})
          </summary>
          <div className="mt-2 flex flex-col gap-2">
            {pastPlans.map((p) => (
              <PastPlanItem key={p.id} plan={p} />
            ))}
          </div>
        </details>
      )}

      <ModuleFooter
        askChad={
          <AskChadButton prompt="Look at my training plan. Is it right for my goal, and should anything about it change?" />
        }
      >
        {plans.length > 0 && <PlanEditor variant="add" />}
      </ModuleFooter>
    </>
  );
}
