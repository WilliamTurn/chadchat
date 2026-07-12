import "server-only";
import {
  setUserStripeCustomerId,
  updateUserSubscriptionById,
} from "@/lib/db/queries";
import type { User } from "@/lib/db/schema";
import { getStripe } from "@/lib/stripe";

/**
 * True when a Stripe error means the referenced object simply does not exist
 * for the API key in use: deleted in the dashboard, or created under a
 * different mode/account (e.g. a test-mode customer id hit with the live key).
 * Deterministic, never transient, so it is safe to recover from.
 */
export function isMissingStripeResource(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "resource_missing"
  );
}

/**
 * Returns a Stripe customer id that is guaranteed to exist for the current
 * API key, creating (and saving) one when the user has none yet.
 *
 * The critical case (ACC-29): a user row can carry a customer id Stripe no
 * longer recognizes; deleted in the dashboard, or written by a dev session
 * running test-mode keys against the shared database. Every checkout and
 * billing-portal call then fails with "No such customer", which dead-ends the
 * member on /pricing with nothing they can do. So a stored id is verified
 * first; if Stripe reports it missing or deleted, the stale subscription
 * snapshot is cleared (nothing in this Stripe account backs it, so the member
 * is genuinely unsubscribed, and keeping it would fake a "current plan" and
 * burn their free-trial eligibility) and a fresh customer is minted.
 */
export async function ensureStripeCustomer(
  userId: string,
  email: string,
  existing: User | undefined
): Promise<{ customerId: string; staleStateCleared: boolean }> {
  const stored = existing?.stripeCustomerId ?? null;
  let staleStateCleared = false;

  if (stored) {
    try {
      const customer = await getStripe().customers.retrieve(stored);
      if (!customer.deleted) {
        return { customerId: stored, staleStateCleared: false };
      }
    } catch (error) {
      if (!isMissingStripeResource(error)) {
        throw error;
      }
    }
    staleStateCleared = true;
  }

  const customer = await getStripe().customers.create({
    email: email || undefined,
    metadata: { userId },
  });

  if (staleStateCleared) {
    // The old customer (and with it any subscription) is gone from Stripe's
    // point of view, so reset the row to the truthful "never subscribed here"
    // state alongside the fresh customer id.
    await updateUserSubscriptionById(userId, {
      stripeCustomerId: customer.id,
      stripeSubscriptionId: null,
      subscriptionStatus: null,
      subscriptionTier: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      trialEndsAt: null,
    });
  } else {
    await setUserStripeCustomerId(userId, customer.id);
  }

  return { customerId: customer.id, staleStateCleared };
}
