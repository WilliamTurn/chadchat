"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { clearChadMemory, setChadMemoryEnabled } from "@/app/account/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export function MemorySettings({
  initialEnabled,
  hasMemory,
}: {
  initialEnabled: boolean;
  hasMemory: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [memoryExists, setMemoryExists] = useState(hasMemory);
  const [isPending, startTransition] = useTransition();
  const [isClearing, startClearing] = useTransition();

  function handleToggle(next: boolean) {
    // Optimistic — flip immediately, roll back if the server rejects.
    setEnabled(next);
    startTransition(async () => {
      try {
        await setChadMemoryEnabled(next);
        toast.success(
          next
            ? "Chad will remember you across chats."
            : "Memory off. New chats start fresh."
        );
      } catch {
        setEnabled(!next);
        toast.error("Couldn't update that. Try again.");
      }
    });
  }

  function handleClear() {
    startClearing(async () => {
      try {
        await clearChadMemory();
        setMemoryExists(false);
        toast.success("Cleared. Chad's memory of you is wiped.");
      } catch {
        toast.error("Couldn't clear memory. Try again.");
      }
    });
  }

  return (
    <div className="mt-6 rounded-2xl border border-border bg-card p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-medium text-lg">Chad's memory</h2>
          <p className="mt-1 text-muted-foreground text-sm">
            Let Chad remember you across chats — your stats, goals, plan, and
            progress — so every new chat picks up where you left off instead of
            starting from scratch.{" "}
            <span className="text-foreground">Recommended for best results.</span>
          </p>
        </div>
        <Switch
          aria-label="Toggle Chad's memory"
          checked={enabled}
          disabled={isPending}
          onCheckedChange={handleToggle}
        />
      </div>

      {enabled && memoryExists && (
        <div className="mt-5 flex items-center justify-between gap-4 border-border border-t pt-5">
          <p className="text-muted-foreground text-sm">
            Want a clean slate? You can wipe everything Chad remembers about you.
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button disabled={isClearing} size="sm" variant="outline">
                Clear memory
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear Chad's memory?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently deletes the profile Chad has built about you
                  (your stats, goals, plan, and progress notes). Your chat
                  history stays. This can't be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep it</AlertDialogCancel>
                <AlertDialogAction onClick={handleClear}>
                  Clear memory
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
}
