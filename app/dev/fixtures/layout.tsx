import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { FixtureChrome } from "@/components/dev/fixture-chrome";

/**
 * FIXTURE HARNESS SHELL (P2-A, DSH-66 Phase 2).
 *
 * Dev-only surface rendering the deterministic dashboard fixtures
 * (tests/fixtures/dashboard-states.ts) as persona x state x role matrices.
 * This is the surface P2-B/C/D/E build against and every auditor and the
 * FIX-39 screenshot suite verify against.
 *
 * Production exclusion: hard 404 outside development. FIXTURES_ENABLED=1 is
 * the explicit escape hatch for CI screenshot runs against a prod build.
 */
export default function FixturesLayout({ children }: { children: ReactNode }) {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.FIXTURES_ENABLED !== "1"
  ) {
    notFound();
  }
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-10 border-border border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-content items-center justify-between gap-4 px-4 md:px-6">
          <nav className="flex min-w-0 items-center gap-4 overflow-x-auto no-scrollbar">
            <Link
              className="shrink-0 font-semibold text-sm tracking-tight"
              href="/dev/fixtures"
            >
              Fixture harness
            </Link>
            <Link
              className="shrink-0 text-muted-foreground text-sm hover:text-foreground"
              href="/dev/fixtures/tokens"
            >
              Tokens
            </Link>
            <Link
              className="shrink-0 text-muted-foreground text-sm hover:text-foreground"
              href="/dev/fixtures/roles"
            >
              Panel roles
            </Link>
            <Link
              className="shrink-0 text-muted-foreground text-sm hover:text-foreground"
              href="/dev/fixtures/personas"
            >
              Personas
            </Link>
            <Link
              className="shrink-0 text-muted-foreground text-sm hover:text-foreground"
              href="/dev/fixtures/panels"
            >
              Panel composition
            </Link>
            <Link
              className="shrink-0 text-muted-foreground text-sm hover:text-foreground"
              href="/dev/fixtures/charts"
            >
              Charts
            </Link>
            <Link
              className="shrink-0 text-muted-foreground text-sm hover:text-foreground"
              href="/dev/fixtures/overlays"
            >
              Overlays
            </Link>
            <Link
              className="shrink-0 text-muted-foreground text-sm hover:text-foreground"
              href="/dev/fixtures/forms"
            >
              Forms
            </Link>
          </nav>
          <FixtureChrome />
        </div>
      </header>
      <main className="mx-auto max-w-content px-4 py-8 md:px-6">{children}</main>
    </div>
  );
}
