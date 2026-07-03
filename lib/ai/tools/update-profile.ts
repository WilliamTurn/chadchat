import { tool } from "ai";
import type { Session } from "next-auth";
import { z } from "zod";
import { updateUserProfile } from "@/lib/db/queries";
import {
  experienceLabel,
  formatHeightBoth,
  goalLabel,
  profileSchema,
  sexLabel,
} from "@/lib/profile";

type UpdateProfileProps = {
  session: Session;
};

/**
 * Lets Chad update the client's confirmed profile (the "Your stats" truth
 * store on /account) when they settle on a change in chat (FN-5). Runs the
 * exact same validation the account form and onboarding wizard use
 * (`profileSchema`) and writes through the same query, so the profile Chad is
 * prompted with next message matches what was just agreed. Not tier-gated:
 * the profile is every member's own data, same as the account page.
 */
export const updateProfile = ({ session }: UpdateProfileProps) =>
  tool({
    description:
      "Update the client's confirmed profile stats (the 'Your stats' section on their Account page, which the app treats as the truth about them): primary goal, age, height, sex, training experience, or training days per week. Use it when the client states or agrees to a change in one of these - especially when you two settle on a different primary goal than the profile shows. Pass ONLY the fields that changed, with exactly what the client confirmed. Never guess or update a field they didn't address.",
    inputSchema: z.object({
      primaryGoal: z
        .enum(["muscle", "fat_loss", "strength", "health"])
        .optional()
        .describe(
          "Their primary goal: muscle = build muscle, fat_loss = lose fat, strength = get stronger, health = overall health."
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
    }),
    execute: async (input) => {
      const parsed = profileSchema.safeParse(input);
      if (!parsed.success) {
        return {
          error:
            parsed.error.errors[0]?.message ?? "Couldn't update the profile.",
        };
      }

      // Only pass through keys the model actually sent: `updateUserProfile`
      // writes every present key, and an absent one leaves the field untouched.
      const fields = Object.fromEntries(
        Object.entries(parsed.data).filter(([, v]) => v !== undefined)
      );
      if (Object.keys(fields).length === 0) {
        return { error: "No profile fields to update were given." };
      }

      await updateUserProfile(session.user.id, fields);

      const changed: string[] = [];
      if (parsed.data.primaryGoal) {
        changed.push(`primary goal: ${goalLabel(parsed.data.primaryGoal)}`);
      }
      if (parsed.data.age != null) {
        changed.push(`age: ${parsed.data.age}`);
      }
      if (parsed.data.heightCm != null) {
        changed.push(`height: ${formatHeightBoth(parsed.data.heightCm)}`);
      }
      if (parsed.data.sex) {
        changed.push(`sex: ${sexLabel(parsed.data.sex)}`);
      }
      if (parsed.data.experienceLevel) {
        changed.push(
          `training experience: ${experienceLabel(parsed.data.experienceLevel)}`
        );
      }
      if (parsed.data.trainingDaysPerWeek != null) {
        changed.push(
          `training days/week: ${parsed.data.trainingDaysPerWeek}`
        );
      }

      return {
        message: `Profile updated (${changed.join("; ")}). This is now the confirmed truth on their Account page.`,
      };
    },
  });
