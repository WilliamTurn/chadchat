import type { ReactNode } from "react";
import type { PanelState } from "@/lib/contracts/data-state";
import type { PanelRole } from "@/lib/contracts/panels";
import type { Persona } from "@/tests/fixtures/dashboard-states";

/**
 * PANEL RENDERER REGISTRY (P2-A harness plumbing).
 *
 * The fixture harness renders a role x persona x state matrix. Until a real
 * component exists for a role, the harness draws the contract placeholder
 * frame (see app/dev/fixtures/roles). When a parallel session ships a real
 * role component (P2-B panels, P2-C charts, P2-D overlays), it registers a
 * renderer here and the matrix pages pick it up automatically.
 *
 * Coordination rule (Phase 2 briefing, rules 2 and 9): each session adds ONLY
 * its own entries and notes the registration in the briefing's cross-session
 * log. Keys are panel roles; renderers receive the persona and the target
 * state and must render the panel exactly as the dashboard would.
 */
export type PanelRenderer = (props: {
  persona: Persona;
  state: PanelState;
}) => ReactNode;

export const PANEL_RENDERERS: Partial<Record<PanelRole, PanelRenderer>> = {
  // P2-B registers: status, quick-log, trend, plan, insight, milestone, summary
};
