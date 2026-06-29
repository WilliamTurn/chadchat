import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { NutritionSkeleton } from "@/components/dashboard/page-skeletons";
import { Toaster } from "sonner";
import { auth } from "@/app/(auth)/auth";
import { AskChadButton } from "@/components/chad/ask-chad-button";
import { StandaloneHeader } from "@/components/nav/standalone-header";
import { AnalysisCard } from "@/components/nutrition/analysis-card";
import { AnalyzeForm } from "@/components/nutrition/analyze-form";
import { MacroRings } from "@/components/nutrition/macro-rings";
import { MacroTrendChart } from "@/components/nutrition/macro-trend-chart";
import { TargetEditor } from "@/components/today/target-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { canAccessChad, canAccessProFeatures } from "@/lib/admin";
import {
  formatCalendarDay,
  startOfTodayUTC,
  toCalendarDayISO,
} from "@/lib/date";
import {
  getMealLogByUserId,
  getNutritionTarget,
  getUserById,
} from "@/lib/db/queries";
import type { MealAnalysis, NutritionTarget } from "@/lib/db/schema";
import { dailyMacroTrend } from "@/lib/nutrition/daily-macros";
import { deriveRecentFoods } from "@/lib/nutrition/recent-foods";
import { MEAL_CATEGORIES, type MealCategory } from "@/lib/validation/nutrition";

const MEAL_LABEL: Record<MealCategory, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

export default function NutritionPage() {
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

      <StandaloneHeader active="/nutrition" />

      <div className="mb-8">
        <div className="flex items-center gap-3">
          <h1 className="font-semibold text-2xl tracking-tight">
            Calorie Tracker
          </h1>
          <Badge variant="secondary">Pro</Badge>
        </div>
        <p className="mt-1 text-muted-foreground text-sm">
          Log every meal — by photo or by hand. Chad grades it and keeps your
          day's totals honest. Want a plan to follow?{" "}
          <Link
            className="text-foreground underline underline-offset-4"
            href="/meal-plan"
          >
            Meal plan
          </Link>{" "}
          · Rating your fridge or pantry?{" "}
          <Link
            className="text-foreground underline underline-offset-4"
            href="/kitchen"
          >
            Rate My Kitchen
          </Link>
          .
        </p>
      </div>

      <Suspense fallback={<NutritionSkeleton />}>
        <NutritionContent />
      </Suspense>
    </main>
  );
}

async function NutritionContent() {
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

  const isPro = canAccessProFeatures(user);
  return isPro ? <Feed userId={user.id} /> : <UpgradePrompt />;
}

function UpgradePrompt() {
  return (
    <div className="rounded-2xl border border-border bg-card p-8 text-center">
      <h2 className="font-medium text-lg">
        Meal logging is a Chad Pro feature
      </h2>
      <p className="mx-auto mt-2 max-w-md text-muted-foreground text-sm">
        Upgrade to Pro to log meals by photo or by hand. Chad estimates the
        macros, grades each plate out of 10, and keeps a running diary of your
        day — the stuff a real coach keeps on you about.
      </p>
      <Button asChild className="mt-5">
        <Link href="/account">Upgrade to Pro</Link>
      </Button>
    </div>
  );
}

// Lower bound for "today's ..." queries — 00:00 UTC, matching the noon-UTC
// calendar-day convention (see lib/date.ts). Not server-local midnight.
const startOfToday = startOfTodayUTC;

/** The day a meal is logged for — its user-picked date, or its insert time for
 * rows logged before back-dating existed. */
function mealDay(m: MealAnalysis): Date {
  return m.recordedAt ?? m.createdAt;
}

function sumMacro(
  meals: MealAnalysis[],
  key: "calories" | "protein" | "carbs" | "fat"
) {
  return meals.reduce((s, m) => s + (m[key] ?? 0), 0);
}

