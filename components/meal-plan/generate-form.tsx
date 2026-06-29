"use client";

import { ChefHat, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { generatePlan } from "@/app/meal-plan/actions";
import { PlanSkeleton } from "@/components/meal-plan/plan-skeleton";
import { SegmentedPicker } from "@/components/meal-plan/segmented-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  type Budget,
  BUDGET_LABEL,
  BUDGETS,
  type CookTime,
  COOK_TIME_LABEL,
  COOK_TIMES,
  type DietStyle,
  DIET_STYLE_LABEL,
  DIET_STYLES,
} from "@/lib/validation/meal-plan";

function toList(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);
}

// Tap-target option lists built from the validation label maps, so the form and
// the schema can never drift apart.
const DIET_OPTIONS = DIET_STYLES.map((s) => ({
  value: s,
  label: DIET_STYLE_LABEL[s],
}));
const BUDGET_OPTIONS = BUDGETS.map((b) => ({ value: b, label: BUDGET_LABEL[b] }));
const COOK_OPTIONS = COOK_TIMES.map((c) => ({
  value: c,
  label: COOK_TIME_LABEL[c],
}));
const MEALS_OPTIONS = [2, 3, 4, 5, 6].map((n) => ({
  value: String(n),
  label: String(n),
}));
const DAYS_OPTIONS = [1, 2, 3, 4, 5, 6, 7].map((n) => ({
  value: String(n),
  label: String(n),
}));

/**
 * The preferences form that generates a structured meal plan from the dashboard.
 * Every preference is a segmented pill picker (NUT-4) rather than a native
 * dropdown, and generation (one Opus design pass + food-DB lookups, a minute or
 * two) shows a shape-matched skeleton of the plan that's forming.
 */
export function GenerateForm({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [dietStyle, setDietStyle] = useState<DietStyle>("balanced");
  const [mealsPerDay, setMealsPerDay] = useState("4");
  const [days, setDays] = useState("7");
  const [budget, setBudget] = useState<Budget>("moderate");
  const [cookTime, setCookTime] = useState<CookTime>("moderate");
  const [allergies, setAllergies] = useState("");
  const [dislikes, setDislikes] = useState("");
  const [notes, setNotes] = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await generatePlan({
        dietStyle,
        mealsPerDay: Number(mealsPerDay),
        days: Number(days),
        budget,
        cookTime,
        allergies: toList(allergies),
        dislikes: toList(dislikes),
        notes: notes.trim(),
      });
      if (res.ok) {
        toast.success("Your meal plan is ready.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Couldn't build that plan.");
      }
    });
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={onSubmit}>
      {!compact && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <ChefHat className="size-4 text-blood" />
          <span>
            Tell Chad how you eat. He builds the plan around your macro target —
            real foods, exact portions, accurate numbers.
          </span>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label>Eating style</Label>
        <SegmentedPicker
          ariaLabel="Eating style"
          className="grid-cols-2 sm:grid-cols-3"
          onChange={(v) => setDietStyle(v as DietStyle)}
          options={DIET_OPTIONS}
          value={dietStyle}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label>Meals per day</Label>
          <SegmentedPicker
            ariaLabel="Meals per day"
            className="grid-cols-5"
            onChange={setMealsPerDay}
            options={MEALS_OPTIONS}
            value={mealsPerDay}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Days to plan</Label>
          <SegmentedPicker
            ariaLabel="Days to plan"
            className="grid-cols-7"
            onChange={setDays}
            options={DAYS_OPTIONS}
            value={days}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label>Cooking effort</Label>
          <SegmentedPicker
            ariaLabel="Cooking effort"
            className="grid-cols-1 sm:grid-cols-3"
            onChange={(v) => setCookTime(v as CookTime)}
            options={COOK_OPTIONS}
            value={cookTime}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Budget</Label>
          <SegmentedPicker
            ariaLabel="Budget"
            className="grid-cols-3"
            onChange={(v) => setBudget(v as Budget)}
            options={BUDGET_OPTIONS}
            value={budget}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="allergies">Allergies</Label>
          <Input
            id="allergies"
            onChange={(e) => setAllergies(e.target.value)}
            placeholder="e.g. peanuts, shellfish"
            value={allergies}
          />
          <span className="text-[11px] text-muted-foreground">
            Comma-separated. Hard exclusions — never included.
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dislikes">Foods to avoid</Label>
          <Input
            id="dislikes"
            onChange={(e) => setDislikes(e.target.value)}
            placeholder="e.g. mushrooms, tofu"
            value={dislikes}
          />
          <span className="text-[11px] text-muted-foreground">
            Comma-separated. Chad will steer clear.
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notes">Anything else (optional)</Label>
        <Textarea
          id="notes"
          maxLength={500}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. I train fasted in the mornings; I want bigger dinners."
          rows={2}
          value={notes}
        />
      </div>

      <Button className="w-full" disabled={pending} size="lg" type="submit">
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Building your plan — this takes a minute…
          </>
        ) : (
          <>
            <ChefHat className="size-4" />
            Build my meal plan
          </>
        )}
      </Button>

      {pending && (
        <div className="flex flex-col gap-3">
          <p className="text-center text-muted-foreground text-xs">
            Chad is designing every meal and pulling real macros from the food
            database. Hang tight.
          </p>
          <PlanSkeleton meals={Number(mealsPerDay)} />
        </div>
      )}
    </form>
  );
}
