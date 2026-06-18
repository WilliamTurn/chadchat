import { z } from "zod";

/** Input for analyzing a meal/fridge/pantry photo. The photo is uploaded first
 * (to Vercel Blob) and only its URL is sent to the server action. */
export const analyzeMealSchema = z.object({
  photoUrl: z.string().url(),
  mediaType: z.enum(["image/jpeg", "image/png"]).default("image/jpeg"),
  kind: z.enum(["meal", "fridge", "pantry"]).default("meal"),
  note: z.string().trim().max(500).nullable().optional(),
});

export type AnalyzeMealInput = z.infer<typeof analyzeMealSchema>;

/** Daily intake targets set on the dashboard. Either can be cleared (null). */
export const nutritionTargetSchema = z.object({
  calories: z.number().int().positive().max(20_000).nullable(),
  protein: z.number().int().positive().max(1000).nullable(),
});

export type NutritionTargetInput = z.infer<typeof nutritionTargetSchema>;
