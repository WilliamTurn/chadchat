import { z } from "zod";
import { MEAL_CATEGORIES } from "./nutrition";

/**
 * Schemas for the structured meal-plan feature (outstanding task #5). Three
 * shapes live here and are reused everywhere:
 *   1. preferences  — the generation inputs (diet style, allergies, …).
 *   2. design       — what Opus 4.8 returns (foods + queries + grams, NO macros).
 *   3. enriched     — the stored plan, with DB-verified macros baked in.
 * Keeping all three in one file means the generator, the chat tool, the edit
 * action and the PDF all agree on the shape.
 */

// --- Preferences (generation inputs) ---

export const DIET_STYLES = [
  "balanced",
  "high_protein",
  "low_carb",
  "keto",
  "mediterranean",
  "vegetarian",
  "vegan",
  "pescatarian",
  "paleo",
] as const;
export type DietStyle = (typeof DIET_STYLES)[number];

export const DIET_STYLE_LABEL: Record<DietStyle, string> = {
  balanced: "Balanced",
  high_protein: "High protein",
  low_carb: "Low carb",
  keto: "Keto",
  mediterranean: "Mediterranean",
  vegetarian: "Vegetarian",
  vegan: "Vegan",
  pescatarian: "Pescatarian",
  paleo: "Paleo",
};

export const BUDGETS = ["budget", "moderate", "premium"] as const;
export type Budget = (typeof BUDGETS)[number];
export const BUDGET_LABEL: Record<Budget, string> = {
  budget: "Budget",
  moderate: "Moderate",
  premium: "No limit",
};

export const COOK_TIMES = ["minimal", "moderate", "involved"] as const;
export type CookTime = (typeof COOK_TIMES)[number];
export const COOK_TIME_LABEL: Record<CookTime, string> = {
  minimal: "Minimal (≤15 min)",
  moderate: "Moderate (≤30 min)",
  involved: "Happy to cook",
};

export const mealPlanPreferencesSchema = z.object({
  dietStyle: z.enum(DIET_STYLES).default("balanced"),
  allergies: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  dislikes: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  mealsPerDay: z.number().int().min(2).max(6).default(4),
  days: z.number().int().min(1).max(7).default(7),
  budget: z.enum(BUDGETS).default("moderate"),
  cookTime: z.enum(COOK_TIMES).default("moderate"),
  notes: z.string().trim().max(500).default(""),
});

export type MealPlanPreferences = z.infer<typeof mealPlanPreferencesSchema>;

// --- Macro target (snapshot at generation time) ---

export const macroTargetSchema = z.object({
  calories: z.number().int().min(0).nullable(),
  protein: z.number().int().min(0).nullable(),
  carbs: z.number().int().min(0).nullable(),
  fat: z.number().int().min(0).nullable(),
});
export type MacroTarget = z.infer<typeof macroTargetSchema>;

// --- A macro bundle (trusted; computed in code from FDC) ---

const macrosSchema = z.object({
  calories: z.number().min(0),
  protein: z.number().min(0),
  carbs: z.number().min(0),
  fat: z.number().min(0),
});

// --- Enriched, stored plan shape (macros baked in) ---

export const planFoodSchema = z.object({
  name: z.string().trim().min(1).max(120),
  grams: z.number().min(0).max(5000),
  calories: z.number().min(0),
  protein: z.number().min(0),
  carbs: z.number().min(0),
  fat: z.number().min(0),
  // The matched USDA food, kept for audit + so the user can see the source.
  fdcId: z.number().int().nullable().default(null),
  fdcDescription: z.string().max(200).nullable().default(null),
  // Per-100g macros from FDC, kept so a grams-edit re-scales in code with no
  // network call. Null when no FDC match was found (macros are 0 then).
  per100g: macrosSchema.nullable().default(null),
});
export type PlanFood = z.infer<typeof planFoodSchema>;

export const planMealSchema = z.object({
  slot: z.enum(MEAL_CATEGORIES),
  title: z.string().trim().min(1).max(120),
  foods: z.array(planFoodSchema).min(1).max(12),
  totals: macrosSchema,
});
export type PlanMeal = z.infer<typeof planMealSchema>;

export const planDaySchema = z.object({
  label: z.string().trim().min(1).max(60),
  meals: z.array(planMealSchema).min(1).max(8),
  totals: macrosSchema,
});
export type PlanDay = z.infer<typeof planDaySchema>;

export const planDaysSchema = z.array(planDaySchema).min(1).max(7);
export type PlanDays = z.infer<typeof planDaysSchema>;

// --- Design schema: what the model returns (NO trusted macros) ---
// Each food carries a human `name`, a clean `query` for the food DB, and the
// `grams` the model chose to hit the target. Macros are added afterward in code.

export const mealPlanDesignSchema = z.object({
  title: z
    .string()
    .min(1)
    .max(120)
    .describe(
      "A short plan title that states the calorie target + meals/day, e.g. '2,200 kcal cut — 4 meals/day'."
    ),
  coachIntro: z
    .string()
    .min(1)
    .max(900)
    .describe(
      "Chad's blunt 2-4 sentence intro in his own voice: the strategy behind this plan and the standard he holds them to. Direct and hard, no soft platitudes."
    ),
  recommendedTarget: z
    .object({
      calories: z.number().int().min(800).max(8000),
      protein: z.number().int().min(0).max(500),
      carbs: z.number().int().min(0).max(1200),
      fat: z.number().int().min(0).max(400),
    })
    .describe(
      "The daily macro target you designed every day to hit. If the client already has a target, echo it here. If not, set a sensible one for their goal/stats and design to it. This is your coaching call on the numbers — the foods' actual macros come from a database."
    ),
  days: z
    .array(
      z.object({
        label: z
          .string()
          .min(1)
          .max(60)
          .describe("Day label, e.g. 'Day 1' or 'Training day'."),
        meals: z
          .array(
            z.object({
              slot: z
                .enum(MEAL_CATEGORIES)
                .describe("Which meal of the day this is."),
              title: z
                .string()
                .min(1)
                .max(120)
                .describe(
                  "Short meal name, e.g. 'Greek yogurt, berries & whey'."
                ),
              foods: z
                .array(
                  z.object({
                    name: z
                      .string()
                      .min(1)
                      .max(120)
                      .describe(
                        "Human label for the food, e.g. 'Grilled chicken breast'."
                      ),
                    query: z
                      .string()
                      .min(1)
                      .max(80)
                      .describe(
                        "A clean, canonical search term for a nutrition database — a plain whole-food name with no brand, no portion, no adjectives. e.g. 'chicken breast cooked', 'rolled oats dry', 'banana raw'."
                      ),
                    grams: z
                      .number()
                      .min(1)
                      .max(5000)
                      .describe(
                        "The exact cooked/edible portion in grams chosen to hit the day's macro target."
                      ),
                  })
                )
                .min(1)
                .max(12),
            })
          )
          .min(1)
          .max(8),
      })
    )
    .min(1)
    .max(7),
});

export type MealPlanDesign = z.infer<typeof mealPlanDesignSchema>;

/** Edit payload: the whole (enriched) plan, re-validated and re-totaled server-side. */
export const updateMealPlanSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(120),
  coachIntro: z.string().trim().max(900).default(""),
  days: planDaysSchema,
});
export type UpdateMealPlanInput = z.infer<typeof updateMealPlanSchema>;
