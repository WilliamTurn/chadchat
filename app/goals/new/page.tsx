import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/app/(auth)/auth";
import { GoalForm } from "@/components/goals/goal-form";
import { TodaySkeleton } from "@/components/dashboard/page-skeletons";
import { BackLink } from "@/components/nav/back-link";
import { PageShell } from "@/components/nav/page-shell";
import { canAccessChad } from "@/lib/admin";
import { getUserById } from "@/lib/db/queries";
import { loadGoalFormData } from "@/lib/goals/form-data";

/**
 * The dedicated goal-creation page (MOB-19): a real surface with room for the
 * type cards, the numbers, and the live pace check, replacing the cramped
 * dialog the old GoalEditor squeezed everything into.
 */
export default function NewGoalPage() {
  return (
    // Full-width desktop frame (LAY-1); the form lays itself out inside it.
    <PageShell active="/goals" className="max-w-[1500px]">
      <div className="mb-8">
        <BackLink href="/goals" label="Goals" />
        <h1 className="font-semibold text-2xl tracking-tight">New goal</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Set exactly what you want to achieve and by when. Chad reads this
          in every chat and holds you to it.
        </p>
      </div>

      <Suspense fallback={<TodaySkeleton />}>
        <NewGoalContent />
      </Suspense>
    </PageShell>
  );
}

async function NewGoalContent() {
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

  const data = await loadGoalFormData(user);

  return (
    <GoalForm
      currentWeight={data.currentWeight}
      defaultUnit={data.defaultUnit}
      exerciseNames={data.exerciseNames}
      liftE1rm={data.liftE1rm}
      mode="create"
    />
  );
}
