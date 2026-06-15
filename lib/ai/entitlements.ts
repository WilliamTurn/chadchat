import type { PlanTier } from "@/lib/subscription";

export type Entitlements = {
  /** Max user messages per rolling 24h window. */
  maxMessagesPerDay: number;
  /** Whether photo analysis is available (Pro-only). Feature not built yet. */
  photoAnalysis: boolean;
  /**
   * How many messages a single photo upload counts as, for cost control.
   * (Photos are far more expensive than text.) Wired in when photo analysis
   * ships; kept here so the limit model is ready for it.
   */
  photoMessageCost: number;
};

// Deliberately generous on paid plans and tighter on the free trial. These are
// high enough that real users rarely notice — they exist to stop abuse and
// bound API cost, not to nickel-and-dime. Safe to tune anytime.
const TRIAL_MAX_MESSAGES_PER_DAY = 20;

export const entitlementsByTier: Record<PlanTier, Entitlements> = {
  basic: {
    maxMessagesPerDay: 50,
    photoAnalysis: false,
    photoMessageCost: 5,
  },
  pro: {
    maxMessagesPerDay: 200,
    photoAnalysis: true,
    photoMessageCost: 5,
  },
};

/**
 * Resolve the effective limits for a user from their subscription tier +
 * status. During the free trial we keep the chosen tier's *features* but apply
 * a smaller daily message cap to bound cost.
 */
export function getEntitlements(user: {
  subscriptionTier: PlanTier | null;
  subscriptionStatus: string | null;
}): Entitlements {
  const tier: PlanTier = user.subscriptionTier ?? "basic";
  const base = entitlementsByTier[tier];

  if (user.subscriptionStatus === "trialing") {
    return { ...base, maxMessagesPerDay: TRIAL_MAX_MESSAGES_PER_DAY };
  }

  return base;
}
