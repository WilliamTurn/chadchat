import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { auth } from "@/app/(auth)/auth";
import { LogoutButton } from "@/components/billing/logout-button";
import { PricingPlans } from "@/components/billing/pricing-plans";
import { Button } from "@/components/ui/button";
import { getUserById } from "@/lib/db/queries";
import { hasActiveAccess, hasUsedTrial } from "@/lib/subscription";

export default function PricingPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center px-4 py-16">
      {/* Without this, sonner toasts (e.g. a checkout error) never render
          because /pricing lives outside the (chat) layout that mounts one —
          which made a failed checkout look like a "dead" button. */}
      <Toaster
        position="top-center"
        theme="system"
        toastOptions={{
          className:
            "!bg-card !text-foreground !border-border/50 !shadow-[var(--shadow-float)]",
        }}
      />
      {/* Escape hatch: a logged-in member with no active plan would otherwise be
          stranded here (every app route redirects back to /pricing). The logo
          goes to the marketing site; signed-in users can also log out. */}
      <header className="mb-12 flex w-full max-w-5xl items-center justify-between">
        <a
          className="font-semibold text-lg tracking-tight"
          href="https://chadcoach.ai"
        >
          Chad
        </a>
        <Suspense fallback={null}>
          <AccountControls />
        </Suspense>
      </header>

      <div className="mb-10 flex max-w-2xl flex-col items-center text-center">
        <h1 className="font-semibold text-3xl tracking-tight sm:text-4xl">
          Train with Chad
        </h1>
        <p className="mt-3 text-balance text-muted-foreground">
          Start your 3-day free trial today. Chad's in your corner from day one —
          cancel anytime, no hard feelings.
        </p>
      </div>

      <Suspense
        fallback={
          <div className="grid w-full max-w-3xl gap-5 sm:grid-cols-2">
            <div className="h-80 animate-pulse rounded-2xl border border-border bg-card" />
            <div className="h-80 animate-pulse rounded-2xl border border-border bg-card" />
          </div>
        }
      >
        <PricingContent />
      </Suspense>

      <p className="mt-8 max-w-md text-balance text-center text-muted-foreground text-xs">
        3 days free, then $29 or $39 per month. Cancel in a couple of clicks
        whenever you like.
      </p>
    </main>
  );
}

async function AccountControls() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return (
      <Button asChild size="sm" variant="ghost">
        <Link href="/login">Sign in</Link>
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className="hidden text-muted-foreground text-sm sm:inline">
        Signed in as {email}
      </span>
      <LogoutButton />
    </div>
  );
}

async function PricingContent() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await getUserById(session.user.id);
  const hasAccess = user ? hasActiveAccess(user) : false;
  // A returning customer already has a Stripe customer record (their card,
  // history, and — if cancelled/lapsed — a subscription they can restart).
  const isReturningCustomer = user?.stripeCustomerId != null;
  const alreadyTrialed = user
    ? hasUsedTrial({ stripeSubscriptionId: user.stripeSubscriptionId })
    : false;

  return (
    <>
      {hasAccess && (
        <div className="mb-8 flex items-center gap-3">
          <Button asChild>
            <Link href="/">Open Chad</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/account">Manage billing</Link>
          </Button>
        </div>
      )}
      {!hasAccess && isReturningCustomer && (
        <div className="mb-8 flex flex-col items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/account">Manage billing & payment</Link>
          </Button>
          <p className="max-w-sm text-balance text-center text-muted-foreground text-xs">
            Already a member before? Update your card or pick up where you left
            off from your billing page.
          </p>
        </div>
      )}
      <PricingPlans
        alreadyTrialed={alreadyTrialed}
        currentTier={user?.subscriptionTier ?? null}
      />
    </>
  );
}
