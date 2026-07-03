import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * One badge per plan status, shared by the /today plan card and the
 * /plans/[id] document (LC-15). "active" now renders too ("Current", tinted):
 * before, active plans carried no badge at all, so two simultaneously active
 * training plans were indistinguishable and nothing said which program the
 * member is actually on. The save path enforces one active plan per kind, so
 * "Current" is a real singular claim, not a decoration.
 */
const STATUS_LABELS: Record<string, { label: string; className?: string }> = {
  active: {
    label: "Current",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
  },
  achieved: { label: "Completed" },
  archived: { label: "Archived" },
};

export function PlanStatusBadge({
  status,
  className,
}: {
  status: "active" | "achieved" | "archived";
  className?: string;
}) {
  const s = STATUS_LABELS[status] ?? { label: status };
  return (
    <Badge className={cn(s.className, className)} variant="secondary">
      {s.label}
    </Badge>
  );
}
