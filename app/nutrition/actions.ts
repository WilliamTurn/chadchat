"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/app/(auth)/auth";
import { canAccessProFeatures } from "@/lib/admin";
import {
  analyzeFoodPhoto,
  analyzeNutritionLabel,
} from "@/lib/ai/meal-analysis";
import {
  calendarRangeWindowInTz,
  parseCalendarDay,
  startOfDayUTC,
  toCalendarDayISO,
  todayAnchorInTz,
  todayStartInTz,
} from "@/lib/date";
import { applyMutationReceipt } from "@/lib/refresh/coordinator";
import {
  loggingReceipt,
  mutationReceipt,
  targetReceipt,
} from "@/lib/refresh/receipt";
import {
  addWaterLog,
  createMealAnalysis,
  deleteLatestWaterLog,
  deleteMealAnalysis,
  deleteWaterLogById,
  getNutritionTarget,
  getUserById,
  restoreMealAnalysis,
  updateMealAnalysis,
  updateUserProfile,
  updateUserWaterGoal,
  upsertNutritionTarget,
} from "@/lib/db/queries";
import { createFirstWeighIn } from "@/lib/nutrition/first-weigh-in";
import {
  type FoodHit,
  lookupBarcode,
  searchFoodDatabase,
} from "@/lib/nutrition/food-search";
import { computeUserRecalibration } from "@/lib/nutrition/recalibrate";
import { computeUserTargetRecommendation } from "@/lib/nutrition/recommend-target";
import type { TargetRecommendation } from "@/lib/nutrition/target-recommendation";
import { reconcileTarget } from "@/lib/nutrition/target-math";
import {
  type AnalyzeMealInput,
  analyzeMealSchema,
  type EditMealInput,
  editMealSchema,
  type LogMealInput,
  logMealSchema,
  type NutritionTargetInput,
  nutritionTargetSchema,
  type RecommendationInputs,
  recommendationInputsSchema,
  type RestoreMealInput,
  restoreMealSchema,
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

  const { photoUrl, mediaType, kind, meal, mealLabel, recordedAt, servings, note } =
    parsed.data;
  // A custom slot name only makes sense on the "other" bucket.
  const slotLabel = meal === "other" ? (mealLabel ?? null) || null : null;

  // A nutrition-label scan is logged as a meal, but the macros are read off the
  // label per serving and multiplied here — exact arithmetic, not the model's.
  if (kind === "label") {
    try {
      const label = await analyzeNutritionLabel({
        photoUrl,
        mediaType,
        servings,
        note,
      });
      const scale = (v: number | null) =>
        v === null ? null : Math.round(v * servings);
      const portion = label.servingSize
        ? `${servings} × ${label.servingSize}`
        : `${servings} serving${servings === 1 ? "" : "s"}`;

      await createMealAnalysis({
        userId: user.id,
        kind: "meal",
        source: "photo",
        meal: meal ?? null,
        mealLabel: slotLabel,
        recordedAt: parseCalendarDay(recordedAt),
        photoUrl,
        title: label.title,
        calories: scale(label.calories),
        protein: scale(label.protein),
        carbs: scale(label.carbs),
        fat: scale(label.fat),
        healthScore: label.healthScore ?? null,
        verdict: label.verdict,
        items: [{ name: label.title, detail: portion }],
        tips: label.tips,
      });
    } catch (_error) {
      return {
        ok: false,
        error:
          "Chad couldn't read that label. Get the nutrition panel in frame, well-lit and in focus.",
      };
    }

    applyMutationReceipt(
      loggingReceipt({
        domain: "nutrition",
        entity: "meal",
        op: "create",
        alsoDomains: ["kitchen"],
        days: { startISO: recordedAt ?? toCalendarDayISO(todayAnchorInTz(user.timezone)) },
      })
    );
    return { ok: true };
  }

  try {
    const result = await analyzeFoodPhoto({ photoUrl, mediaType, kind, note });

    await createMealAnalysis({
      userId: user.id,
      kind,
      source: "photo",
      meal: kind === "meal" ? (meal ?? null) : null,
      mealLabel: kind === "meal" ? slotLabel : null,
      // Only meals carry a diary date; kitchen shots are point-in-time.
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

  applyMutationReceipt(
    kind === "meal"
      ? loggingReceipt({
          domain: "nutrition",
          entity: "meal",
          op: "create",
          alsoDomains: ["kitchen"],
          days: {
            startISO:
              recordedAt ?? toCalendarDayISO(todayAnchorInTz(user.timezone)),
          },
        })
      : // Kitchen shots are point-in-time gradings, not diary logs; MealAnalysis
        // rows still surface on the nutrition feed, so both domains refresh.
        mutationReceipt({
          domain: "kitchen",
          entity: "kitchenAnalysis",
          op: "create",
          alsoDomains: ["nutrition"],
        })
  );
  return { ok: true };
}

/**
 * Food-database search for the Calorie Tracker's Search tab (FN-1): curated
 * table + USDA generic/branded, verified numbers only. Read-only, Pro-gated
 * like every other tracker action.
 */
export async function searchFoods(
  query: string
): Promise<{ ok: boolean; results?: FoodHit[]; error?: string }> {
  const user = await requirePro();
  if (!user) {
    return { ok: false, error: "The Calorie Tracker is a Chad Pro feature." };
  }
  const q = typeof query === "string" ? query.trim() : "";
  if (q.length < 2) {
    return { ok: true, results: [] };
  }
  const results = await searchFoodDatabase(q.slice(0, 80));
  return { ok: true, results };
}

/** Barcode → product lookup (USDA Branded + Open Food Facts). `result: null`
 *  means the scan worked but no database knows the product. */
export async function lookupFoodBarcode(
  code: string
): Promise<{ ok: boolean; result?: FoodHit | null; error?: string }> {
  const user = await requirePro();
  if (!user) {
    return { ok: false, error: "The Calorie Tracker is a Chad Pro feature." };
  }
  const digits = typeof code === "string" ? code.replace(/\D/g, "") : "";
  if (digits.length < 8 || digits.length > 14) {
    return { ok: false, error: "That doesn't look like a product barcode." };
  }
  const result = await lookupBarcode(digits);
  return { ok: true, result };
}

/** Log a meal by typing the macros yourself — no photo, no grade. */
export async function logMealManually(
  input: LogMealInput
): Promise<NutritionActionState> {
  const user = await requirePro();
  if (!user) {
    return { ok: false, error: "The Calorie Tracker is a Chad Pro feature." };
  }

  const parsed = logMealSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.errors[0]?.message ?? "Couldn't log that.",
    };
  }

  const { title, meal, mealLabel, recordedAt, calories, protein, carbs, fat } =
    parsed.data;

  await createMealAnalysis({
    userId: user.id,
    kind: "meal",
    source: "manual",
    meal: meal ?? null,
    mealLabel: meal === "other" ? (mealLabel ?? null) || null : null,
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

  applyMutationReceipt(
    loggingReceipt({
      domain: "nutrition",
      entity: "meal",
      op: "create",
      alsoDomains: ["kitchen"],
      days: {
        startISO:
          recordedAt ?? toCalendarDayISO(todayAnchorInTz(user.timezone)),
      },
    })
  );
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

  const { id, title, meal, mealLabel, recordedAt, calories, protein, carbs, fat } =
    parsed.data;

  await updateMealAnalysis({
    id,
    userId: user.id,
    title,
    meal: meal ?? null,
    mealLabel: meal === "other" ? (mealLabel ?? null) || null : null,
    recordedAt: parseCalendarDay(recordedAt),
    calories,
    protein,
    carbs,
    fat,
  });

  applyMutationReceipt(
    loggingReceipt({
      domain: "nutrition",
      entity: "meal",
      op: "update",
      alsoDomains: ["kitchen"],
      days: {
        startISO:
          recordedAt ?? toCalendarDayISO(todayAnchorInTz(user.timezone)),
      },
    })
  );
  return { ok: true };
}

export async function removeMealAnalysis(
  id: string
): Promise<NutritionActionState & { deleted?: RestoreMealInput }> {
  const user = await requirePro();
  if (!user) {
    return { ok: false, error: "Not authorized." };
  }

  const deleted = await deleteMealAnalysis({ id, userId: user.id });
  applyMutationReceipt(
    loggingReceipt({
      domain: "nutrition",
      entity: "meal",
      op: "delete",
      alsoDomains: ["kitchen"],
      days: deleted?.recordedAt
        ? { startISO: toCalendarDayISO(deleted.recordedAt) }
        : undefined,
    })
  );
  return {
    ok: true,
    // Hand the deleted row back (dates as ISO strings) so the delete toast's
    // Undo can restore it via undoRemoveMealAnalysis.
    deleted: deleted
      ? {
          id: deleted.id,
          kind: deleted.kind,
          source: deleted.source,
          meal: deleted.meal,
          mealLabel: deleted.mealLabel,
          recordedAt: deleted.recordedAt?.toISOString() ?? null,
          photoUrl: deleted.photoUrl,
          title: deleted.title,
          calories: deleted.calories,
          protein: deleted.protein,
          carbs: deleted.carbs,
          fat: deleted.fat,
          healthScore: deleted.healthScore,
          verdict: deleted.verdict,
          items: deleted.items,
          tips: deleted.tips,
          createdAt: deleted.createdAt.toISOString(),
        }
      : undefined,
  };
}

/**
 * Undo for the meal-delete toast (FN-10): re-insert the row the delete just
 * removed. The payload round-trips through the browser, so it's validated
 * here and the userId is forced back to the session user — a member can only
 * ever restore a row into their own diary (the same trust level as the edit
 * dialog, which already lets them write any macros they want).
 */
export async function undoRemoveMealAnalysis(
  input: RestoreMealInput
): Promise<NutritionActionState> {
  const user = await requirePro();
  if (!user) {
    return { ok: false, error: "Not authorized." };
  }

  const parsed = restoreMealSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Couldn't restore that entry." };
  }

  await restoreMealAnalysis({
    ...parsed.data,
    recordedAt: parsed.data.recordedAt ? new Date(parsed.data.recordedAt) : null,
    createdAt: new Date(parsed.data.createdAt),
    items: parsed.data.items ?? [],
    tips: parsed.data.tips ?? [],
    userId: user.id,
  });
  applyMutationReceipt(
    loggingReceipt({
      domain: "nutrition",
      entity: "meal",
      op: "create",
      alsoDomains: ["kitchen"],
      days: parsed.data.recordedAt
        ? { startISO: toCalendarDayISO(new Date(parsed.data.recordedAt)) }
        : undefined,
    })
  );
  return { ok: true };
}

/** Remove the most recent water entry logged today — the user's local today (FEAT-8). */
export async function removeWater(): Promise<NutritionActionState> {
  const user = await requirePro();
  if (!user) {
    return { ok: false, error: "Not authorized." };
  }
  await deleteLatestWaterLog({
    userId: user.id,
    since: todayStartInTz(user.timezone),
  });
  applyMutationReceipt(
    loggingReceipt({
      domain: "hydration",
      entity: "waterLog",
      op: "delete",
      days: { startISO: toCalendarDayISO(todayAnchorInTz(user.timezone)) },
    })
  );
  return { ok: true };
}

/** Remove one specific water entry — the itemized "Today's log" delete (LC-11). */
export async function removeWaterEntry(
  id: string
): Promise<NutritionActionState> {
  const user = await requirePro();
  if (!user) {
    return { ok: false, error: "Not authorized." };
  }
  await deleteWaterLogById({ id, userId: user.id });
  applyMutationReceipt(
    loggingReceipt({ domain: "hydration", entity: "waterLog", op: "delete" })
  );
  return { ok: true };
}

/** Largest single log the water tracker accepts — one US gallon (DSH-48: an
 *  end-of-night member logs the whole day's jug in one shot). Still guards a
 *  fat-fingered custom amount from blowing out the day's total. */
const MAX_WATER_ML = 3785;

/**
 * Log an arbitrary amount of water (in ml) for today — backs the water
 * tracker's serving quick-adds (glass → gallon + custom). Amount is clamped to
 * at most a gallon so a typo can't poison the daily total.
 */
export async function logWaterAmount(
  amountMl: number
): Promise<NutritionActionState & { id?: string }> {
  const user = await requirePro();
  if (!user) {
    return { ok: false, error: "Not authorized." };
  }
  if (!Number.isFinite(amountMl) || amountMl <= 0) {
    return { ok: false, error: "Enter how much you drank." };
  }
  const clamped = Math.min(Math.round(amountMl), MAX_WATER_ML);
  // Return the created id so the caller's Undo toast can remove EXACTLY this
  // entry (two quick-adds inside the toast window must not undo each other).
  const id = await addWaterLog({ userId: user.id, amountMl: clamped });
  applyMutationReceipt(
    loggingReceipt({
      domain: "hydration",
      entity: "waterLog",
      op: "create",
      days: { startISO: toCalendarDayISO(todayAnchorInTz(user.timezone)) },
    })
  );
  return { ok: true, id };
}

/**
 * Backfill water onto a past calendar day (DSH-57 / excellence-standards §12:
 * every logger lets the member log past dates). The entry is stamped at noon
 * on the member's wall clock for the picked day, so the tz-day bucketing in
 * `getWaterDailyTotals` lands it on that day; picking today just logs "now"
 * (identical to a quick-add, so it shows in Today's log with a real time).
 * Returns the created entry id so the caller's toast can offer a one-tap Undo
 * (the same `removeWaterEntry` the itemized Today's-log delete uses).
 */
export async function logWaterForDay(input: {
  /** Calendar-day ISO ("2026-07-10") from the date picker. */
  day: string;
  amountMl: number;
}): Promise<NutritionActionState & { id?: string }> {
  const user = await requirePro();
  if (!user) {
    return { ok: false, error: "Not authorized." };
  }
  if (!Number.isFinite(input.amountMl) || input.amountMl <= 0) {
    return { ok: false, error: "Enter how much you drank." };
  }
  const picked = parseCalendarDay(input.day);
  if (!picked) {
    return { ok: false, error: "Pick a day." };
  }
  const pickedAnchor = startOfDayUTC(picked).getTime();
  const todayAnchor = todayAnchorInTz(user.timezone).getTime();
  if (pickedAnchor > todayAnchor) {
    return { ok: false, error: "That day hasn't happened yet." };
  }
  const clamped = Math.min(Math.round(input.amountMl), MAX_WATER_ML);
  const recordedAt =
    pickedAnchor === todayAnchor
      ? new Date()
      : new Date(
          calendarRangeWindowInTz(
            input.day,
            input.day,
            user.timezone
          ).start.getTime() +
            12 * 60 * 60 * 1000
        );
  const id = await addWaterLog({
    userId: user.id,
    amountMl: clamped,
    recordedAt,
  });
  applyMutationReceipt(
    loggingReceipt({
      domain: "hydration",
      entity: "waterLog",
      op: "create",
      days: { startISO: input.day },
    })
  );
  return { ok: true, id };
}

// Sane bounds for a daily hydration goal, in ml: a single glass up to two
// gallons. Stops a typo'd custom goal from making the tracker nonsensical.
const MIN_WATER_GOAL_ML = 237; // ~8 oz
const MAX_WATER_GOAL_ML = 7600; // ~2 gallons

/** Set the user's daily hydration goal (DSH-24). Amount arrives in ml. */
export async function saveWaterGoal(
  amountMl: number
): Promise<NutritionActionState> {
  const user = await requirePro();
  if (!user) {
    return { ok: false, error: "Setting a goal is a Chad Pro feature." };
  }
  if (!Number.isFinite(amountMl) || amountMl <= 0) {
    return { ok: false, error: "Enter a daily goal." };
  }
  const clamped = Math.min(
    Math.max(Math.round(amountMl), MIN_WATER_GOAL_ML),
    MAX_WATER_GOAL_ML
  );
  await updateUserWaterGoal(user.id, clamped);
  applyMutationReceipt(
    targetReceipt({
      domain: "hydration",
      entity: "waterGoal",
      todayISO: toCalendarDayISO(todayAnchorInTz(user.timezone)),
    })
  );
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

  // R2-3: calories and macros are one equation (4/4/9 kcal per gram). Reject
  // physically impossible combos on the server too, so no client can store
  // "100 calories with 900g protein".
  const verdict = reconcileTarget(parsed.data.calories, parsed.data);
  if (verdict.kind === "impossible") {
    return {
      ok: false,
      error: `Those macros alone add up to ${verdict.macroCal.toLocaleString()} calories, more than the calorie target. The numbers have to add up.`,
    };
  }

  await upsertNutritionTarget(user.id, parsed.data);
  applyMutationReceipt(
    targetReceipt({
      domain: "nutrition",
      entity: "nutritionTarget",
      todayISO: toCalendarDayISO(todayAnchorInTz(user.timezone)),
    })
  );
  return { ok: true };
}

/**
 * Calories-burned Phase 2 — the target editor's "Recommended for you" data:
 * the recommendation (observed expenditure outranking the formula, D1) or
 * the exact list of missing formula inputs to ask for. The member's weight
 * unit rides along so the missing-data height/weight fields render in their
 * system.
 */
export async function getTargetRecommendation(): Promise<{
  ok: boolean;
  rec?: TargetRecommendation;
  weightUnit?: "lb" | "kg";
  error?: string;
}> {
  const user = await requirePro();
  if (!user) {
    return { ok: false, error: "Targets are a Chad Pro feature." };
  }
  const rec = await computeUserTargetRecommendation(user);
  return { ok: true, rec, weightUnit: user.weightUnit ?? "lb" };
}

/**
 * Calories-burned Phase 2 — the missing-data ask inside the target editor.
 * Fills ONLY what the recommendation still needs: profile facts go to the
 * same structured profile /account edits (updateUserProfile), and a weight
 * becomes the member's FIRST weigh-in (ProgressEntry) — one storage place,
 * never a second "current weight" field.
 */
export async function saveRecommendationInputs(
  input: RecommendationInputs
): Promise<NutritionActionState> {
  const user = await requirePro();
  if (!user) {
    return { ok: false, error: "Targets are a Chad Pro feature." };
  }

  const parsed = recommendationInputsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.errors[0]?.message ?? "Couldn't save those details.",
    };
  }

  const { weight, ...profile } = parsed.data;
  if (Object.keys(profile).length > 0) {
    await updateUserProfile(user.id, profile);
    // The same fields show on /account, and sex drives the /today figure.
    revalidatePath("/account");
    revalidatePath("/today");
  }

  if (weight != null) {
    await createFirstWeighIn({
      userId: user.id,
      weight,
      unit: user.weightUnit ?? "lb",
      timezone: user.timezone,
    });
  }

  return { ok: true };
}

