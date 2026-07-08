"use client";

import * as React from "react";

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
import { useIsMobile } from "@/hooks/use-mobile";

/**
 * MOB-11: one dialog API, two presentations. On phones (<768px) the logging
 * dialogs render as a bottom sheet with a drag handle (the Hevy/Strong/
 * MyFitnessPal pattern — reachable one-handed, dismissed with a swipe); on
 * desktop they stay centered modals. Drop-in: same subcomponent names and
 * props as ui/dialog, so a Dialog converts by swapping imports.
 */

const AdaptiveMobileContext = React.createContext(false);

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
  ...props
}: React.ComponentProps<typeof DialogContent>) {
  const isMobile = React.useContext(AdaptiveMobileContext);
  if (isMobile) {
    return (
      <DrawerContent
        // Never auto-focus a field on a phone: the keyboard would cover the
        // sheet the moment it opens (the NUT-27b rule, mobile-first gate).
        onOpenAutoFocus={(e) => e.preventDefault()}
        {...props}
      />
    );
  }
  return (
    <DialogContent
      onOpenAutoFocus={onOpenAutoFocus}
      showCloseButton={showCloseButton}
      {...props}
    />
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

export {
  AdaptiveDialog,
  AdaptiveDialogClose,
  AdaptiveDialogContent,
  AdaptiveDialogDescription,
  AdaptiveDialogFooter,
  AdaptiveDialogHeader,
  AdaptiveDialogTitle,
  AdaptiveDialogTrigger,
};
