import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { type ReactNode, Suspense } from "react";
import { NutritionSkeleton } from "@/components/dashboard/page-skeletons";
import { Toaster } from "sonner";
import { auth } from "@/app/(auth)/auth";
import { AskChadButton } from "@/components/chad/ask-chad-button";
import { BackToDashboard } from "@/components/nav/back-to-dashboard";
import { PageShell } from "@/components/nav/page-shell";
import { ScrollToHash } from "@/components/nav/scroll-to-hash";
import { StandaloneHeader } from "@/components/nav/standalone-header";
import { AnalysisCard } from "@/components/nutrition/analysis-card";
import { AnalyzeForm } from "@/components/nutrition/analyze-form";
import { DayNav } from "@/components/nutrition/day-nav";
import { NutritionEmptyState } from "@/components/nutrition/empty-state";
import { MacroRings } from "@/components/nutrition/macro-rings";
import { MacroTrendChart } from "@/components/nutrition/macro-trend-chart";
import { RecalibrationCard } from "@/components/nutrition/recalibration-card";
import { TargetEditor } from "@/components/today/target-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { canAccessChad, canAccessProFeatures } from "@/lib/admin";
import {
  calendarRangeWindowInTz,
  formatCalendarDay,
  parseCalendarDay,
  toCalendarDayISO,
  todayAnchorInTz,
  todayStartInTz,
} from "@/lib/date";
import {
  getMealLogByUserId,
  getMealsBetween,
  getNutritionTarget,
  getUserById,
} from "@/lib/db/queries";
import type { MealAnalysis, NutritionTarget, User } from "@/lib/db/schema";
import { dailyMacroTrend } from "@/lib/nutrition/daily-macros";
import { computeUserRecalibration } from "@/lib/nutrition/recalibrate";
import { deriveRecentFoods } from "@/lib/nutrition/recent-foods";
import { RewardProvider } from "@/components/dashboard/reward";
import { MEAL_CATEGORIES, type MealCategory } from "@/lib/validation/nutrition";

const MEAL_LABEL: Record<MealCategory, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
  other: "Other",
};

export default function NutritionPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
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

      <StandaloneHeader active="/nutrition" />

      <div className="mb-8">
        <BackToDashboard />
        <div className="flex items-center gap-3">
          <h1 className="font-semibold text-2xl tracking-tight">
            Calorie Tracker
          </h1>
          {/* "Pro feature", not bare "Pro" (LC-13). */}
          <Badge variant="secondary">Pro feature</Badge>
        </div>
        <p className="mt-1 text-muted-foreground text-sm">
          Log every meal: search the food database, scan a barcode, snap a
          photo, or type it in. Chad grades it and keeps your day's totals
          honest. Want a plan to follow?{" "}
          <Link
            className="text-foreground underline underline-offset-4"
            href="/meal-plan"
          >
            Meal Plan
          </Link>{" "}
          · Rating your kitchen or grocery haul?{" "}
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
        <NutritionContent searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}

