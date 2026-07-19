import { tool } from "ai";
import type { Session } from "next-auth";
import { updateProfileInputSchema } from "@/lib/ai/tool-schemas";
import { setSensoryPrefs, updateUserProfile } from "@/lib/db/queries";
import {
  activityLabel,
  experienceLabel,
  formatHeightBoth,
  goalLabel,
  goalsLabel,
  type ProfileInput,
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
      "Update the client's confirmed profile stats (the 'Your stats' section on their Account page, which the app treats as the truth about them): primary goal, age, height, sex, training experience, training days per week, or everyday activity level (which feeds their recommended calorie target). Also flips their logging-feedback preferences (success sounds, vibration) when they ask. Use it when the client states or agrees to a change in one of these - especially when you two settle on a different primary goal than the profile shows. Pass ONLY the fields that changed, with exactly what the client confirmed. Never guess or update a field they didn't address.",
    inputSchema: updateProfileInputSchema,
    execute: async (input) => {
      // Sound/vibration are preferences, not profile stats; split them off
      // before the profile validation and write them through the same setter
      // the /account switches use (DSH-54).
      const { soundEnabled, hapticsEnabled, ...profileInput } = input;
      const parsed = profileSchema.safeParse(profileInput);
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
      ) as ProfileInput;
      // Keep the single-goal mirror and the multi-select list in lockstep
      // (s157): whichever one Chad sent, derive the other.
      if (Array.isArray(fields.primaryGoals)) {
        fields.primaryGoal = fields.primaryGoals[0] ?? null;
      } else if (fields.primaryGoal !== undefined) {
        fields.primaryGoals = fields.primaryGoal ? [fields.primaryGoal] : [];
      }
      const sensory: { soundEnabled?: boolean; hapticsEnabled?: boolean } = {};
      if (typeof soundEnabled === "boolean") {
        sensory.soundEnabled = soundEnabled;
      }
      if (typeof hapticsEnabled === "boolean") {
        sensory.hapticsEnabled = hapticsEnabled;
      }
      if (Object.keys(fields).length === 0 && Object.keys(sensory).length === 0) {
        return { error: "No profile fields to update were given." };
      }

      if (Object.keys(fields).length > 0) {
        await updateUserProfile(session.user.id, fields);
      }
      if (Object.keys(sensory).length > 0) {
        await setSensoryPrefs(session.user.id, sensory);
      }

      const changed: string[] = [];
      if (parsed.data.primaryGoals && parsed.data.primaryGoals.length > 0) {
        changed.push(
          `training goals: ${goalsLabel(parsed.data.primaryGoals, null)}`
        );
      } else if (parsed.data.primaryGoal) {
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
      if (parsed.data.activityLevel) {
        changed.push(
          `everyday activity: ${activityLabel(parsed.data.activityLevel)}`
        );
      }
      if (sensory.soundEnabled != null) {
        changed.push(`logging sounds: ${sensory.soundEnabled ? "on" : "off"}`);
      }
      if (sensory.hapticsEnabled != null) {
        changed.push(`vibration: ${sensory.hapticsEnabled ? "on" : "off"}`);
      }

      return {
        message: `Profile updated (${changed.join("; ")}). This is now the confirmed truth on their Account page.`,
      };
    },
  });
