"use server";

import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { markOnboarded, updateUserProfile } from "@/lib/db/queries";
import { type ProfileInput, profileSchema } from "@/lib/profile";

/**
 * Finish the first-run onboarding wizard (ONB-1). Called on both "start with
 * Chad" (with the collected stats) and "skip" (no stats). Stamps `onboardedAt`
 * so the wizard never shows again, persists the body-weight unit the user
 * picked so the whole dashboard reads in their units from day one, and — ONB-2 —
 * persists the collected stats to the user's structured profile so they're the
 * trusted source of truth from message one (and editable later on /account),
 * not just loose text Chad has to remember.
 */
export async function finishOnboarding(opts?: {
  weightUnit?: "lb" | "kg";
  profile?: ProfileInput;
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

  await markOnboarded(session.user.id, {
    weightUnit: opts?.weightUnit,
  });
}
