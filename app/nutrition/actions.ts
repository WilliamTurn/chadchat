"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/app/(auth)/auth";
import { getEntitlements } from "@/lib/ai/entitlements";
import { analyzeFoodPhoto } from "@/lib/ai/meal-analysis";
import {
  createMealAnalysis,
  deleteMealAnalysis,
  getUserById,
  upsertNutritionTarget,
} from "@/lib/db/queries";
import {
  type AnalyzeMealInput,
  analyzeMealSchema,
  type NutritionTargetInput,
  nutritionTargetSchema,
} from "@/lib/validation/nutrition";

export type NutritionActionState = { ok: boolean; error?: string };

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
  if (!(user && getEntitlements(user).photoAnalysis)) {
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

  const { photoUrl, mediaType, kind, note } = parsed.data;

  try {
    const result = await analyzeFoodPhoto({ photoUrl, mediaType, kind, note });

    await createMealAnalysis({
      userId: user.id,
      kind,
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
