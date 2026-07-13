"use client";

/**
 * The reactive core of the FIX-03 URL-state system. One hook, one law:
 * the URL is the single source of truth for restorable view state.
 *
 * Mechanics (per the evidence-p34b teardown):
 *   - reads go through `useSearchParams`, which Next.js keeps in sync with
 *     BOTH back/forward (popstate) and the shallow History API writes below,
 *     so restoration is the URL, not a parallel store;
 *   - writes are SHALLOW (`window.history.replaceState`/`pushState`): no
 *     server round-trip, the RSC payload is untouched;
 *   - `replace` is the default (filter changes never spam history);
 *     `push` is for navigation-like changes only (opening a drill-down or a
 *     report), so Back closes what the member just opened;
 *   - `debounceMs` coalesces typing bursts: the on-screen value is instant,
 *     the URL updates when the burst settles.
 *
 * Every param is parsed/serialized through a `UrlCodec` from
 * `lib/url-state.ts`: invalid values fail safe to the default, and a param
 * at its default is omitted from the URL (canonical form).
 */

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { applyParams, type UrlCodec } from "@/lib/url-state";

export type UrlHistoryMode = "replace" | "push";

/** Shallow-write param updates onto the current URL (null deletes a param).
 * Path and hash are preserved, so the helper works unchanged on any current
 * or future route (DEC-02 category routes included). */
export function writeUrlParams(
  updates: Record<string, string | null>,
  mode: UrlHistoryMode = "replace"
): void {
  const search = applyParams(
    new URLSearchParams(window.location.search),
    updates
  );
  const qs = search.toString();
  const url = `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`;
  if (mode === "push") {
    window.history.pushState(null, "", url);
  } else {
    window.history.replaceState(null, "", url);
  }
}

/**
 * One URL query param as React state.
 *
 *   const [metric, setMetric] = useUrlParam("metric", METRIC_PARAM);
 *   setMetric("protein");                      // replace (default)
 *   setMetric(id, { history: "push" });        // navigation-like change
 *
 * The setter updates local state immediately and writes the URL shallowly
 * (debounced when `debounceMs` is set). External URL changes (back/forward,
 * a Link, another writer) flow back in through `useSearchParams`.
 */
export function useUrlParam<T>(
  key: string,
  codec: UrlCodec<T>,
  opts: { history?: UrlHistoryMode; debounceMs?: number } = {}
): [T, (value: T, over?: { history?: UrlHistoryMode }) => void] {
  const searchParams = useSearchParams();
  const raw = searchParams.get(key);

  // The codec/opts are captured in refs so inline codec literals at call
  // sites cannot churn effect deps or the setter's identity.
  const codecRef = useRef(codec);
  codecRef.current = codec;
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const [value, setValue] = useState<T>(() => codec.parse(raw));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Adopt external URL changes (back/forward, Links, other writers). While a
  // debounced write is pending, the local value is newer than the URL; keep it.
  useEffect(() => {
    if (timer.current != null) {
      return;
    }
    setValue((prev) =>
      (codecRef.current.serialize(prev) ?? null) === raw
        ? prev
        : codecRef.current.parse(raw)
    );
  }, [raw]);

  // Never fire a stale debounced write after unmount (e.g. mid-navigation).
  useEffect(
    () => () => {
      if (timer.current != null) {
        clearTimeout(timer.current);
      }
    },
    []
  );

  const set = useCallback(
    (next: T, over?: { history?: UrlHistoryMode }) => {
      setValue(next);
      const write = () =>
        writeUrlParams(
          { [key]: codecRef.current.serialize(next) },
          over?.history ?? optsRef.current.history ?? "replace"
        );
      const debounceMs = optsRef.current.debounceMs;
      if (debounceMs) {
        if (timer.current != null) {
          clearTimeout(timer.current);
        }
        timer.current = setTimeout(() => {
          timer.current = null;
          write();
        }, debounceMs);
      } else {
        write();
      }
    },
    [key]
  );

  return [value, set];
}
