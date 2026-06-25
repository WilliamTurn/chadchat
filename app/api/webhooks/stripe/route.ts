import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { syncSubscriptionToDb } from "@/lib/stripe-sync";

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
        await syncSubscriptionToDb(event.data.object);
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
