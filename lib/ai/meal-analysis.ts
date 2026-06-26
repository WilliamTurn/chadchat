import "server-only";

import { generateObject } from "ai";
import { z } from "zod";
import { DEFAULT_CHAT_MODEL } from "./models";
import { getLanguageModel } from "./providers";

export type MealKind = "meal" | "fridge" | "pantry";

// The structured analysis Chad returns for a photo. Macros are nullable because
// a fridge/pantry inventory doesn't have a single "serving" to total — only a
// plated meal does.
export const mealAnalysisSchema = z.object({
  title: z
    .string()
    .describe(
      "A short, specific label for what's in the photo, e.g. 'Double cheeseburger + fries' or 'Mostly-empty fridge: beer, condiments, leftover pizza'."
    ),
  items: z
    .array(
      z.object({
        name: z.string().describe("The food item."),
        detail: z
          .string()
          .nullable()
          .describe("Optional portion/quantity, e.g. '2 slices', '~200g'."),
      })
    )
    .describe("Every distinct food item identified in the photo."),
  calories: z
    .number()
    .nullable()
    .describe(
      "Estimated total calories for a plated MEAL. Null for a fridge/pantry inventory."
    ),
  protein: z
    .number()
    .nullable()
    .describe("Estimated total grams of protein for a MEAL. Null otherwise."),
  carbs: z
    .number()
    .nullable()
    .describe("Estimated total grams of carbs for a MEAL. Null otherwise."),
  fat: z
    .number()
    .nullable()
    .describe("Estimated total grams of fat for a MEAL. Null otherwise."),
  healthScore: z
    .number()
    .min(1)
    .max(10)
    .describe(
      "How well this supports a serious fitness goal: 1 = garbage, 10 = elite. Be honest and harsh."
    ),
  verdict: z
    .string()
    .describe(
      "Chad's blunt verdict in his own voice — 2 to 4 sentences. Brutally honest. Shame the junk, give credit only where it's earned."
    ),
  tips: z
    .array(z.string())
    .describe("2 to 4 concrete, specific fixes or swaps. No vague platitudes."),
});

export type MealAnalysisResult = z.infer<typeof mealAnalysisSchema>;

// A nutrition-label scan. Unlike a plated meal, the numbers are PRINTED, so Chad
// reads them off the label rather than estimating. Everything here is PER SERVING
// — the caller multiplies by how many servings the client ate.
export const labelAnalysisSchema = z.object({
  title: z
    .string()
    .describe(
      "The product's name as printed on the packaging, e.g. 'Greek yogurt' or 'Chocolate protein bar'. If no name is visible, a short description of the food."
    ),
  servingSize: z
    .string()
    .nullable()
    .describe(
      "The serving size printed on the label, e.g. '30g', '1 bar (60g)', '250ml'. Null if not legible."
    ),
  calories: z
    .number()
    .nullable()
    .describe("Calories PER SERVING, read off the label. Null if not legible."),
  protein: z
    .number()
    .nullable()
    .describe(
      "Grams of protein PER SERVING, read off the label. Null if not legible."
    ),
  carbs: z
    .number()
    .nullable()
    .describe(
      "Grams of carbohydrate PER SERVING, read off the label. Null if not legible."
    ),
  fat: z
    .number()
    .nullable()
    .describe(
      "Grams of fat PER SERVING, read off the label. Null if not legible."
    ),
  healthScore: z
    .number()
    .min(1)
    .max(10)
    .describe(
      "How well this food supports a serious fitness goal: 1 = garbage, 10 = elite. Be honest and harsh."
    ),
  verdict: z
    .string()
    .describe(
      "Chad's blunt verdict in his own voice — 2 to 4 sentences — on this food and the amount the client ate. Brutally honest."
    ),
  tips: z
    .array(z.string())
    .describe("2 to 4 concrete, specific tips or better swaps."),
});

export type LabelAnalysisResult = z.infer<typeof labelAnalysisSchema>;

