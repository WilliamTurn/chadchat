"use client";

import { Dumbbell, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { removePlan } from "@/app/today/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconChip } from "./icon-chip";
import { type EditablePlan, PlanEditor } from "./plan-editor";
import { PlanViewer } from "./plan-viewer";

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
        {plan.status !== "active" && (
          <Badge variant="secondary">{plan.status}</Badge>
        )}
      </div>
      {plan.kind === "training" && <SplitSummary detail={plan.detail} />}
      <div className="mt-1 flex items-center gap-1">
        <PlanViewer plan={plan} />
        <PlanEditor plan={plan} variant="icon" />
        <RowDeletePlan id={plan.id} />
      </div>
    </div>
  );
}

/**
 * A direct row delete for a plan: a trash icon that flips to an inline
 * Delete/Cancel confirm (matching the workouts list), so deleting doesn't
 * require opening the View dialog (NAV-25).
 */
function RowDeletePlan({ id }: { id: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <Button
        aria-label="Delete plan"
        className="size-7 text-muted-foreground"
        onClick={() => setConfirming(true)}
        size="icon"
        variant="ghost"
      >
        <Trash2 className="size-3.5" />
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        className="h-7 px-2 text-xs"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await removePlan(id);
            if (result.ok) {
              toast.success("Plan deleted.");
              router.refresh();
            } else {
              toast.error(result.error ?? "Couldn't delete that plan.");
              setConfirming(false);
            }
          })
        }
        size="sm"
        variant="destructive"
      >
        {pending ? "Deleting…" : "Delete"}
      </Button>
      <Button
        className="h-7 px-2 text-xs"
        disabled={pending}
        onClick={() => setConfirming(false)}
        size="sm"
        variant="ghost"
      >
        Cancel
      </Button>
    </div>
  );
}

/**
 * The /today "Your training" card body: lists the user's saved training/diet
 * plans (the full documents), with an Add control and an empty state that falls
 * back to the one-line plan Chad has in memory until a real one is saved.
 */
export function PlanList({
  plans,
  memoryPlanHint,
}: {
  plans: EditablePlan[];
  memoryPlanHint: string | null;
}) {
  return (
    <>
      <div className="mb-3 flex items-start justify-between gap-2">
        <h2 className="flex items-center gap-2.5 font-medium text-muted-foreground text-sm uppercase tracking-wide">
          <IconChip tone="blood">
            <Dumbbell className="size-4" />
          </IconChip>
          Your training
        </h2>
        <div className="flex items-center gap-2">
          <Link
            className="whitespace-nowrap text-muted-foreground text-xs underline-offset-4 transition-colors hover:text-foreground hover:underline"
            href="/workouts"
          >
            View all →
          </Link>
          {plans.length > 0 && <PlanEditor variant="add" />}
        </div>
      </div>

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
              No plan on file yet. Ask Chad to build your split, then save it
              here — or add your own.
            </p>
          )}
          <PlanEditor variant="cta" />
        </div>
      )}
    </>
  );
}
