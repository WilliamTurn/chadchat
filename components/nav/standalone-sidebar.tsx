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
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { headerLinks } from "@/lib/nav-links";

/**
 * The collapsible left navigation panel for the standalone (non-chat) pages
 * (LAY-2, owner order s178): full-width pages get the standard app shell,
 * labeled nav down the left, collapsible to an icon rail so the member can
 * focus on the page. Renders from the shared `headerLinks` list (NAV-3) so it
 * can't drift from the mobile sheet. Desktop/tablet only; phones keep the
 * hamburger sheet in `StandaloneHeader`.
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

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="h-11" tooltip="Dashboard">
              <Link aria-label="Chad — dashboard" href="/today">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted/60 ring-1 ring-border/50">
                  <Dumbbell className="text-blood" size={13} strokeWidth={2.5} />
                </span>
                <span className="font-bold font-display text-[15px] tracking-[0.14em]">
                  CHAD
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {headerLinks.map((link) => {
                const Icon = link.icon;
                const active = path === link.href;
                return (
                  <SidebarMenuItem key={link.href}>
                    <SidebarMenuButton
                      asChild
                      className="h-11"
                      isActive={active}
                      tooltip={link.label}
                    >
                      <Link href={link.href}>
                        <Icon className={active ? "text-blood" : undefined} />
                        <span>{link.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
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
                  className={path === "/pricing" ? "text-blood" : undefined}
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
