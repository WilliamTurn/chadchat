import { Camera, Check, Sparkles, Zap } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/app/(auth)/auth";
import { StandaloneHeader } from "@/components/nav/standalone-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getUserById } from "@/lib/db/queries";
import { PLANS } from "@/lib/stripe";
import { hasActiveAccess } from "@/lib/subscription";
import { openBillingPortal, upgradeToPro } from "./actions";

function formatDate(date: Date | null): string {
  if (!date) {
    return "—";
  }
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function AccountPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-4 py-16">
      <StandaloneHeader active="/account" />

      <div className="mb-8">
        <h1 className="font-semibold text-2xl tracking-tight">
          Your membership
        </h1>
      </div>

      <Suspense
        fallback={
          <div className="h-40 animate-pulse rounded-2xl border border-border bg-card" />
        }
      >
        <MembershipCard />
      </Suspense>

      <p className="mt-6 text-center text-muted-foreground text-xs">
        Billing is handled securely by Stripe. Update your card, switch plans,
        or cancel anytime from the billing page.
      </p>
    </main>
  );
}

async function MembershipCard() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await getUserById(session.user.id);
  if (!user) {
    redirect("/login");
  }

  const hasAccess = hasActiveAccess(user);
  const tier = user.subscriptionTier;
  const planName = tier ? PLANS[tier].name : "No active plan";
  const priceLabel = tier ? PLANS[tier].monthlyPriceLabel : null;
  const status = user.subscriptionStatus;

  // A Basic member with live access who can move up to Pro. The upgrade itself
  // goes through Stripe's hosted plan-change flow (no second subscription).
  const canUpgrade = hasAccess && tier === "basic";

  // Friendly, retention-minded status line. We always surface the actual price
  // so a renewal never reads as a surprise charge.
  let statusLine: string;
  if (status === "trialing") {
    statusLine = `Free trial — your first charge${priceLabel ? ` of ${priceLabel}` : ""} is on ${formatDate(user.trialEndsAt ?? user.currentPeriodEnd)}.`;
  } else if (status === "active" && user.cancelAtPeriodEnd) {
    statusLine = `Active until ${formatDate(user.currentPeriodEnd)}. We'd love to keep training with you — you can resume anytime before then.`;
  } else if (status === "active") {
    statusLine = `${priceLabel ? `${priceLabel}/month · ` : ""}Renews on ${formatDate(user.currentPeriodEnd)}.`;
  } else if (status === "past_due") {
    statusLine =
      "There's a hiccup with your payment. Update your card to keep your access uninterrupted.";
  } else {
    statusLine = "You don't have an active plan right now.";
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <span className="font-medium text-lg">{planName}</span>
          {hasAccess && status === "trialing" && (
            <Badge variant="secondary">Free trial</Badge>
          )}
          {hasAccess && status === "active" && <Badge>Active</Badge>}
          {status === "past_due" && (
            <Badge variant="destructive">Payment needed</Badge>
          )}
        </div>

        <p className="text-muted-foreground text-sm">{statusLine}</p>

        <div className="mt-6 flex flex-wrap gap-3">
          {user.stripeCustomerId ? (
            <form action={openBillingPortal}>
              <Button
                type="submit"
                variant={canUpgrade ? "outline" : "default"}
              >
                Manage billing
              </Button>
            </form>
          ) : (
            <Button asChild>
              <Link href="/pricing">Choose a plan</Link>
            </Button>
          )}

          {hasAccess ? (
            <Button asChild variant="outline">
              <Link href="/">Open Chad</Link>
            </Button>
          ) : (
            <Button asChild variant="outline">
              <Link href="/pricing">See plans</Link>
            </Button>
          )}
        </div>
      </div>

      {canUpgrade && <UpgradeToProCard price={PLANS.pro.monthlyPriceLabel} />}
    </div>
  );
}

/**
 * The in-app upgrade path for Basic members. Without this, a Basic user who
 * comes to "manage their account" hits a dead end — the page only offered
 * "Manage billing" and "Open Chad", and nothing actually moved them to Pro.
 * The button posts to the `upgradeToPro` server action, which opens Stripe's
 * hosted plan-change flow (real proration, no duplicate subscription).
 */
function UpgradeToProCard({ price }: { price: string }) {
  const proPerks = [
    { icon: Camera, text: "Progress photo analysis — Chad reviews your form" },
    { icon: Sparkles, text: "Custom workout & nutrition plans built for you" },
    { icon: Zap, text: "Highest-priority access to Chad" },
  ];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-blood/40 bg-card p-6 ring-1 ring-blood/20">
      <div
        aria-hidden
        className="-right-12 -top-12 pointer-events-none absolute size-40 rounded-full bg-blood/20 blur-3xl"
      />
      <div className="relative">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-blood" />
          <h2 className="font-display font-bold text-lg tracking-tight">
            Upgrade to Chad Pro
          </h2>
        </div>
        <p className="mt-1.5 text-muted-foreground text-sm">
          Unlock everything Basic has, plus the features that make Chad a real
          coach — not just a chat.
        </p>

        <ul className="mt-4 flex flex-col gap-2.5">
          {proPerks.map((perk) => (
            <li className="flex items-start gap-2.5 text-sm" key={perk.text}>
              <Check className="mt-0.5 size-4 shrink-0 text-blood" />
              <span>{perk.text}</span>
            </li>
          ))}
        </ul>

        <form action={upgradeToPro}>
          <Button
            className="mt-5 w-full gap-1.5 sm:w-auto"
            size="lg"
            type="submit"
          >
            <Sparkles className="size-4" />
            Upgrade to Pro — {price}/month
          </Button>
        </form>
        <p className="mt-2.5 text-muted-foreground text-xs">
          You'll see the exact prorated amount before you confirm. Billed
          securely by Stripe · cancel anytime.
        </p>
      </div>
    </div>
  );
}
