import { ChefHat, Lock } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { auth } from "@/app/(auth)/auth";
import { TodaySkeleton } from "@/components/dashboard/page-skeletons";
import { BackToDashboard } from "@/components/nav/back-to-dashboard";
import { PageShell } from "@/components/nav/page-shell";
import { ModuleCard, ModuleHeader } from "@/components/today/module-card";
import { PlanList } from "@/components/today/plan-list";
import { Button } from "@/components/ui/button";
import { canAccessChad, canAccessProFeatures } from "@/lib/admin";
import {
  getActiveMealPlanByUserId,
  getActivePlansByUserId,
  getInactivePlansByUserId,
  getUserById,
  getUserMemory,
} from "@/lib/db/queries";
import { clientField } from "@/lib/memory/client-field";

/**
 * The plans index (P56-E, FIX-30). Plan MANAGEMENT relocated off /today per
 * the 03-spec ("plan edit/delete controls move to plan detail"; capabilities
 * are relocated, never silently removed): the same PlanList the dashboard
 * carried, verbatim: active plans, add, edit, delete, past plans with
 * one-tap reactivate, and the memory-plan hint. /today now shows the
 * Training-today summary and links here.
 */
export default function PlansPage() {
  return (
    <PageShell active="/plans" className="max-w-[var(--container-content)]">
      <Toaster
        position="top-center"
        theme="system"
        toastOptions={{
          className:
            "!bg-card !text-foreground !border-border/50 !shadow-[var(--shadow-float)]",
        }}
      />

      <div className="mb-8">
        <BackToDashboard />
        <h1 className="font-semibold text-2xl tracking-tight">All plans</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Every plan document you have saved: your current training and diet
          write-ups, your past plans, and the tools to add, edit, or bring
          one back. Your structured meal plan lives on its own Meal plan
          page, linked beside them.
        </p>
      </div>

      <Suspense fallback={<TodaySkeleton />}>
        <PlansContent />
      </Suspense>
    </PageShell>
  );
}

async function PlansContent() {
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

  const isPro = canAccessProFeatures(user);
  const [plans, pastPlans, memory, mealPlan] = await Promise.all([
    getActivePlansByUserId(user.id),
    getInactivePlansByUserId(user.id),
    getUserMemory(user.id),
    isPro ? getActiveMealPlanByUserId(user.id) : Promise.resolve(null),
  ]);

  const toPlanItem = (p: (typeof plans)[number]) => ({
    id: p.id,
    title: p.title,
    detail: p.detail,
    kind: p.kind,
    status: p.status,
  });

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
      <ModuleCard glow="blood">
        <PlanList
          memoryPlanHint={clientField(
            memory?.profile ?? null,
            "Current workout plan"
          )}
          pastPlans={pastPlans.map(toPlanItem)}
          plans={plans.map(toPlanItem)}
        />
      </ModuleCard>

      {/* The structured meal plan's pointer card: it is a different object
          (MealPlan, owned by /meal-plan) than the free-text plan documents
          above, and members look for it here (P56-E live-verification
          finding 2). One named destination, no management duplicated. */}
      <ModuleCard glow="amber">
        <ModuleHeader
          icon={<ChefHat className="size-4" />}
          title="Meal plan"
          tone="amber"
          viewHref="/meal-plan"
          viewLabel="Open meal plan"
        />
        {isPro ? (
          <div className="flex flex-1 flex-col justify-center gap-2">
            {mealPlan ? (
              <>
                <p className="font-display font-semibold text-lg leading-tight">
                  {mealPlan.title}
                </p>
                <p className="text-muted-foreground text-sm">
                  {Array.isArray(mealPlan.days) ? mealPlan.days.length : 0}
                  -day structured plan with exact foods and portions. Days,
                  meals, swaps, and edits live on the Meal plan page.
                </p>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">
                No meal plan yet. Chad builds a structured plan around your
                macro target on the Meal plan page. Real foods, exact
                portions.
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-start justify-center gap-3 py-2">
            <Lock className="size-5 text-muted-foreground" />
            <p className="text-muted-foreground text-sm">
              Chad builds a structured meal plan around your macro target.
              Real foods, exact portions. Pro only.
            </p>
            <Button asChild className="min-h-11 sm:min-h-8" size="sm">
              <Link href="/account">Upgrade to Pro</Link>
            </Button>
          </div>
        )}
      </ModuleCard>
    </div>
  );
}
