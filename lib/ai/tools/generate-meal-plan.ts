import { tool } from "ai";
import type { Session } from "next-auth";
import { z } from "zod";
import { generateMealPlan } from "@/lib/ai/meal-plan";
import {
  createMealPlan,
  getActiveGoalsByUserId,
  getActivePlansByUserId,
  getNutritionTarget,
  getUserMemory,
} from "@/lib/db/queries";
import {
  BUDGETS,
  COOK_TIMES,
  DIET_STYLES,
  mealPlanPreferencesSchema,
} from "@/lib/validation/meal-plan";

type GenerateMealPlanProps = {
  session: Session;
  chatId: string;
};

/**
 * Lets Chad generate a full STRUCTURED meal plan for the client and save it to
 * their /meal-plan dashboard. Unlike `savePlan` (which stores a markdown blob),
 * this builds a real day-by-day plan whose macros come from the USDA food
 * database (computed in code, never AI-estimated). The model designs foods +
 * gram portions; the server enriches with verified macros. Long-running (one
 * Opus design pass + DB lookups), so Chad should tell the client it'll take a
 * moment.
 */
export const generateMealPlanTool = ({
  session,
  chatId,
}: GenerateMealPlanProps) =>
  tool({
    description:
      "Generate a structured, multi-day meal plan tailored to the client's goal and macro target, and save it to their dashboard. Use this when the client wants you to actually BUILD their meals out (not just talk macros). Gather their preferences first — diet style, any allergies/dislikes, how many meals a day, budget, and how much they want to cook — then call this. The plan's macros are computed from a real food database, so don't write out the macro numbers yourself; just confirm the plan is built and point them to their Meal Plan page.",
    inputSchema: z.object({
      dietStyle: z
        .enum(DIET_STYLES)
        .default("balanced")
        .describe("The client's eating style."),
      allergies: z
        .array(z.string().max(40))
        .max(20)
        .default([])
        .describe("Hard food exclusions — allergies. Never included in the plan."),
      dislikes: z
        .array(z.string().max(40))
        .max(20)
        .default([])
        .describe("Foods the client dislikes and wants avoided."),
      mealsPerDay: z
        .number()
        .int()
        .min(2)
        .max(6)
        .default(4)
        .describe("How many meals per day."),
      days: z
        .number()
        .int()
        .min(1)
        .max(7)
        .default(7)
        .describe("How many days to plan (7 is standard)."),
      budget: z.enum(BUDGETS).default("moderate").describe("Grocery budget."),
      cookTime: z
        .enum(COOK_TIMES)
        .default("moderate")
        .describe("How much time/effort the client will put into cooking."),
      notes: z
        .string()
        .max(500)
        .default("")
        .describe("Any other relevant context for the plan."),
    }),
    execute: async (input) => {
      const userId = session.user.id;

      // Snapshot the preferences (fills defaults/validates).
      const preferences = mealPlanPreferencesSchema.parse(input);

      // Pull context: explicit macro target + goals + memory for a smart plan.
      const [target, goals, plans, memory] = await Promise.all([
        getNutritionTarget(userId),
        getActiveGoalsByUserId(userId),
        getActivePlansByUserId(userId),
        getUserMemory(userId),
      ]);

      const goalContext = [
        ...goals.map((g) => `Goal: ${g.title}${g.targetDate ? ` (by ${g.targetDate})` : ""}`),
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

      const created = await createMealPlan({
        userId,
        title: plan.title,
        source: "chad",
        sourceChatId: chatId,
        targetCalories: plan.target.calories,
        targetProtein: plan.target.protein,
        targetCarbs: plan.target.carbs,
        targetFat: plan.target.fat,
        preferences,
        coachIntro: plan.coachIntro,
        days: plan.days,
      });

      return {
        id: created.id,
        title: created.title,
        days: plan.days.length,
        mealsPerDay: preferences.mealsPerDay,
        message: `Structured meal plan "${created.title}" built and saved to the client's Meal Plan dashboard (${plan.days.length} days). Tell them it's ready and they can view, tweak, download, or log meals from it there. Do not list the macros yourself.`,
      };
    },
  });
