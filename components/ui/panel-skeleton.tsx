import { PANEL_ROLES, type PanelRole } from "@/lib/contracts/panels";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * ROLE-SIZED PANEL SKELETON (FIX-38, P2-E). The page-level Suspense fallback
 * for a dashboard panel: a card-shaped placeholder that reserves the role's
 * MINIMUM height budget from lib/contracts/panels.ts, so data arrival never
 * shifts layout (performance-budget zero-shift law).
 *
 * Scope note: a MOUNTED panel in its loading state renders through the panel
 * system's own state machine (components/panels/panel-frame.tsx). This
 * primitive is for the moment BEFORE that, when the panel component itself is
 * still suspended, and for any non-panel surface that needs a card-shaped
 * reservation.
 */
export function PanelSkeleton({
  role,
  className,
}: {
  role: PanelRole;
  className?: string;
}) {
  const [minHeight] = PANEL_ROLES[role].heightRange;

  return (
    <div
      aria-hidden
      className={cn(
        "flex flex-col gap-4 rounded-2xl border border-border bg-card p-6",
        className
      )}
      data-role={role}
      data-slot="panel-skeleton"
      style={{ minHeight }}
    >
      <div className="flex items-center gap-3">
        <Skeleton className="size-9 rounded-xl" />
        <Skeleton className="h-4 w-28" />
      </div>
      <Skeleton className="h-8 w-32" />
      <Skeleton className="min-h-6 w-full flex-1" />
    </div>
  );
}
