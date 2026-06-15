import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { PricingPlans } from "@/components/billing/pricing-plans";
import { Button } from "@/components/ui/button";
import { getUserById } from "@/lib/db/queries";
import { hasActiveAccess } from "@/lib/subscription";

export default async function PricingPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await getUserById(session.user.id);
  const hasAccess = user ? hasActiveAccess(user) : false;

  return (
    <main className="flex min-h-dvh flex-col items-center px-4 py-16">
      <div className="mb-10 flex max-w-2xl flex-col items-center text-center">
        <h1 className="font-semibold text-3xl tracking-tight sm:text-4xl">
          Train with Chad
        </h1>
        <p className="mt-3 text-balance text-muted-foreground">
          Start your 3-day free trial today. Chad's in your corner from day one —
          cancel anytime, no hard feelings.
        </p>

        {hasAccess && (
          <div className="mt-6 flex items-center gap-3">
            <Button asChild>
              <Link href="/">Open Chad</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/account">Manage billing</Link>
            </Button>
          </div>
        )}
      </div>

      <PricingPlans currentTier={user?.subscriptionTier ?? null} />

      <p className="mt-8 max-w-md text-balance text-center text-muted-foreground text-xs">
        3 days free, then $19 or $39 per month. Cancel in a couple of clicks
        whenever you like.
      </p>
    </main>
  );
}
