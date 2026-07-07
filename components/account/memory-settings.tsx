"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setChadMemoryEnabled } from "@/app/account/actions";
import { Switch } from "@/components/ui/switch";

/**
 * Chad's memory toggle on /account (owner order, s157): it lived only in the
 * chat sidebar's Settings popup, but members look for it in the dashboard
 * settings. Same server action as that popup; optimistic like the other
 * /account switches.
 */
export function MemorySettings({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isPending, startTransition] = useTransition();

  function save(next: boolean) {
    const prev = enabled;
    setEnabled(next);
    startTransition(async () => {
      try {
        await setChadMemoryEnabled(next);
        toast.success(
          next
            ? "Chad will remember you across sessions."
            : "Memory off. Every session starts fresh."
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
        <h3 className="font-medium text-sm">Chad&apos;s memory</h3>
        <p className="mt-1 text-muted-foreground text-sm">
          Chad remembers you from session to session and gets smarter about
          coaching you the more you work with him.{" "}
          <span className="text-foreground">
            Recommended: keep this on for best results.
          </span>
        </p>
      </div>
      <Switch
        aria-label="Chad's memory"
        checked={enabled}
        disabled={isPending}
        onCheckedChange={save}
      />
    </div>
  );
}
