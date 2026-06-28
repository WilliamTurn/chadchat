"use client";

import {
  AlertTriangle,
  Archive,
  Check,
  Download,
  Loader2,
  MessageSquare,
  MoreVertical,
  Pencil,
  RefreshCw,
  Utensils,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  archivePlan,
  logPlannedMeal,
  regeneratePlan,
  updateMealPlan,
} from "@/app/meal-plan/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { type Macros, scaleMacros, sumMacros } from "@/lib/nutrition/macros";
import { downloadMealPlanPdf } from "@/lib/pdf/meal-plan-pdf";
import { cn } from "@/lib/utils";
import type { PlanDay, PlanFood, PlanMeal } from "@/lib/validation/meal-plan";
import type { MealCategory } from "@/lib/validation/nutrition";
import { MacroRings } from "@/components/nutrition/macro-rings";

const SLOT_LABEL: Record<MealCategory, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

export type MealPlanViewData = {
  id: string;
  title: string;
  status: "active" | "archived";
  coachIntro: string;
  target: Macros | null;
  days: PlanDay[];
};

/**
 * Live macros for a food. When we have the per-100g numbers (every FDC-matched
 * food does), re-scale them so a grams edit updates the displayed macros
 * instantly — no network call, identical math to the server's authoritative
 * `recomputePlanTotals`. Fall back to the stored values only when there was no
 * FDC match (per100g === null, macros 0).
 */
function foodMacros(food: PlanFood): Macros {
  if (food.per100g) {
    return scaleMacros(food.per100g, food.grams);
  }
  return {
    calories: food.calories,
    protein: food.protein,
    carbs: food.carbs,
    fat: food.fat,
  };
}

function mealMacros(meal: PlanMeal): Macros {
  return sumMacros(meal.foods.map(foodMacros));
}

function dayMacros(day: PlanDay): Macros {
  return sumMacros(day.meals.map(mealMacros));
}

/** Compact "504 kcal · 33P 35C 26F" macro line. */
function macroLine(m: Macros): string {
  return `${m.calories.toLocaleString()} kcal · ${m.protein}P ${m.carbs}C ${m.fat}F`;
}

// Shared P/C/F accent colors — kept in sync with `MacroRings` (protein = sky,
// carbs = amber, fat = violet) so a food row reads the same as the day's dial.
const MACRO_TONE = {
  protein: "bg-sky-400",
  carbs: "bg-amber-400",
  fat: "bg-violet-400",
} as const;

type MacroKey = keyof typeof MACRO_TONE;

/** Calories contributed by each macro (4/4/9), used to size the micro-bar. */
function macroCalSplit(m: Macros): {
  protein: number;
  carbs: number;
  fat: number;
  total: number;
} {
  const protein = Math.max(0, m.protein) * 4;
  const carbs = Math.max(0, m.carbs) * 4;
  const fat = Math.max(0, m.fat) * 9;
  return { protein, carbs, fat, total: protein + carbs + fat };
}

/** Which macro drives most of a food's calories — colors its category dot. */
function dominantMacro(m: Macros): MacroKey {
  const { protein, carbs, fat } = macroCalSplit(m);
  if (fat >= protein && fat >= carbs) {
    return "fat";
  }
  return protein >= carbs ? "protein" : "carbs";
}

/** A thin 3-segment P/C/F bar showing what's driving a food's calories. */
function MacroMicroBar({ m }: { m: Macros }) {
  const { protein, carbs, fat, total } = macroCalSplit(m);
  if (total <= 0) {
    return null;
  }
  const seg = (cal: number) => `${(cal / total) * 100}%`;
  return (
    <div
      className="mt-1.5 flex h-1 w-full max-w-[180px] overflow-hidden rounded-full bg-muted"
      title={`Protein ${m.protein}g · Carbs ${m.carbs}g · Fat ${m.fat}g`}
    >
      <span className="h-full bg-sky-400" style={{ width: seg(protein) }} />
      <span className="h-full bg-amber-400" style={{ width: seg(carbs) }} />
      <span className="h-full bg-violet-400" style={{ width: seg(fat) }} />
    </div>
  );
}

/**
 * The interactive meal-plan viewer. Renders Chad's intro + a week-at-a-glance
 * day switcher + the selected day's meals, and flips into an inline editor for
 * portions/names/title/intro. Macros always render from each food's per-100g so
 * edits re-scale live; the server re-totals authoritatively on save.
 */
