import "server-only";
import type Stripe from "stripe";
import { updateUserSubscriptionByCustomerId } from "@/lib/db/queries";
import { tierFromPriceId } from "@/lib/stripe";

/**
 * Writes the full current state of a Stripe subscription into our User row.
 * Idempotent: it always overwrites with the latest snapshot, so duplicate or
 * out-of-order webhook deliveries are safe.
 *
 * Shared by the Stripe webhook (the normal path) and the post-checkout success
 * page (which syncs synchronously so a just-paid user isn't bounced to /pricing
 * while we wait for the `customer.subscription.created` webhook to land).
 */
export async function syncSubscriptionToDb(subscription: Stripe.Subscription) {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  // Since the Basil API change, the period end lives on the subscription ITEM,
  // not the top-level subscription object.
  const item = subscription.items.data[0];
  const priceId = item?.price.id ?? null;
  const periodEnd = item?.current_period_end ?? null;

  await updateUserSubscriptionByCustomerId(customerId, {
    stripeSubscriptionId: subscription.id,
    subscriptionStatus: subscription.status,
    subscriptionTier: tierFromPriceId(priceId),
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    trialEndsAt: subscription.trial_end
      ? new Date(subscription.trial_end * 1000)
      : null,
  });
}
