"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveSensorySettings } from "@/app/account/actions";
import { Switch } from "@/components/ui/switch";

/**
 * The sound + vibration controls for logging feedback (DSH-54): every log
 * plays a short success chime and, on phones, a light vibration. Two
 * independent switches, optimistic like CheckInSettings: flip instantly,
 * roll back on failure.
 */
export function SensorySettings({
  initialSound,
  initialHaptics,
}: {
  initialSound: boolean;
  initialHaptics: boolean;
}) {
  const [sound, setSound] = useState(initialSound);
  const [haptics, setHaptics] = useState(initialHaptics);
  const [isPending, startTransition] = useTransition();

  function save(next: { sound: boolean; haptics: boolean }, message: string) {
    const prev = { sound, haptics };
    setSound(next.sound);
    setHaptics(next.haptics);
    startTransition(async () => {
      try {
        await saveSensorySettings({
          soundEnabled: next.sound,
          hapticsEnabled: next.haptics,
        });
        toast.success(message);
      } catch {
        setSound(prev.sound);
        setHaptics(prev.haptics);
        toast.error("Couldn't save that. Try again.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="font-medium text-sm">Sound effects</h3>
          <p className="mt-1 text-muted-foreground text-sm">
            A short chime when you log a workout, meal, weigh-in, or anything
            else, and when the rest timer finishes.
          </p>
        </div>
        <Switch
          aria-label="Sound effects"
          checked={sound}
          disabled={isPending}
          onCheckedChange={(next) =>
            save(
              { sound: next, haptics },
              next ? "Sound is on." : "Sound is off."
            )
          }
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="font-medium text-sm">Vibration</h3>
          <p className="mt-1 text-muted-foreground text-sm">
            A light buzz on logs and timers, on phones that support it.
          </p>
        </div>
        <Switch
          aria-label="Vibration"
          checked={haptics}
          disabled={isPending}
          onCheckedChange={(next) =>
            save(
              { sound, haptics: next },
              next ? "Vibration is on." : "Vibration is off."
            )
          }
        />
      </div>
    </div>
  );
}
