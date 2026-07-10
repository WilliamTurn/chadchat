import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { auth } from "@/app/(auth)/auth";
import { GoalForm } from "@/components/goals/goal-form";
import { TodaySkeleton } from "@/components/dashboard/page-skeletons";
import { BackToDashboard } from "@/components/nav/back-to-dashboard";
import { PageShell } from "@/components/nav/page-shell";
import { StandaloneHeader } from "@/components/nav/standalone-header";
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
    <PageShell>
      <Toaster
        position="top-center"
        theme="system"
        toastOptions={{
          className:
            "!bg-card !text-foreground !border-border/50 !shadow-[var(--shadow-float)]",
        }}
      />
      <StandaloneHeader active="/goals" />

      {/* A form reads best as one centered column (the standard pro-app form
          layout), not content pinned to the left edge of a wide shell. */}
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-8">
          <BackToDashboard href="/goals" label="Goals" />
          <h1 className="font-semibold text-2xl tracking-tight">New goal</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Set exactly what you want to achieve and by when. Chad reads this
            in every chat and holds you to it.
          </p>
        </div>

        <Suspense fallback={<TodaySkeleton />}>
          <NewGoalContent />
        </Suspense>
      </div>
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
