/**
 * PANEL-ROLE CONTRACT (DSH-66 / Phase 1). The typed taxonomy of dashboard
 * panels that Phase 2 (FIX-14/15/16) implements on top of the existing
 * ModuleCard / SectionBand / IconChip grammar. Phase 1 defines the contract;
 * Phase 2 builds the components; no live card changes here.
 *
 * The rules this encodes, so no card ever re-invents them:
 *   - One panel, one role. A panel is a status readout, a logger, a trend, a
 *     plan summary, an insight, a milestone, or a compact summary. Never an
 *     uncontrolled mixture.
 *   - At most ONE primary action per panel. Settings live in overflow or on
 *     the detail page; destructive actions never appear on a dashboard panel.
 *   - Every panel that has a detail page links to it BY NAME ("Workout
 *     history", "Sleep trends"), via ModuleHeader's viewHref/viewLabel slot.
 *     Generic "View all" is a contract violation (see copy.ts).
 *   - Size follows information, not sibling symmetry. Role span defaults
 *     below; equal height is never a goal in itself.
 *   - Every panel renders ALL SEVEN data states (lib/contracts/data-state.ts)
 *     deliberately. The deterministic fixtures exercise them.
 *
 * Compatibility with what exists (verified 2026-07-11): ModuleCard already
 * fixes the three-slot layout (header with one named view link, body, footer
 * with Ask Chad anchored left and a right-aligned action cluster). The role
 * contract keeps all of that and adds the role discipline on top.
 */

import type { PanelState } from "./data-state";
import type { MetricId } from "./metrics";
import type { RouteId } from "./routes";

export type PanelRole =
  | "status" // one current value + target ("1,840 of 2,300 kcal")
  | "quick-log" // status + a low-friction logging action (the trackers)
  | "trend" // an outcome + compact chart (weight trend)
  | "plan" // today's/next slice of a plan document
  | "insight" // one evidence-backed observation
  | "milestone" // a reward moment (PR, streak, completed goal)
  | "summary"; // compact cross-link into a domain (Progress highlights)

export type PanelRoleContract = {
  role: PanelRole;
  purpose: string;
  /**
   * Slots the role MUST render (ModuleCard grammar names). Owner law s181:
   * EVERY dashboard panel carries a real visual, so "visual" is required on
   * every role; its scale matches the role (a compact ring/bar on a status
   * cell, strip + chart on trackers, a full chart on trend panels).
   */
  requiredSlots: readonly (
    | "header" // IconChip + canonical title
    | "headline" // the one number/statement the panel exists for
    | "visual" // chart, ring, bars, or week strip (see reward-visual.md)
    | "target-context" // target/goal framing next to the headline
    | "coverage" // data coverage when interpretation depends on it
    | "detail-link" // named destination in the header slot
    | "footer" // Ask Chad slot + right-aligned action cluster
  )[];
  /** 0 or 1. Two primaries on one panel is a contract violation. */
  maxPrimaryActions: 0 | 1;
  /** Whether the named detail link is required. */
  detailLink: "required" | "optional";
  /**
   * Desktop grid span guidance at the xl 3-column dashboard grid (spans are
   * per-grid, revisited in Phase 2 fixtures; the invariant is that span
   * follows information density, not symmetry).
   */
  defaultSpan: 1 | 2 | 3;
  /** Vertical budget so empty panels cannot squat on dead space (px). */
  heightRange: readonly [number, number];
  destructiveActions: "never";
  settingsPlacement: "overflow" | "detail-page" | "none";
};