/**
 * Calories-burned Phase 2 — the member accepts the recommended target. Same
 * consent shape as applyRecalibration: recomputed server-side from their
 * real profile + logs (never taken from the client), written through the
 * effective-dated NutritionTarget rails. This tap IS the consent; nothing
 * ever sets a target silently.
 */
export async function acceptRecommendedTarget(): Promise<NutritionActionState> {
  const user = await requirePro();
  if (!user) {
    return { ok: false, error: "Targets are a Chad Pro feature." };
  }

  const rec = await computeUserTargetRecommendation(user);
  if (rec.kind !== "ready") {
    return {
      ok: false,
      error:
        "Your numbers changed since this was computed. Reopen the editor for the current recommendation.",
    };
  }

  const existing = await getNutritionTarget(user.id);
  await upsertNutritionTarget(user.id, {
    calories: rec.target,
    // Macros only move when the member has a complete set for the engine to
    // rebalance (protein anchored); otherwise whatever they had stays.
    protein: rec.protein ?? existing?.protein ?? null,
    carbs: rec.carbs ?? existing?.carbs ?? null,
    fat: rec.fat ?? existing?.fat ?? null,
  });
  applyMutationReceipt(
    targetReceipt({
      domain: "nutrition",
      entity: "nutritionTarget",
      todayISO: toCalendarDayISO(todayAnchorInTz(user.timezone)),
    })
  );
  return { ok: true };
}

