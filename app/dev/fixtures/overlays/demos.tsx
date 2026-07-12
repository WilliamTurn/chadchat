"use client";

import * as React from "react";
import Link from "next/link";

import {
  AdaptiveDialog,
  AdaptiveDialogContent,
  AdaptiveDialogDescription,
  AdaptiveDialogFooter,
  AdaptiveDialogHeader,
  AdaptiveDialogTitle,
  AdaptiveDialogTrigger,
  OverlayActions,
  useOverlayDraft,
} from "@/components/ui/adaptive-dialog";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/ui/confirm-undo";
import { toastReceipt, toastUndo } from "@/components/ui/toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { formatQuantity, formatVsTarget } from "@/lib/contracts/units";

/**
 * OVERLAY PLATFORM DEMOS (P2-D harness, FIX-17 evidence surface).
 *
 * Each demo exercises one row of the motion-interaction overlay decision
 * tree on the real platform components. `autoOpen` exists ONLY for the
 * screenshot suite and auditors (deterministic open state on page load); it
 * is a harness mechanism, not a product behavior, and does not exempt the
 * overlays from the no-auto-start law, which governs what happens INSIDE an
 * open overlay (no focused input, no running timer).
 */

const WATER_GOAL_OZ = 128;
const WATER_LOGGED_OZ = 96;
const QUICK_AMOUNTS_OZ = [8, 12, 16, 24];

