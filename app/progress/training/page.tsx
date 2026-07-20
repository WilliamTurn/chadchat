import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/app/(auth)/auth";
import { RewardProvider } from "@/components/dashboard/reward";
import { ProgressSkeleton } from "@/components/dashboard/page-skeletons";
import { BackLink } from "@/components/nav/back-link";
import { PageShell } from "@/components/nav/page-shell";
import { TrainingSection } from "@/components/progress/training/training-section";
import { Badge } from "@/components/ui/badge";
import { canAccessChad, canAccessProFeatures } from "@/lib/admin";
import { getUserById } from "@/lib/db/queries";

/**
 * FIX-33 mount (DEC-02): the Training category page under Progress. This
 * shell (P56-A territory) owns the route, chrome, and access gates; the
 * section content is `components/progress/training/training-section.tsx`
 * (P56-B territory). Mount contract published in the P5/P6 briefing log.
 */
export default function ProgressTrainingPage() {
  return (
    <PageShell active="/progress" className="max-w-[var(--container-content)]">
      <div className="mb-8">
        <BackLink href="/progress" label="Progress" />
        <div className="flex items-center gap-3">
          <h1 className="font-semibold text-2xl tracking-tight">Training</h1>
          {/* "Pro feature", not bare "Pro" (LC-13). */}
          <Badge variant="secondary">Pro feature</Badge>
        </div>
        <p className="mt-1 text-muted-foreground text-sm">
          Your training outcomes: frequency, volume, strength, records, and
          milestones.
        </p>
      </div>

      <Suspense fallback={<ProgressSkeleton />}>
        <TrainingContent />
      </Suspense>
    </PageShell>
  );
}

async function TrainingContent() {
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

  return (
    <RewardProvider haptics={user.hapticsEnabled} sound={user.soundEnabled}>
      <TrainingSection isPro={canAccessProFeatures(user)} user={user} />
    </RewardProvider>
  );
}
