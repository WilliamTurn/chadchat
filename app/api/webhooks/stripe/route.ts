import type Stripe from "stripe";
import { getUserByStripeCustomerId } from "@/lib/db/queries";
import { sendPaymentFailedEmail } from "@/lib/email/billing-emails";
import { getStripe } from "@/lib/stripe";
import { syncSubscriptionToDb } from "@/lib/stripe-sync";

// Note: this route relies on Node's crypto for Stripe signature verification.
// Next.js 16 route handlers default to the Node.js runtime (Edge is opt-in), and
// POST handlers are never cached, so no runtime/dynamic segment config is needed
// (and Cache Components disallows it anyway).

// The subscription.* events carry the full subscription object and are our
// source of truth for access — including the `past_due` status that a failed
// payment produces. invoice.payment_failed additionally drives the dunning
// email so a member whose renewal card fails is actually told to fix it.
const RELEVANT_EVENTS = new Set<string>([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_failed",
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
      case "invoice.payment_failed": {
        await handlePaymentFailed(event.data.object);
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

/**
 * A subscription invoice failed to charge (renewal card declined, etc). Stripe
 * has already moved the subscription to `past_due` via a subscription.updated
 * event, so access is handled elsewhere — here we just nudge the member to fix
 * their card. Every invoice in this app is a subscription invoice, so any
 * payment_failed is dunning-worthy.
 *
 * Email failures are swallowed (logged, not rethrown) so Stripe doesn't retry
 * the whole webhook — and re-send the email — just because Resend hiccuped.
 */
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : (invoice.customer?.id ?? null);

  if (!customerId) {
    return;
  }

  const user = await getUserByStripeCustomerId(customerId);
  const email = user?.email ?? invoice.customer_email;
  if (!email) {
    return;
  }

  try {
    await sendPaymentFailedEmail(email);
  } catch (error) {
    const message = error instanceof Error ? error.message : "send failed";
    console.error(
      `[stripe-webhook] dunning email failed for ${email}: ${message}`
    );
  }
}
