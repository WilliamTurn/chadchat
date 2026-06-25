import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/app/(auth)/auth";
import { getStripe } from "@/lib/stripe";
import { syncSubscriptionToDb } from "@/lib/stripe-sync";

/**
 * Post-checkout landing page. Stripe sends a paid customer here with the
 * Checkout Session id. We retrieve that session and sync the subscription into
 * our DB *synchronously* before sending them into the app, so they aren't
 * bounced back to /pricing during the (often multi-second) window before the
 * `customer.subscription.created` webhook lands. The webhook remains the
 * backstop if this sync fails.
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
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-foreground" />
      <p className="text-muted-foreground">Setting up your account…</p>
      <Suspense fallback={null}>
        <SyncAndContinue searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function SyncAndContinue({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}): Promise<null> {
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
      // the user on an error screen — send them in and let the paywall decide.
      console.error("[checkout/success] sync failed:", error);
    }
  }

  redirect("/");
  // Unreachable (redirect throws); satisfies the component's ReactNode return.
  return null;
}
