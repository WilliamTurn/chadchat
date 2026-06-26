"use client";

import { ChefHat, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { generatePlan } from "@/app/meal-plan/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  BUDGET_LABEL,
  BUDGETS,
  COOK_TIME_LABEL,
  COOK_TIMES,
  DIET_STYLE_LABEL,
  DIET_STYLES,
  type DietStyle,
  type Budget,
  type CookTime,
} from "@/lib/validation/meal-plan";

function toList(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);
}

/**
 * The preferences form that generates a structured meal plan from the dashboard.
 * Generation takes a minute or two (one Opus design pass + food-DB lookups), so
 * the submit state is an explicit, reassuring full-button progress state.
 */
export function GenerateForm({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [, setBusy] = useState(false);

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
    setBusy(true);
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
      setBusy(false);
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

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="diet-style">Eating style</Label>
          <Select
            onValueChange={(v) => setDietStyle(v as DietStyle)}
            value={dietStyle}
          >
            <SelectTrigger id="diet-style">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DIET_STYLES.map((s) => (
                <SelectItem key={s} value={s}>
                  {DIET_STYLE_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="meals-per-day">Meals per day</Label>
          <Select onValueChange={setMealsPerDay} value={mealsPerDay}>
            <SelectTrigger id="meals-per-day">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2, 3, 4, 5, 6].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n} meals
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="days">Days to plan</Label>
          <Select onValueChange={setDays} value={days}>
            <SelectTrigger id="days">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n} {n === 1 ? "day" : "days"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cook-time">Cooking effort</Label>
          <Select
            onValueChange={(v) => setCookTime(v as CookTime)}
            value={cookTime}
          >
            <SelectTrigger id="cook-time">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COOK_TIMES.map((c) => (
                <SelectItem key={c} value={c}>
                  {COOK_TIME_LABEL[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="budget">Budget</Label>
          <Select onValueChange={(v) => setBudget(v as Budget)} value={budget}>
            <SelectTrigger id="budget">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BUDGETS.map((b) => (
                <SelectItem key={b} value={b}>
                  {BUDGET_LABEL[b]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
        <p className="-mt-2 text-center text-muted-foreground text-xs">
          Chad is designing every meal and pulling real macros from the food
          database. Hang tight.
        </p>
      )}
    </form>
  );
}
