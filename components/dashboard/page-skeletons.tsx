import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Shape-matched Suspense fallbacks for the dashboard pages (DSH-12).
 *
 * Each skeleton mirrors the real page's card structure — header, KPI/stat rows,
 * card grids, charts — so the loading state reads as "the page is arriving",
 * not a single flat grey block that then snaps to a busy layout.
 */

function SkelCard({
  className,
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card p-6",
        className
      )}
    >
      {children}
    </div>
  );
}

/** A circular macro dial + three macro bars (mirrors <MacroRings>). */
function RingsSkel() {
  return (
    <div className="flex flex-col items-center gap-4 py-2">
      <Skeleton className="size-40 rounded-full" />
      <div className="flex w-full max-w-sm flex-col gap-2.5">
        <Skeleton className="h-3 w-full rounded-full" />
        <Skeleton className="h-3 w-full rounded-full" />
        <Skeleton className="h-3 w-full rounded-full" />
      </div>
    </div>
  );
}

// ── /today ──────────────────────────────────────────────────────────────────
export function TodaySkeleton() {
  return (
    <div className="flex flex-col gap-6">
      {/* Header card: title row + KPI vital strip + streak strip */}
      <SkelCard className="p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="ml-auto h-8 w-28 rounded-lg" />
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton className="h-16 rounded-xl" key={i} />
          ))}
        </div>
        <div className="mt-5 flex items-center gap-2">
          <Skeleton className="size-7 rounded-full" />
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton className="size-7 rounded-full" key={i} />
          ))}
        </div>
      </SkelCard>

      {/* Calorie Tracker — full-width centerpiece */}
      <SkelCard>
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
        <div className="mt-2">
          <RingsSkel />
        </div>
      </SkelCard>

      {/* Goal + Training */}
      <div className="grid gap-6 md:grid-cols-2">
        <SkelCard className="h-44" />
        <SkelCard className="h-44" />
      </div>

      {/* Last workout + Meal plan */}
      <div className="grid gap-6 md:grid-cols-2">
        <SkelCard className="h-32" />
        <SkelCard className="h-32" />
      </div>

      {/* Hydration + Weight */}
      <div className="grid gap-6 md:grid-cols-2">
        <SkelCard className="h-56" />
        <SkelCard className="h-56" />
      </div>
    </div>
  );
}

// ── /workouts ───────────────────────────────────────────────────────────────
export function WorkoutsSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      {/* Action row + 3-up stat grid */}
      <div className="flex flex-col gap-4">
        <div className="flex justify-end gap-2">
          <Skeleton className="h-9 w-28 rounded-lg" />
          <Skeleton className="h-9 w-32 rounded-lg" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton className="h-[68px] rounded-xl" key={i} />
          ))}
        </div>
      </div>

      {/* Volume chart */}
      <SkelCard className="h-72" />

      {/* Personal records */}
      <div>
        <Skeleton className="mb-3 h-4 w-40" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
      </div>

      {/* History */}
      <div>
        <Skeleton className="mb-3 h-4 w-24" />
        <div className="flex flex-col gap-4">
          <SkelCard className="h-28" />
          <SkelCard className="h-28" />
        </div>
      </div>
    </div>
  );
}

// ── /nutrition ──────────────────────────────────────────────────────────────
export function NutritionSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      {/* Analyze form */}
      <SkelCard>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
        <Skeleton className="mt-4 h-32 w-full rounded-xl" />
      </SkelCard>

      {/* Today — macro dial */}
      <SkelCard>
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
        <div className="mt-2">
          <RingsSkel />
        </div>
      </SkelCard>

      {/* Macro trend chart */}
      <SkelCard className="h-72" />
    </div>
  );
}

// ── /progress ───────────────────────────────────────────────────────────────
export function ProgressSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      {/* Weight trend chart (owns KPI strip + toggle) */}
      <SkelCard className="h-80" />

      {/* Log an entry */}
      <SkelCard>
        <Skeleton className="mb-4 h-5 w-28" />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>
      </SkelCard>

      {/* Body measurements */}
      <SkelCard className="h-40" />
    </div>
  );
}

// ── /meal-plan ──────────────────────────────────────────────────────────────
export function MealPlanSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <SkelCard>
        <Skeleton className="h-6 w-48" />
        <Skeleton className="mt-2 h-4 w-72 max-w-full" />
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton className="h-16 rounded-xl" key={i} />
          ))}
        </div>
        <Skeleton className="mt-6 h-10 w-40 rounded-lg" />
      </SkelCard>
    </div>
  );
}

// ── /kitchen ────────────────────────────────────────────────────────────────
export function KitchenSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      {/* Snap-a-photo form */}
      <SkelCard>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-4 h-36 w-full rounded-xl" />
      </SkelCard>

      {/* History feed */}
      <div>
        <Skeleton className="mb-3 h-4 w-24" />
        <div className="flex flex-col gap-4">
          <SkelCard className="h-40" />
          <SkelCard className="h-40" />
        </div>
      </div>
    </div>
  );
}
