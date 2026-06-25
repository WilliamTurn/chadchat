"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/app/(auth)/auth";
import { canAccessProFeatures } from "@/lib/admin";
import { analyzeFoodPhoto } from "@/lib/ai/meal-analysis";
import { parseCalendarDay } from "@/lib/date";
import {
  addWaterLog,
  createMealAnalysis,
  deleteLatestWaterLog,
  deleteMealAnalysis,
  getUserById,
  updateMealAnalysis,
  upsertNutritionTarget,
} from "@/lib/db/queries";
import {
  type AnalyzeMealInput,
  analyzeMealSchema,
  type EditMealInput,
  editMealSchema,
  type LogMealInput,
  logMealSchema,
  type NutritionTargetInput,
  nutritionTargetSchema,
} from "@/lib/validation/nutrition";

export type NutritionActionState = { ok: boolean; error?: string };

/** A single glass logged by the water counter on /today. */
const GLASS_ML = 250;

/**
 * Resolve the signed-in user and confirm Pro. Photo analysis is a Chad Pro
 * feature, so this is the server-side gate behind the UI — re-checked on every
 * write, same pattern as the progress dashboard.
 */
async function requirePro() {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }
  const user = await getUserById(session.user.id);
  if (!(user && canAccessProFeatures(user))) {
    return null;
  }
  return user;
}

export async function analyzeMeal(
  input: AnalyzeMealInput
): Promise<NutritionActionState> {
  const user = await requirePro();
  if (!user) {
    return { ok: false, error: "Photo analysis is a Chad Pro feature." };
  }

  const parsed = analyzeMealSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.errors[0]?.message ?? "Couldn't read that photo.",
    };
  }

  const { photoUrl, mediaType, kind, meal, recordedAt, note } = parsed.data;

  try {
    const result = await analyzeFoodPhoto({ photoUrl, mediaType, kind, note });

    await createMealAnalysis({
      userId: user.id,
      kind,
      source: "photo",
      meal: kind === "meal" ? (meal ?? null) : null,
      // Only meals carry a diary date; fridge/pantry shots are point-in-time.
      recordedAt: kind === "meal" ? parseCalendarDay(recordedAt) : null,
      photoUrl,
      title: result.title,
      calories: result.calories ?? null,
      protein: result.protein ?? null,
      carbs: result.carbs ?? null,
      fat: result.fat ?? null,
      healthScore: result.healthScore ?? null,
      verdict: result.verdict,
      items: result.items,
      tips: result.tips,
    });
  } catch (_error) {
    return {
      ok: false,
      error: "Chad couldn't read that one. Try a clearer, well-lit photo.",
    };
  }

  revalidatePath("/nutrition");
  revalidatePath("/kitchen");
  revalidatePath("/today");
  return { ok: true };
}

/** Log a meal by typing the macros yourself — no photo, no grade. */
export async function logMealManually(
  input: LogMealInput
): Promise<NutritionActionState> {
  const user = await requirePro();
  if (!user) {
    return { ok: false, error: "Meal logging is a Chad Pro feature." };
  }

  const parsed = logMealSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.errors[0]?.message ?? "Couldn't log that.",
    };
  }

  const { title, meal, recordedAt, calories, protein, carbs, fat } = parsed.data;

  await createMealAnalysis({
    userId: user.id,
    kind: "meal",
    source: "manual",
    meal: meal ?? null,
    recordedAt: parseCalendarDay(recordedAt),
    photoUrl: null,
    title,
    calories,
    protein,
    carbs,
    fat,
    healthScore: null,
    verdict: null,
    items: [],
    tips: [],
  });

  revalidatePath("/nutrition");
  revalidatePath("/today");
  return { ok: true };
}

/** Correct a logged meal's title/category/macros. */
export async function editMeal(
  input: EditMealInput
): Promise<NutritionActionState> {
  const user = await requirePro();
  if (!user) {
    return { ok: false, error: "Not authorized." };
  }

  const parsed = editMealSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.errors[0]?.message ?? "Couldn't save those changes.",
    };
  }

  const { id, title, meal, recordedAt, calories, protein, carbs, fat } =
    parsed.data;

  await updateMealAnalysis({
    id,
    userId: user.id,
    title,
    meal: meal ?? null,
    recordedAt: parseCalendarDay(recordedAt),
    calories,
    protein,
    carbs,
    fat,
  });

  revalidatePath("/nutrition");
  revalidatePath("/today");
  return { ok: true };
}

export async function removeMealAnalysis(
  id: string
): Promise<NutritionActionState> {
  const user = await requirePro();
  if (!user) {
    return { ok: false, error: "Not authorized." };
  }

  await deleteMealAnalysis({ id, userId: user.id });
  revalidatePath("/nutrition");
  revalidatePath("/kitchen");
  revalidatePath("/today");
  return { ok: true };
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Add one glass (250 ml) to today's water count. */
export async function addWater(): Promise<NutritionActionState> {
  const user = await requirePro();
  if (!user) {
    return { ok: false, error: "Not authorized." };
  }
  await addWaterLog({ userId: user.id, amountMl: GLASS_ML });
  revalidatePath("/today");
  return { ok: true };
}

/** Remove the most recent glass logged today. */
export async function removeWater(): Promise<NutritionActionState> {
  const user = await requirePro();
  if (!user) {
    return { ok: false, error: "Not authorized." };
  }
  await deleteLatestWaterLog({ userId: user.id, since: startOfToday() });
  revalidatePath("/today");
  return { ok: true };
}

export async function saveNutritionTarget(
  input: NutritionTargetInput
): Promise<NutritionActionState> {
  const user = await requirePro();
  if (!user) {
    return { ok: false, error: "Setting targets is a Chad Pro feature." };
  }

  const parsed = nutritionTargetSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.errors[0]?.message ?? "Couldn't save those targets.",
    };
  }

  await upsertNutritionTarget(user.id, parsed.data);
  revalidatePath("/nutrition");
  revalidatePath("/today");
  return { ok: true };
}
