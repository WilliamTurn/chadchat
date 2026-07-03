import type { User } from "@/lib/db/schema";

/**
 * What Chad still doesn't know before building a meal plan (NUT-19). Returns
 * plain-English hints for the generate form's "this plan could be off"
 * confirm; an empty list means the member is set up and generation runs with
 * no interruption. Generation is never LOCKED on this: pro apps gate on
 * missing targets, not tenure, and a warned member can always proceed.
 */
export function planReadinessHints({
  user,
  hasTarget,
  hasMemory,
}: {
  user: User;
  hasTarget: boolean;
  hasMemory: boolean;
}): string[] {
  const hints: string[] = [];

  const profileGaps = [
    user.sex == null,
    user.age == null,
    user.heightCm == null,
    user.experienceLevel == null,
    user.primaryGoal == null,
  ].filter(Boolean).length;
  if (profileGaps >= 2) {
    hints.push(
      "Your profile is missing basics (age, height, goal). Fill them in on the Account page."
    );
  }

  if (!hasTarget) {
    hints.push(
      "No daily calorie or macro targets are set, so Chad will pick the numbers himself."
    );
  }

  if (!hasMemory) {
    hints.push(
      "Chad has no notes on you yet. Even one chat about your goal and training sharpens the plan."
    );
  }

  return hints;
}
