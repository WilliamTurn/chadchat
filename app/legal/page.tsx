import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/app/(auth)/auth";
import { LegalGateForm } from "@/components/legal/legal-gate-form";
import { getUserById } from "@/lib/db/queries";

/**
 * Legal acceptance interstitial (BLK-4). Shown once to any signed-in member
 * whose acceptedTermsAt is null: accounts created before the gate existed and
 * Google signups (who never see the registration checkbox). Every product
 * page redirects here until they accept; accepting stamps the timestamp and
 * sends them to /home. Layout mirrors the /welcome wizard card.
 */
export default function LegalPage() {
  return (
    <main className="relative flex min-h-dvh w-full flex-col items-center justify-center overflow-hidden px-4 py-10">
      <div
        aria-hidden
        className="-translate-x-1/2 pointer-events-none absolute top-1/4 left-1/2 size-[520px] max-w-full rounded-full bg-blood/10 blur-3xl"
      />
      <Suspense fallback={<CardFallback />}>
        <LegalGate />
      </Suspense>
    </main>
  );
}

/** Matches the card's footprint so the screen doesn't reflow when it lands. */
function CardFallback() {
  return (
    <div className="relative z-10 h-[420px] w-full max-w-md animate-pulse rounded-2xl border border-border bg-card shadow-[var(--shadow-float)]" />
  );
}

async function LegalGate() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await getUserById(session.user.id);
  if (!user) {
    redirect("/login");
  }

  // Already accepted — never trap a member on this screen.
  if (user.acceptedTermsAt) {
    redirect("/home");
  }

  return (
    <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-float)] sm:p-8">
      <h1 className="font-semibold text-2xl tracking-tight">
        One thing before you train
      </h1>
      <p className="mt-2 text-muted-foreground text-sm leading-relaxed">
        Chad is an AI coach, not a doctor, and nothing here is medical advice.
        Check with a physician before starting any diet or exercise program,
        especially if you have a medical condition. Training and dietary
        changes carry inherent risks, and you take them on when you use Chad.
      </p>
      <p className="mt-3 text-muted-foreground text-sm leading-relaxed">
        Our{" "}
        <a
          className="text-foreground underline underline-offset-4"
          href="https://chadcoach.ai/terms"
          rel="noreferrer"
          target="_blank"
        >
          Terms of Service
        </a>{" "}
        and{" "}
        <a
          className="text-foreground underline underline-offset-4"
          href="https://chadcoach.ai/privacy"
          rel="noreferrer"
          target="_blank"
        >
          Privacy Policy
        </a>{" "}
        cover the full details, including billing and the 30-day guarantee.
      </p>
      <LegalGateForm />
    </div>
  );
}