const CHAD_VOICE = `You are Chad, a no-bullshit AI fitness coach analyzing a photo a client just sent you. You are direct, ruthless, and results-obsessed, with zero tolerance for excuses. You shame junk food and lazy choices — that's the job, shame works — but your numbers are accurate and your fixes are concrete. No profanity is required; brutal honesty is. Never invent precision you don't have: estimate sensibly and say so.`;

function instructionFor(kind: MealKind): string {
  if (kind === "fridge") {
    return `This is the inside of the client's FRIDGE. Inventory what you see, then judge it like a coach doing a kitchen raid: what's actually useful for building muscle or cutting fat, what's garbage that needs to go, and what's obviously missing. Set calories/protein/carbs/fat to null (a fridge isn't a serving). Your verdict should call out the junk and the gaps. Tips = what to throw out and what to buy on the next shop.`;
  }
  if (kind === "pantry") {
    return `This is the client's PANTRY / cupboard. Inventory what you see and judge it like a coach: which staples support the goal, which processed junk is sabotaging it, and what's missing. Set calories/protein/carbs/fat to null (a pantry isn't a serving). Tips = what to toss and what staples to stock.`;
  }
  return "This is a MEAL the client is about to eat or just ate. Identify everything on the plate, estimate the total calories and macros (protein/carbs/fat in grams) as best you can, and grade it. Be realistic about portions. Your verdict should tell them straight whether this moves them toward their goal or away from it.";
}

/**
 * Analyze a food/fridge/pantry photo with Chad's flagship vision model and
 * return structured macros + his verdict. Throws on model/parse failure — the
 * caller (a server action) turns that into a friendly error.
 */
export async function analyzeFoodPhoto({
  photoUrl,
  mediaType,
  kind,
  note,
}: {
  photoUrl: string;
  mediaType: string;
  kind: MealKind;
  note?: string | null;
}): Promise<MealAnalysisResult> {
  const noteLine = note?.trim()
    ? `\n\nThe client added a note: "${note.trim()}". Take it into account.`
    : "";

  const { object } = await generateObject({
    model: getLanguageModel(DEFAULT_CHAT_MODEL),
    schema: mealAnalysisSchema,
    system: CHAD_VOICE,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `${instructionFor(kind)}${noteLine}`,
          },
          {
            type: "file",
            mediaType,
            data: new URL(photoUrl),
          },
        ],
      },
    ],
  });

  return object;
}

const LABEL_INSTRUCTION = `This is a photo of a NUTRITION LABEL (a nutrition facts panel) on packaged food. Read the numbers PRINTED on the label — do NOT estimate, the values are right there.

Report every macro value PER SINGLE SERVING exactly as the label lists it: calories, protein, carbs, and fat (in grams). Read the serving size too. If a specific value is genuinely not legible, set it to null rather than guessing — never invent a number.

If the image is clearly NOT a nutrition label (e.g. it's a plate of food, or unreadable), say so bluntly in your verdict and set the macro values to null.

Grade the food and give your verdict on it, factoring in how much the client said they ate.`;

/**
 * Read a packaged-food nutrition label with Chad's vision model and return the
 * PER-SERVING macros + his verdict. The caller multiplies by the number of
 * servings eaten so the totals are exact arithmetic, not the model's. Throws on
 * model/parse failure — the caller turns that into a friendly error.
 */
export async function analyzeNutritionLabel({
  photoUrl,
  mediaType,
  servings,
  note,
}: {
  photoUrl: string;
  mediaType: string;
  servings: number;
  note?: string | null;
}): Promise<LabelAnalysisResult> {
  const noteLine = note?.trim()
    ? `\n\nThe client added a note: "${note.trim()}". Take it into account.`
    : "";
  const servingsLine = `\n\nThe client ate ${servings} serving(s) of this product.`;

  const { object } = await generateObject({
    model: getLanguageModel(DEFAULT_CHAT_MODEL),
    schema: labelAnalysisSchema,
    system: CHAD_VOICE,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `${LABEL_INSTRUCTION}${servingsLine}${noteLine}`,
          },
          {
            type: "file",
            mediaType,
            data: new URL(photoUrl),
          },
        ],
      },
    ],
  });

  return object;
}
