"use server";

import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { getUserById } from "@/lib/db/queries";
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
