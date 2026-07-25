"use client";

import { useId, useState, useTransition } from "react";
import { saveQuitDateEnabled } from "@/app/account/actions";
import { SettingsRow } from "@/components/account/settings-row";
import { Switch } from "@/components/ui/switch";

/**
 * The Quit Date on/off switch (FEAT-25, all members). Off hides the /home
 * card, blocks new autopsies, and stops Chad referencing the prediction in
 * chat and check-ins. Optimistic like the other /account switches: flips
 * instantly, rolls back on failure. The moved switch is the feedback, no
 * toast (ux-canon 03 #32); failure renders inline (ux-canon 03 #29, #40).
 */
export function QuitDateSettings({ initialEnabled }: { initialEnabled: boolean }) {
  const id = useId();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save(next: boolean) {
    const prev = enabled;
    setEnabled(next);
    setError(null);
    startTransition(async () => {
      try {
        await saveQuitDateEnabled(next);
      } catch {
        setEnabled(prev);
        setError("The Quit Date didn't save. Try again.");
      }
    });
  }

  return (
    <SettingsRow
      control={
        <Switch
          checked={enabled}
          disabled={isPending}
          id={id}
          onCheckedChange={save}
        />
      }
      controlId={id}
      error={error}
      label="The Quit Date"
      supporting="Chad predicts the day you quit and counts down to it on Home."
    />
  );
}
