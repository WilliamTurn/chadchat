import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/app/(auth)/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getUserById } from "@/lib/db/queries";
import { PLANS } from "@/lib/stripe";
import { hasActiveAccess } from "@/lib/subscription";
import { openBillingPortal } from "./actions";

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
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-semibold text-2xl tracking-tight">
          Your membership
        </h1>
        <Button asChild size="sm" variant="ghost">
          <Link href="/">Back to Chad</Link>
        </Button>
      </div>

      <Suspense
        fallback={
          <div className="h-40 animate-pulse rounded-2xl border border-border bg-card" />
        }
      >
        <MembershipCard />
      </Suspense>

      <p className="mt-6 text-center text-muted-foreground text-xs">
        Billing is handled securely by Stripe. Update your card, switch plans, or
        cancel anytime from the billing page.
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
  const status = user.subscriptionStatus;

  // Friendly, retention-minded status line.
  let statusLine: string;
  if (status === "trialing") {
    statusLine = `Free trial — your first charge is on ${formatDate(user.trialEndsAt ?? user.currentPeriodEnd)}.`;
  } else if (status === "active" && user.cancelAtPeriodEnd) {
    statusLine = `Active until ${formatDate(user.currentPeriodEnd)}. We'd love to keep training with you — you can resume anytime before then.`;
  } else if (status === "active") {
    statusLine = `Active — renews on ${formatDate(user.currentPeriodEnd)}.`;
  } else if (status === "past_due") {
    statusLine =
      "There's a hiccup with your payment. Update your card to keep your access uninterrupted.";
  } else {
    statusLine = "You don't have an active plan right now.";
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="mb-3 flex items-center gap-3">
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
            <Button type="submit">Manage billing</Button>
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
  );
}
