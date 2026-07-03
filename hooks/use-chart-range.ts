"use client";

import { useMemo, useState } from "react";
import { MS_PER_DAY, spanDays } from "@/lib/chart/trend";

export type RangeKey = "1w" | "1m" | "3m" | "6m" | "1y" | "all" | "custom";

const RANGE_DAYS: Record<Exclude<RangeKey, "all" | "custom">, number> = {
  "1w": 7,
  "1m": 30,
  "3m": 90,
  "6m": 180,
  "1y": 365,
};

const RANGE_LABEL: Record<Exclude<RangeKey, "custom">, string> = {
  "1w": "1W",
  "1m": "1M",
  "3m": "3M",
  "6m": "6M",
  "1y": "1Y",
  all: "All",
};

export type RangePreset = { key: RangeKey; label: string };

/** A user-picked from/to window, inclusive ms bounds (DSH-52). */
export type CustomRange = { from: number; to: number };

export type RangeControlProps = {
  range: RangeKey;
  setRange: (r: RangeKey) => void;
  presets: RangePreset[];
  /** The active custom from/to window, when `range === "custom"`. */
  custom: CustomRange | null;
  /** Apply (or clear) a custom window; applying switches the range to it. */
  setCustom: (r: CustomRange | null) => void;
  /** Data extent (ms) so the custom pickers can't offer empty months. */
  dataBounds: { min: number; max: number } | null;
};

/**
 * Range state + preset filtering for a time series. Generic over any
 * oldest-first `{ t: number }[]`:
 *   - only offers presets the data span actually supports (no "6M" toggle on
 *     three weeks of data),
 *   - defaults to the tightest preset that still holds >= `minPoints` points —
 *     "recent but meaningful", never a two-point zoom — else "All",
 *   - supports a custom from/to window (DSH-52). Unlike presets, a custom
 *     window is honored literally — a sparse pick shows its sparse truth
 *     instead of silently falling back.
 *
 * Data is fixed per mount in this app, so the initial default is computed once.
 */
export function useChartRange<T extends { t: number }>(
  rows: T[],
  opts: { minPoints?: number } = {}
): {
  range: RangeKey;
  setRange: (r: RangeKey) => void;
  presets: RangePreset[];
  rows: T[];
  control: RangeControlProps;
} {
  const minPoints = opts.minPoints ?? 8;
  const span = spanDays(rows);

  const presets = useMemo<RangePreset[]>(() => {
    const keys = (["1w", "1m", "3m", "6m", "1y"] as const).filter(
      (r) => span > RANGE_DAYS[r]
    );
    return [...keys, "all" as const].map((key) => ({
      key,
      label: RANGE_LABEL[key],
    }));
  }, [span]);

  const initialRange = useMemo<RangeKey>(() => {
    const last = rows.at(-1)?.t ?? 0;
    for (const { key } of presets) {
      if (key === "all") {
        break;
      }
      const cutoff =
        last - RANGE_DAYS[key as Exclude<RangeKey, "all" | "custom">] * MS_PER_DAY;
      if (rows.filter((r) => r.t >= cutoff).length >= minPoints) {
        return key;
      }
    }
    return "all";
  }, [presets, rows, minPoints]);

  const [range, setRangeState] = useState<RangeKey>(initialRange);
  const [custom, setCustomState] = useState<CustomRange | null>(null);

  function setRange(r: RangeKey) {
    // "custom" only activates through setCustom (it needs a window to mean
    // anything); preset clicks just switch away and keep the last pick around.
    if (r !== "custom" || custom) {
      setRangeState(r);
    }
  }

  function setCustom(r: CustomRange | null) {
    setCustomState(r);
    setRangeState(r ? "custom" : initialRange);
  }

  const dataBounds = useMemo(
    () =>
      rows.length === 0
        ? null
        : { min: rows[0].t, max: rows[rows.length - 1].t },
    [rows]
  );

  const filtered = useMemo<T[]>(() => {
    if (rows.length === 0) {
      return rows;
    }
    if (range === "custom") {
      if (!custom) {
        return rows;
      }
      return rows.filter((r) => r.t >= custom.from && r.t <= custom.to);
    }
    if (range === "all") {
      return rows;
    }
    const cutoff = rows[rows.length - 1].t - RANGE_DAYS[range] * MS_PER_DAY;
    const next = rows.filter((r) => r.t >= cutoff);
    // Never collapse to a degenerate one-point view.
    return next.length >= 2 ? next : rows;
  }, [rows, range, custom]);

  return {
    range,
    setRange,
    presets,
    rows: filtered,
    control: { range, setRange, presets, custom, setCustom, dataBounds },
  };
}
