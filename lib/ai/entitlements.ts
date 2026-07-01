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
// NOTE: these are *user messages* per rolling 24h (Chad's replies don't count).
const TRIAL_MAX_MESSAGES_PER_DAY = 50;

export const entitlementsByTier: Record<PlanTier, Entitlements> = {
  basic: {
    maxMessagesPerDay: 200,
    photoAnalysis: false,
    photoMessageCost: 5,
  },
  pro: {
    // Effectively "unlimited" — a silent fair-use backstop behind the Pro
    // "unlimited" promise. High enough no real user notices, low enough to
    // bound runaway abuse/cost.
    maxMessagesPerDay: 1000,
    photoAnalysis: true,
    photoMessageCost: 5,
  },
  elite: {
    // Elite ⊇ Pro everywhere: photoAnalysis true means every existing Pro gate
    // (canAccessProFeatures) passes for Elite with zero call-site changes.
    maxMessagesPerDay: 2000,
    photoAnalysis: true,
    photoMessageCost: 5,
  },
};

/**
 * A heads-up shown as the user nears their daily message cap, so they're never
 * surprised by the at-limit wall. `audience` lets the UI pick warm, on-brand
 * copy; active Pro members never get one (their cap is a silent fair-use
 * backstop behind the "unlimited" promise).
 */
export type UsageWarning = {
  /** Messages left in the current 24h window after this one. */
  remaining: number;
  /** "approaching" ≈ 80% used, "almost" ≈ 92% used. */
  level: "approaching" | "almost";
  /** Who's being warned, so the UI can tailor the nudge. */
  audience: "trial" | "basic";
};

// Fire a heads-up once when the user crosses each of these fractions of their
// cap. Two gentle nudges (not a per-message nag): an early one, then a final
// one. Tunable.
const WARN_APPROACHING = 0.8;
const WARN_ALMOST = 0.92;

/**
 * Decide whether to surface an "approaching limit" heads-up for this message.
 *
 * `used` is the count *including* the message being sent. Because usage climbs
 * by exactly one per user message, an equality check on each milestone fires it
 * exactly once per window — no server-side state needed, no repeated toasts.
 * Returns null when there's nothing to say (mid-window, at the limit already,
 * a tool-approval continuation, or an active Pro member).
 */
export function getUsageWarning(args: {
  used: number;
  limit: number;
  tier: PlanTier | null;
  status: string | null;
  isNewUserMessage: boolean;
}): UsageWarning | null {
  const { used, limit, status, isNewUserMessage } = args;
  const tier: PlanTier = args.tier ?? "basic";

  // Only real new user messages move the needle (skip tool-approval replays).
  if (!isNewUserMessage) {
    return null;
  }

  const trialing = status === "trialing";

  // Honor the Pro/Elite "unlimited" promise — never warn an active paid-up
  // member on those tiers.
  if ((tier === "pro" || tier === "elite") && !trialing) {
    return null;
  }

  const almostAt = Math.ceil(limit * WARN_ALMOST);
  const approachingAt = Math.ceil(limit * WARN_APPROACHING);

  let level: UsageWarning["level"] | null = null;
  if (used === almostAt) {
    level = "almost";
  } else if (used === approachingAt) {
    level = "approaching";
  }

  if (!level) {
    return null;
  }

  return {
    remaining: Math.max(limit - used, 0),
    level,
    audience: trialing ? "trial" : "basic",
  };
}

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
