"use client";

import { Dumbbell, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { isRouteActive, NAV_GROUPS } from "@/lib/nav-links";

/**
 * The collapsible left navigation panel for the standalone (non-chat) pages
 * (LAY-2, owner order s178): full-width pages get the standard app shell,
 * labeled nav down the left, collapsible to an icon rail so the member can
 * focus on the page. Renders the shared `NAV_GROUPS` (NAV-3 / FIX-20) so it
 * can't drift from the mobile sheet: links grouped Primary / Track / Plan /
 * Review / More, driven by the route registry's nav groups. Selected state
 * covers subroutes (isRouteActive: /workouts/history highlights Workouts).
 * Desktop/tablet only; phones keep the hamburger sheet in `StandaloneHeader`
 * plus the FIX-21 bottom tab bar.
 */
export function StandaloneSidebar() {
  // Current path, read after mount. `usePathname` here would sit outside the
  // pages' Suspense boundaries and break dynamic routes under Cache
  // Components (the StandaloneHeader precedent); each navigation remounts
  // this component, so a client-only read stays correct.
  const [path, setPath] = useState<string | null>(null);
  useEffect(() => {
    setPath(window.location.pathname);
  }, []);
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar className="border-sidebar-border border-r" collapsible="icon">
      <SidebarHeader>
        {/* Brand + the collapse toggle, side by side (the standard pro-app
            placement: the control that collapses the panel lives ON the
            panel). In the collapsed icon rail the pair stacks vertically and
            the toggle becomes the expand button, so it is always reachable
            and, because the sidebar is fixed, never scrolls away. */}
        <div className="flex items-center gap-1 group-data-[collapsible=icon]:flex-col">
          <SidebarMenu className="min-w-0 flex-1 group-data-[collapsible=icon]:flex-none">
            <SidebarMenuItem>
              <SidebarMenuButton asChild className="h-11" tooltip="Dashboard">
                <Link aria-label="Chad dashboard" href="/today">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted/60 ring-1 ring-border/50">
                    <Dumbbell
                      className="text-blood"
                      size={13}
                      strokeWidth={2.5}
                    />
                  </span>
                  <span className="font-bold font-display text-[15px] tracking-[0.14em]">
                    CHAD
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <SidebarTrigger
            aria-label={collapsed ? "Expand menu" : "Collapse menu"}
            className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
            title={collapsed ? "Expand menu" : "Collapse menu"}
          />
        </div>
      </SidebarHeader>
      <SidebarContent>
        {NAV_GROUPS.map((group) => {
          const links = group.links.filter((link) =>
            link.surfaces.includes("header")
          );
          if (links.length === 0) {
            return null;
          }
          return (
            <SidebarGroup
              // The uncaptioned trailing utility block gets a rule so it
              // reads as its own section, not a continuation of Review.
              className={
                group.id === "utility"
                  ? "border-border/60 border-t"
                  : undefined
              }
              key={group.id}
            >
              {group.label && (
                <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu>
                  {links.map((link) => {
                    const Icon = link.icon;
                    const active = isRouteActive(path, link.href);
                    return (
                      <SidebarMenuItem key={link.href}>
                        <SidebarMenuButton
                          asChild
                          className="h-11"
                          isActive={active}
                          tooltip={link.label}
                        >
                          <Link href={link.href}>
                            {/* RC-3 (Q-C): the active nav item reads through
                                the button's own active treatment + a bright
                                foreground icon, not red (red is danger only),
                                matching the bottom nav. */}
                            <Icon
                              className={active ? "text-foreground" : undefined}
                            />
                            <span>{link.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="h-11"
              isActive={path === "/pricing"}
              tooltip="Plans & pricing"
            >
              <Link href="/pricing">
                <Sparkles
                  className={path === "/pricing" ? "text-foreground" : undefined}
                />
                <span>Plans &amp; pricing</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      {/* Click/drag edge to collapse or expand, on top of the header toggle. */}
      <SidebarRail />
    </Sidebar>
  );
}
