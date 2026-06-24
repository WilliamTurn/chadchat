/**
 * Admin allowlist. Who may access the /admin dashboard is controlled by the
 * ADMIN_EMAILS env var (comma-separated, case-insensitive). Keeping this in an
 * env var — not the database — means admin rights can never be granted by
 * editing a normal user row, and the list is identical to whatever is set in
 * the Vercel project for production.
 *
 * Example:  ADMIN_EMAILS=you@example.com,cofounder@example.com
 */

import { getEntitlements } from "@/lib/ai/entitlements";
import { hasActiveAccess, type PlanTier } from "@/lib/subscription";

/** The configured admin emails, normalized to lowercase. */
function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** True if this email is on the admin allowlist. */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) {
    return false;
  }
  return adminEmails().includes(email.trim().toLowerCase());
}

type AccessUser = {
  email: string | null;
  subscriptionStatus: string | null;
  currentPeriodEnd: Date | null;
};

/**
 * Paywall check, admin-aware. Admins are always comped — so the owner is never
 * trapped on /pricing or locked out of their own app — while everyone else
 * needs an active trial/subscription. Use this anywhere a user would otherwise
 * be redirected to /pricing.
 */
export function canAccessChad(user: AccessUser | null | undefined): boolean {
  if (!user) {
    return false;
  }
  return isAdminEmail(user.email) || hasActiveAccess(user);
}

/**
 * Pro-feature gate, admin-aware. Admins are treated as Pro so they can test
 * every feature (photo/meal analysis, dashboards); everyone else needs the Pro
 * entitlement.
 */
export function canAccessProFeatures(
  user:
    | (AccessUser & { subscriptionTier: PlanTier | null })
    | null
    | undefined
): boolean {
  if (!user) {
    return false;
  }
  return isAdminEmail(user.email) || getEntitlements(user).photoAnalysis;
}
