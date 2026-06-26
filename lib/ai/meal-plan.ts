import "server-only";

import { generateObject } from "ai";
import { resolveFoodMacros } from "@/lib/nutrition/food-table";
import { type Macros, scaleMacros, sumMacros } from "@/lib/nutrition/macros";
import {
  BUDGET_LABEL,
  COOK_TIME_LABEL,
  DIET_STYLE_LABEL,
  type MacroTarget,
  type MealPlanDesign,
  type MealPlanPreferences,
  mealPlanDesignSchema,
  type PlanDay,
  type PlanFood,
} from "@/lib/validation/meal-plan";
import { getLanguageModel } from "./providers";

// Opus 4.8 designs the plan (which foods, what gram portions to hit the target);
// real macros come from the curated food table first, with a live USDA lookup as
// a fallback (lib/nutrition/food-table.ts), so nothing is AI-estimated.
// Confirmed live on the Vercel AI Gateway.
const DESIGN_MODEL_ID = "anthropic/claude-opus-4.8";

// How many food lookups to run at once during enrichment. Table hits are
// instant; only the rare USDA-fallback lookup touches the network, so this stays
// small enough to be gentle on the rate limit yet finishes a 7-day plan fast.
const FDC_CONCURRENCY = 5;

const EXPERT_PROMPT = `You are an elite sports-nutrition coach authoring a structured, multi-day meal plan for a client. You design plans that real lifters actually eat: precise, palatable, varied, and built to hit a macro target.

HARD RULES:
- You are given the client's daily macro target (or you set a sensible one for their goal). Choose foods and EXACT gram portions so each day's totals land close to that target — especially calories and protein.
- Do NOT output macro numbers for foods. You choose the food and the grams; a nutrition database computes the real macros. Your job is smart food selection and correct portioning.
- For every food, give a clean \`query\`: a plain whole-food name a food database will match — no brand, no portion, no cooking adjective fluff. Good: "chicken breast cooked", "rolled oats dry", "white rice cooked", "banana raw", "olive oil", "almonds". Bad: "grandma's grilled chicken", "1 cup oats", "a handful of nuts".
- Prefer whole, single-ingredient foods (they match the database cleanly and are what serious eaters use). Combine them into real meals.
- Respect the diet style, allergies, and dislikes ABSOLUTELY. An allergy is a hard exclusion — never include it or anything containing it.
- Vary the meals across days so the client doesn't eat the identical thing every day — but repeating a reliable staple (oats, chicken, rice) is fine and realistic.
- Hit the requested number of meals per day and the requested number of days exactly.
- Portions are the cooked/edible weight in grams.

VOICE:
- The plan body (meal names, food names) stays clean and professional — no jokes in the food list.
- Put your personality ONLY in \`coachIntro\`: 2-4 blunt sentences in a no-nonsense coach's voice explaining the strategy and the standard you hold them to. Hard, direct, no soft platitudes.`;

/**
 * Fill in a complete macro target from a possibly-partial one. When calories are
 * known but a macro is missing we use a standard split (protein floor first,
 * then the rest across carbs/fat). Returns null when there's no calorie anchor
 * at all (caller falls back to the model's recommendation).
 */
function completeTarget(partial: MacroTarget | null): MacroTarget | null {
  if (!partial || partial.calories == null || partial.calories <= 0) {
    return null;
  }
  const calories = partial.calories;
  // Protein: keep an explicit value, else ~30% of calories (4 kcal/g).
  const protein = partial.protein ?? Math.round((calories * 0.3) / 4);
  // Fat: keep explicit, else ~28% of calories (9 kcal/g).
  const fat = partial.fat ?? Math.round((calories * 0.28) / 9);
  // Carbs: keep explicit, else whatever calories are left after protein + fat.
  const carbs =
    partial.carbs ??
    Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));
  return { calories, protein, carbs, fat };
}

function describeTarget(target: MacroTarget | null): string {
  if (!target || target.calories == null) {
    return "The client has not set a macro target. Set a sensible daily target for their goal and stats, design every day to hit it, and report it in recommendedTarget.";
  }
  return `The client's daily macro target is: ${target.calories} kcal, ${target.protein ?? "?"}g protein, ${target.carbs ?? "?"}g carbs, ${target.fat ?? "?"}g fat. Design every day to hit this. Echo it in recommendedTarget.`;
}

function describePreferences(prefs: MealPlanPreferences): string {
  const lines = [
    `- Diet style: ${DIET_STYLE_LABEL[prefs.dietStyle]}`,
    `- Days to plan: ${prefs.days}`,
    `- Meals per day: ${prefs.mealsPerDay}`,
    `- Budget: ${BUDGET_LABEL[prefs.budget]}`,
    `- Cooking effort: ${COOK_TIME_LABEL[prefs.cookTime]}`,
    `- Allergies (HARD exclusions): ${prefs.allergies.length ? prefs.allergies.join(", ") : "none"}`,
    `- Dislikes (avoid): ${prefs.dislikes.length ? prefs.dislikes.join(", ") : "none"}`,
  ];
  if (prefs.notes.trim()) {
    lines.push(`- Extra notes from the client: ${prefs.notes.trim()}`);
  }
  return lines.join("\n");
}

/** Run async work over a list with a fixed concurrency cap. */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i], i);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
  await Promise.all(workers);
  return results;
}

