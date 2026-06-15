/**
 * One-time (idempotent) Stripe setup: creates the Chad Basic ($19/mo) and
 * Chad Pro ($39/mo) products + recurring monthly prices in whatever Stripe
 * account STRIPE_SECRET_KEY points at. Safe to re-run — it reuses prices by
 * lookup_key instead of creating duplicates.
 *
 * Run with: pnpm stripe:setup
 */
import { config } from "dotenv";

config({ path: ".env.local" });

import Stripe from "stripe";

type PlanSpec = {
  tier: "basic" | "pro";
  name: string;
  description: string;
  amount: number; // in cents
  lookupKey: string;
};

const PLANS: PlanSpec[] = [
  {
    tier: "basic",
    name: "Chad Basic",
    description: "Your always-on AI fitness coach.",
    amount: 1900,
    lookupKey: "chad_basic_monthly",
  },
  {
    tier: "pro",
    name: "Chad Pro",
    description: "The complete Chad experience, including progress analysis.",
    amount: 3900,
    lookupKey: "chad_pro_monthly",
  },
];

async function main() {
  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) {
    console.error("✗ STRIPE_SECRET_KEY is missing in .env.local");
    process.exit(1);
  }
  if (!apiKey.startsWith("sk_test")) {
    console.warn(
      "⚠ This is NOT a test-mode key (sk_test_…). Proceeding anyway — make sure this is intentional."
    );
  }

  const stripe = new Stripe(apiKey, { apiVersion: "2026-05-27.dahlia" });
  const priceIds: Record<string, string> = {};

  for (const plan of PLANS) {
    const existing = await stripe.prices.list({
      lookup_keys: [plan.lookupKey],
      active: true,
      limit: 1,
    });

    if (existing.data.length > 0) {
      priceIds[plan.tier] = existing.data[0].id;
      console.log(`• Reusing ${plan.name}: ${existing.data[0].id}`);
      continue;
    }

    const product = await stripe.products.create({
      name: plan.name,
      description: plan.description,
      metadata: { chad_plan: plan.tier },
    });

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: plan.amount,
      currency: "usd",
      recurring: { interval: "month" },
      lookup_key: plan.lookupKey,
      metadata: { chad_plan: plan.tier },
    });

    priceIds[plan.tier] = price.id;
    console.log(`✓ Created ${plan.name}: ${price.id}`);
  }

  console.log("\n=== Copy these into .env.local ===");
  console.log(`STRIPE_PRICE_BASIC=${priceIds.basic}`);
  console.log(`STRIPE_PRICE_PRO=${priceIds.pro}`);
}

main().catch((error) => {
  console.error("Stripe setup failed:");
  console.error(error);
  process.exit(1);
});
