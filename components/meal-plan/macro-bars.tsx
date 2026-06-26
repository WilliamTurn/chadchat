import { cn } from "@/lib/utils";

export type MacroValues = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

type MacroKey = keyof MacroValues;

const MACROS: { key: MacroKey; label: string; unit: string; color: string }[] = [
  { key: "calories", label: "Calories", unit: "", color: "#a4161a" },
  { key: "protein", label: "Protein", unit: "g", color: "#38bdf8" },
  { key: "carbs", label: "Carbs", unit: "g", color: "#fbbf24" },
  { key: "fat", label: "Fat", unit: "g", color: "#a78bfa" },
];

/** Within ±8% of target reads as "on target". */
function statusFor(
  key: MacroKey,
  actual: number,
  target: number | null
): "good" | "over" | "under" | "none" {
  if (target == null || target <= 0) {
    return "none";
  }
  const ratio = actual / target;
  if (ratio > 1.08) {
    return "over";
  }
  if (ratio < 0.92) {
    return "under";
  }
  return "good";
}

function captionFor(
  status: ReturnType<typeof statusFor>,
  diff: number,
  unit: string
): { text: string; tone: string } {
  if (status === "over") {
    return { text: `${diff}${unit} over`, tone: "text-blood" };
  }
  if (status === "under") {
    return { text: `${diff}${unit} under`, tone: "text-amber-500" };
  }
  if (status === "good") {
    return { text: "on target", tone: "text-emerald-500" };
  }
  return { text: "", tone: "" };
}

/**
 * A day's actual macros against the plan's target — four labelled progress bars.
 * Honest about misses: over shows in red, under in amber, on-target in green.
 * Shared by the day panel and the week summary.
 */
export function MacroBars({
  actual,
  target,
  className,
}: {
  actual: MacroValues;
  target: MacroValues | null;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4", className)}>
      {MACROS.map(({ key, label, unit, color }) => {
        const a = Math.round(actual[key]);
        const t = target ? Math.round(target[key]) : null;
        const status = statusFor(key, a, t);
        const pct = t ? Math.min(100, (a / t) * 100) : 0;
        const diff = t ? Math.abs(a - t) : 0;
        const caption = captionFor(status, diff, unit);

        return (
          <div className="min-w-0" key={key}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-muted-foreground text-xs">{label}</span>
              <span className="font-semibold text-sm tabular-nums">
                {a.toLocaleString()}
                {t != null && (
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    / {t.toLocaleString()}
                    {unit}
                  </span>
                )}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: t ? `${pct}%` : "0%",
                  backgroundColor:
                    status === "over" ? "#a4161a" : color,
                  opacity: status === "under" ? 0.55 : 1,
                }}
              />
            </div>
            {caption.text && (
              <div className={cn("mt-1 text-[11px]", caption.tone)}>
                {caption.text}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
