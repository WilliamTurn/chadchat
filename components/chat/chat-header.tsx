"use client";

import { Dumbbell, PanelLeftIcon } from "lucide-react";
import Link from "next/link";
import { memo } from "react";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { ShareButton } from "./share-button";
import type { VisibilityType } from "./visibility-selector";

function PureChatHeader({
  chatId,
  selectedVisibilityType,
  isReadonly,
  hasMessages,
}: {
  chatId: string;
  selectedVisibilityType: VisibilityType;
  isReadonly: boolean;
  hasMessages: boolean;
}) {
  const { state, toggleSidebar, isMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;

  return (
    <header className="sticky top-0 flex h-14 items-center gap-2 border-b border-blood/15 bg-sidebar px-3">
      {/* Sidebar toggle: always on mobile; on desktop only when the sidebar is
          collapsed, so the header stays usable (and Share stays reachable)
          instead of disappearing entirely (NAV-24). */}
      <Button
        className={collapsed ? undefined : "md:hidden"}
        onClick={toggleSidebar}
        size="icon-sm"
        variant="ghost"
      >
        <PanelLeftIcon className="size-4" />
      </Button>

      <Link
        aria-label="Chad — home"
        className="flex items-center gap-2"
        href="/"
      >
        <span className="flex size-7 items-center justify-center rounded-lg bg-muted/60 ring-1 ring-border/50">
          <Dumbbell className="text-blood" size={14} strokeWidth={2.5} />
        </span>
        <span className="font-display font-bold text-[15px] tracking-[0.14em] text-foreground">
          CHAD
        </span>
      </Link>

      {!isReadonly && (
        <div className="ml-auto">
          <ShareButton
            chatId={chatId}
            hasMessages={hasMessages}
            selectedVisibilityType={selectedVisibilityType}
          />
        </div>
      )}
    </header>
  );
}

export const ChatHeader = memo(PureChatHeader, (prevProps, nextProps) => {
  return (
    prevProps.chatId === nextProps.chatId &&
    prevProps.selectedVisibilityType === nextProps.selectedVisibilityType &&
    prevProps.isReadonly === nextProps.isReadonly &&
    prevProps.hasMessages === nextProps.hasMessages
  );
});
