import "server-only";

import Stripe from "stripe";
import type { PlanTier } from "./subscription";

let cachedStripe: Stripe | null = null;

/**
 * Lazily create (and cache) the Stripe client. Done on first use rather than at
 * module load so a missing key never crashes the build — only an actual Stripe
 * call will surface a clear error. Pinned to the API version this SDK (stripe@22)
 * ships with so upgrading the package never silently changes behavior.
 */
export function getStripe(): Stripe {
  if (!cachedStripe) {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (!apiKey) {
      throw new Error("STRIPE_SECRET_KEY is not set.");
    }
    cachedStripe = new Stripe(apiKey, {
      apiVersion: "2026-05-27.dahlia",
      typescript: true,
    });
  }
  return cachedStripe;
}

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
    monthlyPriceLabel: "$29",
  },
  pro: {
    tier: "pro",
    name: "Chad Pro",
    priceId: process.env.STRIPE_PRICE_PRO ?? "",
    monthlyPriceLabel: "$39",
  },
  elite: {
    tier: "elite",
    name: "Chad Elite",
    // Not sold yet (ACC-17): no Stripe price exists until the owner creates it
    // and sets STRIPE_PRICE_ELITE. Until then Elite is grantable only via the
    // admin comp tool, and tierFromPriceId can never match (priceId is never
    // the empty string — the !priceId guard returns first).
    priceId: process.env.STRIPE_PRICE_ELITE ?? "",
    monthlyPriceLabel: "$59",
  },
};

/** Map a Stripe price id back to our internal tier. */
export function tierFromPriceId(priceId: string | null | undefined): PlanTier | null {
  if (!priceId) {
    return null;
  }
  if (priceId === PLANS.elite.priceId) {
    return "elite";
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
