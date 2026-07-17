import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/app/(auth)/auth";
import { TodaySkeleton } from "@/components/dashboard/page-skeletons";
import { BackToDashboard } from "@/components/nav/back-to-dashboard";
import { PageShell } from "@/components/nav/page-shell";
import { PlanScheduleSection } from "@/components/plans/plan-schedule-section";
import { PlanDoc } from "@/components/today/plan-doc";
import { canAccessChad } from "@/lib/admin";
import {
  getPlanSessionCompletions,
  resolvePlanScheduleView,
} from "@/lib/db/plan-goal-queries";
import { getPlanById, getUserById } from "@/lib/db/queries";
import { weeklyPlanAdherence } from "@/lib/plans/adherence";
import { type CompletionEvent, selectUpNextSession } from "@/lib/plans/up-next";
import { weekAnchors } from "@/lib/today/week";

/**
 * The full-page plan document (R2-9): a training or diet plan rendered as rich
 * markdown on its own page instead of a cramped dialog, following the
 * meal-plan page pattern. Owner-scoped; anyone else's id is a 404.
 */

export default function PlanDocPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <PageShell active="/today">
      {/* usePathname inside the header is runtime data on a dynamic route, so
          it needs its own Suspense boundary under Cache Components. */}
      <Suspense fallback={null}>
      </Suspense>

      <div className="mb-8">
        <BackToDashboard />
        <h1 className="font-semibold text-2xl tracking-tight">Plan</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          The full document, exactly as you and Chad wrote it.
        </p>
      </div>

      <Suspense fallback={<TodaySkeleton />}>
        <PlanDocContent params={params} />
      </Suspense>
    </PageShell>
  );
}

async function PlanDocContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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

  const { id } = await params;
  const plan = await getPlanById({ id, userId: user.id });
  if (!plan) {
    notFound();
  }

  // FIX-28: the one resolved schedule (adapter over structured rows, legacy
  // days json, or document-only fallback; DEC-06) plus its completion events
  // power the schedule section. The raw document below always renders.
  const scheduleView = await resolvePlanScheduleView(plan);
  const completions: CompletionEvent[] =
    scheduleView.kind === "structured"
      ? (
          await getPlanSessionCompletions({ planId: plan.id, userId: user.id })
        ).map((c) => ({
          planSessionId: c.planSessionId,
          completedDayMs: c.completedDay.getTime(),
        }))
      : [];
  const weekStartMs = weekAnchors(user.timezone).days[0].getTime();
  const adherence =
    scheduleView.kind === "document"
      ? null
      : weeklyPlanAdherence({
          schedule: scheduleView.schedule,
          completions,
          weekStartMs,
          weekEndMs: weekStartMs + 7 * 24 * 60 * 60 * 1000,
        });
  const upNext =
    scheduleView.kind === "document"
      ? null
      : selectUpNextSession(scheduleView.schedule, completions);

  return (
    <div className="flex flex-col gap-6">
      <PlanScheduleSection
        adherence={adherence}
        completions={completions}
        upNext={upNext}
        view={scheduleView}
      />
      <PlanDoc
        plan={{
          id: plan.id,
          title: plan.title,
          detail: plan.detail,
          kind: plan.kind,
          status: plan.status,
        }}
      />
    </div>
  );
}
