"use client";

/**
 * CELEBRATION SCENE (FIX-33, owner visual directive): the WebGL flourish
 * behind the recent-win hero, an owner-account unicorn.studio scene (the
 * "Huly" laser, surveyed 2026-07-13; the briefing names it for hero
 * moments; Legend plan active so embeds are clean; the first screenshot
 * pass sanity-checks for a watermark anyway).
 *
 * Loading discipline (FIX-41 + the briefing's hard rule):
 *   - ZERO npm dependencies; the unicornstudio.js runtime is a third-party
 *     script injected ONLY at the moment of use.
 *   - It NEVER enters first-load JS: nothing loads until this component is
 *     actually on screen (IntersectionObserver) AND motion is allowed.
 *   - prefers-reduced-motion: the scene never loads; the hero's static
 *     tokenized gradient (rendered by the parent) is the designed
 *     equivalent, so the achievement reads identically (WCAG 2.2.2).
 *   - No sound, no haptics, no input capture: ambient visual only.
 */

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";

/** The owner's published scene (unicorn.studio embed id). */
const PROJECT_ID = "gzVuIBHLlxrggwcxBuXF";
const SDK_SRC =
  "https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v2.2.6/dist/unicornStudio.umd.js";

declare global {
  interface Window {
    UnicornStudio?: {
      init: () => Promise<unknown>;
      destroy: () => void;
    };
  }
}

let sdkPromise: Promise<void> | null = null;

function loadSdk(): Promise<void> {
  sdkPromise ??= new Promise<void>((resolve, reject) => {
    if (window.UnicornStudio) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = SDK_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      sdkPromise = null;
      reject(new Error("unicornstudio sdk failed to load"));
    };
    document.head.appendChild(script);
  });
  return sdkPromise;
}

export function CelebrationScene({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [inView, setInView] = useState(false);
  const [ready, setReady] = useState(false);

  // Load only when the hero is actually on screen.
  useEffect(() => {
    if (reduced || inView) {
      return;
    }
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "80px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [reduced, inView]);

  useEffect(() => {
    if (!inView || reduced) {
      return;
    }
    let cancelled = false;
    loadSdk()
      .then(() => {
        if (cancelled || !window.UnicornStudio) {
          return;
        }
        return window.UnicornStudio.init();
      })
      .then(() => {
        if (!cancelled) {
          setReady(true);
        }
      })
      .catch(() => {
        // The flourish is a nicety: the static hero treatment stands alone.
      });
    return () => {
      cancelled = true;
      // This page hosts the only scene; global destroy releases the WebGL
      // context on route change.
      window.UnicornStudio?.destroy();
    };
  }, [inView, reduced]);

  if (reduced) {
    return null;
  }

  return (
    <div aria-hidden className={className} ref={ref}>
      {inView && (
        <div
          className="h-full w-full transition-opacity duration-700"
          data-us-dpi="1"
          data-us-lazyload="true"
          data-us-production="true"
          data-us-project={PROJECT_ID}
          data-us-scale="1"
          style={{ opacity: ready ? 0.8 : 0 }}
        />
      )}
    </div>
  );
}
