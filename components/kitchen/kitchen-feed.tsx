"use client";

import { Refrigerator } from "lucide-react";
import { type ReactNode, useState } from "react";
import { KitchenAnalysisSkeleton } from "@/components/kitchen/kitchen-analysis-skeleton";
import { KitchenForm } from "@/components/kitchen/kitchen-form";

/**
 * Client shell for the Pro kitchen feed. Owns the "Chad's analyzing" state so a
 * shaped ghost card (NUT-7) can slot in at the top of History the moment a photo
 * is submitted, and renders the fridge empty state (NUT-6) when there's nothing
 * yet. The server passes the rendered `AnalysisCard`s in as `history` so they
 * stay server-rendered across the boundary.
 */
export function KitchenFeed({
  history,
  hasEntries,
}: {
  history: ReactNode;
  hasEntries: boolean;
}) {
  const [analyzing, setAnalyzing] = useState(false);

  return (
    // Full-width desktop layout (LAY-1): photo form (left) and History
    // (right) side by side at xl, matching /nutrition's form + diary shape;
    // phones keep the stacked order. Explicit grid-cols-1 so the single
    // narrow column sizes to the container, not the cards' max-content.
    <div className="grid grid-cols-1 items-start gap-8 xl:grid-cols-2">
      <section className="min-w-0 rounded-2xl border border-border bg-card p-6">
        <KitchenForm onAnalyzingChange={setAnalyzing} />
      </section>

      {analyzing || hasEntries ? (
        <section className="flex min-w-0 flex-col gap-4">
          <h2 className="font-medium text-lg">Kitchen History</h2>
          {analyzing && <KitchenAnalysisSkeleton />}
          {history}
        </section>
      ) : (
        <div className="flex min-w-0 flex-col items-center gap-3 py-10 text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-blood/10">
            <Refrigerator className="size-7 text-blood" />
          </div>
          <p className="max-w-xs text-muted-foreground text-sm">
            No kitchen checks yet. Show Chad your fridge, your grocery cart,
            any food in your life, and brace yourself.
          </p>
        </div>
      )}
    </div>
  );
}