export const PANEL_ROLES: Record<PanelRole, PanelRoleContract> = {
  status: {
    role: "status",
    purpose: "Answer one question about right now, in one glance.",
    requiredSlots: ["header", "headline", "target-context", "visual"],
    maxPrimaryActions: 0,
    detailLink: "optional",
    defaultSpan: 1,
    heightRange: [104, 128],
    destructiveActions: "never",
    settingsPlacement: "none",
  },
  "quick-log": {
    role: "quick-log",
    purpose: "Show today's standing and make logging it one tap away.",
    requiredSlots: [
      "header",
      "headline",
      "target-context",
      "visual",
      "detail-link",
      "footer",
    ],
    maxPrimaryActions: 1,
    detailLink: "required",
    defaultSpan: 1,
    heightRange: [208, 320],
    destructiveActions: "never",
    settingsPlacement: "overflow",
  },
  trend: {
    role: "trend",
    purpose: "Show whether an outcome is moving, with honest context.",
    requiredSlots: [
      "header",
      "headline",
      "visual",
      "coverage",
      "detail-link",
      "footer",
    ],
    maxPrimaryActions: 1,
    detailLink: "required",
    defaultSpan: 2,
    heightRange: [240, 360],
    destructiveActions: "never",
    settingsPlacement: "detail-page",
  },
  plan: {
    role: "plan",
    purpose: "Surface the next actionable slice of a plan, not the document.",
    requiredSlots: ["header", "headline", "visual", "detail-link", "footer"],
    maxPrimaryActions: 1,
    detailLink: "required",
    defaultSpan: 1,
    heightRange: [176, 280],
    destructiveActions: "never",
    settingsPlacement: "detail-page",
  },
  insight: {
    role: "insight",
    purpose: "One evidence-backed observation with its coverage attached.",
    requiredSlots: ["header", "headline", "visual", "coverage", "footer"],
    maxPrimaryActions: 1,
    detailLink: "optional",
    defaultSpan: 1,
    heightRange: [144, 260],
    destructiveActions: "never",
    settingsPlacement: "none",
  },
  milestone: {
    role: "milestone",
    purpose: "Reward a real accomplishment; never a permanent empty trophy case.",
    requiredSlots: ["header", "headline", "visual"],
    maxPrimaryActions: 0,
    detailLink: "optional",
    defaultSpan: 1,
    heightRange: [144, 200],
    destructiveActions: "never",
    settingsPlacement: "none",
  },
  summary: {
    role: "summary",
    purpose: "A compact, truthful teaser that links into a richer surface.",
    requiredSlots: ["header", "headline", "visual", "detail-link"],
    maxPrimaryActions: 0,
    detailLink: "required",
    defaultSpan: 1,
    heightRange: [104, 176],
    destructiveActions: "never",
    settingsPlacement: "none",
  },
};

/**
 * The states every panel must design for, in the order fixtures exercise
 * them. "Designed" means composed on purpose (see standards/first-run.md and
 * standards/reward-visual.md), not the populated layout with holes in it.
 */
export const PANEL_STATES_TO_DESIGN: readonly PanelState[] = [
  "empty",
  "sparse",
  "populated",
  "stale",
  "loading",
  "error",
  "locked",
];

/* --------------------------------------------------------------------------
 * Logger capability law (the structural fix for the DSH-57/DSH-65 class)
 *
 * Every loggable domain ships the SAME capability set. A logger missing any
 * of these is incomplete, which is what kept producing one-off gaps (water
 * had no past-day path, then past-day water had no permanent edit/delete).
 * ------------------------------------------------------------------------ */

export type LoggerCapability =
  | "log-now" // one-tap or short-form logging for today
  | "log-past-day" // backfill, named "Log a past day" (owner law s181)
  | "edit-entry" // permanent correction path for any entry
  | "delete-entry-confirmed" // delete with a named confirmation (DSH-63)
  | "undo-after-quick-add" // transient undo after one-tap adds
  | "immediate-refresh"; // every dependent surface updates on save

export const REQUIRED_LOGGER_CAPABILITIES: readonly LoggerCapability[] = [
  "log-now",
  "log-past-day",
  "edit-entry",
  "delete-entry-confirmed",
  "undo-after-quick-add",
  "immediate-refresh",
];

/**
 * The loggable domains this law applies to. `primaryMetric` is the metric a
 * member's log directly writes (so for body it is the scale weigh-in, never
 * the derived trend). `sparseBelowPoints` is the pinned per-domain panel
 * threshold consumed by resolvePanelState: daily-status domains are populated
 * from the first log of the day; history-shaped domains need 3 points before
 * the full treatment. The fixtures and contract tests use these values.
 */
export const LOGGABLE_DOMAINS: readonly {
  domain: "nutrition" | "hydration" | "sleep" | "training" | "body";
  primaryMetric: MetricId;
  detailRoute: RouteId;
  sparseBelowPoints: number;
}[] = [
  {
    domain: "nutrition",
    primaryMetric: "nutrition.calories.today",
    detailRoute: "/nutrition",
    sparseBelowPoints: 1,
  },
  {
    domain: "hydration",
    primaryMetric: "hydration.water.today",
    detailRoute: "/hydration",
    sparseBelowPoints: 1,
  },
  {
    domain: "sleep",
    primaryMetric: "sleep.lastNight.duration",
    detailRoute: "/sleep",
    sparseBelowPoints: 1,
  },
  {
    domain: "training",
    primaryMetric: "training.session.volume",
    detailRoute: "/workouts",
    sparseBelowPoints: 3,
  },
  {
    domain: "body",
    primaryMetric: "body.weight.scale",
    detailRoute: "/progress",
    sparseBelowPoints: 3,
  },
];
