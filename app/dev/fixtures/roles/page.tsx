import Link from "next/link";
import { PANEL_RENDERERS } from "@/components/dev/fixture-registry";
import type { PanelState } from "@/lib/contracts/data-state";
import {
  PANEL_ROLES,
  PANEL_STATES_TO_DESIGN,
  type PanelRole,
} from "@/lib/contracts/panels";
import { cn } from "@/lib/utils";
import { PERSONAS, type Persona } from "@/tests/fixtures/dashboard-states";

/**
 * ROLE x STATE MATRIX (P2-A harness).
 *
 * One section per panel role (lib/contracts/panels.ts), one cell per data
 * state. Until P2-B/C/D register real components in
 * components/dev/fixture-registry.tsx, each cell draws the CONTRACT
 * PLACEHOLDER: the role's required slots, action budget, and height range,
 * rendered at the role's minimum height. Auditors grade real components
 * against these budgets when they land.
 *
 * ?persona=<id> selects the fixture member fed to registered renderers
 * (default: consistent).
 */
export default async function RolesMatrixPage({
  searchParams,
}: {
  searchParams: Promise<{ persona?: string }>;
}) {
  const { persona: personaParam } = await searchParams;
  const persona: Persona =
    PERSONAS.find((p) => p.id === personaParam) ??
    PERSONAS.find((p) => p.id === "consistent") ??
    PERSONAS[0];

  return (
    <div className="space-y-10">
      <div className="space-y-3">
        <h1 className="text-page-title">Panel roles</h1>
        <p className="max-w-[72ch] text-body text-muted-foreground">
          The seven typed roles every dashboard panel must be. Cells without a
          registered component show the contract placeholder (slots, budgets,
          height range). Persona: <strong>{persona.id}</strong>
        </p>
        <nav className="flex flex-wrap gap-2">
          {PERSONAS.map((p) => (
            <Link
              className={cn(
                "rounded-lg border px-3 py-2 text-body-sm transition-colors",
                p.id === persona.id
                  ? "border-foreground/40 bg-muted text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
              href={`/dev/fixtures/roles?persona=${p.id}`}
              key={p.id}
            >
              {p.id}
            </Link>
          ))}
        </nav>
      </div>

      {(Object.keys(PANEL_ROLES) as PanelRole[]).map((role) => {
        const contract = PANEL_ROLES[role];
        const renderer = PANEL_RENDERERS[role];
        return (
          <section className="space-y-4" data-role={role} key={role}>
            <div className="space-y-1">
              <h2 className="text-section-title">{role}</h2>
              <p className="text-body-sm text-muted-foreground">
                {contract.purpose} Height {contract.heightRange[0]} to{" "}
                {contract.heightRange[1]}px. Span {contract.defaultSpan}.{" "}
                {contract.maxPrimaryActions} primary action
                {contract.maxPrimaryActions === 1 ? "" : "s"}. Detail link{" "}
                {contract.detailLink}.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {PANEL_STATES_TO_DESIGN.map((state) => (
                <div data-state={state} data-testid={`cell-${role}-${state}`} key={state}>
                  <div className="mb-2 flex items-center gap-2">
                    <StateBadge state={state} />
                  </div>
                  {renderer ? (
                    renderer({ persona, state })
                  ) : (
                    <ContractPlaceholder role={role} state={state} />
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

const STATE_TONES: Record<PanelState, string> = {
  locked: "bg-chart-4/15 text-sleep-text",
  loading: "bg-muted text-muted-foreground",
  error: "bg-critical-text/10 text-critical-text",
  empty: "bg-muted text-muted-foreground",
  sparse: "bg-attention/15 text-attention-text",
  stale: "bg-attention/15 text-attention-text",
  populated: "bg-positive/15 text-positive-text",
};

function StateBadge({ state }: { state: PanelState }) {
  return (
    <span
      className={cn(
        "rounded-md px-2 py-0.5 font-medium text-meta uppercase tracking-wide",
        STATE_TONES[state]
      )}
    >
      {state}
    </span>
  );
}

/** The contract, drawn: slot list inside a frame at the role's min height. */
function ContractPlaceholder({
  role,
  state,
}: {
  role: PanelRole;
  state: PanelState;
}) {
  const contract = PANEL_ROLES[role];
  return (
    <div
      className="flex flex-col rounded-2xl border border-border border-dashed bg-card p-5"
      style={{ minHeight: contract.heightRange[0] }}
    >
      <p className="mb-3 text-meta text-muted-foreground uppercase tracking-wide">
        {role} / {state}
      </p>
      <ul className="space-y-1.5">
        {contract.requiredSlots.map((slot) => (
          <li
            className="rounded-md bg-surface-inset px-2.5 py-1.5 text-meta text-muted-foreground"
            key={slot}
          >
            {slot}
          </li>
        ))}
      </ul>
      <p className="mt-auto pt-3 text-meta text-muted-foreground">
        max {contract.heightRange[1]}px
      </p>
    </div>
  );
}
