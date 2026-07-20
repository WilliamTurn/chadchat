import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { MealPlanSkeleton } from "@/components/dashboard/page-skeletons";
import { auth } from "@/app/(auth)/auth";
import { GenerateForm } from "@/components/meal-plan/generate-form";
import { NewPlanSection } from "@/components/meal-plan/new-plan-section";
import {
  MealPlanView,
  type MealPlanViewData,
} from "@/components/meal-plan/meal-plan-view";
import { BackLink } from "@/components/nav/back-link";
import { PageShell } from "@/components/nav/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { canAccessChad, canAccessProFeatures } from "@/lib/admin";
import {
  getActiveMealPlanByUserId,
  getNutritionTarget,
  getUserById,
  getUserMemory,
} from "@/lib/db/queries";
import type { User } from "@/lib/db/schema";
import type { Macros } from "@/lib/nutrition/macros";
import { planReadinessHints } from "@/lib/nutrition/plan-readiness";
import { planDaysSchema } from "@/lib/validation/meal-plan";

// A 7-day plan is one Opus design pass + ~40 USDA lookups, which can exceed the
// default 60s. The generate server action runs in this route, so raise the cap.
export const maxDuration = 300;

export default function MealPlanPage() {
  return (
    // Full-width desktop layout (LAY-1): the wide frame, filled with the
    // plan's multi-column meal grid and full-row day switcher.
    <PageShell active="/meal-plan" className="max-w-[1500px]">

      <div className="mb-8">
        <BackLink />
        <div className="flex items-center gap-3">
          <h1 className="font-semibold text-2xl tracking-tight">Meal Plan</h1>
          {/* "Pro feature", not bare "Pro" (LC-13). */}
          <Badge variant="secondary">Pro feature</Badge>
        </div>
        <p className="mt-1 text-muted-foreground text-sm">
          Chad builds you a structured plan around your macro target — real
          foods, exact portions, accurate numbers from the USDA food database.
          Logging what you actually ate?{" "}
          <Link
            className="text-foreground underline underline-offset-4"
            href="/nutrition"
          >
            Nutrition
          </Link>{" "}
          ·{" "}
          <Link
            className="text-foreground underline underline-offset-4"
            href="/kitchen"
          >
            Rate My Kitchen
          </Link>
          .
        </p>
      </div>

      <Suspense fallback={<MealPlanSkeleton />}>
        <MealPlanContent />
      </Suspense>
    </PageShell>
  );
}

async function MealPlanContent() {
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

  return <PlanArea user={user} />;
}

function UpgradePrompt() {
  return (
    <div className="rounded-2xl border border-border bg-card p-8 text-center">
      <h2 className="font-medium text-lg">Meal plans are a Chad Pro feature</h2>
      <p className="mx-auto mt-2 max-w-md text-muted-foreground text-sm">
        Upgrade to Pro and Chad designs a full structured meal plan around your
        macro target — real foods, exact portions, and accurate numbers pulled
        from the USDA food database, not guessed.
      </p>
      <Button asChild className="mt-5">
        <Link href="/account">Upgrade to Pro</Link>
      </Button>
    </div>
  );
}

async function PlanArea({ user }: { user: User }) {
  const [plan, daily, memory] = await Promise.all([
    getActiveMealPlanByUserId(user.id),
    getNutritionTarget(user.id),
    getUserMemory(user.id),
  ]);

  // What Chad still doesn't know (NUT-19): fuels the generate form's
  // "this plan could be off" confirm. Never locks generation.
  const readinessHints = planReadinessHints({
    user,
    hasTarget: daily?.calories != null,
    hasMemory: Boolean(memory?.profile?.trim()),
  });

  // No active plan → the preferences form + a short pitch.
  if (!plan) {
    return (
      <div className="flex flex-col gap-6">
        <div className="rounded-2xl border border-border bg-card p-6">
          <GenerateForm readinessHints={readinessHints} />
        </div>
      </div>
    );
  }

  // Validate the stored structure before trusting it in the viewer. A plan that
  // somehow fails validation falls back to letting the user build a fresh one.
  const parsedDays = planDaysSchema.safeParse(plan.days);
  if (!parsedDays.success) {
    return (
      <div className="flex flex-col gap-6">
        <div className="rounded-2xl border border-border bg-card p-6">
          <p className="mb-4 text-muted-foreground text-sm">
            This plan couldn't be read. Build a fresh one below.
          </p>
          <GenerateForm readinessHints={readinessHints} />
        </div>
      </div>
    );
  }

  // NUT-13: measure the plan against the user's LIVE daily Calorie-Tracker
  // target — the same numbers that drive the dashboard rings — so there's one
  // target, not two that can silently disagree. Fall back to the plan's own
  // stored snapshot only when no daily target is set (legacy plans / never set).
  const dailyTarget: Macros | null =
    daily?.calories != null
      ? {
          calories: daily.calories,
          protein: daily.protein ?? 0,
          carbs: daily.carbs ?? 0,
          fat: daily.fat ?? 0,
        }
      : null;
  const snapshot: Macros | null =
    plan.targetCalories != null
      ? {
          calories: plan.targetCalories,
          protein: plan.targetProtein ?? 0,
          carbs: plan.targetCarbs ?? 0,
          fat: plan.targetFat ?? 0,
        }
      : null;
  const target = dailyTarget ?? snapshot;

  const data: MealPlanViewData = {
    id: plan.id,
    title: plan.title,
    status: plan.status,
    coachIntro: plan.coachIntro,
    target,
    targetIsDaily: dailyTarget != null,
    days: parsedDays.data,
  };

  return (
    <div className="flex flex-col gap-8">
      <MealPlanView plan={data} />

      <NewPlanSection>
        <GenerateForm compact readinessHints={readinessHints} />
      </NewPlanSection>
    </div>
  );
}
