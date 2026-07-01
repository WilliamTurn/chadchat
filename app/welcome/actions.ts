"use server";

import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { markOnboarded } from "@/lib/db/queries";

/**
 * Finish the first-run onboarding wizard (ONB-1). Called on both "start with
 * Chad" (with the collected stats) and "skip" (no stats). Stamps `onboardedAt`
 * so the wizard never shows again, and persists the body-weight unit the user
 * picked so the whole dashboard reads in their units from day one.
 *
 * The stats themselves are NOT written to a structured column here — they're
 * handed to Chad as the first chat message (see the wizard) and captured into
 * his memory profile by the existing memory layer, keeping a single source of
 * truth for "what Chad knows about you".
 */
export async function finishOnboarding(opts?: {
  weightUnit?: "lb" | "kg";
}): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  await markOnboarded(session.user.id, {
    weightUnit: opts?.weightUnit,
  });
}
