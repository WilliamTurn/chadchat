"use server";

import { redirect } from "next/navigation";
import type Stripe from "stripe";
import { auth } from "@/app/(auth)/auth";
import { getUserById, setUserStripeCustomerId } from "@/lib/db/queries";
import type { User } from "@/lib/db/schema";
import { getAppUrl, getStripe, PLANS, TRIAL_DAYS } from "@/lib/stripe";
import { hasUsedTrial, type PlanTier } from "@/lib/subscription";

/**
 * Returns the user's Stripe customer id, creating (and saving) one the first
 * time. Reusing one customer per user keeps their cards + history together.
 * Takes the already-fetched user row so callers don't re-query.
 */
async function getOrCreateStripeCustomer(
  userId: string,
  email: string,
  existing: User | undefined
): Promise<string> {
  if (existing?.stripeCustomerId) {
    return existing.stripeCustomerId;
  }

  const customer = await getStripe().customers.create({
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

  const user = await getUserById(session.user.id);
  const customerId = await getOrCreateStripeCustomer(
    session.user.id,
    session.user.email ?? "",
    user
  );

  // Each customer gets the free trial only once. Returning/cancelled customers
  // resubscribe and are charged immediately (no repeat free trials).
  const offerTrial = !hasUsedTrial({
    stripeSubscriptionId: user?.stripeSubscriptionId ?? null,
  });

  // Lands on the Subscription object, so it's present on every webhook.
  const subscriptionData: Stripe.Checkout.SessionCreateParams.SubscriptionData = {
    metadata: { userId: session.user.id, tier },
  };
  if (offerTrial) {
    subscriptionData.trial_period_days = TRIAL_DAYS;
    subscriptionData.trial_settings = {
      end_behavior: { missing_payment_method: "cancel" },
    };
  }

  const appUrl = getAppUrl();

  const checkout = await getStripe().checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: session.user.id,
    line_items: [{ price: plan.priceId, quantity: 1 }],
    payment_method_collection: "always",
    allow_promotion_codes: true,
    subscription_data: subscriptionData,
    success_url: `${appUrl}/?checkout=success`,
    cancel_url: `${appUrl}/pricing?checkout=cancelled`,
  });

  if (!checkout.url) {
    throw new Error("Stripe did not return a checkout URL.");
  }

  redirect(checkout.url);
}
