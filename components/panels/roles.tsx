import type { ReactNode } from "react";
import {
  ActionCluster,
  type OverflowAction,
  type PanelAction,
} from "@/components/panels/action-cluster";
import {
  type DetailLink,
  PanelCoverage,
  type PanelEmptySpec,
  PanelFrame,
  PanelHeadline,
} from "@/components/panels/panel-frame";
import type { ChipTone } from "@/components/today/icon-chip";
import { ModuleFooter } from "@/components/today/module-card";
import type { PanelState } from "@/lib/contracts/data-state";

/**
 * THE SEVEN TYPED PANEL ROLES (FIX-14, Phase 2 / P2-B), implementing
 * lib/contracts/panels.ts on the ModuleCard/SectionBand grammar. One panel,
 * one role; the required slots of each role are required props, so an
 * off-contract panel does not typecheck:
 *
 *   - QuickLogPanel without `weekStrip` AND `visual` -> type error
 *     (owner law s181: trackers carry strip AND chart).
 *   - TrendPanel/InsightPanel without `coverage` -> type error.
 *   - A second primary action -> impossible: `footer.primary` is one object.
 *   - Any action on StatusPanel/MilestonePanel/SummaryPanel -> impossible:
 *     those roles take no footer prop at all (maxPrimaryActions: 0).
 *   - Destructive actions -> no API surface exists for them (action-cluster).
 *
 * Every role renders all seven data states: the frame owns locked/loading/
 * error; empty/sparse/stale/populated render the caller's slots, whose
 * content is state-appropriate by construction (a hollow strip when nothing
 * is logged; dated framing when stale). See standards/first-run.md.
 */

type PanelIdentity = {
  state: PanelState;
  icon: ReactNode;
  tone: ChipTone;
  /** Canonical panel title (labels law: instantly self-explanatory). */
  title: string;
  /** One concrete sentence for the locked teaser (first-run.md section 5). */
  lockedCapability: string;
  /** Locked CTA label override (Elite gates); default "Upgrade to Pro". */
  lockedCta?: string;
  /**
   * The designed compact empty state (first-run.md). Required by type: a
   * panel without a designed empty variant does not typecheck (FIX-14/15).
   */
  empty: PanelEmptySpec;
  /** Retry affordance for the error state. */
  retryAction?: ReactNode;
  glow?: ChipTone;
  className?: string;
  /** Opt-in (P56-C): a long canonical title wraps at narrow widths instead
   *  of ellipsizing (a panel's own name must never truncate; mobile audit). */
  wrapTitle?: boolean;
};

/** The footer grammar: Ask Chad fixed left, one action cluster right. */
export type PanelFooter = {
  /** Muted context line on its own row above the controls. */
  status?: ReactNode;
  /** The card's Ask Chad button (R2-7 fixed home). */
  askChad?: ReactNode;
  /** THE one primary action (0 or 1 by type). */
  primary?: PanelAction;
  secondary?: PanelAction[];
  /** Settings/config: overflow only, never a visible peer (FIX-16). */
  overflow?: OverflowAction[];
};

function Footer({ footer }: { footer: PanelFooter }) {
  return (
    <ModuleFooter askChad={footer.askChad} status={footer.status}>
      <ActionCluster
        overflow={footer.overflow}
        primary={footer.primary}
        secondary={footer.secondary}
      />
    </ModuleFooter>
  );
}

/** Body column: consistent 12px rhythm between anatomy rows. */
function Body({ children }: { children: ReactNode }) {
  return <div className="flex min-w-0 flex-1 flex-col gap-3">{children}</div>;
}

/* ----------------------------------------------------------------- status */

/** One current value + target, one glance. No actions, compact. The visual
 *  sits BESIDE the headline (a 104 to 128px cell cannot stack them). */
export function StatusPanel(props: PanelIdentity & {
  headline: ReactNode;
  targetContext: ReactNode;
  visual: ReactNode;
  detailLink?: DetailLink;
}) {
  return (
    <PanelFrame {...frameProps("status", props)}>
      <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
        <PanelHeadline context={props.targetContext} value={props.headline} />
        {props.visual}
      </div>
    </PanelFrame>
  );
}

/* -------------------------------------------------------------- quick-log */

