import { Suspense, type ReactNode } from "react";
import { Toaster } from "sonner";
import { WorkoutDocks } from "@/components/workouts/v2/docks";
import { WorkoutsProvider } from "@/components/workouts/v2/store";

/**
 * Every /workouts page shares the client store (live session + builder
 * draft, mirrored to localStorage) and the floating docks (rest timer +
 * workout-in-progress mini bar), so a running session follows the member
 * across the whole feature. The docks read usePathname (request data), so
 * they sit behind Suspense to keep the rest of the shell streamable.
 *
 * The Toaster lives HERE, not on each page: a toast fired right before a
 * navigation (picker add, custom-exercise save) must survive the page it
 * was fired on, or the member never sees the confirmation (flaws XPK-15).
 */
export default function WorkoutsLayout({ children }: { children: ReactNode }) {
  return (
    <WorkoutsProvider>
      {children}
      <Toaster position="top-center" richColors theme="system" />
      <Suspense fallback={null}>
        <WorkoutDocks />
      </Suspense>
    </WorkoutsProvider>
  );
}
