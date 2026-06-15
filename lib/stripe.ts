import "server-only";

import Stripe from "stripe";
import type { PlanTier } from "./subscription";

// Pinned to the API version this SDK (stripe@22) ships with. Pin explicitly so
// upgrading the package never silently changes API behavior.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: "2026-05-27.dahlia",
  typescript: true,
});

// Length of the free trial, in days. (Card is collected up front.)
export const TRIAL_DAYS = 3;

type PlanConfig = {
  tier: PlanTier;
  name: string;
  /** Stripe recurring Price id (set in env, created in the Stripe dashboard). */
  priceId: string;
  monthlyPriceLabel: string;
};

export const PLANS: Record<PlanTier, PlanConfig> = {
  basic: {
    tier: "basic",
    name: "Chad Basic",
    priceId: process.env.STRIPE_PRICE_BASIC ?? "",
    monthlyPriceLabel: "$19",
  },
  pro: {
    tier: "pro",
    name: "Chad Pro",
    priceId: process.env.STRIPE_PRICE_PRO ?? "",
    monthlyPriceLabel: "$39",
  },
};

/** Map a Stripe price id back to our internal tier. */
export function tierFromPriceId(priceId: string | null | undefined): PlanTier | null {
  if (!priceId) {
    return null;
  }
  if (priceId === PLANS.pro.priceId) {
    return "pro";
  }
  if (priceId === PLANS.basic.priceId) {
    return "basic";
  }
  return null;
}

/** Absolute base URL for building Stripe success/cancel/return URLs. */
export function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000")
  );
}
