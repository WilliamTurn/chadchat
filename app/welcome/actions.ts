"use server";

import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { getUserById, markOnboarded, updateUserProfile } from "@/lib/db/queries";
import { createFirstWeighIn } from "@/lib/nutrition/first-weigh-in";
import { type ProfileInput, profileSchema } from "@/lib/profile";
import { progressEntrySchema } from "@/lib/validation/progress";

/**
 * Finish the first-run onboarding wizard (ONB-1). Called on both "start with
 * Chad" (with the collected stats) and "skip" (no stats). Stamps `onboardedAt`
 * so the wizard never shows again, persists the body-weight unit the user
 * picked so the whole dashboard reads in their units from day one, and — ONB-2 —
 * persists the collected stats to the user's structured profile so they're the
 * trusted source of truth from message one (and editable later on /account),
 * not just loose text Chad has to remember. The weight answer is saved as the
 * member's first weigh-in (owner ruling 2026-07-19).
 */
export async function finishOnboarding(opts?: {
  weightUnit?: "lb" | "kg";
  profile?: ProfileInput;
  /** The wizard's current-weight answer, saved as the first weigh-in. */
  weight?: number | null;
}): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  // Persist the structured stats (best-effort validated). A bad field must not
  // trap the user on the form — the wizard already validates the inputs, and
  // the stats are also handed to Chad as the opening message.
  if (opts?.profile) {
    const parsed = profileSchema.safeParse(opts.profile);
    if (parsed.success) {
      await updateUserProfile(session.user.id, parsed.data);
    }
  }

  // The wizard's weight answer becomes the member's first weigh-in — the same
  // code path (and same validation) as the target editor's missing-data ask
  // and the /progress form, skipped when a weigh-in already exists. Best
  // effort like the profile save: a bad value never traps them on the form.
  const parsedWeight = progressEntrySchema.safeParse({
    weight: opts?.weight ?? null,
    unit: opts?.weightUnit ?? "lb",
  });
  if (parsedWeight.success && parsedWeight.data.weight != null) {
    const user = await getUserById(session.user.id);
    if (user) {
      await createFirstWeighIn({
        userId: user.id,
        weight: parsedWeight.data.weight,
        unit: parsedWeight.data.unit,
        timezone: user.timezone,
      });
    }
  }

  await markOnboarded(session.user.id, {
    weightUnit: opts?.weightUnit,
  });
}
