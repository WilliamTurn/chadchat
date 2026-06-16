import type { UsageWarning } from "@/lib/ai/entitlements";

/**
 * Warm, on-brand copy for the "approaching your daily limit" heads-up.
 *
 * Tone rules (see project memory): never scare with hard caps, always frame the
 * reset as soon + Chad as eager to continue, and keep a light Pro-positive nudge
 * — without ever implying the user is being nickel-and-dimed.
 */
export function usageWarningMessage(warning: UsageWarning): string {
  const { remaining, level, audience } = warning;
  const count = `${remaining} ${remaining === 1 ? "message" : "messages"}`;

  if (audience === "trial") {
    if (level === "almost") {
      return `Down to your last ${count} with Chad today — they refresh in 24h. Once your trial rolls into your plan, you'll have far more room to keep training.`;
    }
    return `You're really putting Chad through his paces — about ${count} left for today on your trial. Your plan kicks in soon with a lot more headroom.`;
  }

  // Basic members: keep it about the reset, with a light Pro nudge.
  if (level === "almost") {
    return `Just about ${count} left with Chad today — everything refreshes in 24h. Pro gives you the most room to keep the momentum going.`;
  }
  return `You've been grinding today — around ${count} left before your daily reset. Chad's back at full strength in 24h, or go Pro for the most headroom.`;
}
