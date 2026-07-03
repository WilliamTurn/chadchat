"use client";

import { ChefHat, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { generatePlan } from "@/app/meal-plan/actions";
import { PlanSkeleton } from "@/components/meal-plan/plan-skeleton";
import { SegmentedPicker } from "@/components/meal-plan/segmented-picker";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  DIET_STYLE_DESCRIPTION,
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
// the schema can never drift apart. Each eating style carries its one-line
// explanation (NUT-18) so nobody has to guess what "Paleo" actually means.
const DIET_OPTIONS = DIET_STYLES.map((s) => ({
  value: s,
  label: DIET_STYLE_LABEL[s],
  description: DIET_STYLE_DESCRIPTION[s],
}));
const BUDGET_DESCRIPTION: Record<Budget, string> = {
  budget: "Cheap staples: eggs, rice, beans, frozen veg",
  moderate: "Normal groceries, nothing fancy",
  premium: "Whatever hits the target best",
};
const BUDGET_OPTIONS = BUDGETS.map((b) => ({
  value: b,
  label: BUDGET_LABEL[b],
  description: BUDGET_DESCRIPTION[b],
}));
const COOK_DESCRIPTION: Record<CookTime, string> = {
  minimal: "Quick assembly, minimal stove time",
  moderate: "Simple cooking, one or two pans",
  involved: "Real recipes, batch prep is fine",
};
const COOK_OPTIONS = COOK_TIMES.map((c) => ({
  value: c,
  label: COOK_TIME_LABEL[c],
  description: COOK_DESCRIPTION[c],
}));
// The common cases stay one tap; "Other" takes any number 1-8 typed in
// (OMAD, six-meals-plus-shakes bodybuilder splits).
const MEALS_OPTIONS = [
  ...[2, 3, 4, 5, 6].map((n) => ({ value: String(n), label: String(n) })),
  { value: "other", label: "Other" },
];
const DAYS_OPTIONS = [1, 2, 3, 4, 5, 6, 7].map((n) => ({
  value: String(n),
  label: String(n),
}));

/**
 * The preferences form that generates a structured meal plan from the dashboard.
 * Every preference is a segmented pill picker (NUT-4) rather than a native
 * dropdown, with plain-English explainers on every fixed choice and free-text
 * escapes for eating style, meals/day, and schedule (NUT-18). Generation (one
 * Opus design pass + food-DB lookups, a minute or two) shows a shape-matched
 * skeleton of the plan that's forming.
 */
export function GenerateForm({
  compact = false,
  readinessHints = [],
}: {
  compact?: boolean;
  /** What Chad still doesn't know about this member (NUT-19). Non-empty =
   * show a "this plan could be off" confirm before building. */
  readinessHints?: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [dietStyle, setDietStyle] = useState<DietStyle>("balanced");
  const [dietStyleOther, setDietStyleOther] = useState("");
  const [mealsChoice, setMealsChoice] = useState("4");
  const [mealsCustom, setMealsCustom] = useState("");
  const [mealPattern, setMealPattern] = useState("");
  const [days, setDays] = useState("7");
  const [budget, setBudget] = useState<Budget>("moderate");
  const [cookTime, setCookTime] = useState<CookTime>("moderate");
  const [allergies, setAllergies] = useState("");
  const [dislikes, setDislikes] = useState("");
  const [notes, setNotes] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  function resolveMealsPerDay(): number | null {
    if (mealsChoice !== "other") {
      return Number(mealsChoice);
    }
    const n = Math.round(Number(mealsCustom));
    if (!Number.isFinite(n) || n < 1 || n > 8) {
      return null;
    }
    return n;
  }

  function build() {
    const mealsPerDay = resolveMealsPerDay();
    if (mealsPerDay === null) {
      toast.error("Enter how many meals a day, from 1 to 8.");
      return;
    }
    startTransition(async () => {
      const res = await generatePlan({
        dietStyle,
        dietStyleOther: dietStyle === "other" ? dietStyleOther.trim() : "",
        mealsPerDay,
        mealPattern: mealPattern.trim(),
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

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (dietStyle === "other" && !dietStyleOther.trim()) {
      toast.error("Describe how you eat so Chad can build around it.");
      return;
    }
    // Thin profile? Say so honestly before spending a minute building (NUT-19)
    // instead of silently producing a plan that could be off.
    if (readinessHints.length > 0) {
      setConfirmOpen(true);
      return;
    }
    build();
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
          className="grid-cols-1 min-[480px]:grid-cols-2"
          onChange={(v) => setDietStyle(v as DietStyle)}
          options={DIET_OPTIONS}
          value={dietStyle}
        />
        {dietStyle === "other" && (
          <Input
            aria-label="Describe how you eat"
            maxLength={120}
            onChange={(e) => setDietStyleOther(e.target.value)}
            placeholder="Describe it, e.g. carnivore-leaning, mostly red meat and fruit"
            value={dietStyleOther}
          />
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label>Meals per day</Label>
          <SegmentedPicker
            ariaLabel="Meals per day"
            className="grid-cols-6"
            onChange={setMealsChoice}
            options={MEALS_OPTIONS}
            value={mealsChoice}
          />
          {mealsChoice === "other" && (
            <Input
              aria-label="How many meals a day"
              inputMode="numeric"
              onChange={(e) => setMealsCustom(e.target.value)}
              placeholder="Type a number, 1 to 8"
              value={mealsCustom}
            />
          )}
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

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="meal-pattern">Eating schedule (optional)</Label>
        <Textarea
          id="meal-pattern"
          maxLength={300}
          onChange={(e) => setMealPattern(e.target.value)}
          placeholder="e.g. 16:8 fasting, first meal at noon · no breakfast · one meal on Fridays"
          rows={2}
          value={mealPattern}
        />
        <span className="text-[11px] text-muted-foreground">
          Fasting windows, skipped meals, shift work: Chad places every meal
          inside your real schedule.
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label>Cooking effort</Label>
          <SegmentedPicker
            ariaLabel="Cooking effort"
            className="grid-cols-1"
            onChange={(v) => setCookTime(v as CookTime)}
            options={COOK_OPTIONS}
            value={cookTime}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Budget</Label>
          <SegmentedPicker
            ariaLabel="Budget"
            className="grid-cols-1"
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
          placeholder="e.g. I want bigger dinners; I meal-prep Sundays; keep lunches portable."
          rows={2}
          value={notes}
        />
        <span className="text-[11px] text-muted-foreground">
          Chad reads this and builds to it, same as the fields above.
        </span>
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
          <PlanSkeleton meals={resolveMealsPerDay() ?? 4} />
        </div>
      )}

      <AlertDialog onOpenChange={setConfirmOpen} open={confirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Chad still knows very little about you
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="flex flex-col gap-2">
                <p>
                  He'll build the plan with what he has, but it could be off:
                </p>
                <ul className="list-disc space-y-1 pl-5">
                  {readinessHints.map((hint) => (
                    <li key={hint}>{hint}</li>
                  ))}
                </ul>
                <p>
                  The more you fill in, the sharper the plan. You can also
                  build now and regenerate anytime.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Let me fill that in first</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOpen(false);
                build();
              }}
            >
              Build it anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}
