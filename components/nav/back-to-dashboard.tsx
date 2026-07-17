"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  currentBrowserPath,
  NAV_STACK_EVENT,
  referrerPath,
} from "./nav-history";

/**
 * R2-5: one consistent way back from every detail page. A small breadcrumb
 * above the page title, so leaving a deep surface never depends on finding
 * the nav bar or the browser's back button. Document pages nested under a
 * listing (e.g. /goals/[id]) point their fallback at their parent (R2-9).
 *
 * RC-1 (SYS-16, HYD-16, GOL-05): the control is referrer-aware. When the
 * member navigated here from another in-app page it reads plain "Back" and
 * walks real history (router.back(), so Next restores the scroll position
 * they left). On a cold entry (deep link, fresh tab) it falls back to the
 * labeled destination. Either way the label never lies: "Back" is always
 * the page you came from, a named destination is always the page you get.
 */
export function BackToDashboard({
  href = "/today",
  label = "Dashboard",
}: {
  href?: string;
  label?: string;
}) {
  const router = useRouter();
  // Client-only read (sessionStorage does not exist during SSR), refreshed
  // when the NavTracker records the visit: the islands hydrate in no
  // guaranteed order, so the first read may predate the tracker's push.
  const [referrer, setReferrer] = useState<string | null>(null);
  useEffect(() => {
    const update = () => setReferrer(referrerPath(currentBrowserPath()));
    update();
    window.addEventListener(NAV_STACK_EVENT, update);
    return () => window.removeEventListener(NAV_STACK_EVENT, update);
  }, []);

  return (
    <Link
      // Negative margins cancel the padding visually (top -14 = -py, bottom
      // -6 = 8px original gap minus the 14px padding), so the link renders
      // exactly where it always did while its tap target clears 44px (the
      // text alone measured 17px tall on a phone).
      className="-mx-2 -mt-3.5 -mb-1.5 inline-flex items-center gap-1 px-2 py-3.5 text-muted-foreground text-xs underline-offset-4 transition-colors hover:text-foreground hover:underline"
      href={referrer ?? href}
      onClick={
        referrer
          ? (event) => {
              // Plain left-clicks walk history; modified clicks keep the
              // link's default behavior (the href is the real referrer).
              if (
                event.defaultPrevented ||
                event.button !== 0 ||
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
              ) {
                return;
              }
              event.preventDefault();
              router.back();
            }
          : undefined
      }
    >
      <ArrowLeft className="size-3.5" />
      {referrer ? "Back" : label}
    </Link>
  );
}