/** Today's standing + one-tap logging. Strip AND visual are both required. */
export function QuickLogPanel(props: PanelIdentity & {
  headline: ReactNode;
  targetContext: ReactNode;
  visual: ReactNode;
  /** The habit dot strip; NEVER removed (owner law s181). */
  weekStrip: ReactNode;
  detailLink: DetailLink;
  footer: PanelFooter;
}) {
  return (
    <PanelFrame
      {...frameProps("quick-log", props)}
      footer={<Footer footer={props.footer} />}
    >
      <Body>
        <PanelHeadline context={props.targetContext} value={props.headline} />
        {props.visual}
        {props.weekStrip}
      </Body>
    </PanelFrame>
  );
}

/* ------------------------------------------------------------------ trend */

/** An outcome + chart, with honest coverage context. */
export function TrendPanel(props: PanelIdentity & {
  headline: ReactNode;
  targetContext?: ReactNode;
  visual: ReactNode;
  /** "4 of 7 days logged" (data-state formatCoverage form). */
  coverage: ReactNode;
  detailLink: DetailLink;
  footer: PanelFooter;
}) {
  return (
    <PanelFrame
      {...frameProps("trend", props)}
      footer={<Footer footer={props.footer} />}
    >
      <Body>
        <PanelHeadline
          context={props.targetContext}
          large
          value={props.headline}
        />
        {props.visual}
        <PanelCoverage>{props.coverage}</PanelCoverage>
      </Body>
    </PanelFrame>
  );
}

/* ------------------------------------------------------------------- plan */

/** The next actionable slice of a plan, not the document. */
export function PlanPanel(props: PanelIdentity & {
  headline: ReactNode;
  visual: ReactNode;
  detailLink: DetailLink;
  footer: PanelFooter;
}) {
  return (
    <PanelFrame
      {...frameProps("plan", props)}
      footer={<Footer footer={props.footer} />}
    >
      <Body>
        <PanelHeadline value={props.headline} />
        {props.visual}
      </Body>
    </PanelFrame>
  );
}

/* ---------------------------------------------------------------- insight */

/** One evidence-backed observation with its coverage attached. */
export function InsightPanel(props: PanelIdentity & {
  headline: ReactNode;
  visual: ReactNode;
  coverage: ReactNode;
  detailLink?: DetailLink;
  footer: PanelFooter;
}) {
  return (
    <PanelFrame
      {...frameProps("insight", props)}
      footer={<Footer footer={props.footer} />}
    >
      <Body>
        <PanelHeadline value={props.headline} />
        {props.visual}
        <PanelCoverage>{props.coverage}</PanelCoverage>
      </Body>
    </PanelFrame>
  );
}

/* -------------------------------------------------------------- milestone */

/** A reward moment. No actions; never a permanent empty trophy case. */
export function MilestonePanel(props: PanelIdentity & {
  headline: ReactNode;
  visual: ReactNode;
  detailLink?: DetailLink;
}) {
  return (
    <PanelFrame {...frameProps("milestone", props)}>
      <Body>
        <PanelHeadline value={props.headline} />
        {props.visual}
      </Body>
    </PanelFrame>
  );
}

/* ---------------------------------------------------------------- summary */

/** A compact, truthful teaser linking into a richer surface. No actions. */
export function SummaryPanel(props: PanelIdentity & {
  headline: ReactNode;
  targetContext?: ReactNode;
  visual: ReactNode;
  detailLink: DetailLink;
}) {
  return (
    <PanelFrame {...frameProps("summary", props)}>
      <Body>
        <PanelHeadline context={props.targetContext} value={props.headline} />
        {props.visual}
      </Body>
    </PanelFrame>
  );
}

/* ---------------------------------------------------------------- plumbing */

function frameProps(
  role: Parameters<typeof PanelFrame>[0]["role"],
  props: PanelIdentity & { detailLink?: DetailLink }
) {
  return {
    role,
    state: props.state,
    icon: props.icon,
    tone: props.tone,
    title: props.title,
    detailLink: props.detailLink,
    lockedCapability: props.lockedCapability,
    lockedCta: props.lockedCta,
    empty: props.empty,
    retryAction: props.retryAction,
    glow: props.glow,
    className: props.className,
    wrapTitle: props.wrapTitle,
  };
}
