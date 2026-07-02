"use client";

import { useEffect } from "react";
import { captureTimezone } from "@/app/account/actions";

// Once-per-browser-session guard so navigating around the app doesn't re-fire
// the capture on every page.
const SYNC_FLAG = "chad:tz-synced";

/**
 * Silent per-user timezone capture (FEAT-8). Mounted app-wide; on first mount
 * of a browser session it reads the browser's IANA zone and hands it to the
 * server, which only ever fills an EMPTY `User.timezone` — so every member has
 * a zone from their first visit without ever being asked, and nothing a member
 * chose is overwritten. Renders nothing.
 */
export function TimezoneSync() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem(SYNC_FLAG)) {
        return;
      }
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (!timezone) {
        return;
      }
      captureTimezone(timezone)
        .then(({ authed }) => {
          // Not signed in yet (e.g. the /login page) — leave the flag unset so
          // the first authenticated page still captures.
          if (authed) {
            sessionStorage.setItem(SYNC_FLAG, "1");
          }
        })
        .catch(() => {
          // Best-effort: a failed capture must never surface to the user.
        });
    } catch {
      // sessionStorage/Intl unavailable — skip silently.
    }
  }, []);

  return null;
}
