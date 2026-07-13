import Link from "next/link";
import { PERSONAS } from "@/tests/fixtures/dashboard-states";

/**
 * Harness index (P2-A): what this surface is, how the parallel sessions plug
 * into it, and where the matrices live.
 */
export default function FixturesIndexPage() {
  return (
    <div className="max-w-[72ch] space-y-8">
      <div className="space-y-3">
        <h1 className="text-page-title">Dashboard fixture harness</h1>
        <p className="text-body text-muted-foreground">
          Deterministic personas from tests/fixtures/dashboard-states.ts
          rendered through the Phase 2 design system. Every panel role, every
          data state, every width, both themes. This page never ships to
          production.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-section-title">Surfaces</h2>
        <ul className="space-y-2 text-body">
          <li>
            <Link className="underline underline-offset-4" href="/dev/fixtures/tokens">
              Tokens
            </Link>
            <span className="text-muted-foreground">
              {" "}
              : type ramp, spacing scale, semantic colors with measured
              contrast, surface levels, grid specimens (FIX-13 evidence)
            </span>
          </li>
          <li>
            <Link className="underline underline-offset-4" href="/dev/fixtures/roles">
              Panel roles
            </Link>
            <span className="text-muted-foreground">
              {" "}
              : the seven panel-role contracts as placeholder frames; P2-B/C/D
              components replace the placeholders via the renderer registry
            </span>
          </li>
          <li>
            <Link className="underline underline-offset-4" href="/dev/fixtures/personas">
              Personas
            </Link>
            <span className="text-muted-foreground">
              {" "}
              : the six fixture members and the panel state each domain must
              resolve to (asserted by tests/unit/contracts.test.ts)
            </span>
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-section-title">For parallel sessions</h2>
        <p className="text-body text-muted-foreground">
          Register real components in components/dev/fixture-registry.tsx
          (roles), or add your own pages under app/dev/fixtures/ (charts,
          overlays, forms). Import matrix helpers, never fork them. Note every
          registration in the briefing cross-session log.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-section-title">Personas loaded</h2>
        <p className="text-body-sm text-muted-foreground">
          {PERSONAS.map((p) => p.id).join(", ")} (anchor date 2026-07-08,
          America/Chicago)
        </p>
      </section>
    </div>
  );
}
