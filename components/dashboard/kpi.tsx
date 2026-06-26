import { cn } from "@/lib/utils";

export type KpiTone = "neutral" | "good" | "bad";

/**
 * A single dashboard stat (value + label, with an optional sub-caption). Shared
 * across every dashboard chart card so weight, 1RM, nutrition and water read
 * identically. `size="lg"` is the headline stat; `tone` colors a value that's
 * moving toward the goal (good) vs away from it (bad).
 */
export function Kpi({
  label,
  value,
  sub,
  tone = "neutral",
  size = "md",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: KpiTone;
  size?: "md" | "lg";
}) {
  return (
    <div className="min-w-0">
      <div
        className={cn(
          "font-semibold tracking-tight tabular-nums",
          size === "lg" ? "text-2xl" : "text-xl",
          tone === "good" && "text-emerald-500",
          tone === "bad" && "text-blood"
        )}
      >
        {value}
      </div>
      <div className="mt-0.5 text-muted-foreground text-xs">
        {label}
        {sub && (
          <span className="ml-1 text-muted-foreground/70">{sub}</span>
        )}
      </div>
    </div>
  );
}
