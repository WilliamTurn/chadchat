import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { auth } from "@/app/(auth)/auth";
import { AskChadButton } from "@/components/chad/ask-chad-button";
import { StandaloneHeader } from "@/components/nav/standalone-header";
import { AnalysisCard } from "@/components/nutrition/analysis-card";
import { AnalyzeForm } from "@/components/nutrition/analyze-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { canAccessChad, canAccessProFeatures } from "@/lib/admin";
import { formatCalendarDay, toCalendarDayISO } from "@/lib/date";
import {
  getMealLogByUserId,
  getNutritionTarget,
  getUserById,
} from "@/lib/db/queries";
import type { MealAnalysis, NutritionTarget } from "@/lib/db/schema";
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
            Nutrition diary
          </h1>
          <Badge variant="secondary">Pro</Badge>
        </div>
        <p className="mt-1 text-muted-foreground text-sm">
          Log every meal — by photo or by hand. Chad grades it and keeps your
          day's totals honest. Rating your fridge or pantry?{" "}
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

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

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

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-2xl border border-border bg-card p-6">
        <AnalyzeForm recentFoods={recentFoods} />
      </section>

      <TodaySection meals={todays} target={target} />

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

function MacroStat({
  label,
  consumed,
  target,
  unit,
}: {
  label: string;
  consumed: number;
  target: number | null;
  unit: string;
}) {
  const remaining = target != null ? target - consumed : null;
  const over = remaining != null && remaining < 0;
  return (
    <div className="rounded-xl border border-border bg-background/40 px-3 py-2 text-center">
      <div className="font-display font-semibold text-base">
        {Math.round(consumed)}
        <span className="ml-0.5 text-muted-foreground text-xs">{unit}</span>
      </div>
      <div className="text-muted-foreground text-[11px]">{label}</div>
      {remaining != null && (
        <div
          className={`text-[11px] ${over ? "text-blood" : "text-emerald-500"}`}
        >
          {over
            ? `${Math.round(-remaining)}${unit} over`
            : `${Math.round(remaining)}${unit} left`}
        </div>
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
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h2 className="font-medium text-lg">Today</h2>
          <span className="text-muted-foreground text-sm">
            {meals.length} meal{meals.length === 1 ? "" : "s"}
          </span>
        </div>
        <AskChadButton prompt="Review my nutrition over the last few days — calories, protein, and the quality of what I've been eating. What's working and what should I fix?" />
      </div>

      {/* Totals + remaining */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MacroStat
          consumed={sumMacro(meals, "calories")}
          label="Calories"
          target={target?.calories ?? null}
          unit=""
        />
        <MacroStat
          consumed={sumMacro(meals, "protein")}
          label="Protein"
          target={target?.protein ?? null}
          unit="g"
        />
        <MacroStat
          consumed={sumMacro(meals, "carbs")}
          label="Carbs"
          target={target?.carbs ?? null}
          unit="g"
        />
        <MacroStat
          consumed={sumMacro(meals, "fat")}
          label="Fat"
          target={target?.fat ?? null}
          unit="g"
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
    <section className="flex flex-col gap-6">
      <h2 className="font-medium text-lg">Earlier</h2>
      {days.map((day) => (
        <div className="flex flex-col gap-3" key={day.key}>
          <h3 className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
            {day.label}
          </h3>
          {day.items.map((entry) => (
            <AnalysisCard entry={entry} key={entry.id} />
          ))}
        </div>
      ))}
    </section>
  );
}
