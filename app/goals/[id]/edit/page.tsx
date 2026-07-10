import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { auth } from "@/app/(auth)/auth";
import { GoalForm } from "@/components/goals/goal-form";
import { TodaySkeleton } from "@/components/dashboard/page-skeletons";
import { BackToDashboard } from "@/components/nav/back-to-dashboard";
import { PageShell } from "@/components/nav/page-shell";
import { StandaloneHeader } from "@/components/nav/standalone-header";
import { canAccessChad } from "@/lib/admin";
import { getGoalById, getUserById } from "@/lib/db/queries";
import { loadGoalFormData } from "@/lib/goals/form-data";

/**
 * The dedicated goal-editing page (MOB-19), owner-scoped: anyone else's goal
 * id is a 404. Same full-width form as /goals/new, prefilled, plus status and
 * delete.
 */
export default function EditGoalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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
      {/* usePathname inside the header is runtime data on a dynamic route, so
          it needs its own Suspense boundary under Cache Components. */}
      <Suspense fallback={null}>
        <StandaloneHeader active="/goals" />
      </Suspense>

      {/* A form reads best as one centered column (the standard pro-app form
          layout), not content pinned to the left edge of a wide shell. */}
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-8">
          <BackToDashboard href="/goals" label="Goals" />
          <h1 className="font-semibold text-2xl tracking-tight">Edit goal</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Change anything: the wording, the numbers, the target date, the
            status.
          </p>
        </div>

        <Suspense fallback={<TodaySkeleton />}>
          <EditGoalContent params={params} />
        </Suspense>
      </div>
    </PageShell>
  );
}

async function EditGoalContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  const record = await getGoalById({ id, userId: user.id }).catch(() => null);
  if (!record) {
    notFound();
  }

  const data = await loadGoalFormData(user);

  return (
    <GoalForm
      currentWeight={data.currentWeight}
      defaultUnit={data.defaultUnit}
      exerciseNames={data.exerciseNames}
      goal={{
        id: record.id,
        title: record.title,
        detail: record.detail,
        targetDate: record.targetDate,
        status: record.status,
        metric: record.metric,
        metricRef: record.metricRef,
        startValue: record.startValue,
        currentValue: record.currentValue,
        targetValue: record.targetValue,
        unit: record.unit,
      }}
      liftE1rm={data.liftE1rm}
      mode="edit"
    />
  );
}
