import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { auth } from "@/app/(auth)/auth";
import { TodaySkeleton } from "@/components/dashboard/page-skeletons";
import { PageShell } from "@/components/nav/page-shell";
import { StandaloneHeader } from "@/components/nav/standalone-header";
import { QuitDateExperience } from "@/components/quit/quit-date-experience";
import { canAccessChad } from "@/lib/admin";
import { formatCalendarDay } from "@/lib/date";
import { getLatestQuitPrediction, getUserById } from "@/lib/db/queries";
import { parseQuitPredictionContent } from "@/lib/quit/content";

/**
 * The Quit Date (FEAT-21): Chad's on-the-record prediction of the exact day
 * this member quits. No standing prediction: the page runs The Autopsy (the
 * failure-history intake). Standing prediction: it shows The Verdict. Not
 * tier-gated; every member with access gets a date. Reached from the /today
 * card (deliberately not in the shared nav while NAV-35/VF-20 debate how many
 * icons the header can hold).
 */

export default function QuitDatePage() {
  return (
    <PageShell>
      <Toaster
        position="top-center"
        theme="system"
        toastOptions={{
          className:
            "!bg-card !text-foreground !border-border/50 !shadow-[var(--shadow-float)]",
        }}
      />

      <StandaloneHeader />

      <div className="mb-8 max-w-2xl">
        <h1 className="font-semibold text-2xl tracking-tight">
          The Quit Date
        </h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Chad reads your history of abandoned plans and names the exact day
          you quit this one. Your job is to prove him wrong.
        </p>
      </div>

      <Suspense fallback={<TodaySkeleton />}>
        <QuitDateContent />
      </Suspense>
    </PageShell>
  );
}

async function QuitDateContent() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await getUserById(session.user.id);
  if (!user) {
    redirect("/login");
  }
  // Legal gate (BLK-4): accept the Terms before using the product.
  if (!user.acceptedTermsAt) {
    redirect("/legal");
  }
  if (!canAccessChad(user)) {
    redirect("/pricing");
  }

  // Latest row regardless of status (FEAT-22): an active one is the standing
  // verdict; a resolved hit/beaten one keeps its verdict on screen with the
  // "run it back" path (a resolved prediction no longer blocks a new autopsy).
  const prediction = await getLatestQuitPrediction(user.id);
  const content = prediction
    ? parseQuitPredictionContent(prediction.content)
    : null;

  return (
    <div className="max-w-2xl">
      <QuitDateExperience
        initial={content}
        predictedAtLabel={
          prediction ? formatCalendarDay(prediction.predictedAt) : null
        }
        status={prediction?.status ?? null}
      />
    </div>
  );
}
