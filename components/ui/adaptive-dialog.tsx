"use client";

import * as React from "react";
import Link from "next/link";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { ActionCluster, type PanelAction } from "@/components/panels/action-cluster";
import { findBannedCopy } from "@/lib/contracts/copy";
import { useIsMobile } from "@/hooks/use-mobile";

/**
 * OVERLAY PLATFORM CORE (FIX-17, P2-D; grew out of MOB-11).
 *
 * One dialog API, two presentations: desktop gets a centered modal, phones
 * (<768px) get a vaul bottom sheet (20px top radius, drag handle, close
 * button, sticky footer). Drop-in: same subcomponent names and props as
 * ui/dialog, so a Dialog converts by swapping imports.
 *
 * WHICH SURFACE FOR WHICH JOB (standards/motion-interaction.md section 5;
 * the decision tree is law, never re-decided per card):
 *   - Quick-log / edit / any short form (2 to 5 fields)  -> AdaptiveDialog
 *   - Destructive confirmation                           -> ConfirmActionDialog (ui/confirm-undo)
 *   - Read-mostly detail preview, navigation panel       -> Sheet (ui/sheet)
 *   - Data entry beyond a few fields, ANY core feature   -> a dedicated full
 *     page or full-screen flow with a back button (owner law s168). The
 *     platform deliberately ships NO full-screen modal.
 *
 * Behaviors guaranteed on every open (owner laws + motion contract):
 *   - No input auto-focused, desktop and phone; focus lands on the overlay
 *     container. Focus trap, escape-to-close, and return-focus-to-trigger
 *     come from the underlying primitives.
 *   - Dialog-on-dialog is banned: nesting any overlay inside another logs a
 *     dev-build error (OverlayDepthContext).
 *   - Accidental dismissal must not lose input: keep short-form state in
 *     useOverlayDraft and clear it on successful save.
 *   - Success feedback: after a receipted save, close the overlay and show
 *     the concrete receipt ("Added 20 oz. 64 oz of 128 oz today.") via toast.
 */

const AdaptiveMobileContext = React.createContext(false);

/** How many overlays are open above the current subtree. Consumed by every
 *  platform overlay to enforce the dialog-on-dialog ban in dev builds. */
const OverlayDepthContext = React.createContext(0);

/** Dev-build tripwire for the stacked-overlay ban (motion-interaction
 *  section 5, owner law s168). Call from any overlay content on mount. */
function useOverlayDepthGuard(surface: string): number {
  const depth = React.useContext(OverlayDepthContext);
  React.useEffect(() => {
    if (depth > 0 && process.env.NODE_ENV !== "production") {
      console.error(
        `${surface} opened inside another overlay. Dialog-on-dialog is banned (motion-interaction.md section 5, owner law s168): move this flow to a dedicated page, or restructure the parent overlay.`
      );
    }
  }, [depth, surface]);
  return depth;
}

/* --------------------------------------------------------- draft storage */

const overlayDrafts = new Map<string, unknown>();

/**
 * Draft preservation for short-form overlays: escape, backdrop click, or a
 * swipe-dismiss must never lose typed input (motion-interaction: errors and
 * dismissals keep data). State survives unmount in a module-level store for
 * the page's lifetime; call `clear` after a successful save.
 */
function useOverlayDraft<T>(
  key: string,
  initial: T
): [T, (next: T | ((prev: T) => T)) => void, () => void] {
  const initialRef = React.useRef(initial);
  const [value, setValue] = React.useState<T>(() =>
    overlayDrafts.has(key) ? (overlayDrafts.get(key) as T) : initial
  );
  const set = React.useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved =
          typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        overlayDrafts.set(key, resolved);
        return resolved;
      });
    },
    [key]
  );
  const clear = React.useCallback(() => {
    overlayDrafts.delete(key);
    setValue(initialRef.current);
  }, [key]);
  return [value, set, clear];
}

/* ------------------------------------------------------------ components */

function AdaptiveDialog(props: React.ComponentProps<typeof Dialog>) {
  const isMobile = useIsMobile();
  const Comp = isMobile ? Drawer : Dialog;
  return (
    <AdaptiveMobileContext.Provider value={isMobile}>
      <Comp {...props} />
    </AdaptiveMobileContext.Provider>
  );
}

function AdaptiveDialogTrigger(
  props: React.ComponentProps<typeof DialogTrigger>
) {
  const isMobile = React.useContext(AdaptiveMobileContext);
  const Comp = isMobile ? DrawerTrigger : DialogTrigger;
  return <Comp {...props} />;
}

function AdaptiveDialogClose(props: React.ComponentProps<typeof DialogClose>) {
  const isMobile = React.useContext(AdaptiveMobileContext);
  const Comp = isMobile ? DrawerClose : DialogClose;
  return <Comp {...props} />;
}

