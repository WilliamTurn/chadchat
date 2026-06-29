/**
 * A ghost of the meal plan that's being generated (NUT-4). Generation takes a
 * minute or two; instead of just a spinner, we show a shimmer in the exact shape
 * of the finished plan — title, Chad's intro, the macro dial + bars, and one
 * card per meal the user asked for — so the wait feels like the plan is forming.
 */
export function PlanSkeleton({ meals = 4 }: { meals?: number }) {
  const mealCards = Array.from({ length: Math.max(1, Math.min(meals, 8)) });
  return (
    <div
      aria-hidden
      className="animate-pulse rounded-2xl border border-border bg-card p-5"
    >
      {/* Title + day tabs */}
      <div className="h-5 w-2/3 rounded bg-muted" />
      <div className="mt-3 flex gap-2">
        {[0, 1, 2].map((i) => (
          <div className="h-7 w-16 rounded-full bg-muted/70" key={i} />
        ))}
      </div>

      {/* Chad's intro */}
      <div className="mt-5 space-y-2">
        <div className="h-3 w-full rounded bg-muted/70" />
        <div className="h-3 w-11/12 rounded bg-muted/70" />
        <div className="h-3 w-4/5 rounded bg-muted/70" />
      </div>

      {/* Macro dial + bars */}
      <div className="mt-6 flex items-center gap-5">
        <div className="size-24 shrink-0 rounded-full border-8 border-muted" />
        <div className="flex-1 space-y-3">
          {[0, 1, 2].map((i) => (
            <div className="h-2.5 w-full rounded-full bg-muted/70" key={i} />
          ))}
        </div>
      </div>

      {/* One card per meal */}
      <div className="mt-6 space-y-3">
        {mealCards.map((_, i) => (
          <div className="rounded-xl border border-border p-4" key={i}>
            <div className="h-4 w-1/3 rounded bg-muted" />
            <div className="mt-3 space-y-2">
              <div className="h-3 w-full rounded bg-muted/60" />
              <div className="h-3 w-5/6 rounded bg-muted/60" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
