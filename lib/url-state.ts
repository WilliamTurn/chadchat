/**
 * URL-STATE GRAMMAR (FIX-03 / P34-B). Pure, React-free.
 *
 * The rule this module enforces, stated once so no surface re-decides it:
 *
 *   RESTORABLE VIEW STATE LIVES IN THE URL, CANONICALLY.
 *
 * A member who leaves a filtered view and comes back (browser back/forward,
 * reload, or a shared deep link) lands in the same context. The benchmark
 * teardown and the full grammar are in `evidence-p34b/` (Stripe Dashboard URL
 * architecture + Linear's durable-vs-ephemeral filter split + nuqs/TanStack
 * mechanics). The contract:
 *
 *   - tokens are human-readable (range keys `1w..all`, days `YYYY-MM-DD`),
 *     never epochs;
 *   - a param at its default is OMITTED (canonical URLs; no `?muscle=all`
 *     residue);
 *   - invalid/unknown values FAIL SAFE to the default, never throw;
 *   - categories are PATH state (DEC-02: `/progress/body` is a route, not
 *     `?tab=body`); query params carry only view state within a page.
 *
 * React bindings live in `hooks/use-url-state.ts` (core read/write) and
 * `hooks/use-url-chart-range.ts` (URL-synced chart range hooks). Server pages
 * that read their params directly (e.g. /nutrition `?day=`) validate through
 * the same helpers.
 */

/** Parse/serialize pair for one query param. */
export type UrlCodec<T> = {
  /** Raw param value (null = absent) to a safe value; invalid = default. */
  parse: (raw: string | null) => T;
  /** Value to its param string; null = omit the param (default value). */
  serialize: (value: T) => string | null;
};

/** A closed set of tokens with a default that is omitted from the URL. */
export function enumParam<T extends string>(
  values: readonly T[],
  defaultValue: T
): UrlCodec<T> {
  return {
    parse: (raw) =>
      raw != null && (values as readonly string[]).includes(raw)
        ? (raw as T)
        : defaultValue,
    serialize: (value) => (value === defaultValue ? null : value),
  };
}

/** Free text (search boxes). Empty/whitespace is the default and is omitted. */
export function textParam(): UrlCodec<string> {
  return {
    parse: (raw) => raw ?? "",
    serialize: (value) => (value.trim() === "" ? null : value),
  };
}

/** An optional identifier (open panel, selected record). null = closed/none. */
export function idParam(): UrlCodec<string | null> {
  return {
    parse: (raw) => (raw ? raw : null),
    serialize: (value) => (value ? value : null),
  };
}

/* --------------------------------------------------------------------------
 * Calendar days and chart ranges
 * ------------------------------------------------------------------------ */

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** True for a real `YYYY-MM-DD` calendar day (rejects 2026-02-31, which
 * Date.parse would silently roll over to March 3; the round-trip catches it). */
export function isIsoDay(raw: string | null): raw is string {
  if (raw == null || !ISO_DAY.test(raw)) {
    return false;
  }
  const ms = Date.parse(`${raw}T00:00:00Z`);
  return !Number.isNaN(ms) && new Date(ms).toISOString().slice(0, 10) === raw;
}

/**
 * The app's chart range tokens (both `hooks/use-chart-range.ts` and
 * `components/charts/use-chart-window.ts` speak these). `custom` is not a
 * standalone token: it exists in a URL only as `range=custom&from=&to=`.
 */
export const CHART_RANGE_TOKENS = [
  "1w",
  "1m",
  "3m",
  "6m",
  "1y",
  "all",
] as const;
export type ChartRangeToken = (typeof CHART_RANGE_TOKENS)[number];

/** Fail-safe: null for anything that is not a preset range token. */
export function parseRangeToken(raw: string | null): ChartRangeToken | null {
  return raw != null &&
    (CHART_RANGE_TOKENS as readonly string[]).includes(raw)
    ? (raw as ChartRangeToken)
    : null;
}

/** A custom from/to window in ms, matching the DSH-52 picker's convention:
 * from = 00:00:00Z of its day, to = 23:59:59Z of its day. */
export type CustomWindowMs = { from: number; to: number };

/** Parse `from`/`to` ISO days into the picker's ms window; swapped bounds are
 * reordered (same forgiveness as the picker); anything invalid = null. */
export function parseCustomWindow(
  fromRaw: string | null,
  toRaw: string | null
): CustomWindowMs | null {
  if (!(isIsoDay(fromRaw) && isIsoDay(toRaw))) {
    return null;
  }
  const [fromDay, toDay] = fromRaw <= toRaw ? [fromRaw, toRaw] : [toRaw, fromRaw];
  return {
    from: Date.parse(`${fromDay}T00:00:00Z`),
    to: Date.parse(`${toDay}T23:59:59Z`),
  };
}

/** The ms window back to its canonical ISO-day params. */
export function customWindowToIso(w: CustomWindowMs): {
  from: string;
  to: string;
} {
  return {
    from: new Date(w.from).toISOString().slice(0, 10),
    to: new Date(w.to).toISOString().slice(0, 10),
  };
}

/* --------------------------------------------------------------------------
 * Canonical query mutation
 * ------------------------------------------------------------------------ */

/** Apply updates to a query: string sets, null deletes (default omission).
 * Untouched params (including unknown ones) are preserved as-is. */
export function applyParams(
  search: URLSearchParams,
  updates: Record<string, string | null>
): URLSearchParams {
  for (const [key, value] of Object.entries(updates)) {
    if (value == null) {
      search.delete(key);
    } else {
      search.set(key, value);
    }
  }
  return search;
}
