import { Check } from "lucide-react";
import { DeleteAnalysisButton } from "@/components/nutrition/delete-analysis-button";
import { EditMealButton } from "@/components/nutrition/edit-meal-button";
import { LogAgainButton } from "@/components/nutrition/log-again-button";
import { Badge } from "@/components/ui/badge";
import type { MealAnalysis } from "@/lib/db/schema";

type Item = { name: string; detail?: string | null };

const KIND_LABEL: Record<string, string> = {
  meal: "Meal",
  fridge: "Fridge",
  pantry: "Pantry",
};

const MEAL_LABEL: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

function scoreColor(score: number | null): string {
  if (score == null) {
    return "text-muted-foreground";
  }
  if (score <= 3) {
    return "text-blood";
  }
  if (score <= 6) {
    return "text-amber-500";
  }
  return "text-emerald-500";
}

function Macro({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  if (value == null) {
    return null;
  }
  return (
    <div className="rounded-xl border border-border bg-background/40 px-3 py-2 text-center">
      <div className="font-display font-semibold text-base">
        {Math.round(value)}
        <span className="ml-0.5 text-muted-foreground text-xs">{unit}</span>
      </div>
      <div className="text-muted-foreground text-xs">{label}</div>
    </div>
  );
}

export function AnalysisCard({ entry }: { entry: MealAnalysis }) {
  const items = (Array.isArray(entry.items) ? entry.items : []) as Item[];
  const tips = (Array.isArray(entry.tips) ? entry.tips : []) as string[];
  const isMeal = entry.kind === "meal";
  const mealLabel = entry.meal ? MEAL_LABEL[entry.meal] : null;
  const hasMacros =
    entry.calories != null ||
    entry.protein != null ||
    entry.carbs != null ||
    entry.fat != null;

  return (
    <article className="message-fade-in overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex flex-col gap-0 sm:flex-row">
        {/* Photo (absent for manual entries) */}
        {entry.photoUrl && (
          <div className="relative sm:w-48 sm:shrink-0">
            {/* biome-ignore lint/performance/noImgElement: user-uploaded blob images, sizes vary */}
            <img
              alt={entry.title}
              className="aspect-square w-full object-cover sm:h-full"
              src={entry.photoUrl}
            />
            <Badge
              className="absolute top-2 left-2 bg-background/80 backdrop-blur"
              variant="secondary"
            >
              {KIND_LABEL[entry.kind] ?? "Photo"}
            </Badge>
          </div>
        )}

        {/* Body */}
        <div className="flex min-w-0 flex-1 flex-col gap-3 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-semibold text-base leading-tight">
                {entry.title}
              </h3>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {mealLabel && (
                  <Badge className="text-[11px]" variant="secondary">
                    {mealLabel}
                  </Badge>
                )}
                {entry.source === "manual" && (
                  <Badge className="text-[11px]" variant="outline">
                    Manual
                  </Badge>
                )}
                <span className="text-muted-foreground text-xs">
                  {entry.createdAt.toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}{" "}
                  ·{" "}
                  {entry.createdAt.toLocaleTimeString(undefined, {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
            {entry.healthScore != null && (
              <div className="shrink-0 text-right">
                <div
                  className={`font-display font-bold text-2xl ${scoreColor(entry.healthScore)}`}
                >
                  {entry.healthScore}
                  <span className="text-muted-foreground text-sm">/10</span>
                </div>
                <div className="text-muted-foreground text-[11px]">
                  Chad's grade
                </div>
              </div>
            )}
          </div>

          {hasMacros && (
            <div className="grid grid-cols-4 gap-2">
              <Macro label="kcal" unit="" value={entry.calories} />
              <Macro label="protein" unit="g" value={entry.protein} />
              <Macro label="carbs" unit="g" value={entry.carbs} />
              <Macro label="fat" unit="g" value={entry.fat} />
            </div>
          )}

          {/* Chad's verdict (absent for manual entries) */}
          {entry.verdict && (
            <blockquote className="border-blood border-l-2 pl-3 text-sm leading-relaxed">
              {entry.verdict}
            </blockquote>
          )}

          {items.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {items.map((item, i) => (
                <span
                  className="rounded-full border border-border bg-background/40 px-2.5 py-0.5 text-muted-foreground text-xs"
                  key={`${item.name}-${i}`}
                >
                  {item.name}
                  {item.detail ? ` · ${item.detail}` : ""}
                </span>
              ))}
            </div>
          )}

          {tips.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {tips.map((tip, i) => (
                <li className="flex gap-2 text-sm" key={i}>
                  <Check className="mt-0.5 size-3.5 shrink-0 text-blood" />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-auto flex items-center justify-end gap-1 pt-1">
            {isMeal && <LogAgainButton entry={entry} />}
            {isMeal && <EditMealButton entry={entry} />}
            <DeleteAnalysisButton id={entry.id} />
          </div>
        </div>
      </div>
    </article>
  );
}
