"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { useLocalStorage } from "usehooks-ts";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { fetcher } from "@/lib/utils";

type SettingsResponse = { memoryEnabled: boolean; hasMemory: boolean };

const SETTINGS_KEY = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/me/settings`;

export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  // Only fetch while the dialog is open.
  const { data, isLoading, mutate } = useSWR<SettingsResponse>(
    open ? SETTINGS_KEY : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const [isPending, startTransition] = useTransition();
  const [isClearing, startClearing] = useTransition();

  // The composer reads this same key, so flipping it here updates the empty
  // state live (usehooks-ts syncs useLocalStorage across components).
  const [hideSuggestions, setHideSuggestions] = useLocalStorage(
    "chad-hide-suggestions",
    false
  );

  const memoryEnabled = data?.memoryEnabled ?? false;
  const hasMemory = data?.hasMemory ?? false;

  function handleMemoryToggle(next: boolean) {
    // Optimistic — flip immediately, roll back if the server rejects.
    mutate({ memoryEnabled: next, hasMemory }, { revalidate: false });
    startTransition(async () => {
      try {
        await setChadMemoryEnabled(next);
        toast.success(
          next
            ? "Chad will remember you across chats."
            : "Memory off. New chats start fresh."
        );
      } catch {
        mutate({ memoryEnabled: !next, hasMemory }, { revalidate: false });
        toast.error("Couldn't update that. Try again.");
      }
    });
  }

  function handleClear() {
    startClearing(async () => {
      try {
        await clearChadMemory();
        mutate({ memoryEnabled, hasMemory: false }, { revalidate: false });
        toast.success("Cleared. Chad's memory of you is wiped.");
      } catch {
        toast.error("Couldn't clear memory. Try again.");
      }
    });
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Control how Chad works for you.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col divide-y divide-border">
          {/* Chad's memory */}
          <div className="flex flex-col gap-4 py-4 first:pt-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-medium text-sm">Chad's memory</h3>
                <p className="mt-1 text-muted-foreground text-sm">
                  Let Chad remember you across chats — your stats, goals, plan,
                  and progress — so every new chat picks up where you left off.{" "}
                  <span className="text-foreground">
                    Recommended for best results.
                  </span>
                </p>
              </div>
              <Switch
                aria-label="Toggle Chad's memory"
                checked={memoryEnabled}
                disabled={isLoading || isPending}
                onCheckedChange={handleMemoryToggle}
              />
            </div>

            {memoryEnabled && hasMemory && (
              <div className="flex items-center justify-between gap-4">
                <p className="text-muted-foreground text-sm">
                  Want a clean slate? Wipe everything Chad remembers about you.
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
                        This permanently deletes the profile Chad has built about
                        you (your stats, goals, plan, and progress notes). Your
                        chat history stays. This can't be undone.
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

          {/* Example prompts */}
          <div className="flex items-start justify-between gap-4 py-4 last:pb-0">
            <div>
              <h3 className="font-medium text-sm">Example prompts</h3>
              <p className="mt-1 text-muted-foreground text-sm">
                Show the suggested starter prompts on the empty chat screen.
              </p>
            </div>
            <Switch
              aria-label="Toggle example prompts"
              checked={!hideSuggestions}
              onCheckedChange={(next) => setHideSuggestions(!next)}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
