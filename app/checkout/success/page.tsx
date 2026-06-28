import { redirect } from "next/navigation";
import type { ReactElement } from "react";
import { Suspense } from "react";
import { auth } from "@/app/(auth)/auth";
import { CheckoutCelebration } from "@/components/billing/checkout-celebration";
import { getStripe } from "@/lib/stripe";
import { syncSubscriptionToDb } from "@/lib/stripe-sync";

/**
 * Post-checkout landing page. Stripe sends a paid customer here with the
 * Checkout Session id. We retrieve that session and sync the subscription into
 * our DB *synchronously* before showing them the celebration, so when they tap
 * "Open Chad" they aren't bounced back to /pricing during the (often
 * multi-second) window before the `customer.subscription.created` webhook
 * lands. The webhook remains the backstop if this sync fails.
 *
 * This route lives OUTSIDE the (chat) group on purpose — its layout enforces
 * the paywall, which would redirect the just-paid user before we could sync.
 */
export default function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  return (
    <Suspense fallback={<SettingUp />}>
      <SyncAndCelebrate searchParams={searchParams} />
    </Suspense>
  );
}

function SettingUp() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-foreground" />
      <p className="text-muted-foreground">Setting up your account…</p>
    </main>
  );
}

async function SyncAndCelebrate({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}): Promise<ReactElement> {
  const [session, params] = await Promise.all([auth(), searchParams]);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const sessionId = params.session_id;
  if (sessionId) {
    try {
      const checkout = await getStripe().checkout.sessions.retrieve(sessionId, {
        expand: ["subscription"],
      });
      const subscription = checkout.subscription;
      // Only sync if this checkout actually belongs to the signed-in user.
      if (
        checkout.client_reference_id === session.user.id &&
        subscription &&
        typeof subscription !== "string"
      ) {
        await syncSubscriptionToDb(subscription);
      }
    } catch (error) {
      // Non-fatal: the Stripe webhook is still the source of truth. Don't trap
      // the user on an error screen — they paid; the webhook backstops the sync.
      console.error("[checkout/success] sync failed:", error);
    }
  }

  return <CheckoutCelebration />;
}
