"use client";

import {
  Dumbbell,
  PanelLeftIcon,
  PenSquareIcon,
  TrashIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "next-auth";
import { Fragment, useState } from "react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import { unstable_serialize } from "swr/infinite";
import {
  getChatHistoryPaginationKey,
  SidebarHistory,
} from "@/components/chat/sidebar-history";
import { SidebarPlanStatus } from "@/components/chat/sidebar-plan-status";
import { SidebarUserNav } from "@/components/chat/sidebar-user-nav";
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
import { NAV_GROUPS } from "@/lib/nav-links";
import { cn } from "@/lib/utils";
import type { PlanStatusSummary } from "@/lib/subscription";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

export function AppSidebar({
  user,
  plan,
}: {
  user: User | undefined;
  plan?: PlanStatusSummary | null;
}) {
  const router = useRouter();
  const { isMobile, setOpenMobile, state, toggleSidebar } = useSidebar();
  // The hover-overlay toggle below only makes sense while the menu is
  // collapsed to the icon rail. It used to be hidden by CSS alone
  // (`opacity-0` + `pointer-events-none`), which leaves it in the tab order
  // and the accessibility tree in every other state - so once S0c gave it the
  // name "Open menu" it announced that name, and closed the menu when
  // activated, while the menu was open. Render it only where it is true.
  const railCollapsed = state === "collapsed" && !isMobile;
  const { mutate } = useSWRConfig();
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);

  const handleDeleteAll = () => {
    setShowDeleteAllDialog(false);
    router.replace("/");
    mutate(unstable_serialize(getChatHistoryPaginationKey), [], {
      revalidate: false,
    });

    fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/history`, {
      method: "DELETE",
    });

    toast.success("All chats deleted");
  };

  return (
    <>
      <Sidebar collapsible="icon">
        <SidebarHeader className="pb-0 pt-3">
          <SidebarMenu>
            <SidebarMenuItem className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="group/logo relative flex items-center justify-center">
                  <SidebarMenuButton
                    asChild
                    className="size-8 !px-0 items-center justify-center group-data-[collapsible=icon]:group-hover/logo:opacity-0"
                    tooltip="Chad"
                  >
                    {/* D5 (S0c): icon-only, so it was announced as a bare
                        "link" (axe link-name). It names its destination, which
                        routes.ts registers as "Chad". */}
                    <Link
                      aria-label="Chad"
                      href="/"
                      onClick={() => setOpenMobile(false)}
                    >
                      <Dumbbell
                        aria-hidden
                        className="size-4 text-blood"
                        strokeWidth={2.5}
                      />
                    </Link>
                  </SidebarMenuButton>
                  {railCollapsed && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <SidebarMenuButton
                          // D5 (S0c): icon-only, so it was announced as a bare
                          // "button" (axe button-name, critical) - a tooltip is
                          // a description, never an accessible name. The name
                          // matches the visible tooltip text (WCAG 2.5.3).
                          aria-label="Open menu"
                          className="absolute inset-0 size-8 opacity-0 group-hover/logo:opacity-100"
                          onClick={() => toggleSidebar()}
                        >
                          <PanelLeftIcon aria-hidden className="size-4" />
                        </SidebarMenuButton>
                      </TooltipTrigger>
                      <TooltipContent className="hidden md:block" side="right">
                        Open menu
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
                <Link
                  className="font-display font-bold text-[15px] text-sidebar-foreground tracking-[0.14em] group-data-[collapsible=icon]:hidden"
                  href="/"
                  onClick={() => setOpenMobile(false)}
                >
                  CHAD
                </Link>
              </div>
              <div className="group-data-[collapsible=icon]:hidden">
                {/* Overrides the vendored primitive's title-case "Toggle
                    Sidebar" sr-only default: sentence case, and the app's
                    word for this panel. It only renders while the menu is
                    open, so it always closes. */}
                <SidebarTrigger
                  aria-label="Close menu"
                  className="text-sidebar-foreground/60 transition-colors duration-150 hover:text-sidebar-foreground"
                />
              </div>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        {/* Desktop (md+): overflow-hidden so the content area itself doesn't
            scroll: the nav group below is pinned (shrink-0) and SidebarHistory
            owns its own scroll region, keeping the full app nav visible no
            matter how long the chat history grows (ChatGPT/Claude pattern).
            Mobile: the drawer is only 70dvh and the nav block alone can be
            taller than that, so pinning it clips the bottom entries with no way
            to reach them (NAV-37). There the whole content area scrolls as one
            list instead (nav first, history under it, the ChatGPT mobile
            drawer pattern); SidebarHistory drops its own scroll region below md
            to match. */}
        <SidebarContent className="overflow-y-auto md:overflow-hidden">
          {/* Section links come from the shared nav groups (NAV-3 / FIX-20)
              so the sidebar and the standalone nav can't drift apart: the
              full feature inventory (NAV-31), grouped Primary / Track / Plan
              / Review / More exactly like the desktop nav panel. The
              "New chat" action is sidebar-only, so it's rendered inline right
              after Dashboard (the primary group) rather than living in the
              shared list. */}
          <div className="shrink-0">
            {/* DEC-08 (owner, 2026-07-13): at phone widths the bottom nav's
                More tab is the SINGLE overflow path for destinations, so the
                grouped nav block renders md+ only. The phone drawer stays
                chat-focused: New chat (below), history, delete-all, and the
                footer user menu. The desktop sidebar is untouched. */}
            <div className="hidden md:block">
            {NAV_GROUPS.map((group) => {
              const links = group.links.filter((link) =>
                link.surfaces.includes("sidebar")
              );
              if (links.length === 0) {
                return null;
              }
              return (
                <SidebarGroup
                  className={cn(
                    "py-1 first:pt-1",
                    // The uncaptioned trailing utility block gets a rule so
                    // it reads as its own section, not more of Review.
                    group.id === "utility" && "border-sidebar-border border-t"
                  )}
                  key={group.id}
                >
                  {group.label && (
                    <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
                  )}
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {links.map((link) => {
                        const Icon = link.icon;
                        return (
                          <Fragment key={link.href}>
                            <SidebarMenuItem>
                              <SidebarMenuButton
                                asChild
                                className="h-10 rounded-lg text-[15px] text-sidebar-foreground/70 transition-colors duration-150 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground md:h-8 md:text-[13px]"
                                tooltip={link.label}
                              >
                                <Link
                                  href={link.href}
                                  onClick={() => setOpenMobile(false)}
                                >
                                  <Icon className="size-4" />
                                  <span className="font-medium">
                                    {link.label}
                                  </span>
                                </Link>
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                            {link.href === "/home" && (
                              <SidebarMenuItem>
                                <SidebarMenuButton
                                  className="h-10 rounded-lg border border-sidebar-border text-[15px] text-sidebar-foreground/70 transition-colors duration-150 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground md:h-8 md:text-[13px]"
                                  onClick={() => {
                                    setOpenMobile(false);
                                    router.push("/");
                                  }}
                                  tooltip="New chat"
                                >
                                  <PenSquareIcon className="size-4" />
                                  <span className="font-medium">New chat</span>
                                </SidebarMenuButton>
                              </SidebarMenuItem>
                            )}
                          </Fragment>
                        );
                      })}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              );
            })}
            </div>
            {/* Phone widths only: the one chat action the grouped block was
                carrying (DEC-08). Destinations live in the bottom nav. */}
            <SidebarGroup className="py-1 md:hidden">
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      className="h-10 rounded-lg border border-sidebar-border text-base text-sidebar-foreground/70 transition-colors duration-150 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                      onClick={() => {
                        setOpenMobile(false);
                        router.push("/");
                      }}
                      tooltip="New chat"
                    >
                      <PenSquareIcon className="size-4" />
                      <span className="font-medium">New chat</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            {user && (
              <SidebarGroup className="py-1">
                <SidebarGroupContent>
                  <SidebarMenu>
                    {/* Named for its exact scope + visually detached from the
                        nav links above (LC-11): a bare "Delete all" inside a
                        nav list read as "delete all <anything>". */}
                    <SidebarMenuItem className="border-sidebar-border border-t pt-2">
                      <SidebarMenuButton
                        className="h-10 rounded-lg text-sidebar-foreground/40 transition-colors duration-150 hover:bg-destructive/10 hover:text-destructive md:h-8"
                        onClick={() => setShowDeleteAllDialog(true)}
                        tooltip="Delete all chats"
                      >
                        <TrashIcon className="size-4" />
                        <span className="text-[15px] md:text-[13px]">
                          Delete all chats
                        </span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}
          </div>
          <SidebarHistory user={user} />
        </SidebarContent>
        <SidebarFooter className="border-t border-sidebar-border pt-2 pb-3">
          {plan && <SidebarPlanStatus plan={plan} />}
          {user && <SidebarUserNav user={user} />}
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <AlertDialog
        onOpenChange={setShowDeleteAllDialog}
        open={showDeleteAllDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete all chats?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete all
              your chats and remove them from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAll}>
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
