"use client";

import { Dumbbell } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { type EditablePlan, PlanEditor } from "./plan-editor";
import { PlanViewer } from "./plan-viewer";

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
      <div className="mt-1 flex items-center gap-1">
        <PlanViewer plan={plan} />
        <PlanEditor plan={plan} variant="icon" />
      </div>
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
        <h2 className="flex items-center gap-2 font-medium text-muted-foreground text-sm uppercase tracking-wide">
          <Dumbbell className="size-4 text-blood" />
          Your training
        </h2>
        <div className="flex items-center gap-2">
          <Link
            className="whitespace-nowrap text-muted-foreground text-xs underline-offset-4 transition-colors hover:text-foreground hover:underline"
            href="/workouts"
          >
            All workouts →
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
