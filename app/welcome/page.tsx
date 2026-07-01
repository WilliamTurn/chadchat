import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { auth } from "@/app/(auth)/auth";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { canAccessChad } from "@/lib/admin";
import { getUserById } from "@/lib/db/queries";

/**
 * First-run onboarding (ONB-1). New members land here once, right after they get
 * access, before their first real chat. They can fill in their stats (which get
 * handed straight to Chad as the opening message) or skip and onboard with Chad
 * conversationally. Either path stamps `onboardedAt`, so this page only ever
 * shows a member the wizard a single time.
 *
 * Gating mirrors the rest of the app: unauthenticated → /login, no access →
 * /pricing, already onboarded → /today.
 */
export default function WelcomePage() {
  return (
    <main className="relative flex min-h-dvh w-full flex-col items-center justify-center overflow-hidden px-4 py-10">
      <Toaster position="top-center" richColors theme="system" />
      {/* Soft brand glow behind the card so the first screen feels like Chad, not a form. */}
      <div
        aria-hidden
        className="-translate-x-1/2 pointer-events-none absolute top-1/4 left-1/2 size-[520px] max-w-full rounded-full bg-blood/10 blur-3xl"
      />
      <Suspense fallback={<WizardFallback />}>
        <WelcomeGate />
      </Suspense>
    </main>
  );
}

/** Matches the wizard card's footprint so the screen doesn't reflow when it lands. */
function WizardFallback() {
  return (
    <div className="relative z-10 h-[520px] w-full max-w-md animate-pulse rounded-2xl border border-border bg-card shadow-[var(--shadow-float)]" />
  );
}

async function WelcomeGate() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await getUserById(session.user.id);
  if (!user) {
    redirect("/login");
  }

  // Onboarding is a post-access step — you can't hand your stats to a coach you
  // haven't unlocked yet. Non-subscribers go choose a plan first.
  if (!canAccessChad(user)) {
    redirect("/pricing");
  }

  // Already done it — don't trap a returning member on the welcome screen.
  if (user.onboardedAt) {
    redirect("/today");
  }

  return (
    <OnboardingWizard
      initialName={user.name ?? ""}
      initialWeightUnit={user.weightUnit}
    />
  );
}
