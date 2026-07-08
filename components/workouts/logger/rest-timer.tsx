"use client";

import { Minus, Pause, Play, Plus, Timer, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useReward } from "@/components/dashboard/reward";
import { KpiHelp } from "@/components/dashboard/kpi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const PRESETS = [60, 90, 120, 180];
const DEFAULT_REST = 120;
const REST_DEFAULT_KEY = "chad:rest-default:v1";
const REST_AUTO_KEY = "chad:rest-auto:v1";

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

export type RestTimer = {
  remaining: number;
  running: boolean;
  /** Seconds a fresh auto/preset start counts down from. */
  defaultSeconds: number;
  /** Auto-start the countdown whenever a set is checked off. */
  autoStart: boolean;
  start: (seconds?: number) => void;
  adjust: (delta: number) => void;
  togglePause: () => void;
  skip: () => void;
  setDefaultSeconds: (seconds: number) => void;
  setAutoStart: (on: boolean) => void;
};

/**
 * The session rest timer (MOB-18), the Hevy/Strong staple upgraded to the
 * pro-app behavior set: auto-starts when a set is checked off (toggleable),
 * remembers your preferred duration, and is adjustable ±15s mid-countdown.
 * Chimes/buzzes at zero honoring the member's sound/vibration preferences.
 */
export function useRestTimer(): RestTimer {
  const reward = useReward();
  const [remaining, setRemaining] = useState(0);
  const [running, setRunning] = useState(false);
  const [defaultSeconds, setDefaultState] = useState(DEFAULT_REST);
  const [autoStart, setAutoState] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Preferences persist across sessions.
  useEffect(() => {
    try {
      const d = Number(localStorage.getItem(REST_DEFAULT_KEY));
      if (Number.isInteger(d) && d > 0 && d <= 3600) {
        setDefaultState(d);
      }
      const a = localStorage.getItem(REST_AUTO_KEY);
      if (a === "off") {
        setAutoState(false);
      }
    } catch {
      // storage unavailable; defaults are fine
    }
  }, []);

  useEffect(() => {
    if (!running) {
      return;
    }
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          setRunning(false);
          reward.effects("timer");
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
  }, [running, reward]);

  const start = useCallback(
    (seconds?: number) => {
      setRemaining(seconds ?? defaultSeconds);
      setRunning(true);
    },
    [defaultSeconds]
  );

  const adjust = useCallback((delta: number) => {
    setRemaining((r) => Math.max(0, Math.min(3600, r + delta)));
  }, []);

  const togglePause = useCallback(() => setRunning((v) => !v), []);

  const skip = useCallback(() => {
    setRunning(false);
    setRemaining(0);
  }, []);

  const setDefaultSeconds = useCallback((seconds: number) => {
    setDefaultState(seconds);
    try {
      localStorage.setItem(REST_DEFAULT_KEY, String(seconds));
    } catch {
      // ignore
    }
  }, []);

  const setAutoStart = useCallback((on: boolean) => {
    setAutoState(on);
    try {
      localStorage.setItem(REST_AUTO_KEY, on ? "on" : "off");
    } catch {
      // ignore
    }
  }, []);

  return {
    remaining,
    running,
    defaultSeconds,
    autoStart,
    start,
    adjust,
    togglePause,
    skip,
    setDefaultSeconds,
    setAutoStart,
  };
}

/** The rest-timer settings card in the logger's Tools section. */
export function RestTimerCard({ timer }: { timer: RestTimer }) {
  const [custom, setCustom] = useState("");
  const customSeconds = parseRestDuration(custom);

  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-border bg-background/40 px-3.5 py-3">
      <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
        <Timer className="size-3.5 shrink-0 text-blood" />
        <span className="font-medium uppercase tracking-wide">Rest timer</span>
        <KpiHelp label="Rest timer">
          Times your rest between sets. With auto-start on, the countdown
          begins the moment you check a set off, the way Hevy and Strong do
          it. While it runs, a countdown bar stays visible at the bottom of
          the screen with +15s / −15s buttons.
        </KpiHelp>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground text-xs">Rest length:</span>
        {PRESETS.map((p) => (
          <button
            className={cn(
              "h-9 rounded-md border px-2.5 text-xs transition-colors",
              timer.defaultSeconds === p
                ? "border-blood/40 bg-blood/10 font-medium text-blood"
                : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
            key={p}
            onClick={() => timer.setDefaultSeconds(p)}
            type="button"
          >
            {p < 120 ? `${p}s` : `${p / 60} min`}
          </button>
        ))}
        <div className="flex items-center gap-1">
          <Input
            aria-label="Custom rest length (seconds or m:ss)"
            className="h-9 w-16 px-2 text-xs"
            inputMode="numeric"
            onChange={(e) => setCustom(e.target.value)}
            placeholder="2:30"
            value={custom}
          />
          <Button
            className="h-9 px-2 text-xs"
            disabled={customSeconds == null}
            onClick={() => {
              if (customSeconds != null) {
                timer.setDefaultSeconds(customSeconds);
                setCustom("");
              }
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            Set
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-muted-foreground text-xs">
          <Switch
            aria-label="Auto-start the rest timer when a set is checked off"
            checked={timer.autoStart}
            onCheckedChange={timer.setAutoStart}
          />
          Start automatically when I check off a set
        </label>
        <Button
          className="h-9 gap-1.5 px-2.5 text-xs"
          onClick={() => timer.start()}
          size="sm"
          type="button"
          variant="outline"
        >
          <Play className="size-3.5" />
          Start now ({mmss(timer.defaultSeconds)})
        </Button>
      </div>
    </div>
  );
}

/**
 * The always-visible countdown while resting: a floating pill pinned above
 * the bottom edge so it survives scrolling anywhere in a long session.
 */
export function RestTimerBar({ timer }: { timer: RestTimer }) {
  if (timer.remaining <= 0) {
    return null;
  }
  return (
    <div className="-translate-x-1/2 fixed bottom-4 left-1/2 z-40 flex items-center gap-1 rounded-full border border-border bg-card/95 px-2 py-1.5 shadow-[var(--shadow-float)] backdrop-blur">
      <Timer
        className={cn(
          "ml-1 size-4",
          timer.remaining <= 5 && timer.running
            ? "text-blood"
            : "text-muted-foreground"
        )}
      />
      <span
        className={cn(
          "min-w-[4ch] text-center font-display font-semibold text-lg tabular-nums",
          timer.remaining <= 5 && timer.running ? "text-blood" : "text-foreground"
        )}
      >
        {mmss(timer.remaining)}
      </span>
      <Button
        aria-label="Shorten rest by 15 seconds"
        className="size-9 rounded-full"
        onClick={() => timer.adjust(-15)}
        size="icon"
        type="button"
        variant="ghost"
      >
        <Minus className="size-4" />
      </Button>
      <Button
        aria-label="Extend rest by 15 seconds"
        className="size-9 rounded-full"
        onClick={() => timer.adjust(15)}
        size="icon"
        type="button"
        variant="ghost"
      >
        <Plus className="size-4" />
      </Button>
      <Button
        aria-label={timer.running ? "Pause rest timer" : "Resume rest timer"}
        className="size-9 rounded-full"
        onClick={timer.togglePause}
        size="icon"
        type="button"
        variant="ghost"
      >
        {timer.running ? <Pause className="size-4" /> : <Play className="size-4" />}
      </Button>
      <Button
        aria-label="Skip the rest timer"
        className="size-9 rounded-full"
        onClick={timer.skip}
        size="icon"
        type="button"
        variant="ghost"
      >
        <X className="size-4" />
      </Button>
    </div>
  );
}
