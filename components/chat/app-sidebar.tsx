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
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { sidebarLinks } from "@/lib/nav-links";
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
  const { setOpenMobile, toggleSidebar } = useSidebar();
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
                    <Link href="/" onClick={() => setOpenMobile(false)}>
                      <Dumbbell
                        className="size-4 text-blood"
                        strokeWidth={2.5}
                      />
                    </Link>
                  </SidebarMenuButton>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SidebarMenuButton
                        className="pointer-events-none absolute inset-0 size-8 opacity-0 group-data-[collapsible=icon]:pointer-events-auto group-data-[collapsible=icon]:group-hover/logo:opacity-100"
                        onClick={() => toggleSidebar()}
                      >
                        <PanelLeftIcon className="size-4" />
                      </SidebarMenuButton>
                    </TooltipTrigger>
                    <TooltipContent className="hidden md:block" side="right">
                      Open sidebar
                    </TooltipContent>
                  </Tooltip>
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
                <SidebarTrigger className="text-sidebar-foreground/60 transition-colors duration-150 hover:text-sidebar-foreground" />
              </div>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        {/* overflow-hidden (not the default overflow-auto) so the content area
            itself doesn't scroll: the nav group below is pinned (shrink-0) and
            stays anchored, while SidebarHistory owns its own scroll region. The
            full app nav therefore stays visible at the top no matter how long
            the chat history grows — on desktop AND in the mobile bottom drawer,
            which reuses this same markup (ChatGPT/Claude pattern). */}
        <SidebarContent className="overflow-hidden">
          <SidebarGroup className="shrink-0 pt-1">
            <SidebarGroupContent>
              <SidebarMenu>
                {/* Section links come from the shared nav list (NAV-3) so the
                    sidebar and the StandaloneHeader can't drift apart. As of
                    NAV-31 the sidebar carries the full feature inventory
                    (Dashboard, Workouts, Calorie Tracker, Meal Plan, Kitchen,
                    Progress, Sleep, Help) — same nav model as the header — so
                    the product is discoverable from the chat landing. The
                    "New chat" action is sidebar-only, so it's rendered inline
                    right after Dashboard (the first link) rather than living in
                    the shared list. */}
                {sidebarLinks.map((link, index) => {
                  const Icon = link.icon;
                  return (
                    <Fragment key={link.href}>
                      <SidebarMenuItem>
                        <SidebarMenuButton
                          asChild
                          className="h-8 rounded-lg text-[13px] text-sidebar-foreground/70 transition-colors duration-150 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                          tooltip={link.label}
                        >
                          <Link
                            href={link.href}
                            onClick={() => setOpenMobile(false)}
                          >
                            <Icon className="size-4" />
                            <span className="font-medium">{link.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                      {index === 0 && (
                        <SidebarMenuItem>
                          <SidebarMenuButton
                            className="h-8 rounded-lg border border-sidebar-border text-[13px] text-sidebar-foreground/70 transition-colors duration-150 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                            onClick={() => {
                              setOpenMobile(false);
                              router.push("/");
                            }}
                            tooltip="New Chat"
                          >
                            <PenSquareIcon className="size-4" />
                            <span className="font-medium">New chat</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      )}
                    </Fragment>
                  );
                })}
                {user && (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      className="rounded-lg text-sidebar-foreground/40 transition-colors duration-150 hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setShowDeleteAllDialog(true)}
                      tooltip="Delete All Chats"
                    >
                      <TrashIcon className="size-4" />
                      <span className="text-[13px]">Delete all</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
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
