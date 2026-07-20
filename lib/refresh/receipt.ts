/**
 * MUTATION RECEIPT (FIX-10, P4 / DSH-66). Every data mutation names what it
 * changed, in contract vocabulary, and the dependent surfaces are DERIVED
 * from the metric registry instead of hand-maintained per action. This kills
 * the class of bug where a mutation refreshes the page it happened on and
 * silently leaves a sibling surface stale (the pre-FIX-10 progress actions
 * revalidated /progress only, while body.weight.* metrics render on /home,
 * /goals, and /reports too).
 *
 * Pure module (no server imports) so receipts can be built, returned to
 * clients, and unit-tested anywhere; lib/refresh/coordinator.ts is the
 * server-only half that applies a receipt to the Next.js cache.
 *
 * Adoption contract (P34-D and later phases): build the receipt with
 * loggingReceipt / targetReceipt / mutationReceipt, call
 * applyMutationReceipt(receipt) after the DB write succeeds, and keep the
 * action's return shape unchanged (attach the receipt to returns only when a
 * client consumes it). Never call revalidatePath directly for member-data
 * mutations; the graph owns the fan-out.
 */

import { METRICS } from "@/lib/contracts/metrics";
import { type DomainId, type RouteId, ROUTES } from "@/lib/contracts/routes";

export type MutationOp = "create" | "update" | "delete";

export type MutationReceipt = {
  /**
   * Domains whose data changed (lib/contracts/routes.ts vocabulary). A
   * logged-action mutation also carries "engagement": streak and logging
   * consistency count every domain's logs.
   */
  domains: DomainId[];
  /** The entity that changed, e.g. "meal", "waterLog", "nutritionTarget". */
  entity: string;
  op: MutationOp;
  /**
   * Member-local calendar days whose interpretation changed (ISO yyyy-mm-dd,
   * inclusive). endISO omitted = open-ended forward (target changes apply
   * from startISO onward). Omit entirely when the action cannot cheaply name
   * the day. Path-level revalidation ignores this today; it exists so
   * finer-grained consumers (tag caches, Coach context, reports) can scope
   * work without re-deriving what changed.
   */
  days?: { startISO: string; endISO?: string };
  /**
   * Registered routes that render this entity but are not yet derivable from
   * the metric registry (a REGISTRY GAP, not a preference). Example: Plan
   * summaries render on /home, but no plan metric is registered until
   * FIX-28's batch registration; the receipt names the surface explicitly so
   * the dependency is visible and deletable the day the registry covers it.
   */
  alsoSurfaces?: RouteId[];
};

/** A data mutation in one domain. */
export function mutationReceipt(args: {
  domain: DomainId;
  entity: string;
  op: MutationOp;
  days?: MutationReceipt["days"];
  /** Extra domains the entity spans (e.g. MealAnalysis rows power kitchen). */
  alsoDomains?: DomainId[];
  /** Registry-gap surfaces; see MutationReceipt.alsoSurfaces. */
  alsoSurfaces?: RouteId[];
}): MutationReceipt {
  return {
    domains: [args.domain, ...(args.alsoDomains ?? [])],
    entity: args.entity,
    op: args.op,
    days: args.days,
    alsoSurfaces: args.alsoSurfaces,
  };
}

/**
 * A LOGGED-ACTION mutation (meal, water, sleep, weigh-in, workout, ...):
 * adds "engagement", because the streak and weekly logging consistency on
 * /home count logs from every domain.
 */
export function loggingReceipt(args: {
  domain: DomainId;
  entity: string;
  op: MutationOp;
  days?: MutationReceipt["days"];
  alsoDomains?: DomainId[];
  alsoSurfaces?: RouteId[];
}): MutationReceipt {
  return mutationReceipt({
    ...args,
    alsoDomains: [...(args.alsoDomains ?? []), "engagement"],
  });
}

/**
 * A TARGET change (FIX-07 effective-dated: forward-only from the member's
 * today). Adherence renders wherever the domain's metrics render, so the
 * fan-out is the domain's surfaces.
 */
export function targetReceipt(args: {
  domain: DomainId;
  entity: string;
  todayISO?: string;
}): MutationReceipt {
  return {
    domains: [args.domain],
    entity: args.entity,
    op: "update",
    days: args.todayISO ? { startISO: args.todayISO } : undefined,
  };
}

/**
 * THE refresh graph: every registered route that renders data from the given
 * domains. Two contract-derived sources, unioned:
 *
 *   1. Metric surfaces: every route listed in `surfaces` of a registered
 *      metric belonging to a changed domain (lib/contracts/metrics.ts).
 *   2. Domain routes: every registered route whose `domain` is a changed
 *      domain (detail/history/settings pages that show the domain's rows
 *      without registering a headline metric).
 *
 * Deliberately correctness-first: over-revalidating a route is a cheap
 * cache miss; under-revalidating is a stale-surface bug.
 */
export function surfacesForDomains(
  domains: readonly DomainId[]
): RouteId[] {
  const wanted = new Set<DomainId>(domains);
  const out = new Set<RouteId>();
  for (const def of Object.values(METRICS)) {
    if (wanted.has(def.domain)) {
      for (const routeId of def.surfaces) {
        out.add(routeId);
      }
    }
  }
  for (const [routeId, def] of Object.entries(ROUTES) as [
    RouteId,
    (typeof ROUTES)[RouteId],
  ][]) {
    if (wanted.has(def.domain)) {
      out.add(routeId);
    }
  }
  return [...out];
}

/** The dependent surfaces of one receipt. */
export function surfacesForReceipt(receipt: MutationReceipt): RouteId[] {
  const out = new Set<RouteId>(surfacesForDomains(receipt.domains));
  for (const routeId of receipt.alsoSurfaces ?? []) {
    out.add(routeId);
  }
  return [...out];
}
