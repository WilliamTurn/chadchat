import { ArrowLeft } from "lucide-react";
import Link from "next/link";

/**
 * R2-5: one consistent way back from every page that isn't the root of a
 * section. A small breadcrumb above the page title, so leaving a deep surface
 * never depends on finding the nav bar or the browser's back button. Document
 * pages nested under a listing (e.g. /goals/[id]) point at their parent (R2-9).
 *
 * RC-11 (Q-D, WKT-38/39): the control ALWAYS names its destination and ALWAYS
 * navigates to that explicit href. It used to be referrer-aware (plain "Back"
 * walking real history when you arrived from another in-app page), which read
 * as a loop on /workouts, where "Back" walked you straight into the workout you
 * had just exited. A back control that can land you anywhere cannot be labeled
 * honestly, so the referrer leg is gone: the label is the destination, and the
 * destination is where you land. This matches WorkoutBackLink
 * (`components/workouts/v2/page-header.tsx`), which was fixed the same way for
 * the same reason (XPK-16/17).
 */
export function BackLink({
  href = "/home",
  label = "Home",
}: {
  href?: string;
  label?: string;
}) {
  return (
    <Link
      // Negative margins cancel the padding visually (top -14 = -py, bottom
      // -6 = 8px original gap minus the 14px padding), so the link renders
      // exactly where it always did while its tap target clears 44px (the
      // text alone measured 17px tall on a phone).
      className="-mx-2 -mt-3.5 -mb-1.5 inline-flex items-center gap-1 px-2 py-3.5 text-muted-foreground text-xs underline-offset-4 transition-colors hover:text-foreground hover:underline"
      href={href}
    >
      <ArrowLeft className="size-3.5" />
      Back to {label}
    </Link>
  );
}
