import { z } from "zod";

/**
 * Shared source of truth for a member's editable stats/profile (ONB-2).
 *
 * These are the durable "who is this client" facts — collected at onboarding
 * and correctable anytime on /account. Storing them as structured, user-owned
 * data (rather than only as loose text in Chad's self-maintained memory) gives
 * the app a trusted profile it can inject into his prompt, and gives the user a
 * place to fix anything he ever gets wrong.
 *
 * Body WEIGHT is deliberately NOT part of this profile: it's dynamic and already
 * owned by the weigh-in log (ProgressEntry), so duplicating it here would create
 * two disagreeing "current weight" numbers. Height/age/sex/experience/goal/days
 * are the durable facts that have no other home.
 *
 * The option value ↔ label maps live here so the onboarding wizard, the account
 * editor, the server validation, and the prompt formatter all agree.
 */

export const SEX_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
] as const;
export type Sex = (typeof SEX_OPTIONS)[number]["value"];

export const EXPERIENCE_OPTIONS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
] as const;
export type ExperienceLevel = (typeof EXPERIENCE_OPTIONS)[number]["value"];

export const GOAL_OPTIONS = [
  { value: "muscle", label: "Build muscle" },
  { value: "fat_loss", label: "Lose fat" },
  { value: "strength", label: "Get stronger" },
  { value: "health", label: "Overall health" },
] as const;
export type PrimaryGoal = (typeof GOAL_OPTIONS)[number]["value"];

export const TRAINING_DAY_OPTIONS = [1, 2, 3, 4, 5, 6, 7] as const;

function labelFor<T extends string>(
  options: readonly { value: T; label: string }[],
  value: T | null | undefined
): string | null {
  if (!value) {
    return null;
  }
  return options.find((o) => o.value === value)?.label ?? null;
}

export const sexLabel = (v: Sex | null | undefined) =>
  labelFor(SEX_OPTIONS, v);
export const experienceLabel = (v: ExperienceLevel | null | undefined) =>
  labelFor(EXPERIENCE_OPTIONS, v);
export const goalLabel = (v: PrimaryGoal | null | undefined) =>
  labelFor(GOAL_OPTIONS, v);

// --- Height: stored canonically in whole centimeters, shown in the user's
// preferred system (imperial ft/in or metric cm), derived from their weightUnit
// so height and weight always read in the same system without a second toggle.

export type UnitSystem = "imperial" | "metric";

/** The unit system to show height in, derived from the weight-unit preference. */
export function unitSystemFor(
  weightUnit: "lb" | "kg" | null | undefined
): UnitSystem {
  return weightUnit === "kg" ? "metric" : "imperial";
}

export function cmToFtIn(cm: number): { ft: number; inches: number } {
  const totalInches = Math.round(cm / 2.54);
  return { ft: Math.floor(totalInches / 12), inches: totalInches % 12 };
}

export function ftInToCm(ft: number, inches: number): number {
  return Math.round((ft * 12 + inches) * 2.54);
}

/** Human-readable height, e.g. `5'11"` (imperial) or `180 cm` (metric). */
export function formatHeight(
  cm: number | null | undefined,
  system: UnitSystem
): string | null {
  if (cm == null) {
    return null;
  }
  if (system === "metric") {
    return `${Math.round(cm)} cm`;
  }
  const { ft, inches } = cmToFtIn(cm);
  return `${ft}'${inches}"`;
}

/**
 * Compact "5'11" (180 cm)" style used in Chad's prompt so he has both systems
 * regardless of which the client entered.
 */
export function formatHeightBoth(cm: number | null | undefined): string | null {
  if (cm == null) {
    return null;
  }
  const { ft, inches } = cmToFtIn(cm);
  return `${ft}'${inches}" (${Math.round(cm)} cm)`;
}

/**
 * Validated shape for saving a profile. Every field is optional + nullable so a
 * partial save (or a cleared field) is fine — the account form and the
 * onboarding wizard both send only what the user actually filled. Bounds are
 * generous sanity checks, not gatekeeping.
 */
export const profileSchema = z.object({
  sex: z.enum(["male", "female"]).nullable().optional(),
  age: z.coerce.number().int().min(13).max(100).nullable().optional(),
  heightCm: z.coerce.number().int().min(90).max(250).nullable().optional(),
  experienceLevel: z
    .enum(["beginner", "intermediate", "advanced"])
    .nullable()
    .optional(),
  primaryGoal: z
    .enum(["muscle", "fat_loss", "strength", "health"])
    .nullable()
    .optional(),
  trainingDaysPerWeek: z.coerce.number().int().min(1).max(7).nullable().optional(),
});

export type ProfileInput = z.infer<typeof profileSchema>;
