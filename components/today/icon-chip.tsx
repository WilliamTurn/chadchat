/**
 * A small domain-colored icon chip — a tinted rounded square holding a lucide
 * icon. The /today dashboard uses one consistent accent per domain so the page
 * reads as a cockpit (Whoop/Oura pattern) instead of a wall of identical red
 * icons, while staying restrained on Chad's blood-on-ink brand: color is an
 * accent, never a rainbow.
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ChipTone =
  | "blood"
  | "amber"
  | "violet"
  | "sky"
  | "indigo"
  | "emerald";

const TONES: Record<ChipTone, string> = {
  blood: "bg-blood/12 text-blood",
  amber: "bg-amber-400/12 text-amber-400",
  violet: "bg-violet-400/12 text-violet-400",
  sky: "bg-sky-400/12 text-sky-400",
  indigo: "bg-indigo-400/12 text-indigo-400",
  emerald: "bg-emerald-500/12 text-emerald-500",
};

export function IconChip({
  tone,
  children,
  className,
}: {
  tone: ChipTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-lg",
        TONES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
