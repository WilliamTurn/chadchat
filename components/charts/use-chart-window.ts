"use client";

/**
 * Range state for the shared chart system (FIX-18). Unlike the older
 * hooks/use-chart-range.ts (which filters rows and lets the axis follow the
 * data extent), this hook resolves every range key to a full ChartWindow so
 * the axis always spans the WINDOW (DSH-60): sparse data reads sparse.
 *
 * `todayMs` is always passed in (member-local day anchor, or the fixture
 * anchor) so charts stay deterministic and testable.
 */

import { useMemo, useState } from "react";
import { MS_PER_DAY } from "@/lib/chart/trend";
import {
  type ChartWindow,
  clampToWindow,
  windowEndingAt,
  windowFromExtent,
} from "@/lib/chart/window";

export type WindowRangeKey = "1w" | "1m" | "3m" | "6m" | "1y" | "all";

const RANGE_DAYS: Record<Exclude<WindowRangeKey, "all">, number> = {
  "1w": 7,
  "1m": 30,
  "3m": 90,
  "6m": 180,
  "1y": 365,
};

const SEGMENT_LABEL: Record<WindowRangeKey, string> = {
  "1w": "1W",
  "1m": "1M",
  "3m": "3M",
  "6m": "6M",
  "1y": "1Y",
  all: "All",
};

/** Member-facing window phrase, used in captions and text summaries. */
const MEMBER_LABEL: Record<WindowRangeKey, string> = {
  "1w": "last 7 days",
  "1m": "last 30 days",
  "3m": "last 3 months",
  "6m": "last 6 months",
  "1y": "last year",
  all: "all time",
};

export type ChartRangePreset = { key: WindowRangeKey; label: string };

export type ChartRangeState = {
  key: WindowRangeKey;
  setKey: (k: WindowRangeKey) => void;
  presets: ChartRangePreset[];
  /** Member-facing phrase for the active window ("last 30 days"). */
  rangeLabel: string;
};

export function useChartWindow<T extends { t: number }>(
  rows: readonly T[],
  opts: {
    /** 00:00-UTC anchor of the member-local today. Required (determinism). */
    todayMs: number;
    /** Presets keep widening until one holds at least this many points. */
    minPoints?: number;
    /** Force a starting key (fixtures); default picks the tightest useful one. */
    initialKey?: WindowRangeKey;
  }
): {
  window: ChartWindow;
  /** Rows inside the active window (points at their true dates). */
  rows: T[];
  control: ChartRangeState;
} {
  const { todayMs, minPoints = 8, initialKey } = opts;

  const presets = useMemo<ChartRangePreset[]>(() => {
    const first = rows.length ? Math.min(...rows.map((r) => r.t)) : todayMs;
    const daysCovered = Math.round((todayMs - first) / MS_PER_DAY) + 1;
    const keys = (["1w", "1m", "3m", "6m", "1y"] as const).filter(
      (k) => daysCovered > RANGE_DAYS[k]
    );
    return [...keys, "all" as const].map((key) => ({
      key,
      label: SEGMENT_LABEL[key],
    }));
  }, [rows, todayMs]);

  const defaultKey = useMemo<WindowRangeKey>(() => {
    if (initialKey) {
      return initialKey;
    }
    for (const { key } of presets) {
      if (key === "all") {
        break;
      }
      const w = windowEndingAt(todayMs, RANGE_DAYS[key]);
      if (clampToWindow(rows, w).length >= minPoints) {
        return key;
      }
    }
    return "all";
  }, [presets, rows, todayMs, minPoints, initialKey]);

  const [key, setKey] = useState<WindowRangeKey>(defaultKey);

  const window = useMemo<ChartWindow>(
    () =>
      key === "all"
        ? windowFromExtent(rows, todayMs)
        : windowEndingAt(todayMs, RANGE_DAYS[key]),
    [key, rows, todayMs]
  );

  const clamped = useMemo(() => clampToWindow(rows, window), [rows, window]);

  return {
    window,
    rows: clamped,
    control: { key, setKey, presets, rangeLabel: MEMBER_LABEL[key] },
  };
}

/** The fixed member-facing label for a window built without the hook. */
export function rangeLabelForDays(days: number): string {
  const match = (Object.entries(RANGE_DAYS) as [WindowRangeKey, number][]).find(
    ([, d]) => d === days
  );
  return match ? MEMBER_LABEL[match[0]] : `last ${days} days`;
}
