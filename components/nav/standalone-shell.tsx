"use client";

import { type ReactNode, useEffect } from "react";
import {
  SidebarInset,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar";
import { StandaloneSidebar } from "./standalone-sidebar";

/**
 * Restores the member's collapsed choice after mount. The provider writes the
 * `sidebar_state` cookie on every toggle; reading it during render would make
 * server and client HTML disagree (hydration error), so the first paint is
 * always expanded and a collapsed preference applies right after mount.
 */
function RestoreSidebarState() {
  const { setOpen } = useSidebar();
  useEffect(() => {
    if (document.cookie.includes("sidebar_state=false")) {
      setOpen(false);
    }
  }, [setOpen]);
  return null;
}

/**
 * The client shell PageShell wraps every standalone page in: the collapsible
 * left nav (LAY-2) plus the content inset. Split from PageShell so PageShell
 * itself stays a server component.
 */
export function StandaloneShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <RestoreSidebarState />
      <StandaloneSidebar />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
