"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { canAccessProFeatures } from "@/lib/admin";
import { generateMealPlan, recomputePlanTotals } from "@/lib/ai/meal-plan";
import { parseCalendarDay } from "@/lib/date";
import {
  createMealAnalysis,
  createMealPlan,
  getActiveGoalsByUserId,
  getActiveMealPlanByUserId,
  getActivePlansByUserId,
  getMealPlanById,
  getNutritionTarget,
  getUserById,
  getUserMemory,
  updateMealPlan as updateMealPlanQuery,
} from "@/lib/db/queries";
import { reconcilePlanTarget } from "@/lib/nutrition/target-sync";
import {
  type MealPlanPreferences,
  mealPlanPreferencesSchema,
  updateMealPlanSchema,
} from "@/lib/validation/meal-plan";
import { MEAL_CATEGORIES } from "@/lib/validation/nutrition";

export type MealPlanActionState = {
  ok: boolean;
  error?: string;
  planId?: string;
};

/** Resolve the signed-in user and confirm Pro (the meal-plan feature is Pro). */
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

/** Shared: build + persist a plan from a set of preferences for a user. */
async function buildAndSavePlan(
  userId: string,
  preferences: MealPlanPreferences
): Promise<string> {
  const [target, goals, plans, memory] = await Promise.all([
    getNutritionTarget(userId),
    getActiveGoalsByUserId(userId),
    getActivePlansByUserId(userId),
    getUserMemory(userId),
  ]);

  const goalContext = [
    ...goals.map(
      (g) => `Goal: ${g.title}${g.targetDate ? ` (by ${g.targetDate})` : ""}`
    ),
    ...plans.map((p) => `Plan [${p.kind}]: ${p.title}`),
  ].join("\n");

  const plan = await generateMealPlan({
    preferences,
    target: target
      ? {
          calories: target.calories,
          protein: target.protein,
          carbs: target.carbs,
          fat: target.fat,
        }
      : null,
    goalContext: goalContext || undefined,
    memory: memory?.profile || undefined,
  });

  // NUT-13: unify the plan's target with the daily Calorie-Tracker target so
  // there's one set of numbers driving the dashboard rings. Snapshot the plan
  // against the SAME merged target that's now the user's daily target.
  const effectiveTarget = await reconcilePlanTarget(userId, target, plan.target);

  const created = await createMealPlan({
    userId,
    title: plan.title,
    source: "user",
    sourceChatId: null,
    targetCalories: effectiveTarget.calories,
    targetProtein: effectiveTarget.protein,
    targetCarbs: effectiveTarget.carbs,
    targetFat: effectiveTarget.fat,
    preferences,
    coachIntro: plan.coachIntro,
    days: plan.days,
  });

  return created.id;
}

/** Generate a new plan from the dashboard preferences form. */
export async function generatePlan(
  input: MealPlanPreferences
): Promise<MealPlanActionState> {
  const user = await requirePro();
  if (!user) {
    return { ok: false, error: "Meal plans are a Chad Pro feature." };
  }

  const parsed = mealPlanPreferencesSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.errors[0]?.message ?? "Check your preferences.",
    };
  }

  try {
    // Only one active plan at a time: archive the current one (if any) once the
    // new build succeeds, so a failed generation never loses the old plan.
    const existing = await getActiveMealPlanByUserId(user.id);
    const planId = await buildAndSavePlan(user.id, parsed.data);
    if (existing) {
      await updateMealPlanQuery({
        id: existing.id,
        userId: user.id,
        status: "archived",
      });
    }
    revalidatePath("/meal-plan");
    // The build may have set/updated the daily target (NUT-13) — refresh the
    // surfaces whose rings read it.
    revalidatePath("/today");
    revalidatePath("/nutrition");
    return { ok: true, planId };
  } catch (error) {
    console.error("Meal plan generation failed:", error);
    return {
      ok: false,
      error:
        "Chad couldn't build that plan right now. Give it another shot in a moment.",
    };
  }
}

