/**
 * A ghost of the kitchen analysis Chad is producing (NUT-7). A fridge/pantry
 * raid takes a minute or two; instead of a generic grey block we show a shimmer
 * in the exact shape of the finished `AnalysisCard` — square photo, title, the
 * grade ring, the 4-up macro grid, verdict, and item chips — so the wait reads
 * as the card forming rather than nothing happening.
 */
export function KitchenAnalysisSkeleton() {
  return (
    <article
      aria-hidden
      className="overflow-hidden rounded-2xl border border-border bg-card"
    >
      <div className="flex animate-pulse flex-col gap-0 sm:flex-row">
        {/* Photo */}
        <div className="aspect-square w-full bg-muted sm:size-48 sm:shrink-0" />

        {/* Body */}
        <div className="flex min-w-0 flex-1 flex-col gap-3 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-2/3 rounded bg-muted" />
              <div className="h-3 w-1/3 rounded bg-muted/60" />
            </div>
            {/* Grade ring */}
            <div className="size-16 shrink-0 rounded-full border-4 border-muted" />
          </div>

          {/* Macro grid */}
          <div className="grid grid-cols-4 gap-2">
            {[0, 1, 2, 3].map((i) => (
              <div className="h-14 rounded-xl border border-border bg-muted/40" key={i} />
            ))}
          </div>

          {/* Verdict */}
          <div className="space-y-2 border-muted border-l-2 pl-3">
            <div className="h-3 w-full rounded bg-muted/60" />
            <div className="h-3 w-5/6 rounded bg-muted/60" />
          </div>

          {/* Item chips */}
          <div className="flex flex-wrap gap-1.5">
            {[14, 20, 16, 12].map((w) => (
              <div
                className="h-5 rounded-full bg-muted/50"
                key={w}
                style={{ width: `${w * 4}px` }}
              />
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}
