"use server";

import { redirect } from "next/navigation";
import { auth, signOut } from "@/app/(auth)/auth";
import { markTermsAccepted } from "@/lib/db/queries";

/**
 * Record the member's 18+/Terms/Privacy acceptance from the /legal
 * interstitial (BLK-4), then send them into the app. The stamp is idempotent
 * (markTermsAccepted never moves an existing timestamp).
 */
export async function acceptTerms(): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  await markTermsAccepted(session.user.id);
  redirect("/home");
}

/** The honest exit for anyone who declines: sign them out cleanly. */
export async function declineAndSignOut(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
