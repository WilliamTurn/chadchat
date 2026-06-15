"use server";

import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { getUserById, setUserStripeCustomerId } from "@/lib/db/queries";
import { getAppUrl, PLANS, stripe, TRIAL_DAYS } from "@/lib/stripe";
import type { PlanTier } from "@/lib/subscription";

/**
 * Returns the user's Stripe customer id, creating (and saving) one the first
 * time. Reusing one customer per user keeps their cards + history together.
 */
async function getOrCreateStripeCustomer(
  userId: string,
  email: string
): Promise<string> {
  const existing = await getUserById(userId);
  if (existing?.stripeCustomerId) {
    return existing.stripeCustomerId;
  }

  const customer = await stripe.customers.create({
    email: email || undefined,
    metadata: { userId },
  });

  await setUserStripeCustomerId(userId, customer.id);
  return customer.id;
}

/**
 * Starts a subscription checkout for the given plan and redirects the user to
 * Stripe's hosted payment page. Card is collected up front; a free trial is
 * attached so the first charge only happens after the trial ends.
 */
export async function createCheckoutSession(tier: PlanTier) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const plan = PLANS[tier];
  if (!plan?.priceId) {
    throw new Error(`Stripe price id not configured for tier "${tier}".`);
  }

  const customerId = await getOrCreateStripeCustomer(
    session.user.id,
    session.user.email ?? ""
  );

  const appUrl = getAppUrl();

  const checkout = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: session.user.id,
    line_items: [{ price: plan.priceId, quantity: 1 }],
    payment_method_collection: "always",
    allow_promotion_codes: true,
    subscription_data: {
      trial_period_days: TRIAL_DAYS,
      // Lands on the Subscription object, so it's present on every webhook.
      metadata: { userId: session.user.id, tier },
      trial_settings: {
        end_behavior: { missing_payment_method: "cancel" },
      },
    },
    success_url: `${appUrl}/?checkout=success`,
    cancel_url: `${appUrl}/pricing?checkout=cancelled`,
  });

  if (!checkout.url) {
    throw new Error("Stripe did not return a checkout URL.");
  }

  redirect(checkout.url);
}
