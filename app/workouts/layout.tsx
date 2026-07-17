import { Suspense, type ReactNode } from "react";
import { WorkoutDocks } from "@/components/workouts/v2/docks";
import { WorkoutsProvider } from "@/components/workouts/v2/store";

/**
 * Every /workouts page shares the client store (live session + builder
 * draft, mirrored to localStorage) and the floating docks (rest timer +
 * workout-in-progress mini bar), so a running session follows the member
 * across the whole feature. The docks read usePathname (request data), so
 * they sit behind Suspense to keep the rest of the shell streamable.
 *
 * Toasts (picker add, custom-exercise save) render on the app-wide Toaster
 * in the root layout (RC-5), which survives every navigation (flaws XPK-15).
 */
export default function WorkoutsLayout({ children }: { children: ReactNode }) {
  return (
    <WorkoutsProvider>
      {children}
      <Suspense fallback={null}>
        <WorkoutDocks />
      </Suspense>
    </WorkoutsProvider>
  );
}
