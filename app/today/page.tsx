import {
  Camera,
  CreditCard,
  Dumbbell,
  Flame,
  LineChart,
  Lock,
  MessageSquare,
  Target,
  Utensils,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { auth } from "@/app/(auth)/auth";
import { MacroRings } from "@/components/nutrition/macro-rings";
import { WeightChart } from "@/components/progress/weight-chart";
import { StandaloneHeader } from "@/components/nav/standalone-header";
import { GoalEditor } from "@/components/today/goal-editor";
import { PlanViewer } from "@/components/today/plan-viewer";
import { TargetEditor } from "@/components/today/target-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { canAccessChad, canAccessProFeatures } from "@/lib/admin";
import {
  getMealsSince,
  getNutritionTarget,
  getProgressEntriesByUserId,
  getUserById,
  getUserMemory,
} from "@/lib/db/queries";
import type { ProgressEntry } from "@/lib/db/schema";
import { toPlanStatusSummary } from "@/lib/subscription";

const LB_PER_KG = 2.204_62;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Pull a value from the "## Client file" block of Chad's memory profile. */
function clientField(profile: string | null | undefined, label: string): string | null {
  if (!profile) {
    return null;
  }
  const escaped = label.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  const re = new RegExp(`^[-*]\\s*${escaped}\\s*:\\s*(.+)$`, "im");
  const match = profile.match(re);
  const value = match?.[1]?.trim();
  if (!value || /^unknown$/i.test(value)) {
    return null;
  }
  return value;
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** Consecutive days (ending today or yesterday) with at least one logged action. */
function computeStreak(dates: Date[]): number {
  if (dates.length === 0) {
    return 0;
  }
  const days = new Set(dates.map(dayKey));
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  if (!days.has(dayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(dayKey(cursor))) {
      return 0;
    }
  }
  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export default function TodayPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col px-4 py-10">
      <Toaster
        position="top-center"
        theme="system"
        toastOptions={{
          className:
            "!bg-card !text-foreground !border-border/50 !shadow-[var(--shadow-float)]",
        }}
      />
      <StandaloneHeader active="/today" />
      <Suspense
        fallback={
          <div className="h-[600px] animate-pulse rounded-2xl border border-border bg-card" />
        }
      >
        <TodayContent />
      </Suspense>
    </main>
  );
}

async function TodayContent() {
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
  const plan = toPlanStatusSummary(user);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [memory, entries, todaysMeals, target] = await Promise.all([
    getUserMemory(user.id),
    isPro ? getProgressEntriesByUserId(user.id) : Promise.resolve([]),
    isPro ? getMealsSince(user.id, startOfToday) : Promise.resolve([]),
    isPro ? getNutritionTarget(user.id) : Promise.resolve(undefined),
  ]);

  const profile = memory?.profile ?? null;
  const nameField = clientField(profile, "Name");
  const firstName = nameField ? nameField.split(/\s+/)[0] : null;
  const goal = clientField(profile, "Primary goal");
  const deadline = clientField(profile, "Target / deadline");
  const phase = clientField(profile, "Week / phase");
  const workoutPlan = clientField(profile, "Current workout plan");

  // Weight summary (Pro).
  const weighed = entries.filter(
    (e): e is ProgressEntry & { weight: number } => e.weight != null
  );
  const displayUnit: "lb" | "kg" =
    weighed.length > 0 ? weighed[weighed.length - 1].unit : "lb";
  const points = weighed.map((e) => ({
    t: e.recordedAt.getTime(),
    weight: round1(
      e.unit === displayUnit
        ? e.weight
        : displayUnit === "lb"
          ? e.weight * LB_PER_KG
          : e.weight / LB_PER_KG
    ),
  }));
  const currentWeight = points.at(-1)?.weight ?? null;
  const startWeight = points.at(0)?.weight ?? null;
  const weightChange =
    currentWeight != null && startWeight != null
      ? round1(currentWeight - startWeight)
      : null;

  // Today's intake (Pro).
  const caloriesToday = todaysMeals.reduce((sum, m) => sum + (m.calories ?? 0), 0);
  const proteinToday = todaysMeals.reduce((sum, m) => sum + (m.protein ?? 0), 0);
  const carbsToday = todaysMeals.reduce((sum, m) => sum + (m.carbs ?? 0), 0);
  const fatToday = todaysMeals.reduce((sum, m) => sum + (m.fat ?? 0), 0);

  // Streak from logged actions (progress + meals).
  const streak = computeStreak([
    ...entries.map((e) => e.recordedAt),
    ...todaysMeals.map((m) => m.createdAt),
  ]);

  // First-run: a brand-new member with no profile and nothing logged yet. We
  // show a "welcome / get started" header instead of "Welcome back" (which is
  // illogical the very first time they sign in).
  const isReturning =
    Boolean(profile) || entries.length > 0 || todaysMeals.length > 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <header className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 sm:p-8">
        <div
          aria-hidden
          className="-right-16 -top-16 pointer-events-none absolute size-56 rounded-full bg-blood/20 blur-3xl"
        />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-muted-foreground text-sm">
              {isReturning ? "Welcome back" : "Welcome to Chad"}
            </p>
            <h1 className="mt-1 font-display font-bold text-3xl tracking-tight sm:text-4xl">
              {firstName ?? (isReturning ? "Let's work" : "Let's get started")}
            </h1>
            <p className="mt-2 max-w-md text-muted-foreground text-sm">
              {isReturning
                ? "Here's where you stand today. No excuses — just the numbers."
                : "Set your goal below, then tell Chad about yourself in chat. He'll build the plan from there."}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            {plan.tier === "pro" ? (
              <Badge variant="secondary">Pro</Badge>
            ) : plan.status === "trialing" && plan.trialDaysLeft !== null ? (
              <Badge variant="secondary">
                {plan.trialDaysLeft <= 0
                  ? "Trial ends today"
                  : `${plan.trialDaysLeft} days left in trial`}
              </Badge>
            ) : (
              <Badge variant="secondary">Basic</Badge>
            )}
            <Button asChild className="gap-1.5" size="sm">
              <Link href="/">
                <MessageSquare className="size-3.5" />
                Talk to Chad
              </Link>
            </Button>
          </div>
        </div>

        {/* Streak strip */}
        <div className="relative mt-6 flex items-center gap-3 rounded-xl border border-border bg-background/40 px-4 py-3">
          <Flame
            className={streak > 0 ? "size-6 text-blood" : "size-6 text-muted-foreground"}
            strokeWidth={2.5}
          />
          <div>
            <div className="font-display font-bold text-xl leading-none">
              {streak} day{streak === 1 ? "" : "s"}
            </div>
            <div className="text-muted-foreground text-xs">
              {streak > 0
                ? "Current streak — keep showing up."
                : "No streak yet. Log something today to start one."}
            </div>
          </div>
        </div>
      </header>

      {/* Goal + Training */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <div className="flex items-start justify-between">
            <CardTitle icon={<Target className="size-4 text-blood" />}>
              Your goal
            </CardTitle>
            {goal && (
              <GoalEditor deadline={deadline} goal={goal} phase={phase} />
            )}
          </div>
          {goal ? (
            <>
              <p className="font-medium text-lg leading-snug">{goal}</p>
              {deadline && (
                <p className="mt-1 text-muted-foreground text-sm">
                  Target: {deadline}
                </p>
              )}
              {phase && (
                <Badge className="mt-3 w-fit" variant="secondary">
                  {phase}
                </Badge>
              )}
            </>
          ) : (
            <div className="flex flex-col items-start gap-3">
              <p className="text-muted-foreground text-sm">
                Chad doesn't know your goal yet. Set it here, or tell him in chat
                and he'll build the plan.
              </p>
              <GoalEditor
                deadline={deadline}
                goal={goal}
                phase={phase}
                variant="cta"
              />
            </div>
          )}
        </Card>

        <Card>
          <CardTitle icon={<Dumbbell className="size-4 text-blood" />}>
            Your training
          </CardTitle>
          {workoutPlan ? (
            <>
              <p className="line-clamp-5 whitespace-pre-line text-sm leading-relaxed">
                {workoutPlan}
              </p>
              <PlanViewer plan={workoutPlan} />
            </>
          ) : (
            <EmptyHint
              cta="Get your plan"
              text="No training plan on file yet. Ask Chad to build your split."
            />
          )}
        </Card>
      </div>

      {/* Fuel + Weight (Pro) */}
      <div className="grid gap-6 md:grid-cols-2">
        {isPro ? (
          <Card>
            <div className="flex items-center justify-between">
              <CardTitle icon={<Utensils className="size-4 text-blood" />}>
                Today's fuel
              </CardTitle>
              <TargetEditor
                calories={target?.calories ?? null}
                carbs={target?.carbs ?? null}
                fat={target?.fat ?? null}
                protein={target?.protein ?? null}
              />
            </div>
            <div className="mt-2">
              <MacroRings
                caloriesConsumed={caloriesToday}
                caloriesTarget={target?.calories ?? null}
                carbsConsumed={carbsToday}
                carbsTarget={target?.carbs ?? null}
                fatConsumed={fatToday}
                fatTarget={target?.fat ?? null}
                proteinConsumed={proteinToday}
                proteinTarget={target?.protein ?? null}
              />
            </div>
            <p className="mt-3 text-muted-foreground text-xs">
              {todaysMeals.length > 0
                ? `${todaysMeals.length} meal${todaysMeals.length === 1 ? "" : "s"} logged today`
                : "No meals logged today."}
            </p>
            <Button asChild className="mt-3 gap-1.5" size="sm" variant="outline">
              <Link href="/nutrition">
                <Camera className="size-3.5" />
                Analyze a meal
              </Link>
            </Button>
          </Card>
        ) : (
          <LockedCard
            icon={<Utensils className="size-4" />}
            text="Snap a meal, fridge, or pantry and Chad grades the macros. Pro only."
            title="Today's fuel"
          />
        )}

        {isPro ? (
          <Card>
            <div className="flex items-center justify-between">
              <CardTitle icon={<LineChart className="size-4 text-blood" />}>
                Weight trend
              </CardTitle>
              {currentWeight != null && (
                <div className="text-right">
                  <div className="font-display font-semibold text-lg leading-none">
                    {currentWeight} {displayUnit}
                  </div>
                  {weightChange != null && (
                    <div className="text-muted-foreground text-xs">
                      {weightChange > 0 ? "+" : ""}
                      {weightChange} since start
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="mt-2">
              {points.length > 0 ? (
                <WeightChart points={points} unit={displayUnit} />
              ) : (
                <EmptyHint
                  cta="Log your weight"
                  href="/progress"
                  text="No weigh-ins yet. Log your weight to see the trend."
                />
              )}
            </div>
            {points.length > 0 && (
              <Button asChild className="mt-3 gap-1.5" size="sm" variant="outline">
                <Link href="/progress">
                  <LineChart className="size-3.5" />
                  Log progress
                </Link>
              </Button>
            )}
          </Card>
        ) : (
          <LockedCard
            icon={<LineChart className="size-4" />}
            text="Track your weight and progress photos over time. Pro only."
            title="Weight trend"
          />
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <QuickAction href="/" icon={<MessageSquare className="size-4" />} label="Talk to Chad" />
        <QuickAction href="/nutrition" icon={<Camera className="size-4" />} label="Nutrition check" />
        <QuickAction href="/progress" icon={<LineChart className="size-4" />} label="Progress" />
        <QuickAction href="/account" icon={<CreditCard className="size-4" />} label="Account" />
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="flex flex-col rounded-2xl border border-border bg-card p-6">
      {children}
    </section>
  );
}

function CardTitle({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <h2 className="mb-3 flex items-center gap-2 font-medium text-muted-foreground text-sm uppercase tracking-wide">
      {icon}
      {children}
    </h2>
  );
}

function EmptyHint({
  text,
  cta,
  href = "/",
}: {
  text: string;
  cta: string;
  href?: string;
}) {
  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-muted-foreground text-sm">{text}</p>
      <Button asChild size="sm" variant="outline">
        <Link href={href}>{cta}</Link>
      </Button>
    </div>
  );
}

function LockedCard({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <section className="flex flex-col rounded-2xl border border-border border-dashed bg-card p-6">
      <h2 className="mb-3 flex items-center gap-2 font-medium text-muted-foreground text-sm uppercase tracking-wide">
        {icon}
        {title}
      </h2>
      <div className="flex flex-1 flex-col items-start justify-center gap-3 py-4">
        <Lock className="size-5 text-muted-foreground" />
        <p className="text-muted-foreground text-sm">{text}</p>
        <Button asChild size="sm">
          <Link href="/account">Upgrade to Pro</Link>
        </Button>
      </div>
    </section>
  );
}

function QuickAction({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card px-3 py-4 text-center text-sm transition-colors hover:bg-accent/50"
      href={href}
    >
      <span className="text-blood">{icon}</span>
      <span className="font-medium">{label}</span>
    </Link>
  );
}