/**
 * NUT-23 — the member accepts this week's recalibration. The numbers are
 * recomputed server-side from their real logs (never taken from the client),
 * so the write is exactly what the card showed as long as nothing changed
 * underneath it. This click IS the consent: nothing adapts automatically.
 */
export async function applyRecalibration(): Promise<NutritionActionState> {
  const user = await requirePro();
  if (!user) {
    return { ok: false, error: "Targets are a Chad Pro feature." };
  }

  const rec = await computeUserRecalibration(user);
  if (rec.kind !== "recommend") {
    return {
      ok: false,
      error:
        "Your numbers changed since this was computed. Refresh the page for the current recommendation.",
    };
  }

  const existing = await getNutritionTarget(user.id);
  await upsertNutritionTarget(user.id, {
    calories: rec.calories,
    // Macros only move when the member has a complete macro target for the
    // engine to re-derive; otherwise whatever they had stays untouched.
    protein: rec.protein ?? existing?.protein ?? null,
    carbs: rec.carbs ?? existing?.carbs ?? null,
    fat: rec.fat ?? existing?.fat ?? null,
  });
  applyMutationReceipt(
    targetReceipt({
      domain: "nutrition",
      entity: "nutritionTarget",
      todayISO: toCalendarDayISO(todayAnchorInTz(user.timezone)),
    })
  );
  return { ok: true };
}
