import type { PanelState } from "@/lib/contracts/data-state";
import { LOGGABLE_DOMAINS } from "@/lib/contracts/panels";
import { cn } from "@/lib/utils";
import { PERSONAS } from "@/tests/fixtures/dashboard-states";

/**
 * PERSONA TRUTH TABLE (P2-A harness). The six deterministic members and the
 * panel state each loggable domain must resolve to for them. These
 * expectations are asserted by tests/unit/contracts.test.ts; this page makes
 * them visible so a session can pick the right persona for the state it is
 * designing.
 */
export default function PersonasPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h1 className="text-page-title">Fixture personas</h1>
        <p className="max-w-[72ch] text-body text-muted-foreground">
          Anchor date 2026-07-08 (a Wednesday), timezone America/Chicago.
          Loading and error are fetch-layer states: render any persona with
          the fetch input overridden.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-body">
          <thead>
            <tr className="border-border border-b text-left">
              <th className="py-3 pr-4 font-medium">Persona</th>
              <th className="py-3 pr-4 font-medium">Tier</th>
              {LOGGABLE_DOMAINS.map((d) => (
                <th className="py-3 pr-4 font-medium" key={d.domain}>
                  {d.domain}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERSONAS.map((p) => (
              <tr className="border-border/60 border-b align-top" key={p.id}>
                <td className="py-3 pr-4">
                  <p className="font-medium">{p.id}</p>
                  <p className="mt-1 max-w-[36ch] text-muted-foreground text-body-sm">
                    {p.description}
                  </p>
                </td>
                <td className="py-3 pr-4 text-muted-foreground">{p.tier}</td>
                {LOGGABLE_DOMAINS.map((d) => (
                  <td className="py-3 pr-4" key={d.domain}>
                    <StateChip state={p.expected[d.domain]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const TONES: Record<PanelState, string> = {
  locked: "bg-chart-4/15 text-sleep-text",
  loading: "bg-muted text-muted-foreground",
  error: "bg-critical-text/10 text-critical-text",
  empty: "bg-muted text-muted-foreground",
  sparse: "bg-attention/15 text-attention-text",
  stale: "bg-attention/15 text-attention-text",
  populated: "bg-positive/15 text-positive-text",
};

function StateChip({ state }: { state: PanelState }) {
  return (
    <span
      className={cn(
        "inline-block rounded-md px-2 py-0.5 font-medium text-meta uppercase tracking-wide",
        TONES[state]
      )}
    >
      {state}
    </span>
  );
}