export function QuickLogOverlayDemo({ autoOpen = false }: { autoOpen?: boolean }) {
  const [open, setOpen] = React.useState(autoOpen);
  const [amount, setAmount, clearAmount] = useOverlayDraft(
    "fixtures.overlays.water-oz",
    "16"
  );

  const save = () => {
    const oz = Number.parseFloat(amount);
    if (!Number.isFinite(oz) || oz <= 0) {
      return;
    }
    clearAmount();
    setOpen(false);
    toastUndo(
      `Added ${formatQuantity(oz, "oz")}. ${formatVsTarget(WATER_LOGGED_OZ + oz, WATER_GOAL_OZ, "oz")} today.`,
      {
        onUndo: () => {
          toastReceipt(
            `Removed ${formatQuantity(oz, "oz")}. Back to ${formatQuantity(WATER_LOGGED_OZ, "oz")} today.`
          );
        },
      }
    );
  };

  return (
    <AdaptiveDialog onOpenChange={setOpen} open={open}>
      <AdaptiveDialogTrigger asChild>
        <Button className="min-h-11 sm:min-h-9" data-testid="open-quicklog">
          Log water
        </Button>
      </AdaptiveDialogTrigger>
      <AdaptiveDialogContent>
        <AdaptiveDialogHeader>
          <AdaptiveDialogTitle>Log water</AdaptiveDialogTitle>
          <AdaptiveDialogDescription>
            {`Today so far: ${formatQuantity(WATER_LOGGED_OZ, "oz")} of ${formatQuantity(WATER_GOAL_OZ, "oz")} goal.`}
          </AdaptiveDialogDescription>
        </AdaptiveDialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {QUICK_AMOUNTS_OZ.map((oz) => (
              <Button
                className="min-h-11 sm:min-h-9"
                key={oz}
                onClick={() => setAmount(String(oz))}
                variant={amount === String(oz) ? "secondary" : "outline"}
              >
                {formatQuantity(oz, "oz")}
              </Button>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="overlay-demo-water">Amount (oz)</Label>
            <Input
              id="overlay-demo-water"
              inputMode="decimal"
              onChange={(e) => setAmount(e.target.value)}
              placeholder="16"
              value={amount}
            />
          </div>
        </div>
        <AdaptiveDialogFooter>
          <OverlayActions
            primary={{ label: "Add water", onClick: save }}
            secondary={[{ label: "Cancel", onClick: () => setOpen(false) }]}
          />
        </AdaptiveDialogFooter>
      </AdaptiveDialogContent>
    </AdaptiveDialog>
  );
}

export function EditEntryOverlayDemo({ autoOpen = false }: { autoOpen?: boolean }) {
  const [open, setOpen] = React.useState(autoOpen);
  const [hours, setHours, clearHours] = useOverlayDraft(
    "fixtures.overlays.sleep-hours",
    "7.5"
  );
  const [quality, setQuality, clearQuality] = useOverlayDraft(
    "fixtures.overlays.sleep-quality",
    "4"
  );

  const save = () => {
    clearHours();
    clearQuality();
    setOpen(false);
    toastReceipt(
      `Sleep entry updated. ${formatQuantity((Number.parseFloat(hours) || 0) * 60, "duration")} on Jul 10.`
    );
  };

  return (
    <AdaptiveDialog onOpenChange={setOpen} open={open}>
      <AdaptiveDialogTrigger asChild>
        <Button
          className="min-h-11 sm:min-h-9"
          data-testid="open-edit"
          variant="outline"
        >
          Edit sleep entry
        </Button>
      </AdaptiveDialogTrigger>
      <AdaptiveDialogContent>
        <AdaptiveDialogHeader>
          <AdaptiveDialogTitle>Edit sleep entry</AdaptiveDialogTitle>
          <AdaptiveDialogDescription>
            Jul 10. Corrections update your sleep trend immediately.
          </AdaptiveDialogDescription>
        </AdaptiveDialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="overlay-demo-hours">Hours slept</Label>
            <Input
              data-testid="edit-hours"
              id="overlay-demo-hours"
              inputMode="decimal"
              onChange={(e) => setHours(e.target.value)}
              value={hours}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="overlay-demo-quality">Sleep quality (1 to 5)</Label>
            <Input
              id="overlay-demo-quality"
              inputMode="numeric"
              onChange={(e) => setQuality(e.target.value)}
              value={quality}
            />
          </div>
        </div>
        <AdaptiveDialogFooter>
          <OverlayActions
            primary={{ label: "Save sleep entry", onClick: save }}
            secondary={[{ label: "Cancel", onClick: () => setOpen(false) }]}
          />
        </AdaptiveDialogFooter>
      </AdaptiveDialogContent>
    </AdaptiveDialog>
  );
}

export function ConfirmDemo({ autoOpen = false }: { autoOpen?: boolean }) {
  const [open, setOpen] = React.useState(autoOpen);
  return (
    <ConfirmActionDialog
      confirmLabel="Delete weigh-in"
      consequence="This will update your weight trend."
      onConfirm={async () => {
        await new Promise((resolve) => setTimeout(resolve, 600));
        toastReceipt("Weigh-in deleted. Your weight trend was updated.");
      }}
      onOpenChange={setOpen}
      open={open}
      title="Delete the Jul 6 weigh-in of 205.8 lb?"
      trigger={
        <Button
          className="min-h-11 sm:min-h-9"
          data-testid="open-confirm"
          variant="outline"
        >
          Delete weigh-in
        </Button>
      }
    />
  );
}

export function UndoQuickAddDemo() {
  return (
    <Button
      className="min-h-11 sm:min-h-9"
      data-testid="open-undo"
      onClick={() =>
        toastUndo(
          `Added ${formatQuantity(16, "oz")}. ${formatVsTarget(112, WATER_GOAL_OZ, "oz")} today.`,
          {
            onUndo: () => {
              toastReceipt(
                `Removed ${formatQuantity(16, "oz")}. Back to ${formatQuantity(WATER_LOGGED_OZ, "oz")} today.`
              );
            },
          }
        )
      }
      variant="outline"
    >
      Quick-add with Undo
    </Button>
  );
}

const DETAIL_SETS = [
  { exercise: "Bench press", detail: "4 sets, top set 225 lb for 5" },
  { exercise: "Incline dumbbell press", detail: "3 sets, top set 80 lb for 8" },
  { exercise: "Weighted dip", detail: "3 sets, top set 45 lb for 10" },
  { exercise: "Overhead press", detail: "4 sets, top set 135 lb for 6" },
  { exercise: "Cable fly", detail: "3 sets, top set 50 lb for 12" },
  { exercise: "Lateral raise", detail: "3 sets, top set 25 lb for 15" },
  { exercise: "Triceps pushdown", detail: "3 sets, top set 70 lb for 12" },
  { exercise: "Overhead extension", detail: "3 sets, top set 60 lb for 10" },
];

export function DetailSheetDemo({ autoOpen = false }: { autoOpen?: boolean }) {
  const [open, setOpen] = React.useState(autoOpen);
  return (
    <Sheet onOpenChange={setOpen} open={open}>
      <SheetTrigger asChild>
        <Button
          className="min-h-11 sm:min-h-9"
          data-testid="open-sheet"
          variant="outline"
        >
          Open workout detail
        </Button>
      </SheetTrigger>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Push day, Jul 10</SheetTitle>
          <SheetDescription>8 exercises, 26 sets, 62 minutes.</SheetDescription>
        </SheetHeader>
        <SheetBody>
          <ul className="flex flex-col divide-y divide-border">
            {DETAIL_SETS.map((row) => (
              <li className="flex flex-col gap-1 py-3" key={row.exercise}>
                <span className="font-medium text-foreground">{row.exercise}</span>
                <span className="text-muted-foreground">{row.detail}</span>
              </li>
            ))}
          </ul>
        </SheetBody>
        <SheetFooter>
          <Button asChild className="min-h-11 sm:min-h-9" variant="outline">
            <Link href="/workouts/history">Workout history</Link>
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
