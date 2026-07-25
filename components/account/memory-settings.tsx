"use client";

import { useId, useState, useTransition } from "react";
import { setChadMemoryEnabled } from "@/app/account/actions";
import { SettingsRow } from "@/components/account/settings-row";
import { Switch } from "@/components/ui/switch";

/**
 * Chad's memory toggle on /account (owner order, s157): it lived only in the
 * chat sidebar's Settings popup, but members look for it in the dashboard
 * settings. Same server action as that popup; optimistic like the other
 * /account switches. The moved switch is the feedback, no toast (ux-canon
 * 03 #32); failure renders inline (ux-canon 03 #29, #40).
 */
export function MemorySettings({ initialEnabled }: { initialEnabled: boolean }) {
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
        await setChadMemoryEnabled(next);
      } catch {
        setEnabled(prev);
        setError("Chad's memory didn't save. Try again.");
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
      label="Chad's memory"
      supporting={
        // "session" is banned member vocabulary (session-vocab).
        <>
          Chad remembers you between conversations.{" "}
          <span className="text-foreground">Recommended: keep this on.</span>
        </>
      }
    />
  );
}
