import { z } from "zod";

/** The meal-of-day buckets the diary groups by. */
export const MEAL_CATEGORIES = [
  "breakfast",
  "lunch",
  "dinner",
  "snack",
] as const;
export type MealCategory = (typeof MEAL_CATEGORIES)[number];

/** Input for analyzing a meal/fridge/pantry photo. The photo is uploaded first
 * (to Vercel Blob) and only its URL is sent to the server action. */
/** A user-picked calendar day, "YYYY-MM-DD". */
const calendarDay = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date.");

export const analyzeMealSchema = z.object({
  photoUrl: z.string().url(),
  mediaType: z.enum(["image/jpeg", "image/png"]).default("image/jpeg"),
  // "label" = a packaged-food nutrition label; logged as a meal, but the macros
  // are read off the label (per serving) rather than estimated from a plate.
  kind: z.enum(["meal", "fridge", "pantry", "label"]).default("meal"),
  // Which meal of the day a plated meal is. Ignored for fridge/pantry.
  meal: z.enum(MEAL_CATEGORIES).nullable().optional(),
  // The day this meal is logged for. Omit/null = today. Ignored for fridge/pantry.
  recordedAt: calendarDay.nullable().optional(),
  // How many label servings were eaten (label kind only). The label lists
  // per-serving macros; we multiply by this to get the totals consumed.
  servings: z.number().positive().max(50).default(1),
  note: z.string().trim().max(500).nullable().optional(),
});

// `z.input` (not `z.infer`) so callers may omit fields that carry a Zod
// `.default()` — e.g. `servings` (label-only) and `kind`/`mediaType`.
export type AnalyzeMealInput = z.input<typeof analyzeMealSchema>;

/** Manual meal entry — type the macros yourself, no photo, no grade. */
export const logMealSchema = z.object({
  title: z.string().trim().min(1, "Name this meal.").max(120),
  meal: z.enum(MEAL_CATEGORIES).nullable().optional(),
  // The day this meal is logged for. Omit/null = today.
  recordedAt: calendarDay.nullable().optional(),
  calories: z.number().int().min(0).max(20_000).nullable(),
  protein: z.number().int().min(0).max(1000).nullable(),
  carbs: z.number().int().min(0).max(2000).nullable(),
  fat: z.number().int().min(0).max(1000).nullable(),
  note: z.string().trim().max(500).nullable().optional(),
});

export type LogMealInput = z.infer<typeof logMealSchema>;

/** Editing a logged meal corrects its title/category/macros (not the photo). */
export const editMealSchema = logMealSchema.extend({
  id: z.string().uuid(),
});

export type EditMealInput = z.infer<typeof editMealSchema>;

/** Daily intake targets set on the dashboard. Any can be cleared (null). */
export const nutritionTargetSchema = z.object({
  calories: z.number().int().positive().max(20_000).nullable(),
  protein: z.number().int().positive().max(1000).nullable(),
  carbs: z.number().int().positive().max(2000).nullable(),
  fat: z.number().int().positive().max(1000).nullable(),
});

export type NutritionTargetInput = z.infer<typeof nutritionTargetSchema>;
