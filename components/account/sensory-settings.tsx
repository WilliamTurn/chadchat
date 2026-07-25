"use client";

import { useId, useState, useTransition } from "react";
import { saveSensorySettings } from "@/app/account/actions";
import { SettingsRow } from "@/components/account/settings-row";
import { Switch } from "@/components/ui/switch";

/**
 * The sound + vibration rows for logging feedback (DSH-54): every log
 * plays a short success chime and, on phones, a light vibration. Two
 * independent switches, optimistic like the other /account rows: flip
 * instantly, roll back on failure. The moved switch is the feedback, no
 * toast (ux-canon 03 #32); failure renders inline (ux-canon 03 #29, #40).
 */
export function SensorySettings({
  initialSound,
  initialHaptics,
}: {
  initialSound: boolean;
  initialHaptics: boolean;
}) {
  const soundId = useId();
  const hapticsId = useId();
  const [sound, setSound] = useState(initialSound);
  const [haptics, setHaptics] = useState(initialHaptics);
  const [soundError, setSoundError] = useState<string | null>(null);
  const [hapticsError, setHapticsError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save(
    next: { sound: boolean; haptics: boolean },
    onError: (message: string) => void,
    errorMessage: string
  ) {
    const prev = { sound, haptics };
    setSound(next.sound);
    setHaptics(next.haptics);
    setSoundError(null);
    setHapticsError(null);
    startTransition(async () => {
      try {
        await saveSensorySettings({
          soundEnabled: next.sound,
          hapticsEnabled: next.haptics,
        });
      } catch {
        setSound(prev.sound);
        setHaptics(prev.haptics);
        onError(errorMessage);
      }
    });
  }

  return (
    <>
      <SettingsRow
        control={
          <Switch
            checked={sound}
            disabled={isPending}
            id={soundId}
            onCheckedChange={(next) =>
              save(
                { sound: next, haptics },
                setSoundError,
                "Sound effects didn't save. Try again."
              )
            }
          />
        }
        controlId={soundId}
        error={soundError}
        label="Sound effects"
        supporting="A short chime when you log something or a timer ends."
      />
      <SettingsRow
        control={
          <Switch
            checked={haptics}
            disabled={isPending}
            id={hapticsId}
            onCheckedChange={(next) =>
              save(
                { sound, haptics: next },
                setHapticsError,
                "Vibration didn't save. Try again."
              )
            }
          />
        }
        controlId={hapticsId}
        error={hapticsError}
        label="Vibration"
        supporting="A light buzz on logs and timers, on phones that support it."
      />
    </>
  );
}
