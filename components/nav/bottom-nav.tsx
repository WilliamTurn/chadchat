"use client";

import { Ellipsis, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  BOTTOM_NAV_TABS,
  isRouteActive,
  LOG_ACTIONS,
  NAV_GROUPS,
} from "@/lib/nav-links";
import { cn } from "@/lib/utils";

/**
 * FIX-21 / DEC-01: the persistent phone bottom navigation.
 * Today / Log / Progress / Coach / More at phone widths only (<md); hidden
 * entirely on tablet/desktop where the left nav panel owns navigation.
 *
 * Behaviors this component guarantees (the acceptance criteria):
 * - Safe-area padded: the bar carries `pb-safe-edge`
 *   (env(safe-area-inset-bottom)) so tabs never sit under the home indicator.
 * - Keyboard-safe: with `interactive-widget=resizes-content` a fixed
 *   bottom-0 element rides up above the software keyboard, which is banned
 *   (it would crowd or obscure the focused input). The bar therefore hides
 *   while any editable element has focus (the x.com / Instagram mobile-web
 *   behavior) and returns on blur. The same signal is published as
 *   `data-vk-open` on <html> so the chat shell's reserved bar space
 *   (`pb-tabbar`) collapses too and no dead gap opens above the keyboard.
 * - An additional path, never a replacement: every tab targets an existing
 *   destination or opens a picker onto existing loggers; nothing is removed.
 * - Overlays (z-50) render above the bar (z-40) with their own scrim, so an
 *   open dialog/sheet never competes with the tabs.
 *
 * Mounting: `StandaloneShell` renders it with the in-flow spacer (scrollable
 * pages need document height to clear the fixed bar); the chat layout mounts
 * it with `spacer={false}` and reserves space via `pb-tabbar` on the chat
 * shell's h-dvh root instead.
 */

function isEditable(el: EventTarget | null): el is HTMLElement {
  if (!(el instanceof HTMLElement)) {
    return false;
  }
  if (el.isContentEditable) {
    return true;
  }
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
    return true;
  }
  if (el instanceof HTMLInputElement) {
    // Non-text inputs never summon a keyboard; hiding the bar for a
    // checkbox/radio/button tap would flicker it for nothing.
    return !["button", "checkbox", "radio", "range", "submit", "file"].includes(
      el.type
    );
  }
  return false;
}

