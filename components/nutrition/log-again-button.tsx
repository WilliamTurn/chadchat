"use client";

import { RotateCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { logMealManually } from "@/app/nutrition/actions";
import { defaultMealForNow } from "@/components/nutrition/meal-shared";
import { Button } from "@/components/ui/button";
import type { MealAnalysis } from "@/lib/db/schema";
import type { MealCategory } from "@/lib/validation/nutrition";

/**
 * Re-log a past meal into today. Re-inserts the macros as a fresh manual entry
 * (the fast "I ate this again" path — the #1 speed feature in MFP/MacroFactor).
 */
export function LogAgainButton({ entry }: { entry: MealAnalysis }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      className="gap-1.5 text-muted-foreground text-xs"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await logMealManually({
            title: entry.title,
            meal: (entry.meal as MealCategory | null) ?? defaultMealForNow(),
            calories: entry.calories == null ? null : Math.round(entry.calories),
            protein: entry.protein == null ? null : Math.round(entry.protein),
            carbs: entry.carbs == null ? null : Math.round(entry.carbs),
            fat: entry.fat == null ? null : Math.round(entry.fat),
            note: null,
          });
          if (result.ok) {
            toast.success("Logged again for today.");
            router.refresh();
          } else {
            toast.error(result.error ?? "Couldn't log that again.");
          }
        })
      }
      size="sm"
      variant="ghost"
    >
      <RotateCw className="size-3.5" />
      {pending ? "Logging…" : "Log again"}
    </Button>
  );
}