function AdaptiveDialogContent({
  onOpenAutoFocus,
  showCloseButton,
  children,
  ...props
}: React.ComponentProps<typeof DialogContent>) {
  const isMobile = React.useContext(AdaptiveMobileContext);
  const depth = useOverlayDepthGuard("AdaptiveDialog");
  const contentRef = React.useRef<HTMLDivElement>(null);
  const body = (
    <OverlayDepthContext.Provider value={depth + 1}>
      {children}
    </OverlayDepthContext.Provider>
  );
  if (isMobile) {
    // The drawer already prevents input auto-focus and focuses the sheet.
    return <DrawerContent {...props}>{body}</DrawerContent>;
  }
  return (
    <DialogContent
      ref={contentRef}
      tabIndex={-1}
      // Desktop obeys the same owner law: no input auto-focused on open.
      // Focus the dialog container; the trap keeps focus inside from there.
      onOpenAutoFocus={
        onOpenAutoFocus ??
        ((e) => {
          e.preventDefault();
          contentRef.current?.focus();
        })
      }
      showCloseButton={showCloseButton}
      {...props}
    >
      {body}
    </DialogContent>
  );
}

function AdaptiveDialogHeader(props: React.ComponentProps<"div">) {
  const isMobile = React.useContext(AdaptiveMobileContext);
  const Comp = isMobile ? DrawerHeader : DialogHeader;
  return <Comp {...props} />;
}

function AdaptiveDialogFooter(props: React.ComponentProps<"div">) {
  const isMobile = React.useContext(AdaptiveMobileContext);
  const Comp = isMobile ? DrawerFooter : DialogFooter;
  return <Comp {...props} />;
}

function AdaptiveDialogTitle(props: React.ComponentProps<typeof DialogTitle>) {
  const isMobile = React.useContext(AdaptiveMobileContext);
  const Comp = isMobile ? DrawerTitle : DialogTitle;
  return <Comp {...props} />;
}

function AdaptiveDialogDescription(
  props: React.ComponentProps<typeof DialogDescription>
) {
  const isMobile = React.useContext(AdaptiveMobileContext);
  const Comp = isMobile ? DrawerDescription : DialogDescription;
  return <Comp {...props} />;
}

/* -------------------------------------------------------- action grammar */

function warnBannedOverlayCopy(context: string, label: string) {
  if (process.env.NODE_ENV === "production") {
    return;
  }
  for (const v of findBannedCopy(label)) {
    console.error(
      `OverlayActions ${context} label "${label}" violates copy contract [${v.ruleId}]: ${v.reason}`
    );
  }
}

function StackedAction({
  action,
  variant,
}: {
  action: PanelAction;
  variant: "default" | "ghost";
}) {
  warnBannedOverlayCopy(variant === "default" ? "primary" : "secondary", action.label);
  if (action.href) {
    return (
      <Button asChild className="min-h-11 w-full" variant={variant}>
        <Link href={action.href}>
          {action.icon}
          {action.label}
        </Link>
      </Button>
    );
  }
  return (
    <Button
      className="min-h-11 w-full"
      disabled={action.disabled}
      onClick={action.onClick}
      variant={variant}
    >
      {action.icon}
      {action.label}
    </Button>
  );
}

/**
 * Overlay footer actions on the P2-B action grammar (PanelAction, published
 * in the cross-session log): one primary maximum, quiet ghost secondaries,
 * verb+object labels run through the copy tripwires. Desktop renders the
 * right-aligned ActionCluster; phone sheets stack full-width 44px buttons
 * with the primary on top, inside the sticky DrawerFooter.
 */
function OverlayActions({
  primary,
  secondary,
}: {
  primary?: PanelAction;
  secondary?: PanelAction[];
}) {
  const isMobile = React.useContext(AdaptiveMobileContext);
  if (!isMobile) {
    return <ActionCluster primary={primary} secondary={secondary} />;
  }
  return (
    <div className="flex flex-col gap-2">
      {primary && <StackedAction action={primary} variant="default" />}
      {(secondary ?? []).slice(0, 2).map((action) => (
        <StackedAction action={action} key={action.label} variant="ghost" />
      ))}
    </div>
  );
}

export {
  AdaptiveDialog,
  AdaptiveDialogClose,
  AdaptiveDialogContent,
  AdaptiveDialogDescription,
  AdaptiveDialogFooter,
  AdaptiveDialogHeader,
  AdaptiveDialogTitle,
  AdaptiveDialogTrigger,
  OverlayActions,
  OverlayDepthContext,
  useOverlayDepthGuard,
  useOverlayDraft,
};
