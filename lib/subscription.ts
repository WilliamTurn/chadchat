/**
 * Pure subscription-access logic. No Stripe or DB imports, so this is safe to
 * use from both client and server components.
 */

export type PlanTier = "basic" | "pro";

// Raw Stripe subscription statuses that grant access to Chad.
// - trialing / active: full access.
// - past_due: dunning grace — Stripe is still retrying the card, so we keep
//   them in until Stripe gives up and moves them to canceled/unpaid.
const ACCESS_STATUSES = new Set(["trialing", "active", "past_due"]);

// Backstop grace: if a webhook is ever missed, we still cut access this long
// after the known period end (so a dropped "canceled" event can't grant
// free access forever).
const PERIOD_END_GRACE_MS = 24 * 60 * 60 * 1000; // 1 day

export type SubscriptionFields = {
  subscriptionStatus: string | null;
  currentPeriodEnd: Date | null;
};

/** Whether this user may currently use Chad (paywall check). */
export function hasActiveAccess(u: SubscriptionFields): boolean {
  const status = u.subscriptionStatus;

  if (!status || !ACCESS_STATUSES.has(status)) {
    return false;
  }

  // past_due stays in regardless of period end (active dunning).
  if (status === "past_due") {
    return true;
  }

  // trialing / active: honor the period end as a safety net against missed webhooks.
  if (
    u.currentPeriodEnd &&
    u.currentPeriodEnd.getTime() + PERIOD_END_GRACE_MS < Date.now()
  ) {
    return false;
  }

  return true;
}

/** True only while the user is in their free trial. */
export function isTrialing(u: { subscriptionStatus: string | null }): boolean {
  return u.subscriptionStatus === "trialing";
}

/**
 * Has this customer already used their one free trial? Every first subscription
 * in our flow starts with a trial, and the subscription id is kept even after a
 * cancellation, so any prior subscription means the trial is spent. Returning
 * customers therefore resubscribe and are charged immediately — no second free
 * trial per customer.
 */
export function hasUsedTrial(u: { stripeSubscriptionId: string | null }): boolean {
  return u.stripeSubscriptionId != null;
}