export function BottomNav({
  active,
  spacer = true,
}: {
  /** The tab href to mark selected; omitted → read from the URL on mount
   *  (the StandaloneSidebar client-only pattern for Cache Components). */
  active?: string;
  /** Render the in-flow height spacer under the fixed bar. */
  spacer?: boolean;
}) {
  const [path, setPath] = useState<string | null>(null);
  useEffect(() => {
    setPath(window.location.pathname);
  }, []);
  const current = active ?? path;

  // Keyboard-open detection: hide while an editable element is focused.
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    const update = (open: boolean) => {
      setKeyboardOpen(open);
      if (open) {
        document.documentElement.setAttribute("data-vk-open", "");
      } else {
        document.documentElement.removeAttribute("data-vk-open");
      }
    };
    const onFocusIn = (event: FocusEvent) => {
      if (isEditable(event.target)) {
        update(true);
      }
    };
    let rafId = 0;
    const onFocusOut = (event: FocusEvent) => {
      // Focus moving between two fields fires focusout then focusin in the
      // same task; defer so the bar doesn't flash between fields.
      if (!isEditable(event.target)) {
        return;
      }
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        update(isEditable(document.activeElement));
      });
    };
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      // Intentional unconditional cleanup: the two shells never co-mount,
      // so on unmount the reserved space must always un-collapse.
      document.documentElement.removeAttribute("data-vk-open");
    };
  }, []);

  const [logOpen, setLogOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  // The More sheet lists every grouped destination that is not already a tab.
  const tabHrefs = new Set(
    BOTTOM_NAV_TABS.flatMap((tab) => (tab.kind === "route" ? [tab.href] : []))
  );
  const moreGroups = NAV_GROUPS.map((group) => ({
    ...group,
    links: group.links.filter(
      (link) => link.surfaces.includes("header") && !tabHrefs.has(link.href)
    ),
  })).filter((group) => group.links.length > 0);
  const moreActive = moreGroups.some((group) =>
    group.links.some((link) => isRouteActive(current, link.href))
  );

  const tabClass = (isActive: boolean) =>
    cn(
      "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5",
      isActive
        ? "font-semibold text-foreground"
        : "font-medium text-muted-foreground"
    );
  const iconClass = (isActive: boolean) =>
    cn("size-5 shrink-0", isActive && "text-blood-text");

  return (
    <>
      {spacer && <div aria-hidden className="h-tabbar shrink-0 md:hidden" />}
      <nav
        aria-label="Primary"
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 border-border border-t bg-background/95 pb-safe-edge backdrop-blur transition-transform duration-200 motion-reduce:transition-none md:hidden",
          keyboardOpen && "translate-y-full"
        )}
      >
        <div className="flex h-14 items-stretch">
          {BOTTOM_NAV_TABS.map((tab) => {
            if (tab.kind === "route") {
              const isActive = isRouteActive(current, tab.href);
              const Icon = tab.icon;
              return (
                <Link
                  aria-current={isActive ? "page" : undefined}
                  className={tabClass(isActive)}
                  href={tab.href}
                  key={tab.href}
                >
                  <Icon className={iconClass(isActive)} />
                  <span className="truncate text-meta">{tab.label}</span>
                </Link>
              );
            }
            if (tab.kind === "log") {
              return (
                <Button
                  aria-haspopup="dialog"
                  className={cn(
                    tabClass(logOpen),
                    "h-auto rounded-none px-0 active:translate-y-0"
                  )}
                  key="log"
                  onClick={() => setLogOpen(true)}
                  variant="ghost"
                >
                  {/* The logging action gets the brand fill (the m.youtube /
                      Instagram center-action treatment): it is the bar's one
                      verb among destinations. */}
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-blood text-white">
                    <Plus className="size-4" strokeWidth={2.5} />
                  </span>
                  <span className="truncate text-meta">{tab.label}</span>
                </Button>
              );
            }
            return (
              <Button
                aria-haspopup="dialog"
                className={cn(
                  tabClass(moreOpen || moreActive),
                  "h-auto rounded-none px-0 active:translate-y-0"
                )}
                key="more"
                onClick={() => setMoreOpen(true)}
                variant="ghost"
              >
                <Ellipsis className={iconClass(moreOpen || moreActive)} />
                <span className="truncate text-meta">{tab.label}</span>
              </Button>
            );
          })}
        </div>
      </nav>

      {/* Log picker (DEC-01): five rows onto the existing domain loggers. */}
      <Drawer onOpenChange={setLogOpen} open={logOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>What do you want to log?</DrawerTitle>
          </DrawerHeader>
          <div className="flex flex-col gap-1 pb-2">
            {LOG_ACTIONS.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 font-medium text-base transition-colors hover:bg-accent/50"
                  href={action.href}
                  key={action.href}
                  onClick={() => setLogOpen(false)}
                >
                  <Icon className="size-5 text-muted-foreground" />
                  <span>{action.label}</span>
                </Link>
              );
            })}
          </div>
        </DrawerContent>
      </Drawer>

      {/* More: every other destination, grouped exactly like the desktop nav. */}
      <Drawer onOpenChange={setMoreOpen} open={moreOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>More</DrawerTitle>
          </DrawerHeader>
          <div className="flex flex-col gap-3 pb-2">
            {moreGroups.map((group) => (
              <div
                className={cn(
                  "flex flex-col gap-1",
                  // The uncaptioned trailing utility block still needs a
                  // visible break from the captioned group above it.
                  group.id === "utility" && "border-border border-t pt-3"
                )}
                key={group.id}
              >
                {group.label && (
                  <p className="px-3 text-eyebrow text-muted-foreground">
                    {group.label}
                  </p>
                )}
                {group.links.map((link) => {
                  const Icon = link.icon;
                  const isActive = isRouteActive(current, link.href);
                  return (
                    <Link
                      className={cn(
                        "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 font-medium text-base transition-colors",
                        isActive
                          ? "bg-accent text-foreground"
                          : "hover:bg-accent/50"
                      )}
                      href={link.href}
                      key={link.href}
                      onClick={() => setMoreOpen(false)}
                    >
                      <Icon
                        className={cn(
                          "size-5",
                          isActive ? "text-blood-text" : "text-muted-foreground"
                        )}
                      />
                      <span>{link.label}</span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
