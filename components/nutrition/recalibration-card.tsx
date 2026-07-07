"use client";

import { RefreshCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { applyRecalibration } from "@/app/nutrition/actions";
import { AskChadButton } from "@/components/chad/ask-chad-button";
import { Button } from "@/components/ui/button";
import type { AdaptiveRecommendation } from "@/lib/nutrition/adaptive-target";

/* NUT-23 — the weekly recalibration card. The numbers are computed in code on
   the server (lib/nutrition/adaptive-target.ts) from the member's real logged
   intake + weight trend; this card just states them and takes the member's
   consent. Nothing changes until "Apply new targets" is clicked. */

function paceLabel(rec: AdaptiveRecommendation): string {
  if (rec.desiredRate === 0) {
    return "maintenance";
  }
  const dir = rec.desiredRate < 0 ? "down" : "up";
  return `${Math.abs(rec.desiredRate)} ${rec.unit} a week ${dir}`;
}

export function RecalibrationCard({ rec }: { rec: AdaptiveRecommendation }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [applied, setApplied] = useState(false);

  if (applied) {
    return null;
  }

  const onApply = () => {
    startTransition(async () => {
      const result = await applyRecalibration();
      if (result.ok) {
        toast.success(
          `Targets updated: ${rec.calories.toLocaleString()} calories a day.`
        );
        setApplied(true);
        router.refresh();
      } else {
        toast.error(result.error ?? "Couldn't apply the new targets.");
      }
    });
  };

  const observedDir = rec.observedRate <= 0 ? "down" : "up";

  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <RefreshCcw className="size-4" />
          </span>
          <h2 className="font-medium text-lg">Weekly recalibration</h2>
        </div>
        <div className="ml-auto shrink-0">
          <AskChadButton
            prompt={`The app just recalibrated my nutrition targets from my real logs: my last ${rec.loggedDays} fully logged days averaged ${rec.avgIntake.toLocaleString()} calories a day, my weight trend moved ${Math.abs(rec.observedRate)} ${rec.unit}/week ${observedDir}, and it estimates my real daily burn near ${rec.expenditure.toLocaleString()} calories. It recommends moving my daily target from ${rec.currentCalories.toLocaleString()} to ${rec.calories.toLocaleString()} calories. Should I apply it?`}
          />
        </div>
      </div>

      <p className="mt-3 text-muted-foreground text-sm leading-relaxed">
        Your last {rec.loggedDays} fully logged days averaged{" "}
        <span className="font-medium text-foreground">
          {rec.avgIntake.toLocaleString()} calories
        </span>{" "}
        a day, and your weight trend moved{" "}
        <span className="font-medium text-foreground">
          {Math.abs(rec.observedRate)} {rec.unit}/week {observedDir}
        </span>
        . That puts your real daily burn near{" "}
        <span className="font-medium text-foreground">
          {rec.expenditure.toLocaleString()} calories
        </span>
        . To stay on pace ({paceLabel(rec)}), your daily target should move
        from {rec.currentCalories.toLocaleString()} to{" "}
        <span className="font-semibold text-foreground">
          {rec.calories.toLocaleString()} calories
        </span>
        {rec.protein != null && rec.carbs != null && rec.fat != null ? (
          <>
            {" "}
            (protein stays at {rec.protein}g; carbs {rec.carbs}g, fat{" "}
            {rec.fat}g)
          </>
        ) : null}
        .
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button disabled={pending} onClick={onApply}>
          {pending ? "Applying…" : "Apply new targets"}
        </Button>
        <p className="text-muted-foreground text-xs">
          Nothing changes until you apply. Recomputed weekly from your logs.
        </p>
      </div>
    </section>
  );
}
