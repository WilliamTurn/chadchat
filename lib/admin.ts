/**
 * Admin allowlist. Who may access the admin dashboard is controlled by the
 * ADMIN_EMAILS env var (comma-separated, case-insensitive). Keeping this in an
 * env var — not the database — means admin rights can never be granted by
 * editing a normal user row, and the list is identical to whatever is set in
 * the Vercel project for production.
 *
 * Example:  ADMIN_EMAILS=you@example.com,cofounder@example.com
 */

import { getEntitlements } from "@/lib/ai/entitlements";
import { hasActiveAccess, type PlanTier } from "@/lib/subscription";

/**
 * The admin dashboard's URL base. Deliberately an obscure, unguessable slug
 * (NAV-33) so the panel can't be found by accident or by probing `/admin` —
 * it is owner-only and never linked anywhere on the site. This MUST stay in
 * sync with the route folder name under `app/` (currently `app/ops-x9f2q7k3`).
 * To change it: rename that folder and update this one constant. Access is
 * additionally gated by the admin email allowlist and a passphrase (NAV-34).
 */
export const ADMIN_PATH = "/ops-x9f2q7k3";

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

/**
 * Elite-feature gate, admin-aware. Elite is additive on top of Pro (proactive
 * check-ins, the Sunday Report) — Pro keeps everything it has today. Requires
 * live access so a lapsed Elite subscription doesn't keep receiving outreach.
 */
export function canAccessEliteFeatures(
  user:
    | (AccessUser & { subscriptionTier: PlanTier | null })
    | null
    | undefined
): boolean {
  if (!user) {
    return false;
  }
  return (
    isAdminEmail(user.email) ||
    (user.subscriptionTier === "elite" && hasActiveAccess(user))
  );
}
