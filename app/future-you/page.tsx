import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { auth } from "@/app/(auth)/auth";
import { getLatestForecast } from "@/app/future-you/actions";
import { TodaySkeleton } from "@/components/dashboard/page-skeletons";
import { FutureYouExperience } from "@/components/future-you/future-you-experience";
import { BackToDashboard } from "@/components/nav/back-to-dashboard";
import { PageShell } from "@/components/nav/page-shell";
import { StandaloneHeader } from "@/components/nav/standalone-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { canAccessChad, canAccessProFeatures } from "@/lib/admin";
import { getActiveGoalsByUserId, getUserById } from "@/lib/db/queries";

/**
 * Future You (FEAT-29): the member submits 3-6 clear photos of themselves and
 * Chad generates photorealistic, dated projections of what they'll look like
 * at each checkpoint on the way to their active goal if they do the work,
 * plus one projection of where they land if they quit. Pro feature; needs an
 * active goal (the projection is computed FROM the goal math).
 */

// Generation runs via after() from the start action, INSIDE this invocation's
// lifetime: QC before the response plus parallel high-quality image edits
// after it (observed: single edits can run 4+ min). 300s cut a real run off,
// so this page gets the extended window.
export const maxDuration = 800;

export default function FutureYouPage() {
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

      <StandaloneHeader active="/future-you" />

      <div className="mb-8 max-w-2xl">
        <BackToDashboard />
        <div className="flex items-center gap-3">
          <h1 className="font-semibold text-2xl tracking-tight">Future You</h1>
          <Badge variant="secondary">Pro feature</Badge>
        </div>
        <p className="mt-1 text-muted-foreground text-sm">
          Send Chad clear photos of yourself today. From deep analysis of your
          photos, your goal, and your calculated pace, he shows you exactly
          what you&apos;ll look like at each dated checkpoint on the way to
          your goal, and where you land if you quit.
        </p>
      </div>

      <Suspense fallback={<TodaySkeleton />}>
        <FutureYouContent />
      </Suspense>
    </PageShell>
  );
}

async function FutureYouContent() {
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

  if (!canAccessProFeatures(user)) {
    return <UpgradePrompt />;
  }

  const activeGoals = await getActiveGoalsByUserId(user.id);
  // Projection math needs numbers when it can get them: prefer the active
  // weight goal, fall back to the newest active goal of any kind.
  const goal =
    activeGoals.find((g) => g.metric === "weight" && g.targetValue != null) ??
    activeGoals[0];

  if (!goal) {
    return <GoalGate />;
  }

  const forecast = await getLatestForecast();

  return (
    <div className="max-w-2xl">
      <FutureYouExperience
        goalId={goal.id}
        goalTitle={goal.title}
        initial={forecast}
      />
    </div>
  );
}

function UpgradePrompt() {
  return (
    <div className="max-w-2xl rounded-2xl border border-border bg-card p-8 text-center">
      <h2 className="font-medium text-lg">Future You is a Chad Pro feature</h2>
      <p className="mx-auto mt-2 max-w-md text-muted-foreground text-sm">
        Upgrade to Pro and see yourself at your goal before you get there:
        photos of you at every dated checkpoint, built from deep analysis of
        your own photos, your goal, and your calculated pace.
      </p>
      <Button asChild className="mt-5">
        <Link href="/account">Upgrade to Pro</Link>
      </Button>
    </div>
  );
}

function GoalGate() {
  return (
    <div className="max-w-2xl rounded-2xl border border-border bg-card p-8">
      <h2 className="font-medium text-lg">First, Chad needs your goal</h2>
      <p className="mt-2 text-muted-foreground text-sm">
        The forecast is computed from your goal: the target, the honest pace,
        and the dates. Without one, Chad has nothing real to project. Set your
        goal, then come back here with your photos.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button asChild>
          <Link href="/goals/new">Set your goal</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/goals">See your goals</Link>
        </Button>
      </div>
    </div>
  );
}