/** Regenerate: build a fresh plan from a saved plan's preferences, archive the old. */
export async function regeneratePlan(
  planId: string
): Promise<MealPlanActionState> {
  const user = await requirePro();
  if (!user) {
    return { ok: false, error: "Not authorized." };
  }

  const existing = await getMealPlanById({ id: planId, userId: user.id });
  if (!existing) {
    return { ok: false, error: "Plan not found." };
  }

  const prefs = mealPlanPreferencesSchema.safeParse(existing.preferences);
  if (!prefs.success) {
    return { ok: false, error: "This plan's settings can't be reused." };
  }

  try {
    const newId = await buildAndSavePlan(user.id, prefs.data);
    // Archive the old one so only the fresh plan is active.
    await updateMealPlanQuery({
      id: planId,
      userId: user.id,
      status: "archived",
    });
    revalidatePath("/meal-plan");
    revalidatePath("/today");
    revalidatePath("/nutrition");
    return { ok: true, planId: newId };
  } catch (error) {
    console.error("Meal plan regeneration failed:", error);
    return { ok: false, error: "Couldn't regenerate. Try again in a moment." };
  }
}

/** Save edits to a plan (title, intro, foods/portions). Totals recomputed in code. */
export async function updateMealPlan(
  input: unknown
): Promise<MealPlanActionState> {
  const user = await requirePro();
  if (!user) {
    return { ok: false, error: "Not authorized." };
  }

  const parsed = updateMealPlanSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.errors[0]?.message ?? "Couldn't save those changes.",
    };
  }

  // Never trust client-sent macros: re-scale each food from its stored per-100g
  // and re-total in code, so edits stay DB-accurate.
  const days = recomputePlanTotals(parsed.data.days);

  await updateMealPlanQuery({
    id: parsed.data.id,
    userId: user.id,
    title: parsed.data.title,
    coachIntro: parsed.data.coachIntro,
    days,
  });
  revalidatePath("/meal-plan");
  return { ok: true, planId: parsed.data.id };
}

/** Archive (soft-hide) a plan. */
export async function archivePlan(
  planId: string
): Promise<MealPlanActionState> {
  const user = await requirePro();
  if (!user) {
    return { ok: false, error: "Not authorized." };
  }
  await updateMealPlanQuery({
    id: planId,
    userId: user.id,
    status: "archived",
  });
  revalidatePath("/meal-plan");
  return { ok: true };
}

/** Restore an archived plan to active. */
export async function reactivatePlan(
  planId: string
): Promise<MealPlanActionState> {
  const user = await requirePro();
  if (!user) {
    return { ok: false, error: "Not authorized." };
  }
  await updateMealPlanQuery({
    id: planId,
    userId: user.id,
    status: "active",
  });
  revalidatePath("/meal-plan");
  return { ok: true };
}

const logPlannedMealSchema = z.object({
  title: z.string().trim().min(1).max(120),
  slot: z.enum(MEAL_CATEGORIES),
  calories: z.number().min(0).max(20_000),
  protein: z.number().min(0).max(1000),
  carbs: z.number().min(0).max(2000),
  fat: z.number().min(0).max(1000),
  // The day to log it for; defaults to today.
  recordedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
});

/** One-tap "log as planned": write a planned meal into the food diary as eaten. */
export async function logPlannedMeal(
  input: z.infer<typeof logPlannedMealSchema>
): Promise<MealPlanActionState> {
  const user = await requirePro();
  if (!user) {
    return { ok: false, error: "Not authorized." };
  }

  const parsed = logPlannedMealSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Couldn't log that meal." };
  }

  const { title, slot, calories, protein, carbs, fat, recordedAt } =
    parsed.data;

  await createMealAnalysis({
    userId: user.id,
    kind: "meal",
    source: "manual",
    meal: slot,
    recordedAt: parseCalendarDay(recordedAt ?? null) ?? new Date(),
    photoUrl: null,
    title,
    calories: Math.round(calories),
    protein: Math.round(protein),
    carbs: Math.round(carbs),
    fat: Math.round(fat),
    healthScore: null,
    verdict: null,
    items: [],
    tips: [],
  });

  revalidatePath("/nutrition");
  revalidatePath("/today");
  return { ok: true };
}
