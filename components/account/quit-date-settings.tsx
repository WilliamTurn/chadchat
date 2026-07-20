"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveQuitDateEnabled } from "@/app/account/actions";
import { Switch } from "@/components/ui/switch";

/**
 * The Quit Date on/off switch (FEAT-25, all members). Off hides the /home
 * card, blocks new autopsies, and stops Chad referencing the prediction in
 * chat and check-ins. Optimistic like the other /account switches: flips
 * instantly, rolls back on failure.
 */
export function QuitDateSettings({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isPending, startTransition] = useTransition();

  function save(next: boolean) {
    const prev = enabled;
    setEnabled(next);
    startTransition(async () => {
      try {
        await saveQuitDateEnabled(next);
        toast.success(
          next
            ? "The Quit Date is on. Chad keeps the countdown."
            : "The Quit Date is off. The prediction is hidden everywhere."
        );
      } catch {
        setEnabled(prev);
        toast.error("Couldn't save that. Try again.");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h3 className="font-medium text-sm">The Quit Date</h3>
        <p className="mt-1 text-muted-foreground text-sm">
          Chad predicts the exact day you quit and keeps the countdown on Home.
          Switch it off to hide the prediction everywhere and stop him bringing
          it up.
        </p>
      </div>
      <Switch
        aria-label="The Quit Date"
        checked={enabled}
        disabled={isPending}
        onCheckedChange={save}
      />
    </div>
  );
}