async function NutritionContent({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
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

  const isPro = canAccessProFeatures(user);
  return isPro ? (
    <RewardProvider haptics={user.hapticsEnabled} sound={user.soundEnabled}>
      <Feed searchParams={searchParams} user={user} />
    </RewardProvider>
  ) : (
    <UpgradePrompt />
  );
}

function UpgradePrompt() {
  return (
    <div className="rounded-2xl border border-border bg-card p-8 text-center">
      <h2 className="font-medium text-lg">
        The Calorie Tracker is a Chad Pro feature
      </h2>
      <p className="mx-auto mt-2 max-w-md text-muted-foreground text-sm">
        Upgrade to Pro to log meals with food-database search, barcode
        scanning, photo analysis, or by hand. Chad grades each plate out of 10
        and keeps a running diary of your day, the stuff a real coach keeps
        on you about.
      </p>
      <Button asChild className="mt-5">
        <Link href="/account">Upgrade to Pro</Link>
      </Button>
    </div>
  );
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

const DAY_MS = 24 * 60 * 60 * 1000;

async function Feed({
  user,
  searchParams,
}: {
  user: User;
  searchParams: Promise<{ day?: string }>;
}) {
  const userId = user.id;
  const timezone = user.timezone;
  // Which day the diary shows (BT1-3): ?day=YYYY-MM-DD pages back through
  // history like MFP/MacroFactor; no param (or today/garbage/future) = today.
  const { day: dayParam } = await searchParams;
  const todayISO = toCalendarDayISO(todayAnchorInTz(timezone));
  const requested =
    typeof dayParam === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(dayParam) &&
    parseCalendarDay(dayParam)
      ? dayParam
      : null;
  const dayISO = requested && requested < todayISO ? requested : todayISO;
  const viewingToday = dayISO === todayISO;

  const [meals, target] = await Promise.all([
    getMealLogByUserId(userId),
    getNutritionTarget(userId),
  ]);

  // NUT-23: this week's target recalibration, computed in code from the real
  // logs. Only surfaced on the today view, and only when the engine has an
  // actionable recommendation (enough honest data, meaningful delta, not
  // inside the post-update cooldown).
  const recalibration = viewingToday
    ? await computeUserRecalibration(user)
    : null;

  // "Today" starts at the user's own local midnight (FEAT-8), so a late-night
  // log stays in their today instead of rolling into the next UTC day.
  const since = todayStartInTz(timezone);
  // The viewed day's meals. Today filters the loaded log; a past day gets its
  // own bounded query (the same window math Chad's getDashboard tool uses), so
  // even days beyond the log's row cap render complete.
  let dayMeals: MealAnalysis[];
  if (viewingToday) {
    dayMeals = meals.filter((m) => mealDay(m) >= since);
  } else {
    const { start, end } = calendarRangeWindowInTz(dayISO, dayISO, timezone);
    dayMeals = await getMealsBetween(userId, start, end);
  }
  const earlier = meals.filter((m) => mealDay(m) < since);
  const recentFoods = deriveRecentFoods(meals);
  const macroDays = dailyMacroTrend(meals, timezone);

  const anchor = parseCalendarDay(dayISO) as Date;
  const yesterdayISO = toCalendarDayISO(
    new Date((parseCalendarDay(todayISO) as Date).getTime() - DAY_MS)
  );
  const heading = viewingToday
    ? "Today"
    : dayISO === yesterdayISO
      ? "Yesterday"
      : formatCalendarDay(anchor, {
          weekday: "short",
          month: "short",
          day: "numeric",
        });
  const prevISO = toCalendarDayISO(new Date(anchor.getTime() - DAY_MS));
  const nextISO = viewingToday
    ? null
    : toCalendarDayISO(new Date(anchor.getTime() + DAY_MS));

  return (
    <div className="flex flex-col gap-8">
      <ScrollToHash />
      <section
        className="rounded-2xl border border-border bg-card p-6"
        id="log-meal"
      >
        {/* Keyed by day so browsing to a past day re-arms the form's date to
            that day: logging from a day view lands ON that day, visibly. */}
        <AnalyzeForm
          initialDate={viewingToday ? undefined : dayISO}
          key={dayISO}
          recentFoods={recentFoods}
        />
      </section>

      <DaySection
        dayNav={
          <DayNav
            dayISO={dayISO}
            nextISO={nextISO}
            prevISO={prevISO}
            todayISO={todayISO}
          />
        }
        firstEver={meals.length === 0 && viewingToday}
        heading={heading}
        meals={dayMeals}
        target={target}
        viewingToday={viewingToday}
      />

      {recalibration?.kind === "recommend" && (
        <RecalibrationCard rec={recalibration} />
      )}

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
    </div>
  );
}

function DaySection({
  meals,
  target,
  firstEver,
  heading,
  viewingToday,
  dayNav,
}: {
  meals: MealAnalysis[];
  target: NutritionTarget | undefined;
  firstEver: boolean;
  heading: string;
  viewingToday: boolean;
  dayNav: ReactNode;
}) {
  const grouped: { label: string; items: MealAnalysis[] }[] = [];
  for (const cat of MEAL_CATEGORIES) {
    if (cat === "other") {
      continue;
    }
    const items = meals.filter((m) => m.meal === cat);
    if (items.length > 0) {
      grouped.push({ label: MEAL_LABEL[cat], items });
    }
  }
  // Custom slots ("other") group under the member's own name, so a
  // "Post-workout shake" reads as its own section like the standard meals.
  // Unnamed customs and pre-category rows share a plain "Other" bucket.
  const custom = new Map<string, MealAnalysis[]>();
  for (const m of meals) {
    if (m.meal === "other" || !m.meal) {
      const label =
        (m.meal === "other" && m.mealLabel?.trim()) || MEAL_LABEL.other;
      const bucket = custom.get(label) ?? [];
      bucket.push(m);
      custom.set(label, bucket);
    }
  }
  for (const [label, items] of custom) {
    grouped.push({ label, items });
  }

  return (
    // id="history": where the dashboard card's "View all" link lands (R2-5) --
    // the day's logged meals, with Earlier right below, not the log form.
    <section className="flex flex-col gap-4" id="history">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex items-baseline gap-3">
          <h2 className="font-medium text-lg">{heading}</h2>
          <span className="whitespace-nowrap text-muted-foreground text-sm">
            {meals.length} meal{meals.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {dayNav}
          <TargetEditor
            calories={target?.calories ?? null}
            carbs={target?.carbs ?? null}
            fat={target?.fat ?? null}
            protein={target?.protein ?? null}
          />
          <AskChadButton
            prompt={
              viewingToday
                ? "Go through my Calorie Tracker for today: each meal I've logged so far and my calories and macros against my targets. What's working, and what should I eat (or skip) for the rest of the day?"
                : `Go through my food log for ${heading} in my Calorie Tracker: each meal that day and how the day's calories and macros stacked up against my targets. What should I take away from that day?`
            }
          />
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
        firstEver ? (
          <NutritionEmptyState />
        ) : (
          <p className="text-muted-foreground text-sm">
            {viewingToday
              ? "No meals logged today. Add your first above."
              : "No meals logged this day. Log one above and it lands here."}
          </p>
        )
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
              <Link
                className="whitespace-nowrap text-muted-foreground text-xs underline-offset-4 hover:text-foreground hover:underline"
                href={`/nutrition?day=${day.key}`}
              >
                Open day
              </Link>
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
