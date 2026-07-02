import { tool } from "ai";
import type { Session } from "next-auth";
import { z } from "zod";
import { canAccessProFeatures } from "@/lib/admin";
import { parseCalendarDay } from "@/lib/date";
import { createMealAnalysis } from "@/lib/db/queries";
import type { User } from "@/lib/db/schema";
import { logMealSchema, MEAL_CATEGORIES } from "@/lib/validation/nutrition";

type LogMealProps = {
  session: Session;
  user: User;
};

/**
 * Lets Chad log a meal the client reports in chat straight into their Calorie
 * Tracker (FEAT-14). Runs the exact same validation the manual-entry form uses
 * (`logMealSchema`) and stores through the same query, so a chat-logged meal is
 * indistinguishable from one typed on /nutrition. Pro-gated like the page.
 */
export const logMeal = ({ session, user }: LogMealProps) =>
  tool({
    description:
      "Log a meal the client reports into their Calorie Tracker so it counts toward today's macros. Use when they tell you something they ate and either ask you to log it or say yes when you offer. Use the macro numbers they give you; if they only describe the food, estimate the macros yourself and say they're estimates. Never log a meal they didn't report.",
    inputSchema: z.object({
      title: z
        .string()
        .max(120)
        .describe("Short name for the meal, e.g. 'Chicken and rice'."),
      meal: z
        .enum(MEAL_CATEGORIES)
        .nullable()
        .optional()
        .describe("Which meal of the day: breakfast, lunch, dinner or snack."),
      recordedAt: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.")
        .nullable()
        .optional()
        .describe("The day the meal was eaten (YYYY-MM-DD). Omit for today."),
      calories: z.number().int().min(0).max(20_000).nullable(),
      protein: z.number().int().min(0).max(1000).nullable().describe("grams"),
      carbs: z.number().int().min(0).max(2000).nullable().describe("grams"),
      fat: z.number().int().min(0).max(1000).nullable().describe("grams"),
      note: z.string().max(500).nullable().optional(),
    }),
    execute: async (input) => {
      if (!canAccessProFeatures(user)) {
        return {
          error:
            "This client's plan doesn't include the Calorie Tracker; it's part of Chad Pro. Tell them to upgrade to have you track their food.",
        };
      }

      const parsed = logMealSchema.safeParse(input);
      if (!parsed.success) {
        return {
          error:
            parsed.error.errors[0]?.message ?? "Couldn't log that meal.",
        };
      }

      const { title, meal, recordedAt, calories, protein, carbs, fat } =
        parsed.data;
      const created = await createMealAnalysis({
        userId: session.user.id,
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

      return {
        id: created.id,
        title: created.title,
        message: `Meal "${created.title}" (${calories ?? "?"} kcal, P${protein ?? "?"}/C${carbs ?? "?"}/F${fat ?? "?"}) logged to the client's Calorie Tracker.`,
      };
    },
  });
