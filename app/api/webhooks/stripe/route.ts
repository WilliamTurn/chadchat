import type Stripe from "stripe";
import { updateUserSubscriptionByCustomerId } from "@/lib/db/queries";
import { getStripe, tierFromPriceId } from "@/lib/stripe";

// Note: this route relies on Node's crypto for Stripe signature verification.
// Next.js 16 route handlers default to the Node.js runtime (Edge is opt-in), and
// POST handlers are never cached, so no runtime/dynamic segment config is needed
// (and Cache Components disallows it anyway).

// The subscription.* events carry the full subscription object and are our
// source of truth for access — including the `past_due` status that a failed
// payment produces. (A dedicated invoice.payment_failed hook can be added later
// for dunning emails.)
const RELEVANT_EVENTS = new Set<string>([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

/**
 * Writes the full current state of a Stripe subscription into our User row.
 * Idempotent: it always overwrites with the latest snapshot, so duplicate or
 * out-of-order webhook deliveries are safe.
 */
async function syncSubscription(subscription: Stripe.Subscription) {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  // Since the Basil API change, the period end lives on the subscription ITEM,
  // not the top-level subscription object.
  const item = subscription.items.data[0];
  const priceId = item?.price.id ?? null;
  const periodEnd = item?.current_period_end ?? null;

  await updateUserSubscriptionByCustomerId(customerId, {
    stripeSubscriptionId: subscription.id,
    subscriptionStatus: subscription.status,
    subscriptionTier: tierFromPriceId(priceId),
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    trialEndsAt: subscription.trial_end
      ? new Date(subscription.trial_end * 1000)
      : null,
  });
}

export async function POST(request: Request) {
  const body = await request.text(); // raw body — required for signature check
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return new Response("Webhook secret not configured", { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid payload";
    return new Response(`Webhook signature verification failed: ${message}`, {
      status: 400,
    });
  }

  if (!RELEVANT_EVENTS.has(event.type)) {
    return Response.json({ received: true });
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await syncSubscription(event.data.object);
        break;
      }
      default:
        break;
    }
  } catch (error) {
    // Returning 500 tells Stripe to retry the delivery later.
    const message = error instanceof Error ? error.message : "handler error";
    return new Response(`Webhook handler error: ${message}`, { status: 500 });
  }

  return Response.json({ received: true });
}