export function MealPlanView({ plan }: { plan: MealPlanViewData }) {
  const router = useRouter();

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(plan.title);
  const [coachIntro, setCoachIntro] = useState(plan.coachIntro);
  const [days, setDays] = useState<PlanDay[]>(plan.days);
  const [dayIdx, setDayIdx] = useState(0);

  const [saving, startSave] = useTransition();
  const [busy, startBusy] = useTransition();

  const day = days[dayIdx] ?? days[0];
  const dayTotals = day ? dayMacros(day) : null;

  // --- Edit helpers (all immutable) ---

  function patchFood(
    mealIdx: number,
    foodIdx: number,
    patch: Partial<PlanFood>
  ) {
    setDays((prev) =>
      prev.map((d, di) =>
        di === dayIdx
          ? {
              ...d,
              meals: d.meals.map((m, mi) =>
                mi === mealIdx
                  ? {
                      ...m,
                      foods: m.foods.map((f, fi) =>
                        fi === foodIdx ? { ...f, ...patch } : f
                      ),
                    }
                  : m
              ),
            }
          : d
      )
    );
  }

  function removeFood(mealIdx: number, foodIdx: number) {
    setDays((prev) =>
      prev.map((d, di) =>
        di === dayIdx
          ? {
              ...d,
              meals: d.meals.map((m, mi) =>
                mi === mealIdx
                  ? { ...m, foods: m.foods.filter((_, fi) => fi !== foodIdx) }
                  : m
              ),
            }
          : d
      )
    );
  }

  function patchMealTitle(mealIdx: number, value: string) {
    setDays((prev) =>
      prev.map((d, di) =>
        di === dayIdx
          ? {
              ...d,
              meals: d.meals.map((m, mi) =>
                mi === mealIdx ? { ...m, title: value } : m
              ),
            }
          : d
      )
    );
  }

  function cancelEdit() {
    setTitle(plan.title);
    setCoachIntro(plan.coachIntro);
    setDays(plan.days);
    setEditing(false);
  }

  function onSave() {
    startSave(async () => {
      const res = await updateMealPlan({
        id: plan.id,
        title: title.trim() || plan.title,
        coachIntro: coachIntro.trim(),
        days,
      });
      if (res.ok) {
        toast.success("Plan saved.");
        setEditing(false);
        router.refresh();
      } else {
        toast.error(res.error ?? "Couldn't save those changes.");
      }
    });
  }

  function onRegenerate() {
    startBusy(async () => {
      const res = await regeneratePlan(plan.id);
      if (res.ok) {
        toast.success("Fresh plan built.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Couldn't regenerate.");
      }
    });
  }

  function onArchive() {
    startBusy(async () => {
      const res = await archivePlan(plan.id);
      if (res.ok) {
        toast.success("Plan archived.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Couldn't archive.");
      }
    });
  }

  function onDownload() {
    downloadMealPlanPdf({ title, target: plan.target, days }).catch(() =>
      toast.error("Couldn't generate the PDF.")
    );
  }

  const discussPrompt = `Let's go over my meal plan, "${plan.title}". Is it the right call for my goals, and how do I actually stick to it?`;

  return (
    <div className="flex flex-col gap-6">
      {/* Action row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {editing ? (
            <Input
              aria-label="Plan title"
              className="h-9 font-semibold text-lg"
              maxLength={120}
              onChange={(e) => setTitle(e.target.value)}
              value={title}
            />
          ) : (
            <h2 className="font-semibold text-xl tracking-tight">{title}</h2>
          )}
          {plan.target && !editing && (
            <p className="mt-1 text-muted-foreground text-sm">
              Target {plan.target.calories.toLocaleString()} kcal ·{" "}
              {plan.target.protein}P / {plan.target.carbs}C / {plan.target.fat}F
              per day
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {editing ? (
            <>
              <Button
                className="gap-1.5"
                disabled={saving}
                onClick={onSave}
                size="sm"
              >
                {saving ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Check className="size-3.5" />
                )}
                Save
              </Button>
              <Button
                disabled={saving}
                onClick={cancelEdit}
                size="sm"
                variant="ghost"
              >
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button
                className="gap-1.5"
                onClick={() => setEditing(true)}
                size="sm"
                variant="outline"
              >
                <Pencil className="size-3.5" />
                Edit
              </Button>
              <Button
                className="gap-1.5"
                onClick={onDownload}
                size="sm"
                variant="outline"
              >
                <Download className="size-3.5" />
                <span className="hidden sm:inline">PDF</span>
              </Button>
              <Button asChild className="gap-1.5" size="sm">
                <Link href={`/?prompt=${encodeURIComponent(discussPrompt)}`}>
                  <MessageSquare className="size-3.5" />
                  <span className="hidden sm:inline">Ask Chad</span>
                </Link>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    aria-label="More actions"
                    disabled={busy}
                    size="icon"
                    variant="ghost"
                  >
                    {busy ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <MoreVertical className="size-4" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem disabled={busy} onClick={onRegenerate}>
                    <RefreshCw className="size-4" />
                    Regenerate plan
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={busy} onClick={onArchive}>
                    <Archive className="size-4" />
                    Archive plan
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>

      {/* Chad's intro */}
      {editing ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-muted-foreground text-xs">
            Chad's intro to this plan
          </span>
          <Textarea
            maxLength={900}
            onChange={(e) => setCoachIntro(e.target.value)}
            rows={3}
            value={coachIntro}
          />
        </div>
      ) : (
        coachIntro.trim() && (
          <div className="rounded-xl border border-border border-l-4 border-l-blood bg-card p-4">
            <p className="whitespace-pre-line text-sm leading-relaxed">
              {coachIntro.trim()}
            </p>
          </div>
        )
      )}

      {/* Week-at-a-glance day switcher */}
      {days.length > 1 && (
        <div className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1">
          {days.map((d, i) => (
            <DaySwitchCard
              active={i === dayIdx}
              day={d}
              key={`${d.label}-${i}`}
              onSelect={() => setDayIdx(i)}
              target={plan.target}
            />
          ))}
        </div>
      )}

      {/* Selected day */}
      {day && dayTotals && (
        <div className="flex flex-col gap-5">
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h3 className="font-medium text-base">{day.label}</h3>
              <span className="text-muted-foreground text-xs">
                {day.meals.length} meal{day.meals.length === 1 ? "" : "s"}
              </span>
            </div>
            <MacroRings
              caloriesConsumed={dayTotals.calories}
              caloriesTarget={plan.target?.calories ?? null}
              carbsConsumed={dayTotals.carbs}
              carbsTarget={plan.target?.carbs ?? null}
              consumedLabel="Planned"
              fatConsumed={dayTotals.fat}
              fatTarget={plan.target?.fat ?? null}
              noTargetSub="kcal / day"
              proteinConsumed={dayTotals.protein}
              proteinTarget={plan.target?.protein ?? null}
            />
          </div>

          {day.meals.map((meal, mealIdx) => (
            <MealCard
              editing={editing}
              key={`${meal.slot}-${mealIdx}`}
              meal={meal}
              onPatchFood={(foodIdx, patch) =>
                patchFood(mealIdx, foodIdx, patch)
              }
              onPatchTitle={(value) => patchMealTitle(mealIdx, value)}
              onRemoveFood={(foodIdx) => removeFood(mealIdx, foodIdx)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** A clickable day card: label + that day's calories + a mini target-fill bar. */
function DaySwitchCard({
  day,
  target,
  active,
  onSelect,
}: {
  day: PlanDay;
  target: Macros | null;
  active: boolean;
  onSelect: () => void;
}) {
  const cals = dayMacros(day).calories;
  const t = target?.calories ?? null;
  const ratio = t ? cals / t : 0;
  const pct = t ? Math.min(100, ratio * 100) : 0;
  // ±8% reads as on-target; over = blood, under = amber.
  const tone =
    t == null
      ? "#71717a"
      : ratio > 1.08
        ? "#a4161a"
        : ratio < 0.92
          ? "#f59e0b"
          : "#10b981";

  return (
    <button
      className={cn(
        "flex w-28 shrink-0 snap-start flex-col gap-1.5 rounded-xl border p-3 text-left transition-colors",
        active
          ? "border-blood/60 bg-card ring-1 ring-blood/30"
          : "border-border bg-card/60 hover:bg-card"
      )}
      onClick={onSelect}
      type="button"
    >
      <span className="truncate font-medium text-xs">{day.label}</span>
      <span className="font-semibold text-sm tabular-nums">
        {cals.toLocaleString()}
        <span className="ml-0.5 font-normal text-[10px] text-muted-foreground">
          kcal
        </span>
      </span>
      <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: tone }}
        />
      </div>
    </button>
  );
}

/** One meal: slot badge, title, per-meal macros, its foods, and "log as eaten". */
function MealCard({
  meal,
  editing,
  onPatchFood,
  onPatchTitle,
  onRemoveFood,
}: {
  meal: PlanMeal;
  editing: boolean;
  onPatchFood: (foodIdx: number, patch: Partial<PlanFood>) => void;
  onPatchTitle: (value: string) => void;
  onRemoveFood: (foodIdx: number) => void;
}) {
  const router = useRouter();
  const [logging, startLog] = useTransition();
  const [logged, setLogged] = useState(false);
  const totals = mealMacros(meal);

  function onLog() {
    startLog(async () => {
      const res = await logPlannedMeal({
        title: meal.title,
        slot: meal.slot,
        calories: totals.calories,
        protein: totals.protein,
        carbs: totals.carbs,
        fat: totals.fat,
      });
      if (res.ok) {
        // Optimistic confirmation: morph the button + ring the card briefly so
        // logging feels acknowledged on the spot, not just via the toast.
        setLogged(true);
        toast.success(`Logged "${meal.title}" to today's diary.`);
        router.refresh();
        setTimeout(() => setLogged(false), 2500);
      } else {
        toast.error(res.error ?? "Couldn't log that meal.");
      }
    });
  }

  return (
    <div
      className={cn(
        "rounded-2xl border bg-card p-5 transition-shadow hover:shadow-[var(--shadow-float)]",
        logged ? "border-emerald-500/40 ring-1 ring-emerald-500/30" : "border-border"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Badge className="mb-2" variant="secondary">
            {SLOT_LABEL[meal.slot]}
          </Badge>
          {editing ? (
            <Input
              aria-label="Meal name"
              className="h-8"
              maxLength={120}
              onChange={(e) => onPatchTitle(e.target.value)}
              value={meal.title}
            />
          ) : (
            <h4 className="font-medium text-base leading-snug">{meal.title}</h4>
          )}
        </div>
        <span className="shrink-0 text-right text-muted-foreground text-xs tabular-nums">
          {macroLine(totals)}
        </span>
      </div>

      <ul className="mt-4 flex flex-col divide-y divide-border/60">
        {meal.foods.map((food, foodIdx) => {
          const m = foodMacros(food);
          const noMatch = !food.per100g;
          return (
            <li
              className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
              key={`${food.name}-${foodIdx}`}
            >
              {!editing && (
                <span
                  aria-hidden
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    noMatch ? "bg-muted-foreground/30" : MACRO_TONE[dominantMacro(m)]
                  )}
                />
              )}
              {editing ? (
                <div className="flex items-center gap-1">
                  <Input
                    aria-label={`${food.name} grams`}
                    className="h-8 w-16 text-right tabular-nums"
                    inputMode="numeric"
                    min={0}
                    onChange={(e) =>
                      onPatchFood(foodIdx, {
                        grams: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                    type="number"
                    value={food.grams}
                  />
                  <span className="text-muted-foreground text-xs">g</span>
                </div>
              ) : (
                <span className="w-16 shrink-0 text-right font-medium text-sm tabular-nums">
                  {Math.round(food.grams)}
                  <span className="ml-0.5 text-muted-foreground text-xs">
                    g
                  </span>
                </span>
              )}

              <div className="min-w-0 flex-1">
                {editing ? (
                  <Input
                    aria-label="Food name"
                    className="h-8"
                    maxLength={120}
                    onChange={(e) =>
                      onPatchFood(foodIdx, { name: e.target.value })
                    }
                    value={food.name}
                  />
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm">{food.name}</span>
                    {noMatch && (
                      <span
                        className="inline-flex shrink-0 items-center text-amber-500"
                        title="No food-database match — macros not counted for this item."
                      >
                        <AlertTriangle className="size-3.5" />
                      </span>
                    )}
                  </div>
                )}
                {food.fdcDescription && !editing && (
                  <p className="truncate text-[11px] text-muted-foreground">
                    USDA: {food.fdcDescription}
                  </p>
                )}
                {!(editing || noMatch) && <MacroMicroBar m={m} />}
              </div>

              <span className="shrink-0 text-right text-muted-foreground text-xs tabular-nums">
                {noMatch ? "—" : macroLine(m)}
              </span>

              {editing && (
                <Button
                  aria-label={`Remove ${food.name}`}
                  className="size-7 shrink-0 text-muted-foreground"
                  disabled={meal.foods.length <= 1}
                  onClick={() => onRemoveFood(foodIdx)}
                  size="icon"
                  variant="ghost"
                >
                  <X className="size-3.5" />
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      {!editing && (
        <div className="mt-4 flex justify-end">
          <Button
            className={cn(
              "gap-1.5",
              logged ? "text-emerald-500" : "text-muted-foreground"
            )}
            disabled={logging || logged}
            onClick={onLog}
            size="sm"
            variant="ghost"
          >
            {logging ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : logged ? (
              <Check className="size-3.5" />
            ) : (
              <Utensils className="size-3.5" />
            )}
            {logged ? "Logged" : "Log as eaten"}
          </Button>
        </div>
      )}
    </div>
  );
}
