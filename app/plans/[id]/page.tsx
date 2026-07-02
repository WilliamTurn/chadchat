import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { auth } from "@/app/(auth)/auth";
import { TodaySkeleton } from "@/components/dashboard/page-skeletons";
import { BackToDashboard } from "@/components/nav/back-to-dashboard";
import { PageShell } from "@/components/nav/page-shell";
import { StandaloneHeader } from "@/components/nav/standalone-header";
import { PlanDoc } from "@/components/today/plan-doc";
import { canAccessChad } from "@/lib/admin";
import { getPlanById, getUserById } from "@/lib/db/queries";

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
        <StandaloneHeader active="/today" />
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
  if (!canAccessChad(user)) {
    redirect("/pricing");
  }

  const { id } = await params;
  const plan = await getPlanById({ id, userId: user.id });
  if (!plan) {
    notFound();
  }

  return (
    <PlanDoc
      plan={{
        id: plan.id,
        title: plan.title,
        detail: plan.detail,
        kind: plan.kind,
        status: plan.status,
      }}
    />
  );
}
