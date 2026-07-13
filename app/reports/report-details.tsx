"use client";

/**
 * URL-synced <details> for an older weekly report (FIX-03): the open report
 * lives at `?report=<id>`, so a deep link opens (and scrolls to) it, and
 * back/forward restores it. Opening PUSHES a history entry (Back closes what
 * you just opened, the open-a-panel convention); closing in the UI replaces.
 *
 * The element stays natively UNCONTROLLED (no `open` prop), so this changes
 * zero markup and zero visuals. The URL names at most one open report, so
 * opening another closes the previous one and Back walks the reading stack
 * (report B -> report A -> none), the Stripe list-context model.
 */

import { type ReactNode, useEffect, useRef } from "react";
import { useUrlParam } from "@/hooks/use-url-state";
import { idParam } from "@/lib/url-state";

const REPORT_PARAM = idParam();

export function ReportDetails({
  id,
  className,
  children,
}: {
  id: string;
  className?: string;
  children: ReactNode;
}) {
  const [openId, setOpenId] = useUrlParam("report", REPORT_PARAM);
  const named = openId === id;
  const ref = useRef<HTMLDetailsElement>(null);
  const wasNamed = useRef(false);

  // URL -> DOM: being named opens you (deep link, back/forward); losing the
  // name (Back after open, or another report taking it) closes you.
  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    if (named && !el.open) {
      el.open = true;
      // Deep-link landing: bring the named report into view, anchor-style.
      if (!wasNamed.current) {
        el.scrollIntoView({ block: "start" });
      }
    } else if (!named && el.open) {
      el.open = false;
    }
    wasNamed.current = named;
  }, [named]);

  return (
    <details
      className={className}
      onToggle={(e) => {
        const el = e.currentTarget;
        if (el.open && !named) {
          setOpenId(id, { history: "push" });
        } else if (!el.open && named) {
          setOpenId(null);
        }
      }}
      ref={ref}
    >
      {children}
    </details>
  );
}
