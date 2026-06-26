"use client";

import { useMemo, useState } from "react";
import { MS_PER_DAY, spanDays } from "@/lib/chart/trend";

export type RangeKey = "1m" | "3m" | "6m" | "1y" | "all";

const RANGE_DAYS: Record<Exclude<RangeKey, "all">, number> = {
  "1m": 30,
  "3m": 90,
  "6m": 180,
  "1y": 365,
};

const RANGE_LABEL: Record<RangeKey, string> = {
  "1m": "1M",
  "3m": "3M",
  "6m": "6M",
  "1y": "1Y",
  all: "All",
};

export type RangePreset = { key: RangeKey; label: string };

export type RangeControlProps = {
  range: RangeKey;
  setRange: (r: RangeKey) => void;
  presets: RangePreset[];
};

/**
 * Range state + preset filtering for a time series. Generic over any
 * oldest-first `{ t: number }[]`:
 *   - only offers presets the data span actually supports (no "6M" toggle on
 *     three weeks of data),
 *   - defaults to the tightest preset that still holds >= `minPoints` points —
 *     "recent but meaningful", never a two-point zoom — else "All".
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
    const keys = (["1m", "3m", "6m", "1y"] as const).filter(
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
      const cutoff = last - RANGE_DAYS[key] * MS_PER_DAY;
      if (rows.filter((r) => r.t >= cutoff).length >= minPoints) {
        return key;
      }
    }
    return "all";
  }, [presets, rows, minPoints]);

  const [range, setRange] = useState<RangeKey>(initialRange);

  const filtered = useMemo<T[]>(() => {
    if (range === "all" || rows.length === 0) {
      return rows;
    }
    const cutoff = rows[rows.length - 1].t - RANGE_DAYS[range] * MS_PER_DAY;
    const next = rows.filter((r) => r.t >= cutoff);
    // Never collapse to a degenerate one-point view.
    return next.length >= 2 ? next : rows;
  }, [rows, range]);

  return {
    range,
    setRange,
    presets,
    rows: filtered,
    control: { range, setRange, presets },
  };
}
