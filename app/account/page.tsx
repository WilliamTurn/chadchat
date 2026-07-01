import { Dumbbell, Salad, Scale, Sparkles, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { auth } from "@/app/(auth)/auth";
import { UnitPreference } from "@/components/account/unit-preference";
import { StandaloneHeader } from "@/components/nav/standalone-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { getUserById } from "@/lib/db/queries";
import { PRO_PERKS } from "@/lib/plans";
import { PLANS } from "@/lib/stripe";
import { hasActiveAccess, type PlanTier } from "@/lib/subscription";
import { cn } from "@/lib/utils";
import { openBillingPortal, upgradeToPro } from "./actions";

/** The top-accent color for the membership card, by status/tier (ACC-7). */
function accentForCard({
  isPastDue,
  tier,
}: {
  isPastDue: boolean;
  tier: PlanTier | null;
}): string {
  if (isPastDue) {
    return "bg-destructive";
  }
  if (tier === "pro") {
    return "bg-blood";
  }
  if (tier === "basic") {
    return "bg-muted-foreground/30";
  }
  return "bg-border";
}

/**
 * Loading placeholder that mirrors the real membership card's shape — accent
 * strip, plan-name + badge row, status line, and action buttons — instead of a
 * bare grey rectangle, so the page doesn't visibly reflow when data lands.
 */
function MembershipCardSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-float)]">
      <div className="absolute inset-x-0 top-0 h-1 bg-border" />
      <div className="mb-3 flex items-center gap-3">
        <div className="h-6 w-32 animate-pulse rounded-md bg-muted" />
        <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
      </div>
      <div className="h-4 w-64 max-w-full animate-pulse rounded bg-muted" />
      <div className="mt-6 flex gap-3">
        <div className="h-9 w-32 animate-pulse rounded-lg bg-muted" />
        <div className="h-9 w-28 animate-pulse rounded-lg bg-muted" />
      </div>
    </div>
  );
}

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
      <Toaster position="top-center" richColors theme="system" />
      <StandaloneHeader active="/account" />

      <div className="mb-8">
        <h1 className="font-semibold text-2xl tracking-tight">Account</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Your membership, preferences, and your data.
        </p>
      </div>

      <div className="flex flex-col gap-8">
        <section>
          <h2 className="mb-3 font-medium text-muted-foreground text-sm uppercase tracking-wide">
            Membership
          </h2>
          <Suspense fallback={<MembershipCardSkeleton />}>
            <MembershipCard />
          </Suspense>
          <p className="mt-4 text-muted-foreground text-xs">
            Billing is handled securely by Stripe. Update your card, switch
            plans, or cancel anytime from the billing page.
          </p>
        </section>

        <Suspense fallback={null}>
          <AccountSettings />
        </Suspense>
      </div>
    </main>
  );
}

/** Preferences + data export — the account table stakes beyond billing (ACC-13). */
async function AccountSettings() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const user = await getUserById(session.user.id);
  if (!user) {
    redirect("/login");
  }

  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const exports: { dataset: string; label: string; icon: typeof Scale }[] = [
    { dataset: "weighins", label: "Weigh-ins", icon: Scale },
    { dataset: "meals", label: "Calorie Tracker", icon: Salad },
    { dataset: "workouts", label: "Workouts", icon: Dumbbell },
  ];

  return (
    <>
      {/* Preferences */}
      <section>
        <h2 className="mb-3 font-medium text-muted-foreground text-sm uppercase tracking-wide">
          Preferences
        </h2>
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="font-medium text-sm">Units</h3>
              <p className="mt-1 text-muted-foreground text-sm">
                How your body weight shows across the app and the default for new
                weigh-ins.
              </p>
            </div>
            <UnitPreference initialUnit={user.weightUnit} />
          </div>
        </div>
      </section>

      {/* Your data */}
      <section>
        <h2 className="mb-3 font-medium text-muted-foreground text-sm uppercase tracking-wide">
          Your data
        </h2>
        <div className="rounded-2xl border border-border bg-card p-6">
          <h3 className="font-medium text-sm">Export</h3>
          <p className="mt-1 text-muted-foreground text-sm">
            Download your logged data as CSV — it's yours, take it anywhere.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {exports.map(({ dataset, label, icon: Icon }) => (
              <a
                className={cn(buttonVariants({ variant: "outline" }), "gap-2")}
                download
                href={`${basePath}/api/me/export?dataset=${dataset}`}
                key={dataset}
              >
                <Icon className="size-4" />
                {label}
              </a>
            ))}
          </div>
        </div>
      </section>
    </>
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

  // Revenue at risk: a past-due card is a failed payment one update away from a
  // churned member, so the card itself goes destructive-tinted (not just a faint
  // badge) and the primary action becomes a red "fix it now" button.
  const isPastDue = status === "past_due";

  // Tier-colored top accent so the membership card reads its status at a glance:
  // Pro = brand blood-red, Basic = a calm neutral, past-due = destructive.
  const accentClass = accentForCard({ isPastDue, tier });

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
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border p-6 shadow-[var(--shadow-float)]",
          isPastDue
            ? "border-destructive/50 bg-destructive/[0.06] ring-1 ring-destructive/20"
            : "border-border bg-card"
        )}
      >
        <div className={cn("absolute inset-x-0 top-0 h-1", accentClass)} />

        <div className="mb-3 flex flex-wrap items-center gap-3">
          <span className="font-medium text-lg">{planName}</span>
          {hasAccess && status === "trialing" && (
            <Badge variant="secondary">Free trial</Badge>
          )}
          {hasAccess && status === "active" && <Badge>Active</Badge>}
          {isPastDue && <Badge variant="destructive">Payment needed</Badge>}
        </div>

        <p
          className={cn(
            "text-sm",
            isPastDue
              ? "flex items-start gap-2 font-medium text-foreground"
              : "text-muted-foreground"
          )}
        >
          {isPastDue && (
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
          )}
          <span>{statusLine}</span>
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          {user.stripeCustomerId ? (
            <form action={openBillingPortal}>
              <Button
                type="submit"
                variant={
                  isPastDue ? "destructive" : canUpgrade ? "outline" : "default"
                }
              >
                {isPastDue ? "Update payment" : "Manage billing"}
              </Button>
            </form>
          ) : (
            <Button asChild>
              <Link href="/pricing">Choose a plan</Link>
            </Button>
          )}

          {hasAccess ? (
            <Button asChild variant="outline">
              <Link href="/today">Open Chad</Link>
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
          {PRO_PERKS.map(({ icon: Icon, label, soon }) => (
            <li className="flex items-start gap-2.5 text-sm" key={label}>
              <Icon className="mt-0.5 size-4 shrink-0 text-blood" />
              <span>
                {label}
                {soon && (
                  <span className="ml-1.5 text-muted-foreground text-xs">
                    (coming soon)
                  </span>
                )}
              </span>
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
