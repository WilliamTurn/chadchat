import { Ban, Dumbbell, ShieldCheck, Star } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { auth } from "@/app/(auth)/auth";
import { LogoutButton } from "@/components/billing/logout-button";
import { PricingPlans } from "@/components/billing/pricing-plans";
import { Button } from "@/components/ui/button";
import { getUserById } from "@/lib/db/queries";
import {
  hasActiveAccess,
  hasUsedTrial,
  type PlanTier,
} from "@/lib/subscription";

/** Validate the landing funnel's `?plan=` param (ACC-20). */
function parsePlanParam(raw: string | undefined): PlanTier | null {
  return raw === "basic" || raw === "pro" || raw === "elite" ? raw : null;
}

export default function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
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
      <header className="mb-12 flex w-full max-w-5xl items-center justify-between">
        <Suspense fallback={<LogoMark />}>
          <HeaderLogo />
        </Suspense>
        <Suspense fallback={null}>
          <AccountControls />
        </Suspense>
      </header>

      <div className="mb-6 flex max-w-2xl flex-col items-center text-center">
        <h1 className="font-semibold text-3xl tracking-tight sm:text-4xl">
          Train with Chad
        </h1>
        <p className="mt-3 text-balance text-muted-foreground">
          Start your 3-day free trial today. Chad's in your corner from day one —
          cancel anytime, no hard feelings.
        </p>
      </div>

      <TrustStrip />

      <Suspense
        fallback={
          <div className="grid w-full max-w-5xl gap-5 md:grid-cols-3">
            <div className="h-80 animate-pulse rounded-2xl border border-border bg-card" />
            <div className="h-80 animate-pulse rounded-2xl border border-border bg-card" />
            <div className="h-80 animate-pulse rounded-2xl border border-border bg-card" />
          </div>
        }
      >
        <PricingContent searchParams={searchParams} />
      </Suspense>

      <p className="mt-8 max-w-md text-balance text-center text-muted-foreground text-xs">
        3 days free, then $29, $39, or $59 per month depending on your plan.
        Cancel in a couple of clicks whenever you like.
      </p>
    </main>
  );
}

/**
 * Thin trust strip under the headline — the conversion table-stakes a pricing
 * page is expected to carry: a "your card is safe" signal (Stripe), the
 * risk-reversal (cancel anytime), and social proof (stars). Kept deliberately
 * quiet (xs, muted) so it reassures without competing with the plan cards.
 */
function TrustStrip() {
  return (
    <div className="mb-10 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-muted-foreground text-xs">
      <span className="flex items-center gap-1.5">
        <ShieldCheck className="size-3.5" />
        Secured by Stripe
      </span>
      <span className="flex items-center gap-1.5">
        <Ban className="size-3.5" />
        Cancel anytime
      </span>
      <span className="flex items-center gap-1.5">
        <span className="flex items-center gap-0.5 text-amber-500">
          {[0, 1, 2, 3, 4].map((i) => (
            <Star className="size-3.5 fill-current" key={i} />
          ))}
        </span>
        Loved by lifters
      </span>
    </div>
  );
}

/** The CHAD wordmark by itself; also the logo's brief loading fallback. */
function LogoMark() {
  return (
    <span className="flex shrink-0 items-center gap-2">
      <span className="flex size-7 items-center justify-center rounded-lg bg-muted/60 ring-1 ring-border/50">
        <Dumbbell className="text-blood" size={14} strokeWidth={2.5} />
      </span>
      <span className="font-display font-bold text-[15px] tracking-[0.14em]">
        CHAD
      </span>
    </span>
  );
}

/**
 * The header logo. A signed-in member's logo ALWAYS stays inside the app
 * (owner order, ACC-29: it must never dump them onto the logged-out marketing
 * site): /today for members with access; without access /today bounces right
 * back here, which keeps them on the page that can actually fix their plan.
 * Only logged-out visitors go to the marketing site.
 */
async function HeaderLogo() {
  const session = await auth();
  if (session?.user?.id) {
    return (
      <Link aria-label="Chad — home" href="/today">
        <LogoMark />
      </Link>
    );
  }
  return (
    <a aria-label="Chad — home" href="https://chadcoach.ai">
      <LogoMark />
    </a>
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

async function PricingContent({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
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

  // The plan chosen on the landing page (ACC-20): send a member-to-be straight
  // into that plan's checkout instead of making them re-decide here. Only for
  // users without live access — an existing member changes plans via billing.
  const { plan } = await searchParams;
  const autostartTier = hasAccess ? null : parsePlanParam(plan);

  return (
    <>
      {hasAccess && (
        <div className="mb-8 flex items-center gap-3">
          <Button asChild>
            <Link href="/today">Open Chad</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/account">Manage billing</Link>
          </Button>
        </div>
      )}
      {/* alreadyTrialed keeps this to genuinely lapsed members: a row the
          stale-customer heal reset reads as a fresh start, and "Welcome back"
          next to "Start free trial" cards would contradict itself. */}
      {!hasAccess && isReturningCustomer && alreadyTrialed && (
        <div className="mb-8 flex flex-col items-center gap-2">
          <p className="max-w-md text-balance text-center text-sm">
            Welcome back. Your plan is not active right now. Pick a plan below
            and Chad picks up right where you left off.
          </p>
          <Button asChild size="sm" variant="outline">
            <Link href="/account">Manage billing & payment</Link>
          </Button>
        </div>
      )}
      {/* Only a plan the member can USE today is "current". A lapsed tier must
          never gray out its card (the ACC-29 trap: the dead plan was disabled,
          so a stuck member could not click ANY working action on the page). */}
      <PricingPlans
        alreadyTrialed={alreadyTrialed}
        autostartTier={autostartTier}
        currentTier={hasAccess ? (user?.subscriptionTier ?? null) : null}
      />
    </>
  );
}