export type EnrichedMealPlan = {
  title: string;
  coachIntro: string;
  target: MacroTarget;
  days: PlanDay[];
};

/**
 * Generate a structured meal plan: one Opus 4.8 design pass, then enrich every
 * food with real USDA macros and total it all up in code. Returns the enriched
 * plan; the caller persists it. Throws on a model/parse failure — the caller
 * turns that into a friendly error.
 */
export async function generateMealPlan({
  preferences,
  target,
  goalContext,
  memory,
}: {
  preferences: MealPlanPreferences;
  // The client's explicit target if they've set one (from NutritionTarget).
  target?: MacroTarget | null;
  // A compact string of the client's goal(s) for context (optional).
  goalContext?: string;
  // The client's memory profile, for stats/goal context (optional).
  memory?: string;
}): Promise<EnrichedMealPlan> {
  const completed = completeTarget(target ?? null);

  const contextParts = [
    "CLIENT PREFERENCES:",
    describePreferences(preferences),
    "",
    "MACRO TARGET:",
    describeTarget(completed),
  ];
  if (goalContext?.trim()) {
    contextParts.push("", "CLIENT GOALS:", goalContext.trim());
  }
  if (memory?.trim()) {
    contextParts.push(
      "",
      "WHAT THE COACH KNOWS ABOUT THIS CLIENT:",
      memory.trim()
    );
  }
  contextParts.push(
    "",
    `Design a ${preferences.days}-day plan with ${preferences.mealsPerDay} meals per day.`
  );

  const { object } = await generateObject({
    model: getLanguageModel(DESIGN_MODEL_ID),
    schema: mealPlanDesignSchema,
    system: EXPERT_PROMPT,
    prompt: contextParts.join("\n"),
  });

  const design = object as MealPlanDesign;

  // The target we measure days against: the client's explicit one if set,
  // otherwise the model's coaching recommendation.
  const finalTarget: MacroTarget = completed ?? {
    calories: design.recommendedTarget.calories,
    protein: design.recommendedTarget.protein,
    carbs: design.recommendedTarget.carbs,
    fat: design.recommendedTarget.fat,
  };

  // Flatten every food so FDC lookups run with bounded concurrency (the client
  // cache dedupes repeated staples across days).
  type FoodRef = { dayIdx: number; mealIdx: number; foodIdx: number };
  const refs: FoodRef[] = [];
  design.days.forEach((day, dayIdx) => {
    day.meals.forEach((meal, mealIdx) => {
      meal.foods.forEach((_food, foodIdx) => {
        refs.push({ dayIdx, mealIdx, foodIdx });
      });
    });
  });

  const enrichedFoods = await mapLimit(refs, FDC_CONCURRENCY, async (ref) => {
    const src = design.days[ref.dayIdx].meals[ref.mealIdx].foods[ref.foodIdx];
    const match = await resolveFoodMacros(src.name, src.query);
    const macros: Macros = match
      ? scaleMacros(match.per100g, src.grams)
      : { calories: 0, protein: 0, carbs: 0, fat: 0 };
    const food: PlanFood = {
      name: src.name,
      grams: src.grams,
      calories: macros.calories,
      protein: macros.protein,
      carbs: macros.carbs,
      fat: macros.fat,
      fdcId: match?.fdcId ?? null,
      fdcDescription: match?.description ?? null,
      per100g: match?.per100g ?? null,
    };
    return { ref, food };
  });

  // Stitch enriched foods back into the day/meal tree and total in code.
  const days: PlanDay[] = design.days.map((day, dayIdx) => {
    const meals = day.meals.map((meal, mealIdx) => {
      const foods = meal.foods.map((_f, foodIdx) => {
        const found = enrichedFoods.find(
          (e) =>
            e.ref.dayIdx === dayIdx &&
            e.ref.mealIdx === mealIdx &&
            e.ref.foodIdx === foodIdx
        );
        // Always present (every ref was enriched), but stay defensive.
        return (
          found?.food ?? {
            name: meal.foods[foodIdx].name,
            grams: meal.foods[foodIdx].grams,
            calories: 0,
            protein: 0,
            carbs: 0,
            fat: 0,
            fdcId: null,
            fdcDescription: null,
            per100g: null,
          }
        );
      });
      return {
        slot: meal.slot,
        title: meal.title,
        foods,
        totals: sumMacros(foods),
      };
    });
    return {
      label: day.label,
      meals,
      totals: sumMacros(meals.map((m) => m.totals)),
    };
  });

  return {
    title: design.title,
    coachIntro: design.coachIntro,
    target: finalTarget,
    days,
  };
}

/**
 * Recompute a meal plan's macros + totals from each food's stored per-100g and
 * grams, in code. Used after an edit so totals stay authoritative (never trust
 * client-sent numbers) and a grams change re-scales without a network call.
 */
export function recomputePlanTotals(days: PlanDay[]): PlanDay[] {
  return days.map((day) => {
    const meals = day.meals.map((meal) => {
      const foods = meal.foods.map((food) => {
        if (food.per100g) {
          const scaled = scaleMacros(food.per100g, food.grams);
          return { ...food, ...scaled };
        }
        return food;
      });
      return { ...meal, foods, totals: sumMacros(foods) };
    });
    return { ...day, meals, totals: sumMacros(meals.map((m) => m.totals)) };
  });
}
