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
export const analyzeMealSchema = z.object({
  photoUrl: z.string().url(),
  mediaType: z.enum(["image/jpeg", "image/png"]).default("image/jpeg"),
  kind: z.enum(["meal", "fridge", "pantry"]).default("meal"),
  // Which meal of the day a plated meal is. Ignored for fridge/pantry.
  meal: z.enum(MEAL_CATEGORIES).nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
});

export type AnalyzeMealInput = z.infer<typeof analyzeMealSchema>;

/** Manual meal entry — type the macros yourself, no photo, no grade. */
export const logMealSchema = z.object({
  title: z.string().trim().min(1, "Name this meal.").max(120),
  meal: z.enum(MEAL_CATEGORIES).nullable().optional(),
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
