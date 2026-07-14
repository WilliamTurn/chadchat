# P56-C live browser verification (FIX-26 hydration + FIX-27 sleep)

Date: 2026-07-13
Target: http://localhost:3600 (shared dev server, shared PROD Neon DB)
Account: claude-testing@example.com (Pro, confirmed)
Driver: Node Playwright (evidence-p56c/verify-p56c.mjs), headless Chromium
Viewports: desktop 1280x900 and phone 390x844 (hasTouch + isMobile), dark theme, reduced motion
Result: 21 / 21 PASS (0 FAIL, 0 N/A)

## Starting-state note (important for reading the choreography)

On this account both panels began in the EMPTY data state: no water logged today
and no sleep ever logged. In the empty state the panel footer (the "More options"
overflow) and the populated headline / liquid gauge / night columns do not render
by design, so the populated-state checks required real logged rows. To verify those
faithfully without leaving residue, the run used two kinds of rows:

- Short-lived rows for the CRITICAL Undo checks (logged, then removed inside the
  6s Undo-toast window).
- Keeper rows for the populated-state checks (logged, page reloaded to render the
  server-side surfaces, then removed through the intended confirm-delete paths:
  the /hydration "Today's log" Delete entry, the /sleep History Delete night).

A final independent probe (evidence-p56c/cleancheck.mjs) re-logged in and confirmed
both panels returned to state=empty with no Today's log and 0 history rows.

## /hydration

- Check 1 PASS. Populated panel renders the LiquidGauge (role=img svg with 2 wave
  paths), a row of 7 week bars, a 7-dot week strip, headline metric, and the
  context "of 128 oz goal". State=populated. Evidence: 01b-hydration-panel-populated-desktop.png
- Check 2 PASS. "Log water" opens an overlay; document.activeElement is a DIV
  (the dialog container), not an input. No autofocus. Evidence: 02-hydration-logwater-overlay-desktop.png
- Check 3 PASS. Tapping the "+8 oz Glass" serving closes the overlay, the headline
  rolls 0 -> 8 oz (delta 8, optimistic), and a toast with an "Undo" action appears.
  Evidence: 03-hydration-undo-toast-desktop.png
- Check 4 PASS (CRITICAL). Clicking Undo returns the headline to the prior value
  (8 -> 0, exact revert). The entry just added was removed and only that entry.
- Check 5 PASS. "More options" lists "Edit daily goal" and "Log a past day".
  Clicking "Log a past day" sets the hash to #log-past-day and scrolls the "Log a
  past day" card into view. Evidence: 05-hydration-overflow-menu-desktop.png
- Check 6 PASS. Logging 20 oz for yesterday (Sun, Jul 12) shows the toast
  "Added 20 oz to Sun, Jul 12." with Undo; clicking Undo produces the "Removed."
  confirmation (entry deleted). Evidence: 06-hydration-backfill-undo-toast-desktop.png
- Check 7 PASS. "Edit daily goal" opens the "Daily hydration goal" overlay with no
  autofocused input (activeElement DIV); Escape closes it and the goal context is
  unchanged ("of 128 oz goal" before and after). Evidence: 07-hydration-editgoal-overlay-desktop.png
- Check 8 PASS. The header detail link reads "Hydration history" with href="#history",
  and the #history section exists on the page.

## /sleep

- Check 9 PASS. Populated panel renders 7 vertical night columns, a dashed goal
  line, a 7-dot week strip, and a headline duration ("7h 15m of 7h goal, Goal met").
  State=populated. Evidence: 09-sleep-panel-desktop.png
- Check 10 PASS. The log flow opens an AdaptiveDialog as a centered dialog
  (data-slot=dialog-content, not a drawer and not a popover anchored to the button);
  document.activeElement is a DIV, no autofocused input. Evidence: 10-sleep-log-overlay-desktop.png
- Check 11 PASS. Logged an unlogged in-week night (Sun, Jul 12), 7h 15m, quality 4
  stars. No "Replaces the ..." warning appeared (chosen night had no entry, so real
  data was never at risk). Toast: "Sleep logged for Sun, Jul 12. 7h 15m." with Undo.
  The Jul 12 week column and dot filled (date is in the current week). Evidence:
  11-sleep-log-filled-desktop.png, 11b-sleep-undo-toast-desktop.png
- Check 12 PASS (CRITICAL). Clicking Undo, then reloading, confirmed the Jul 12 night
  is absent from History (removed).
- Check 13 PASS. History row Delete opens a CONFIRMATION dialog naming the exact night
  ("Delete the Sun, Jul 12 night of 7h 15m?"); Cancel dismisses it without deleting.
  Edit opens a centered dialog titled "Edit sleep" (not a popover) seeded with the
  night's controls. Both closed without saving. Evidence: 13-sleep-delete-confirm-desktop.png,
  13b-sleep-edit-dialog-desktop.png
- Check 14 PASS. Overflow "Edit nightly goal" opens the "Nightly sleep goal" overlay
  with 7h / 8h / 9h presets; closed without saving. Evidence: 14-sleep-editgoal-overlay-desktop.png
- Check 15 PASS. No popover-anchored log form remains for sleep or water. Both log
  forms live inside the AdaptiveDialog / Drawer overlays; no Radix popover on either
  page contains the old water-oz or sleep hours/minutes form fields (the only popover
  in use is the branded date-picker calendar).

## Phone (390x844, touch)

- Check M2 PASS. "Log water" (tapped) opens as a BOTTOM SHEET
  (data-slot=drawer-content, data-vaul-drawer-direction=bottom, bottom-anchored to
  the viewport); no autofocused input; no horizontal overflow (scrollWidth 390 <=
  clientWidth 390). Evidence: 21-hydration-logwater-sheet-390.png
- Check M3 PASS. Tapping "+8 oz Glass" rolls the headline 0 -> 8 oz (delta 8) with an
  Undo toast. Evidence: 22-hydration-undo-toast-390.png
- Check M4 PASS. Tapping Undo reverts the headline to 0 (exact).
- Check M10 PASS. The sleep log flow (tapped) opens as a BOTTOM SHEET, no autofocused
  input, no horizontal overflow. Evidence: 24-sleep-log-sheet-390.png
- Check M11 PASS. Logged Sun, Jul 12, 7h 15m, quality 4 (tap); no replace warning;
  toast "Sleep logged for Sun, Jul 12. 7h 15m." Evidence: 25-sleep-log-filled-390.png,
  26-sleep-undo-toast-390.png
- Check M12 PASS. Tapping Undo, then reloading, confirmed the Jul 12 night was removed.

## Row cleanup tally

Rows created: 7. Rows cleaned: 7. Net residue: 0.

Breakdown:
1. Desktop water quick-add glass (short-lived) -> removed via toast Undo (check 4).
2. Desktop water keeper glass -> removed via /hydration Today's log "Delete entry".
3. Desktop water backfill 20 oz / Jul 12 -> removed via toast Undo (check 6).
4. Desktop sleep Night A (Jul 12) -> removed via toast Undo (check 12).
5. Desktop sleep keeper Night B (Jul 12) -> removed via /sleep History "Delete night".
6. Mobile water quick-add glass -> removed via toast Undo (check M4).
7. Mobile sleep night (Jul 12) -> removed via toast Undo (check M12).

Independent post-run probe (cleancheck.mjs): /hydration state=empty, Today's log absent;
/sleep state=empty, 0 history rows. The shared DB was returned to its pre-test state.

No user goal was changed (both Edit-goal overlays were closed with Escape / without
saving). No real logged data existed on this account for these domains, so none was
touched.
