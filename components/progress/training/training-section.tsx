import { Lock } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { User } from "@/lib/db/schema";
import { getTrainingAnalytics } from "@/lib/workouts/training-data";
import { TrainingAnalyticsView } from "./training-analytics-view";

/**
 * PROGRESS > TRAINING section (FIX-33, P56-B). Mounted by the P56-A route
 * shell per the published mount contract: server component, guaranteed
 * authenticated + terms-accepted + canAccessChad, NOT guaranteed Pro. The
 * shell owns page chrome (PageShell, header, back link, Toaster); this owns
 * everything below the header.
 *
 * One data assembly (lib/workouts/training-data.ts getTrainingAnalytics)
 * computes every displayed number over canonicalized workout history, so
 * records and trends deduplicate across exercise aliases (FIX-34 wired).
 */
export async function TrainingSection({
  user,
  isPro,
}: {
  user: User;
  isPro: boolean;
}) {
  // Locked is a designed teaser, never a redirect and never an error tone
  // (FIX-11 / data-state law). A locked member's data is never fetched.
  if (!isPro) {
    return <TrainingLocked />;
  }

  const data = await getTrainingAnalytics(user);
  return <TrainingAnalyticsView data={data} />;
}

/** Exported for the fixture harness (the locked specimen must be THIS
 *  treatment, never a lookalike that can drift). */
export function TrainingLocked() {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-border border-dashed px-6 py-12 text-center">
      <Lock aria-hidden className="size-6 text-muted-foreground" />
      <h2 className="font-medium text-lg">
        Training analytics are a Pro feature
      </h2>
      <p className="max-w-md text-body text-muted-foreground">
        Upgrade to Pro and this page tracks your training frequency, volume,
        strength trends, personal records, and milestones, computed from
        every workout you log.
      </p>
      <Button asChild className="mt-2">
        <Link href="/account">Upgrade to Pro</Link>
      </Button>
    </div>
  );
}
