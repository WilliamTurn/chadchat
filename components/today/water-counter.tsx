"use client";

import { Droplet, Minus, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { addWater, removeWater } from "@/app/nutrition/actions";
import { Button } from "@/components/ui/button";

const GLASS_ML = 250;
const GLASSES_TARGET = 8;

/**
 * Lightweight daily water counter. Each tap is one 250 ml glass; the row sums
 * the day's WaterLog server-side and we render it as filled droplets toward an
 * 8-glass (2 L) default target — a standard diary staple.
 */
export function WaterCounter({ totalMl }: { totalMl: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const glasses = Math.round(totalMl / GLASS_ML);
  const liters = (totalMl / 1000).toFixed(totalMl % 1000 === 0 ? 0 : 1);

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        router.refresh();
      } else {
        toast.error(result.error ?? "Couldn't update water.");
      }
    });
  }

  return (
    <div className="mt-4 flex items-center gap-3 rounded-xl border border-border bg-background/40 px-4 py-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <Droplet className="size-4 text-sky-400" />
          <span className="font-medium text-sm">Water</span>
          <span className="text-muted-foreground text-xs">
            {liters} L · {glasses}/{GLASSES_TARGET} glasses
          </span>
        </div>
        <div className="flex gap-1">
          {Array.from({ length: GLASSES_TARGET }).map((_, i) => (
            <span
              className={`h-1.5 flex-1 rounded-full ${
                i < glasses ? "bg-sky-400" : "bg-border"
              }`}
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length meter
              key={i}
            />
          ))}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          aria-label="Remove a glass"
          className="size-8"
          disabled={pending || glasses === 0}
          onClick={() => run(removeWater)}
          size="icon"
          variant="outline"
        >
          <Minus className="size-4" />
        </Button>
        <Button
          aria-label="Add a glass"
          className="size-8"
          disabled={pending}
          onClick={() => run(addWater)}
          size="icon"
          variant="outline"
        >
          <Plus className="size-4" />
        </Button>
      </div>
    </div>
  );
}
