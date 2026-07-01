"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import {
  clearUserMemory,
  getUserById,
  setMemoryEnabled,
  setWeightUnit,
  updateUserProfile,
} from "@/lib/db/queries";
import { type ProfileInput, profileSchema } from "@/lib/profile";
import { getAppUrl, getStripe } from "@/lib/stripe";

/**
 * Opens Stripe's hosted billing portal where the member can update their card,
 * switch plans, or cancel. Changes flow back to us via webhooks.
 */
export async function openBillingPortal() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await getUserById(session.user.id);
  if (!user?.stripeCustomerId) {
    redirect("/pricing");
  }

  const portal = await getStripe().billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${getAppUrl()}/account`,
  });

  redirect(portal.url);
}

/**
 * Sends a member straight into Stripe's hosted plan-change flow for their
 * existing subscription (pre-selected to the update screen). Stripe shows the
 * exact proration and handles the charge, so there's no second subscription and
 * no custom billing UI to maintain. The result syncs back via the webhook.
 */
export async function upgradeToPro() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await getUserById(session.user.id);
  if (!(user?.stripeCustomerId && user.stripeSubscriptionId)) {
    // No live subscription to upgrade — send them to choose a plan instead.
    redirect("/pricing");
  }

  const portal = await getStripe().billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${getAppUrl()}/account`,
    flow_data: {
      type: "subscription_update",
      subscription_update: { subscription: user.stripeSubscriptionId },
    },
  });

  redirect(portal.url);
}

/** Set the member's preferred body-weight unit (lb/kg). */
export async function setPreferredWeightUnit(unit: "lb" | "kg") {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  await setWeightUnit(session.user.id, unit);
  revalidatePath("/account");
  revalidatePath("/today");
  revalidatePath("/progress");
}

/**
 * Save the member's editable stats/profile (ONB-2). This is their own trusted
 * data — the source of truth Chad reads in every chat — so they can correct
 * anything he ever got wrong. Revalidates /today because the profile's sex
 * drives the default hero figure there.
 */
export async function saveProfile(input: ProfileInput) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error("Invalid profile");
  }

  await updateUserProfile(session.user.id, parsed.data);
  revalidatePath("/account");
  revalidatePath("/today");
}

/** Turn Chad's cross-chat memory on or off for the current user. */
export async function setChadMemoryEnabled(enabled: boolean) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  await setMemoryEnabled(session.user.id, enabled);
  revalidatePath("/account");
}

/** Wipe everything Chad remembers about the current user. */
export async function clearChadMemory() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  await clearUserMemory(session.user.id);
  revalidatePath("/account");
}
