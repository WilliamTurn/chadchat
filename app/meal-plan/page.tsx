import { ChefHat } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { auth } from "@/app/(auth)/auth";
import { GenerateForm } from "@/components/meal-plan/generate-form";
import {
  MealPlanView,
  type MealPlanViewData,
} from "@/components/meal-plan/meal-plan-view";
import { StandaloneHeader } from "@/components/nav/standalone-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { canAccessChad, canAccessProFeatures } from "@/lib/admin";
import { getActiveMealPlanByUserId, getUserById } from "@/lib/db/queries";
import type { Macros } from "@/lib/nutrition/macros";
import { planDaysSchema } from "@/lib/validation/meal-plan";

// A 7-day plan is one Opus design pass + ~40 USDA lookups, which can exceed the
// default 60s. The generate server action runs in this route, so raise the cap.
export const maxDuration = 300;

export default function MealPlanPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4 py-12">
      <Toaster
        position="top-center"
        theme="system"
        toastOptions={{
          className:
            "!bg-card !text-foreground !border-border/50 !shadow-[var(--shadow-float)]",
        }}
      />

      <StandaloneHeader active="/meal-plan" />

      <div className="mb-8">
        <div className="flex items-center gap-3">
          <h1 className="font-semibold text-2xl tracking-tight">Meal plan</h1>
          <Badge variant="secondary">Pro</Badge>
        </div>
        <p className="mt-1 text-muted-foreground text-sm">
          Chad builds you a structured plan around your macro target — real
          foods, exact portions, accurate numbers from the USDA food database.
          Logging what you actually ate?{" "}
          <Link
            className="text-foreground underline underline-offset-4"
            href="/nutrition"
          >
            Calorie Tracker
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

      <Suspense
        fallback={
          <div className="h-96 animate-pulse rounded-2xl border border-border bg-card" />
        }
      >
        <MealPlanContent />
      </Suspense>
    </main>
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
  if (!canAccessChad(user)) {
    redirect("/pricing");
  }

  if (!canAccessProFeatures(user)) {
    return <UpgradePrompt />;
  }

  return <PlanArea userId={user.id} />;
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

async function PlanArea({ userId }: { userId: string }) {
  const plan = await getActiveMealPlanByUserId(userId);

  // No active plan → the preferences form + a short pitch.
  if (!plan) {
    return (
      <div className="flex flex-col gap-6">
        <div className="rounded-2xl border border-border bg-card p-6">
          <GenerateForm />
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
          <GenerateForm />
        </div>
      </div>
    );
  }

  const target: Macros | null =
    plan.targetCalories != null
      ? {
          calories: plan.targetCalories,
          protein: plan.targetProtein ?? 0,
          carbs: plan.targetCarbs ?? 0,
          fat: plan.targetFat ?? 0,
        }
      : null;

  const data: MealPlanViewData = {
    id: plan.id,
    title: plan.title,
    status: plan.status,
    coachIntro: plan.coachIntro,
    target,
    days: parsedDays.data,
  };

  return (
    <div className="flex flex-col gap-8">
      <MealPlanView plan={data} />

      <details className="rounded-2xl border border-border bg-card/60 p-5">
        <summary className="flex cursor-pointer list-none items-center gap-2 font-medium text-sm">
          <ChefHat className="size-4 text-blood" />
          Build a new plan
        </summary>
        <p className="mt-3 mb-4 text-muted-foreground text-sm">
          Generating a new plan replaces the one above. Your current plan is
          archived, not deleted.
        </p>
        <GenerateForm compact />
      </details>
    </div>
  );
}
