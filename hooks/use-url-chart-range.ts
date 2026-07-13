"use client";

/**
 * URL-synced chart range state (FIX-03). Drop-in wrappers around the two
 * existing range hooks - they COMPOSE with them (the briefing's rule), never
 * fork them:
 *
 *   - `useUrlChartWindow` wraps P2-C's `useChartWindow` (window-axis charts:
 *     water, sleep) via its published `initialKey` + `setKey`;
 *   - `useUrlChartRange` wraps the legacy s45 `useChartRange` (weight, macro,
 *     volume) via its additive `initialRange`/`initialCustom` opts, including
 *     the DSH-52 custom from/to window.
 *
 * Grammar (lib/url-state.ts): `?range=1w|1m|3m|6m|1y|all`, custom windows as
 * `?range=custom&from=YYYY-MM-DD&to=YYYY-MM-DD`. Writes are shallow
 * `replaceState` (a range toggle is a filter, not a navigation); back/forward
 * and deep links restore through `useSearchParams`. Invalid tokens fail safe
 * to each hook's computed default. When no param is present, behavior is
 * byte-identical to the wrapped hook.
 */

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import {
  type ChartRangeState,
  useChartWindow,
  type WindowRangeKey,
} from "@/components/charts/use-chart-window";
import {
  type CustomRange,
  type RangeControlProps,
  type RangeKey,
  type RangePreset,
  useChartRange,
} from "@/hooks/use-chart-range";
import { writeUrlParams } from "@/hooks/use-url-state";
import {
  customWindowToIso,
  parseCustomWindow,
  parseRangeToken,
} from "@/lib/url-state";
import type { ChartWindow } from "@/lib/chart/window";

const RANGE_PARAM = "range";
const FROM_PARAM = "from";
const TO_PARAM = "to";

/** URL-synced `useChartWindow`. Same signature plus `param` (default
 * `range`); pass a distinct param if two window charts ever share a page. */
export function useUrlChartWindow<T extends { t: number }>(
  rows: readonly T[],
  opts: { todayMs: number; minPoints?: number; param?: string }
): { window: ChartWindow; rows: T[]; control: ChartRangeState } {
  const param = opts.param ?? RANGE_PARAM;
  const searchParams = useSearchParams();
  const urlKey = parseRangeToken(searchParams.get(param)) as
    | WindowRangeKey
    | null;

  const chart = useChartWindow(rows, {
    todayMs: opts.todayMs,
    minPoints: opts.minPoints,
    initialKey: urlKey ?? undefined,
  });
  const { control } = chart;

  // Back/forward: adopt the URL's key when it differs and is offered.
  // biome-ignore lint/correctness/useExhaustiveDependencies: sync on URL change only; `control` is a fresh object every render
  useEffect(() => {
    if (
      urlKey &&
      urlKey !== control.key &&
      control.presets.some((p) => p.key === urlKey)
    ) {
      control.setKey(urlKey);
    }
  }, [urlKey]);

  const setKey = (k: WindowRangeKey) => {
    control.setKey(k);
    writeUrlParams({ [param]: k });
  };

  return { ...chart, control: { ...control, setKey } };
}

/** URL-synced legacy `useChartRange`, custom window included. Same shape.
 * `enabled: false` = behave exactly like the plain hook (for components that
 * also mount embedded on pages that do not own the params, e.g. the weight
 * chart's compact /today mount). */
export function useUrlChartRange<T extends { t: number }>(
  rows: T[],
  opts: {
    minPoints?: number;
    param?: string;
    enabled?: boolean;
    /** Caller-computed starting preset when the URL carries none (additive,
     * P56-A): today-anchored-window charts pick the tightest NON-EMPTY
     * window themselves; the URL key still wins. */
    defaultRange?: RangeKey;
  } = {}
): {
  range: RangeKey;
  setRange: (r: RangeKey) => void;
  presets: RangePreset[];
  rows: T[];
  control: RangeControlProps;
} {
  const enabled = opts.enabled ?? true;
  const param = opts.param ?? RANGE_PARAM;
  const searchParams = useSearchParams();
  const rawKey = enabled ? searchParams.get(param) : null;
  const urlCustom = useMemo(
    () =>
      rawKey === "custom"
        ? parseCustomWindow(
            searchParams.get(FROM_PARAM),
            searchParams.get(TO_PARAM)
          )
        : null,
    [rawKey, searchParams]
  );
  const urlKey = parseRangeToken(rawKey);

  const chart = useChartRange(rows, {
    minPoints: opts.minPoints,
    initialRange: urlKey ?? opts.defaultRange,
    initialCustom: urlCustom,
  });

  // Back/forward: adopt the URL's state when it differs.
  // biome-ignore lint/correctness/useExhaustiveDependencies: sync on URL change only; `chart` is a fresh object every render
  useEffect(() => {
    if (urlCustom) {
      const current = chart.control.custom;
      if (
        chart.range !== "custom" ||
        !current ||
        current.from !== urlCustom.from ||
        current.to !== urlCustom.to
      ) {
        chart.control.setCustom(urlCustom);
      }
    } else if (
      urlKey &&
      urlKey !== chart.range &&
      chart.presets.some((p) => p.key === urlKey)
    ) {
      chart.setRange(urlKey);
    }
  }, [urlKey, urlCustom]);

  const setRange = (r: RangeKey) => {
    chart.setRange(r);
    if (enabled && r !== "custom") {
      writeUrlParams({ [param]: r, [FROM_PARAM]: null, [TO_PARAM]: null });
    }
  };

  const setCustom = (c: CustomRange | null) => {
    chart.control.setCustom(c);
    if (!enabled) {
      return;
    }
    if (c) {
      const iso = customWindowToIso(c);
      writeUrlParams({ [param]: "custom", [FROM_PARAM]: iso.from, [TO_PARAM]: iso.to });
    } else {
      // Clearing returns the hook to its computed default; canonical URL =
      // no params at all.
      writeUrlParams({ [param]: null, [FROM_PARAM]: null, [TO_PARAM]: null });
    }
  };

  return {
    ...chart,
    setRange,
    control: { ...chart.control, setRange, setCustom },
  };
}
