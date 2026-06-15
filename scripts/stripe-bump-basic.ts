/**
 * One-off migration: raise Chad Basic from $19/mo to $29/mo.
 *
 * Stripe prices are immutable, so we can't edit the existing $19 price. Instead
 * we create a NEW $29 monthly price on the SAME Basic product, move the
 * `chad_basic_monthly` lookup key onto it (transfer_lookup_key), and archive the
 * old $19 price so it can no longer be used for new checkouts. Existing
 * subscribers on the old price keep their price until they change plans — that's
 * normal Stripe behavior and intentional.
 *
 * Safe to re-run: if Basic is already $29 it does nothing.
 *
 * Run with: pnpm tsx scripts/stripe-bump-basic.ts
 */
import { config } from "dotenv";

config({ path: ".env.local" });

import Stripe from "stripe";

const NEW_AMOUNT = 2900; // $29.00 in cents
const LOOKUP_KEY = "chad_basic_monthly";

async function main() {
  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) {
    console.error("✗ STRIPE_SECRET_KEY is missing in .env.local");
    process.exit(1);
  }
  console.log(
    apiKey.startsWith("sk_test")
      ? "• Using TEST-mode key."
      : "⚠ Using a LIVE key — this will change real billing prices."
  );

  const stripe = new Stripe(apiKey, { apiVersion: "2026-05-27.dahlia" });

  // Find the current Basic price by lookup key.
  const existing = await stripe.prices.list({
    lookup_keys: [LOOKUP_KEY],
    active: true,
    limit: 1,
  });

  if (existing.data.length === 0) {
    console.error(
      `✗ No active price found with lookup_key "${LOOKUP_KEY}". Run "pnpm stripe:setup" first.`
    );
    process.exit(1);
  }

  const oldPrice = existing.data[0];
  const productId =
    typeof oldPrice.product === "string" ? oldPrice.product : oldPrice.product.id;

  if (oldPrice.unit_amount === NEW_AMOUNT) {
    console.log(`• Basic is already $${NEW_AMOUNT / 100}/mo (${oldPrice.id}). Nothing to do.`);
    console.log(`STRIPE_PRICE_BASIC=${oldPrice.id}`);
    return;
  }

  console.log(
    `• Current Basic: ${oldPrice.id} = $${(oldPrice.unit_amount ?? 0) / 100}/mo (product ${productId})`
  );

  // Create the new $29 price on the same product and steal the lookup key.
  const newPrice = await stripe.prices.create({
    product: productId,
    unit_amount: NEW_AMOUNT,
    currency: "usd",
    recurring: { interval: "month" },
    lookup_key: LOOKUP_KEY,
    transfer_lookup_key: true,
    metadata: { chad_plan: "basic" },
  });
  console.log(`✓ Created new Basic price: ${newPrice.id} = $${NEW_AMOUNT / 100}/mo`);

  // Archive the old price so it can't be used for new checkouts.
  await stripe.prices.update(oldPrice.id, { active: false });
  console.log(`✓ Archived old price ${oldPrice.id}`);

  console.log("\n=== Update .env.local (and Vercel env later) ===");
  console.log(`STRIPE_PRICE_BASIC=${newPrice.id}`);
}

main().catch((error) => {
  console.error("Stripe bump failed:");
  console.error(error);
  process.exit(1);
});
