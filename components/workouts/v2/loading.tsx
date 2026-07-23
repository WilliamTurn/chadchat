// Streaming fallback for the workout subpages: quiet pulse blocks in the
// page's shape, matching the dashboard skeleton language.

export function WorkoutsPageLoading() {
  return (
    // biome-ignore lint/a11y/useSemanticElements: role="status" is the standard live-region idiom; swapping to <output> changes element semantics and default display for zero AT gain.
    <div aria-label="Loading" className="animate-pulse" role="status">
      <div className="h-8 w-56 rounded-lg bg-muted/60" />
      <div className="mt-3 h-4 w-80 max-w-full rounded bg-muted/40" />
      <div className="mt-8 flex flex-col gap-3">
        <div className="h-28 rounded-2xl border border-border bg-card" />
        <div className="h-28 rounded-2xl border border-border bg-card" />
        <div className="h-28 rounded-2xl border border-border bg-card" />
      </div>
    </div>
  );
}
