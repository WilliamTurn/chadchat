"use client";

import { useEffect } from "react";

/**
 * R2-5 companion: the detail pages stream their content in via <Suspense>,
 * so the browser's native #hash scroll fires before the anchor target exists
 * and silently lands at the top. Mount this INSIDE the streamed content; when
 * it hydrates the target is in the DOM, and it finishes the jump the URL
 * promised.
 */
export function ScrollToHash() {
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) {
      return;
    }
    document.getElementById(hash)?.scrollIntoView({ block: "start" });
  }, []);
  return null;
}
