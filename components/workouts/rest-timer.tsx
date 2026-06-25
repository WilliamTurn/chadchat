"use client";

import { Pause, Play, RotateCcw, Timer } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PRESETS = [60, 90, 120, 180];

function mmss(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * A lightweight rest timer for between sets — the Hevy/Strong staple. Pick a
 * preset, it counts down; vibrates (where supported) when it hits zero. Purely
 * client-side, no audio assets.
 */
export function RestTimer() {
  const [remaining, setRemaining] = useState(0);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!running) {
      return;
    }
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          setRunning(false);
          if (typeof navigator !== "undefined" && "vibrate" in navigator) {
            navigator.vibrate?.(400);
          }
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [running]);

  function start(seconds: number) {
    setRemaining(seconds);
    setRunning(true);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background/40 px-3 py-2">
      <Timer className="size-4 shrink-0 text-blood" />
      <span
        className={cn(
          "min-w-[3ch] font-display font-semibold text-base tabular-nums",
          remaining > 0 && remaining <= 5 && running
            ? "text-blood"
            : "text-foreground"
        )}
      >
        {mmss(remaining)}
      </span>

      {remaining > 0 ? (
        <Button
          aria-label={running ? "Pause rest timer" : "Resume rest timer"}
          className="size-7"
          onClick={() => setRunning((v) => !v)}
          size="icon"
          type="button"
          variant="ghost"
        >
          {running ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
        </Button>
      ) : null}

      {remaining > 0 ? (
        <Button
          aria-label="Reset rest timer"
          className="size-7"
          onClick={() => {
            setRunning(false);
            setRemaining(0);
          }}
          size="icon"
          type="button"
          variant="ghost"
        >
          <RotateCcw className="size-3.5" />
        </Button>
      ) : null}

      <div className="flex items-center gap-1">
        {PRESETS.map((p) => (
          <button
            className="rounded-md border border-border px-2 py-1 text-muted-foreground text-xs transition-colors hover:bg-accent hover:text-foreground"
            key={p}
            onClick={() => start(p)}
            type="button"
          >
            {p < 120 ? `${p}s` : `${p / 60}m`}
          </button>
        ))}
      </div>
    </div>
  );
}
