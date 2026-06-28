"use client";

import { Dumbbell } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Standard plate sets (one of each size loaded per side, largest first).
const PLATES: Record<"lb" | "kg", number[]> = {
  lb: [45, 35, 25, 10, 5, 2.5],
  kg: [25, 20, 15, 10, 5, 2.5, 1.25],
};
// Common bar weights per unit; first is the default.
const BARS: Record<"lb" | "kg", number[]> = {
  lb: [45, 35, 15],
  kg: [20, 15, 10],
};

/**
 * Barbell plate calculator — the gym staple. Enter the total weight on the bar
 * and it shows what to load per side from a standard plate set. Pure client
 * math; lives beside the rest timer in the workout builder.
 */
export function PlateCalculator() {
  const [unit, setUnit] = useState<"lb" | "kg">("lb");
  const [bar, setBar] = useState<number>(BARS.lb[0]);
  const [target, setTarget] = useState("");

  const total = Number(target);
  const valid = target.trim() !== "" && !Number.isNaN(total) && total >= bar;
  const perSide = valid ? (total - bar) / 2 : 0;

  // Greedily load the largest plates that fit into one side.
  const plates: number[] = [];
  let remaining = perSide;
  for (const p of PLATES[unit]) {
    while (remaining >= p - 1e-6) {
      plates.push(p);
      remaining -= p;
    }
  }
  const leftover = valid ? remaining : 0;

  function switchUnit(next: "lb" | "kg") {
    setUnit(next);
    setBar(BARS[next][0]);
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-background/40 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <Dumbbell className="size-4 shrink-0 text-blood" />
        <span className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
          Plates
        </span>

        <Input
          aria-label="Total weight on the bar"
          className="h-7 w-20"
          inputMode="decimal"
          onChange={(e) => setTarget(e.target.value)}
          placeholder="Total"
          value={target}
        />

        {/* Unit toggle */}
        <div className="flex items-center gap-1">
          {(["lb", "kg"] as const).map((u) => (
            <button
              className={cn(
                "rounded-md border px-2 py-1 text-xs transition-colors",
                unit === u
                  ? "border-blood/40 bg-blood/10 text-blood"
                  : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
              key={u}
              onClick={() => switchUnit(u)}
              type="button"
            >
              {u}
            </button>
          ))}
        </div>

        {/* Bar weight */}
        <div className="flex items-center gap-1">
          {BARS[unit].map((b) => (
            <button
              className={cn(
                "rounded-md border px-2 py-1 text-xs transition-colors",
                bar === b
                  ? "border-blood/40 bg-blood/10 text-blood"
                  : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
              key={b}
              onClick={() => setBar(b)}
              type="button"
            >
              {b} bar
            </button>
          ))}
        </div>
      </div>

      {/* Result */}
      {valid ? (
        plates.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-muted-foreground">Per side:</span>
            {plates.map((p, i) => (
              <span
                className="rounded-md border border-border bg-card px-1.5 py-0.5 font-medium tabular-nums"
                // biome-ignore lint/suspicious/noArrayIndexKey: plates repeat by value
                key={`${p}-${i}`}
              >
                {p}
              </span>
            ))}
            {leftover > 1e-6 && (
              <span className="text-muted-foreground">
                (+{Math.round(leftover * 100) / 100} {unit} short)
              </span>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground text-xs">
            Just the {bar} {unit} bar — no plates needed.
          </p>
        )
      ) : (
        target.trim() !== "" && (
          <p className="text-muted-foreground text-xs">
            Enter a total at or above the {bar} {unit} bar.
          </p>
        )
      )}
    </div>
  );
}
