"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

/**
 * D1 GATE REGRESSION FIXTURE (2026-07-23): broken ON PURPOSE.
 *
 * Reproduces the three composition defect classes from the owner's
 * finish-workout screenshot (design flaw.png) so the surface-smoke
 * composition checks stay proven against a live reproduction even after the
 * real dialogs are rebuilt (canon numbers cite
 * ../chadlatest/audits/design-standards-2026-07-23/composition-canon/):
 *
 *   1. Horizontal overflow inside an open overlay (canon 04 §22): a fixed
 *      420px child inside a ≤400px dialog panel.
 *   2. A leaf text label clipped without ellipsis (canon 04 §15/§46): the
 *      screenshot's clipped "s" unit, as a 40px-wide nowrap label.
 *   3. The action bar buried below the fold of the overlay's scroll region
 *      (canon 04 §23/§24): a 240px-tall scrolling panel with 600px of
 *      content above the footer slot.
 *
 * The geometry is forced with inline styles (design-lint polices classes,
 * not deliberate fixture geometry) and the overlay is a raw positioned div,
 * NOT the shared primitives, because the primitives are exactly what
 * prevents these defects. Never copy this pattern into member UI.
 */
export function CompositionDefectsDemo({
  autoOpen = false,
}: {
  autoOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(autoOpen);

  return (
    <>
      <Button
        data-testid="open-composition-defects"
        onClick={() => setOpen(true)}
        variant="outline"
      >
        Composition defects (gate fixture)
      </Button>
      {open && (
        <div
          role="presentation"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 80,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          {/* Defect 2: leaf text wider than its own box, no ellipsis. Sits
              outside the panel so the panel's own overflow (defect 1) cannot
              exempt it as a scroll container. */}
          <p
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              width: 40,
              whiteSpace: "nowrap",
              overflow: "hidden",
            }}
          >
            seconds
          </p>
          <div
            aria-label="Broken finish dialog (gate fixture)"
            aria-modal="true"
            role="alertdialog"
            style={{
              maxHeight: 240,
              width: "100%",
              maxWidth: 400,
              overflowY: "auto",
              borderRadius: 16,
              border: "1px solid var(--border)",
              background: "var(--popover)",
              padding: 20,
            }}
          >
            <h2 style={{ fontWeight: 700, fontSize: 18 }}>Finish workout?</h2>
            {/* Defect 1: a row wider than the panel's content box. */}
            <div
              aria-hidden
              style={{ width: 420, height: 24, marginTop: 12 }}
            />
            {/* Defect 3: enough content that the footer sits below the
                panel's fold, inside its scroll region. */}
            <div aria-hidden style={{ height: 600 }} />
            <div
              data-slot="alert-dialog-footer"
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                marginTop: 16,
              }}
            >
              <Button onClick={() => setOpen(false)} variant="ghost">
                Cancel
              </Button>
              <Button onClick={() => setOpen(false)}>Finish and save</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
