/**
 * DATA-STATE CONTRACT (DSH-66 / Phase 1). The one model of "what state is this
 * data in", shared by every panel, chart, and report from Phase 2 on.
 *
 * The rule this exists to enforce, stated once so no card ever re-decides it:
 *
 *   MISSING IS NEVER RENDERED AS ZERO.
 *
 * "No meals logged" and "0 kcal eaten" are different facts. The type system
 * enforces the difference: an unlogged reading structurally has no value field
 * to render, so a card cannot accidentally print 0.
 *
 * Three layers, deliberately separate because they vary independently:
 *
 *   1. Entitlement  - may this member see this data at all? (locked)
 *   2. Fetch        - did we get an answer from the server? (loading / error)
 *   3. Reading      - what does the data itself say? (unlogged / logged,
 *                     with coverage, staleness, and estimation flags)
 *
 * A LOCKED panel is not an EMPTY panel is not a BROKEN panel (FIX-11):
 *   - locked  = plan gate. Show the capability teaser and the upgrade path.
 *     Never fake values, never an error tone, never a bare blank.
 *   - error   = we failed, the member did not. Keep last-known values visible
 *     when we have them, offer retry, never blame.
 *   - empty   = the member has not logged this yet. A designed first-run state
 *     (see standards/first-run.md), never a bare blank or a zero.
 *
 * Render precedence when layers conflict: locked > loading > error > data.
 * Locked wins even over loading because a locked member's data is never
 * fetched; loading wins over error because an in-flight retry supersedes the
 * failure it is retrying.
 */

/** How much of the requested window actually has logged data. */
export type Coverage = {
  /** Distinct member-local days with at least one logged row. */
  loggedDays: number;
  /** Days in the window the reading was computed over. */
  windowDays: number;
  /** Raw data points (rows, weigh-ins, sessions) behind the reading. */
  points: number;
  /** Days between the first and last point (0 for fewer than 2 points). */
  spanDays: number;
};

export const EMPTY_COVERAGE: Coverage = {
  loggedDays: 0,
  windowDays: 0,
  points: 0,
  spanDays: 0,
};

/**
 * A metric value plus the honesty metadata every consumer needs. `unlogged`
 * has NO value field: there is nothing to render except the designed
 * empty/unlogged treatment, and that is the point.
 */
export type MetricReading<T> =
  | { status: "unlogged"; coverage: Coverage }
  | {
      status: "logged";
      value: T;
      coverage: Coverage;
      /** Derived/estimated (trend weight, est. 1RM). Display must label it. */
      estimated: boolean;
      /**
       * Member-local days since the last logged row. 0 = logged today.
       * Freshness verdicts come from comparing this to the metric's
       * `staleAfterDays` (metric registry); a stale reading may be shown but
       * must be dated ("Last logged Jun 28"), never framed as current.
       */
      ageDays: number;
    };

/** Convenience constructors so call sites stay honest and terse. */
export function unloggedReading(
  coverage: Coverage = EMPTY_COVERAGE
): MetricReading<never> {
  return { status: "unlogged", coverage };
}

export function loggedReading<T>(
  value: T,
  opts: { coverage: Coverage; estimated?: boolean; ageDays?: number }
): MetricReading<T> {
  return {
    status: "logged",
    value,
    coverage: opts.coverage,
    estimated: opts.estimated ?? false,
    ageDays: opts.ageDays ?? 0,
  };
}

/**
 * The seven render states a panel can be in. Every panel in every later phase
 * resolves to exactly one of these, and the deterministic fixtures exercise
 * all seven (tests/fixtures/dashboard-states.ts).
 */
export type PanelState =
  | "locked" // entitlement gate; capability teaser + upgrade path
  | "loading" // skeleton with reserved height; never spinners in cards
  | "error" // retry + last-known values when available; no blame
  | "empty" // nothing ever logged in scope; designed first-run treatment
  | "sparse" // some data, below claim thresholds; show facts + coverage
  | "stale" // data exists but is old; show it dated, prompt a fresh log
  | "populated"; // enough fresh data for the full treatment

export type PanelStateInput = {
  locked: boolean;
  fetch: "loading" | "error" | "ready";
  reading: MetricReading<unknown>;
  /** From the metric registry; null = this metric never goes stale. */
  staleAfterDays: number | null;
  /**
   * Below this coverage the panel renders `sparse`. Defaults keep a panel
   * populated with any 2+ points; metrics with claim policies typically pass
   * the trend threshold from lib/contracts/claims.ts instead.
   */
  sparseBelow?: Pick<Coverage, "points">;
};

/**
 * THE state resolver. Pure, total, and order-fixed so every surface agrees on
 * precedence: locked > loading > error > data states.
 */
export function resolvePanelState(input: PanelStateInput): PanelState {
  if (input.locked) {
    return "locked";
  }
  if (input.fetch === "loading") {
    return "loading";
  }
  if (input.fetch === "error") {
    return "error";
  }
  const r = input.reading;
  if (r.status === "unlogged") {
    return "empty";
  }
  if (
    input.staleAfterDays != null &&
    r.ageDays > input.staleAfterDays
  ) {
    return "stale";
  }
  const sparseBelow = input.sparseBelow?.points ?? 2;
  if (r.coverage.points < sparseBelow) {
    return "sparse";
  }
  return "populated";
}

/**
 * Sum rows into a reading WITHOUT collapsing "no rows" into zero. This is the
 * helper that makes the missing-is-not-zero rule the path of least resistance:
 * cards call this instead of `rows.reduce(...)`.
 */
export function readingFromRows<Row, T>(
  rows: Row[],
  fold: (rows: Row[]) => T,
  coverage: Coverage,
  opts: { estimated?: boolean; ageDays?: number } = {}
): MetricReading<T> {
  if (rows.length === 0) {
    return unloggedReading(coverage);
  }
  return loggedReading(fold(rows), {
    coverage,
    estimated: opts.estimated,
    ageDays: opts.ageDays,
  });
}

/**
 * Coverage phrasing, the one member-facing form: "4 of 7 days logged".
 * Surfaces that interpret partial data must show this next to the claim
 * (lib/contracts/claims.ts decides WHETHER the claim is allowed at all).
 */
export function formatCoverage(c: Coverage): string {
  return `${c.loggedDays} of ${c.windowDays} days logged`;
}
