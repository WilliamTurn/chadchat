"use client";

import { Pause, Play, RotateCcw, Timer } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const PRESETS = [60, 90, 120, 180];

function mmss(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Parse a custom rest duration: plain seconds ("150") or m:ss ("2:30").
 * Returns whole seconds, or null when the text isn't a usable duration.
 */
export function parseRestDuration(raw: string): number | null {
  const v = raw.trim();
  if (!v) {
    return null;
  }
  if (v.includes(":")) {
    const [m, s, extra] = v.split(":");
    if (extra !== undefined) {
      return null;
    }
    const mins = Number(m);
    const secs = Number(s);
    if (
      !Number.isInteger(mins) ||
      !Number.isInteger(secs) ||
      mins < 0 ||
      secs < 0 ||
      secs > 59
    ) {
      return null;
    }
    const total = mins * 60 + secs;
    return total > 0 && total <= 3600 ? total : null;
  }
  const secs = Number(v);
  if (!Number.isInteger(secs) || secs <= 0 || secs > 3600) {
    return null;
  }
  return secs;
}

/**
 * A lightweight rest timer for between sets, the Hevy/Strong staple. Pick a
 * preset or type your own duration; it counts down and vibrates (where
 * supported) at zero. Purely client-side, no audio assets.
 */
export function RestTimer() {
  const [remaining, setRemaining] = useState(0);
  const [running, setRunning] = useState(false);
  const [custom, setCustom] = useState("");
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

  const customSeconds = parseRestDuration(custom);

  function startCustom() {
    if (customSeconds != null) {
      start(customSeconds);
    }
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-background/40 px-3 py-2">
      {/* What this is, in plain words (DSH-53). */}
      <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
        <Timer className="size-3.5 shrink-0 text-blood" />
        <span className="font-medium uppercase tracking-wide">Rest timer</span>
        <span>· Time your rests between sets</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
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

        {/* Custom duration (DSH-53): seconds or m:ss, Enter or Start. */}
        <div className="flex items-center gap-1">
          <Input
            aria-label="Custom rest duration (seconds or m:ss)"
            className="h-7 w-16 px-2 text-xs"
            inputMode="numeric"
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                startCustom();
              }
            }}
            placeholder="2:30"
            value={custom}
          />
          <Button
            className="h-7 px-2 text-xs"
            disabled={customSeconds == null}
            onClick={startCustom}
            size="sm"
            type="button"
            variant="outline"
          >
            Start
          </Button>
        </div>
      </div>
    </div>
  );
}
