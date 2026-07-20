import { redirect } from "next/navigation";
import { Suspense } from "react";
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
 * /pricing, already onboarded → /home.
 */
export default function WelcomePage() {
  return (
    <main className="relative flex min-h-dvh w-full flex-col items-center justify-center overflow-hidden px-4 py-10">
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

  // Legal gate (BLK-4): accept the Terms before anything, onboarding included.
  if (!user.acceptedTermsAt) {
    redirect("/legal");
  }

  // Onboarding is a post-access step — you can't hand your stats to a coach you
  // haven't unlocked yet. Non-subscribers go choose a plan first.
  if (!canAccessChad(user)) {
    redirect("/pricing");
  }

  // Already done it — don't trap a returning member on the welcome screen.
  if (user.onboardedAt) {
    redirect("/home");
  }

  return (
    <>
      <OnboardingWizard
        initialName={user.name ?? ""}
        initialWeightUnit={user.weightUnit}
      />
      {/* First-use health disclaimer (BLK-4): the standard not-medical-advice
          line, shown once at the door before any coaching happens. */}
      <p className="relative z-10 mt-4 w-full max-w-md text-center text-muted-foreground text-xs leading-relaxed">
        Chad is an AI coach, not a doctor, and his guidance is not medical
        advice. Check with a physician before starting a new diet or training
        program. You train at your own risk.
      </p>
    </>
  );
}
