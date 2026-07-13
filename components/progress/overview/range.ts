/**
 * The Progress overview's range vocabulary (FIX-32, P56-A). Plain module
 * (NO "use client"): the server page parses ?range with these and the
 * client control renders them; importing non-component values from a client
 * module into a server component yields client-reference proxies (the
 * round-1 `OVERVIEW_RANGES.some is not a function` bug), so the shared
 * constants live here.
 */

export type OverviewRangeKey = "1w" | "1m" | "3m" | "6m" | "1y";

export const OVERVIEW_RANGES: { key: OverviewRangeKey; label: string }[] = [
  { key: "1w", label: "1W" },
  { key: "1m", label: "1M" },
  { key: "3m", label: "3M" },
  { key: "6m", label: "6M" },
  { key: "1y", label: "1Y" },
];

export const OVERVIEW_RANGE_DAYS: Record<OverviewRangeKey, number> = {
  "1w": 7,
  "1m": 30,
  "3m": 90,
  "6m": 180,
  "1y": 365,
};

export const OVERVIEW_RANGE_LABEL: Record<OverviewRangeKey, string> = {
  "1w": "last 7 days",
  "1m": "last 30 days",
  "3m": "last 3 months",
  "6m": "last 6 months",
  "1y": "last year",
};

export function parseOverviewRange(
  raw: string | undefined
): OverviewRangeKey {
  return OVERVIEW_RANGES.some((r) => r.key === raw)
    ? (raw as OverviewRangeKey)
    : "1m";
}