async function Feed({ userId }: { userId: string }) {
  const [meals, target] = await Promise.all([
    getMealLogByUserId(userId),
    getNutritionTarget(userId),
  ]);

  const since = startOfToday();
  const todays = meals.filter((m) => mealDay(m) >= since);
  const earlier = meals.filter((m) => mealDay(m) < since);
  const recentFoods = deriveRecentFoods(meals);
  const macroDays = dailyMacroTrend(meals);

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-2xl border border-border bg-card p-6">
        <AnalyzeForm recentFoods={recentFoods} />
      </section>

      <TodaySection meals={todays} target={target} />

      {macroDays.length >= 2 && (
        <MacroTrendChart
          days={macroDays}
          target={
            target
              ? {
                  calories: target.calories,
                  protein: target.protein,
                  carbs: target.carbs,
                  fat: target.fat,
                }
              : null
          }
        />
      )}

      {earlier.length > 0 && <HistorySection meals={earlier} />}

      {meals.length === 0 && (
        <p className="text-center text-muted-foreground text-sm">
          Nothing logged yet. Log your next meal above and Chad will start
          tracking your day.
        </p>
      )}
    </div>
  );
}

function TodaySection({
  meals,
  target,
}: {
  meals: MealAnalysis[];
  target: NutritionTarget | undefined;
}) {
  const grouped: { label: string; items: MealAnalysis[] }[] = [];
  for (const cat of MEAL_CATEGORIES) {
    const items = meals.filter((m) => m.meal === cat);
    if (items.length > 0) {
      grouped.push({ label: MEAL_LABEL[cat], items });
    }
  }
  const uncategorized = meals.filter((m) => !m.meal);
  if (uncategorized.length > 0) {
    grouped.push({ label: "Other", items: uncategorized });
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex items-baseline gap-3">
          <h2 className="font-medium text-lg">Today</h2>
          <span className="whitespace-nowrap text-muted-foreground text-sm">
            {meals.length} meal{meals.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <TargetEditor
            calories={target?.calories ?? null}
            carbs={target?.carbs ?? null}
            fat={target?.fat ?? null}
            protein={target?.protein ?? null}
          />
          <AskChadButton prompt="Review my nutrition over the last few days — calories, protein, and the quality of what I've been eating. What's working and what should I fix?" />
        </div>
      </div>

      {/* Totals + remaining — hero calorie dial + macro bars */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <MacroRings
          caloriesConsumed={sumMacro(meals, "calories")}
          caloriesTarget={target?.calories ?? null}
          carbsConsumed={sumMacro(meals, "carbs")}
          carbsTarget={target?.carbs ?? null}
          fatConsumed={sumMacro(meals, "fat")}
          fatTarget={target?.fat ?? null}
          proteinConsumed={sumMacro(meals, "protein")}
          proteinTarget={target?.protein ?? null}
        />
      </div>

      {meals.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No meals logged today. Add your first above.
        </p>
      ) : (
        grouped.map((group) => (
          <div className="flex flex-col gap-3" key={group.label}>
            <h3 className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
              {group.label}
            </h3>
            {group.items.map((entry) => (
              <AnalysisCard entry={entry} key={entry.id} />
            ))}
          </div>
        ))
      )}
    </section>
  );
}

function dayHeading(d: Date): string {
  return formatCalendarDay(d, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function HistorySection({ meals }: { meals: MealAnalysis[] }) {
  // meals arrive newest-first; group into days (by their logged-for date)
  // preserving order.
  const days: { key: string; label: string; items: MealAnalysis[] }[] = [];
  for (const m of meals) {
    const day = mealDay(m);
    const key = toCalendarDayISO(day);
    const last = days.at(-1);
    if (last && last.key === key) {
      last.items.push(m);
    } else {
      days.push({ key, label: dayHeading(day), items: [m] });
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-medium text-lg">Earlier</h2>
      {/* Each past day is a collapsible group so a long history stays scannable
          instead of one endless scroll (NUT-12). The most recent past day is
          open by default; older days collapse to a one-line date + meal-count +
          calorie summary you can expand on demand. Native <details> keeps this
          server-rendered with zero client JS. */}
      {days.map((day, i) => {
        const cals = Math.round(sumMacro(day.items, "calories"));
        return (
          <details
            className="group flex flex-col gap-3 border-border border-t pt-4 first:border-t-0 first:pt-0"
            key={day.key}
            open={i === 0}
          >
            <summary className="flex cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
              <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
              <span className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
                {day.label}
              </span>
              <span className="ml-auto whitespace-nowrap text-muted-foreground/70 text-xs">
                {day.items.length} meal{day.items.length === 1 ? "" : "s"}
                {cals > 0 ? ` · ${cals.toLocaleString()} cal` : ""}
              </span>
            </summary>
            <div className="flex flex-col gap-3">
              {day.items.map((entry) => (
                <AnalysisCard entry={entry} key={entry.id} />
              ))}
            </div>
          </details>
        );
      })}
    </section>
  );
}
