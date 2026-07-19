/**
 * Calories-burned Phase 4: the input schemas of Chad's energy-touching
 * tools, extracted to a pure module (no DB / server-only imports) so the
 * tool-schema regression suite can pin them. The tool files under
 * lib/ai/tools/* import from here — this IS each tool's real schema, not a
 * copy.
 *
 * WORDING GATE: every .describe() string here is text Chad reads. Changes
 * need the owner's explicit authorization on the exact wording (chadlatest
 * CLAUDE.md, Chad authorization). The strings below are the Phase 4 drafts
 * presented for that approval.
 */

import { z } from "zod";
import { ACTIVITY_CATALOG } from "@/lib/energy/activity-catalog";
import { ACTIVITY_LEVELS } from "@/lib/energy/tdee";

/** The catalog's activity ids, as a zod enum the model can pick from. */
const ACTIVITY_IDS = ACTIVITY_CATALOG.map((a) => a.id) as [
  string,
  ...string[],
];

export const logCardioInputSchema = z.object({
  activity: z
    .enum(ACTIVITY_IDS)
    .describe(
      "The activity, from the app's cardio catalog (same list as the Log Cardio page). Pick the closest match to what the client did."
    ),
  minutes: z
    .number()
    .int()
    .min(1)
    .max(1440)
    .describe("How long they went, in whole minutes."),
  intensity: z
    .string()
    .max(60)
    .nullable()
    .optional()
    .describe(
      "Optional effort level, only for activities that offer them (e.g. rowing-machine has easy, moderate, vigorous, all-out intervals). Use the client's own words; if it doesn't match, the tool replies with the valid choices. Omit when they didn't say — the activity's standard effort applies."
    ),
  recordedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.")
    .nullable()
    .optional()
    .describe("The day they did it (YYYY-MM-DD). Omit for today."),
});

export type LogCardioToolInput = z.infer<typeof logCardioInputSchema>;

export const logWorkoutInputSchema = z.object({
  title: z
    .string()
    .max(120)
    .describe("Session label, e.g. 'Push Day' or 'Legs'."),
  performedAt: z
    .string()
    .nullable()
    .optional()
    .describe("ISO date the session was done. Omit for today."),
  durationMinutes: z
    .number()
    .int()
    .min(1)
    .max(1440)
    .nullable()
    .optional()
    .describe(
      "How long the whole session took, in minutes, when the client tells you ('about an hour in the gym'). It powers the session's estimated exercise calories. Omit when they didn't say; never guess a duration."
    ),
  notes: z.string().max(2000).nullable().optional(),
  exercises: z
    .array(
      z.object({
        name: z
          .string()
          .max(120)
          .describe("Exercise name, e.g. 'Barbell Bench Press'."),
        sets: z
          .array(
            z.object({
              weight: z
                .number()
                .nullable()
                .optional()
                .describe("Load. Null for bodyweight."),
              reps: z.number().int().nullable().optional(),
              unit: z.enum(["lb", "kg"]).default("lb"),
              rpe: z.number().min(1).max(10).nullable().optional(),
            })
          )
          .max(40),
      })
    )
    .min(1)
    .max(50),
});

export type LogWorkoutToolInput = z.infer<typeof logWorkoutInputSchema>;

export const updateProfileInputSchema = z.object({
  primaryGoal: z
    .enum(["muscle", "fat_loss", "strength", "health"])
    .optional()
    .describe(
      "Their primary goal: muscle = build muscle, fat_loss = lose fat, strength = get stronger, health = overall health."
    ),
  primaryGoals: z
    .array(z.enum(["muscle", "fat_loss", "strength", "health"]))
    .max(4)
    .optional()
    .describe(
      "Their FULL set of training goals when they name more than one (e.g. build muscle AND lose fat). Use this instead of primaryGoal whenever multiple goals apply; list them in priority order."
    ),
  age: z.number().int().min(13).max(100).optional(),
  heightCm: z
    .number()
    .int()
    .min(90)
    .max(250)
    .optional()
    .describe("Height in whole centimeters (convert from ft/in yourself)."),
  sex: z.enum(["male", "female"]).optional(),
  experienceLevel: z
    .enum(["beginner", "intermediate", "advanced"])
    .optional(),
  trainingDaysPerWeek: z.number().int().min(1).max(7).optional(),
  activityLevel: z
    .enum(ACTIVITY_LEVELS)
    .optional()
    .describe(
      "How active their everyday life is, NOT counting workouts (it feeds their recommended calorie target): sedentary = mostly sitting, light = on their feet part of the day, moderate = moving most of the day, very = hard physical work. Set it only when the client describes or confirms their day-to-day activity."
    ),
  soundEnabled: z
    .boolean()
    .optional()
    .describe(
      "Whether the app plays the success chime when they log something. Set only when the client asks to turn logging sounds on or off."
    ),
  hapticsEnabled: z
    .boolean()
    .optional()
    .describe(
      "Whether the app vibrates on logs and timers (phones only). Set only when the client asks to turn vibration on or off."
    ),
});

export type UpdateProfileToolInput = z.infer<typeof updateProfileInputSchema>;

export const getDashboardInputSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.")
    .nullable()
    .optional()
    .describe(
      "The day to look up (YYYY-MM-DD). Omit for today. With endDate, this is the start of the range."
    ),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.")
    .nullable()
    .optional()
    .describe(
      "Optional inclusive end of a range (YYYY-MM-DD). Omit to look up a single day. Keep ranges reasonable (a few weeks at most)."
    ),
});

export type GetDashboardToolInput = z.infer<typeof getDashboardInputSchema>;
