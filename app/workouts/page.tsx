import { Dumbbell, Plus, Repeat, TrendingUp, Trophy } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { auth } from "@/app/(auth)/auth";
import { StandaloneHeader } from "@/components/nav/standalone-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PersonalRecords } from "@/components/workouts/personal-records";
import { VolumeChart } from "@/components/workouts/volume-chart";
import { WorkoutBuilder } from "@/components/workouts/workout-builder";
import { WorkoutCard } from "@/components/workouts/workout-card";
import { canAccessChad, canAccessProFeatures } from "@/lib/admin";
import {
  getCustomExercisesByUserId,
  getUserById,
  getWorkoutsByUserId,
  type WorkoutWithChildren,
} from "@/lib/db/queries";
import {
  computePersonalRecords,
  exercise1RMTrend,
  type WorkoutData,
  workoutVolumeLb,
  volumeTrend,
} from "@/lib/workouts/stats";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function toWorkoutData(w: WorkoutWithChildren): WorkoutData {
  return {
    id: w.id,
    title: w.title,
    performedAt: w.performedAt.toISOString(),
    durationSeconds: w.durationSeconds,
    notes: w.notes,
    exercises: w.exercises.map((ex) => ({
      name: ex.exerciseName,
      muscleGroup: ex.muscleGroup,
      notes: ex.notes,
      sets: ex.sets.map((s) => ({
        weight: s.weight,
        reps: s.reps,
        unit: s.unit,
        rpe: s.rpe,
        setType: s.setType,
        completed: s.completed,
      })),
    })),
  };
}

export default function WorkoutsPage() {
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
      <StandaloneHeader active="/workouts" />

      <div className="mb-8">
        <div className="flex items-center gap-3">
          <h1 className="font-semibold text-2xl tracking-tight">Workouts</h1>
          <Badge variant="secondary">Pro</Badge>
        </div>
        <p className="mt-1 text-muted-foreground text-sm">
          Log every set, rep, and pound. Chad tracks your PRs and volume — and
          holds you to them.
        </p>
      </div>

      <Suspense
        fallback={
          <div className="h-96 animate-pulse rounded-2xl border border-border bg-card" />
        }
      >
        <WorkoutsContent />
      </Suspense>
    </main>
  );
}

async function WorkoutsContent() {
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

  return <Dashboard userId={user.id} />;
}

function UpgradePrompt() {
  return (
    <div className="rounded-2xl border border-border bg-card p-8 text-center">
      <h2 className="font-medium text-lg">Workout logging is a Chad Pro feature</h2>
      <p className="mx-auto mt-2 max-w-md text-muted-foreground text-sm">
        Upgrade to Pro to log your training set by set, build an exercise
        library, and watch your strength and volume climb — the stuff a real
        coach tracks for you.
      </p>
      <Button asChild className="mt-5">
        <Link href="/account">Upgrade to Pro</Link>
      </Button>
    </div>
  );
}

async function Dashboard({ userId }: { userId: string }) {
  const [rawWorkouts, customExercisesRaw] = await Promise.all([
    getWorkoutsByUserId(userId),
    getCustomExercisesByUserId(userId),
  ]);

  const workouts = rawWorkouts.map(toWorkoutData);
  const customExercises = customExercisesRaw.map((e) => ({
    id: e.id,
    name: e.name,
    muscleGroup: e.muscleGroup,
    equipment: e.equipment,
  }));

  const records = computePersonalRecords(workouts)
    .slice(0, 6)
    .map((r) => ({
      ...r,
      trend: exercise1RMTrend(workouts, r.exerciseName),
    }));
  const trend = volumeTrend(workouts);

  const now = Date.now();
  const weekWorkouts = workouts.filter(
    (w) => now - new Date(w.performedAt).getTime() <= WEEK_MS
  );
  const weekVolume = weekWorkouts.reduce((sum, w) => sum + workoutVolumeLb(w), 0);

  return (
    <div className="flex flex-col gap-8">
      {/* Action + summary */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-6">
            <Stat label="Workouts" value={String(workouts.length)} />
            <Stat label="This week" value={String(weekWorkouts.length)} />
            <Stat
              label="Volume / 7d"
              value={
                weekVolume > 0 ? `${weekVolume.toLocaleString()} lb` : "—"
              }
            />
          </div>
          <div className="flex items-center gap-2">
            {workouts.length > 0 && (
              <WorkoutBuilder
                customExercises={customExercises}
                initial={workouts[0]}
                mode="repeat"
                trigger={
                  <Button className="gap-1.5" variant="outline">
                    <Repeat className="size-4" />
                    Repeat last
                  </Button>
                }
              />
            )}
            <WorkoutBuilder
              customExercises={customExercises}
              mode="create"
              trigger={
                <Button className="gap-1.5">
                  <Plus className="size-4" />
                  Log a workout
                </Button>
              }
            />
          </div>
        </div>
      </div>

      {workouts.length === 0 ? (
        <EmptyState customExercises={customExercises} />
      ) : (
        <>
          {/* Volume trend */}
          {trend.length >= 2 && (
            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="mb-3 flex items-center gap-2 font-medium text-muted-foreground text-sm uppercase tracking-wide">
                <TrendingUp className="size-4 text-blood" />
                Volume trend
              </h2>
              <VolumeChart points={trend} />
            </section>
          )}

          {/* Personal records */}
          {records.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 font-medium text-muted-foreground text-sm uppercase tracking-wide">
                <Trophy className="size-4 text-amber-500" />
                Personal records
              </h2>
              <PersonalRecords records={records} />
            </section>
          )}

          {/* History */}
          <section>
            <h2 className="mb-3 font-medium text-muted-foreground text-sm uppercase tracking-wide">
              History
            </h2>
            <div className="flex flex-col gap-4">
              {workouts.map((w) => (
                <WorkoutCard
                  customExercises={customExercises}
                  key={w.id}
                  workout={w}
                />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-display font-bold text-2xl leading-none">{value}</div>
      <div className="mt-1 text-muted-foreground text-xs uppercase tracking-wide">
        {label}
      </div>
    </div>
  );
}

function EmptyState({
  customExercises,
}: {
  customExercises: {
    id: string;
    name: string;
    muscleGroup: string;
    equipment: string;
  }[];
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-border border-dashed bg-card px-6 py-14 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-muted/60 ring-1 ring-border/50">
        <Dumbbell className="size-6 text-blood" />
      </span>
      <div>
        <h3 className="font-medium text-lg">No workouts logged yet</h3>
        <p className="mx-auto mt-1 max-w-sm text-muted-foreground text-sm">
          Log your first session — every set, rep, and weight. Chad will start
          tracking your PRs and volume the moment you do.
        </p>
      </div>
      <WorkoutBuilder
        customExercises={customExercises}
        mode="create"
        trigger={
          <Button className="gap-1.5">
            <Plus className="size-4" />
            Log your first workout
          </Button>
        }
      />
    </div>
  );
}
