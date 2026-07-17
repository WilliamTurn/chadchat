"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import {
  consumeFreshNavigation,
  currentBrowserPath,
  type NavAction,
  recordVisit,
  savedScrollPosition,
  saveScrollPosition,
} from "./nav-history";

/**
 * RC-1 (SYS-15/16): mounted once per standalone page by PageShell (and
 * record-only, `manageScroll={false}`, in the chat layout, since chat owns
 * its own scroll). Maintains the sessionStorage nav stack and gives every
 * page the two register behaviors:
 *
 * - Returning to a page (back, or re-tapping a bottom-nav tab) restores the
 *   scroll position you left, topping up while Suspense content streams in.
 * - Fresh navigations start at the top. The bottom-nav tabs navigate with
 *   scroll={false} (so a tab RETURN doesn't flash the top first), which
 *   turns off Next's own scroll-to-top; the push branch below covers it.
 */

// Survives a StrictMode remount (whose cleanup cancels an in-flight restore,
// so the re-run must resume it) but resets on a real page load, where the
// browser owns scroll restoration.
let lastHandled: { path: string; action: NavAction; fresh: boolean } | null =
  null;

const RESTORE_DEADLINE_MS = 6000;

/** Scroll as deep as the streaming page currently allows, topping up as
 *  content lands, until the target is reachable, the member takes over
 *  (wheel/touch/keys), or the deadline passes. Returns a cancel function. */
function restoreScrollPosition(target: number): () => void {
  const deadline = performance.now() + RESTORE_DEADLINE_MS;
  let rafId = 0;
  const stop = () => {
    cancelAnimationFrame(rafId);
    window.removeEventListener("wheel", stop);
    window.removeEventListener("touchstart", stop);
    window.removeEventListener("keydown", stop);
  };
  const tick = () => {
    const reachable =
      document.documentElement.scrollHeight - window.innerHeight;
    if (reachable >= target) {
      window.scrollTo(0, target);
      stop();
      return;
    }
    window.scrollTo(0, Math.max(0, reachable));
    if (performance.now() > deadline) {
      stop();
      return;
    }
    rafId = requestAnimationFrame(tick);
  };
  window.addEventListener("wheel", stop, { passive: true });
  window.addEventListener("touchstart", stop, { passive: true });
  window.addEventListener("keydown", stop);
  tick();
  return stop;
}

export function NavTracker({
  manageScroll = true,
}: {
  /** false = record the visit in the stack but leave scrolling alone (the
   *  chat shell is h-dvh and manages its own scroll). */
  manageScroll?: boolean;
}) {
  const pathname = usePathname();

  // Classify the movement and apply the scroll rule for it.
  useEffect(() => {
    if (!pathname) {
      return;
    }
    let action: NavAction;
    let fresh: boolean;
    const repeat = pathname === lastHandled?.path;
    if (repeat && lastHandled) {
      // A StrictMode replay (same commit) or a round trip through an
      // untracked page: never re-record, and never re-scroll-to-top (that
      // would fight the browser's own popstate restoration); only an
      // interrupted restore is worth resuming, and re-restoring the same
      // saved position is harmless.
      ({ action, fresh } = lastHandled);
    } else {
      action = recordVisit(pathname);
      fresh = consumeFreshNavigation();
      lastHandled = { path: pathname, action, fresh };
    }
    if (!manageScroll) {
      return;
    }
    // A hash navigation is owned by Next/the browser (it scrolls to the
    // anchor); never fight it. "reload"/"initial" belong to the browser's
    // own restoration.
    if (window.location.hash) {
      return;
    }
    if ((action === "back" || action === "return") && !fresh) {
      const target = savedScrollPosition(pathname);
      if (target > 0) {
        return restoreScrollPosition(target);
      }
      return;
    }
    if (action === "push" && !repeat) {
      window.scrollTo(0, 0);
    }
  }, [pathname, manageScroll]);

  // Scroll memory: save the position per pathname, rAF-throttled.
  useEffect(() => {
    if (!manageScroll || !pathname) {
      return;
    }
    let rafId = 0;
    const onScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        // A late clamp/scroll event can fire after the URL has moved on;
        // never let it overwrite the position saved for the page just left.
        if (currentBrowserPath() === pathname) {
          saveScrollPosition(pathname, window.scrollY);
        }
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", onScroll);
    };
  }, [pathname, manageScroll]);

  return null;
}
