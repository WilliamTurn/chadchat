# P56-E Mobile Audit -- Plans/goals + Progress-highlights bands, /plans, fixtures

**Target:** http://localhost:3600 (dev; shared prod DB, read-only)
**Account:** claude-testing@example.com (Pro)
**Viewports:** 390x844, 360, 320 (iPhone UA, touch emulation, DPR 2)
**Themes:** dark + light (both)
**Surfaces:** /today bands, /plans (+ Add-a-plan dialog), /dev/fixtures/plans-goals (consistent, overshoot, locked-basic)
**Method:** node Playwright (MCP browser profile locked by a parallel session). Scripts + screenshots in this directory.

## Verdict: DO-NOT-SHIP
Two gating issues: (P1) Add-a-plan dialog auto-focuses its Title input on open, so the keyboard opens uninvited (violates the nothing-starts-uninvited owner law); (P2) Progress-highlight tile labels overlap their action link at 320 and at the mainstream 360px Android width. Everything else is solid.

## Summary
- P1: 1
- P2: 3
- P3: 3 (incl. 1 copy-law note)
- No horizontal overflow at any width on any surface. Viewport meta correct. AA contrast passes BOTH themes. Segment strips readable at 320.

---

## /plans

### [P1] Add-a-plan (New plan) dialog auto-focuses the Title input on open
- Component: New-plan dialog (Add a plan trigger on the Your-training card)
- Viewport: all (measured 390)
- What is wrong: Opening the dialog immediately moves focus to the Title input (placeholder "e.g. 4-Day Upper/Lower Split"). On a phone this pops the software keyboard uninvited the instant the sheet appears. Measured activeElement = INPUT right after open; red focus ring visible in screenshot.
- Repro: /plans, tap Add a plan, Title field is focused / keyboard rises with no user action.
- Measurement: document.activeElement.tagName is INPUT immediately post-open.
- Screenshot: plans-dialog-open-dark-390.png
- Rule: OWNER LAW nothing-starts-uninvited; task brief "nothing may auto-focus when it opens."
- Benchmark: Hevy/MacroFactor open create-sheets with the keyboard down; the member taps the field to summon it.

### [P2] Dialog close (X) button is 34x34px (below 44)
- Component: New-plan dialog close control. Viewport: 390.
- What is wrong: The X target measures 34x34, below the 44px minimum, top-right (two-handed reach).
- Measurement: close button rect 34x34. Screenshot: plans-dialog-open-dark-390.png
- Benchmark: Hevy/Strong sheet close/handle targets are 44px or larger.

### [P3] Centered modal instead of a bottom sheet
- Component: New-plan dialog. Measurement: dialog rect x17 y85 w356 h674 in a 390x844 viewport (91% width, centered).
- Benchmark: Hevy exercise picker and MacroFactor add-food use full-width bottom sheets.

### [P3 / copy-law] Em-dash in shipping copy
- Meal-plan pointer card title "2,200 cal cut [em-dash] 3 meals/day"; New-plan dialog textarea placeholder "Day 1 [em-dash] Upper". Both use a literal em-dash, violating the no-em-dashes-ever law. Out of mobile-UX scope; surfaced because on audited surfaces.
- Screenshot: plans-page-dark-390.png, plans-dialog-open-dark-390.png

Clean on /plans: header, back link, All-plans intro, empty Your-training card, bottom nav (60px targets, safe-area). All page controls 44px or larger. No page-load autofocus (body focused). No overflow at 320.

---

## /today -- Progress-highlights band

### [P2] Tile eyebrow labels OVERLAP the progress-link at narrow widths
- Component: TrainingHighlight / NutritionHighlight / RecoveryHighlight header rows.
- Viewport: 320 (all three) and 360 (Recovery). 390 clean.
- What is wrong: The metric label wraps to two lines and its glyphs render into the space of the right-aligned "... progress" action link (header is flex, justify-content:space-between, flex-wrap:nowrap; the label item does not yield width and the link does not drop to its own row). Colliding text reads as broken.
- Measurements (label text right edge vs link left edge):
  - 320px: Recovery consistency OVERLAP 50px (text 192, link 141); Nutrition adherence OVERLAP 31px (text 178, link 146); Training this week OVERLAP 5px.
  - 360px: Recovery consistency OVERLAP 10px (text 192, link 181); Nutrition and Training clear (9px / 25px gaps).
  - 390px: all clear (20-39px gaps).
- Screenshot: today-progress-band-light-320.png; today-progress-band-dark-390.png (clean baseline).
- Benchmark: Whoop/Hevy daily cards keep the metric title on one line and shrink the affordance to an icon/chevron; they never collide.

### [P3] Eyebrow labels truncate / wrap clumsily; weaker hierarchy than leaders
- Component: highlight tiles (and Plans-and-goals panels). Viewport: 320-390; worst in narrow columns.
- What is wrong: In constrained widths the labels ellipsize to ambiguity (NUTRITION ADH..., RECOVERY CO..., PRIMARY G..., MEAL P...) and on mobile live wrap to 2-line eyebrows. Full text is in the DOM (good for a11y) but the visible label loses meaning or looks clunky. Violates labels-always-instantly-clear.
- Measurement: fixtures 390 shows NUTRITION ADH...; fixtures 320 shows NUTRI..., RECO..., MEAL P....
- Screenshot: fixtures-dark-390.png, persona-consistent-dark-320.png
- Benchmark: Whoop keeps SLEEP / RECOVERY / STRAIN titles fully visible at every width.

Clean on Progress-highlights: helpful empty states; ring + segment placeholders render; AA contrast passes both themes (dark 4.86:1, light 5.28:1 on caption/context lines); primary controls 47px; theme toggle correct at all widths; no overflow.

---

## /today -- Plans-and-goals band and fixtures (consistent / overshoot / locked-basic)

### [P2] Primary-goal All-goals(2) link is 73x16px (height 16, below 44)
- Component: GoalPrimary multi-goal footer link. Viewport: all (appears when more than one goal; present in fixtures consistent).
- What is wrong: The tappable link All goals (2) measures 73x16. Height 16px is far under the 44px minimum, close under the last goal row.
- Measurement: rect 73x16. Screenshot: persona-consistent-dark-390.png
- Benchmark: Strong/Hevy list-footer links get 44px or larger row height.

Clean on Plans-and-goals / fixtures:
- No horizontal overflow at 390/360/320, all personas, both themes.
- All plan/goal panel controls 47px (Training plan, Start workout, Ask Chad, Open meal plan, Goal details, Workout history, Open plan, Upgrade to Pro, all progress links).
- Segment strips readable at 320 (segments ~40px, bars 53px+), not slivers, both themes.
- Long names wrap/ellipsize gracefully with no overlap: exercise chips wrap one-per-line at 320; the live long goal (Lose 200 lb and build a strong, muscular body) and the meal title (Egg whites, whole eggs and toast) wrap cleanly.
- Reward states (overshoot) and locked-basic teasers render correctly at all widths, both themes.
- AA contrast passes both themes on all caption/context/label/value text.

---

## Notes / not audited
- MCP browser profile was locked by a parallel session; drove via node Playwright with an iPhone context (touch, DPR 2). Read-only, only the /login form was submitted.
- The 9 sub-44 links flagged by the raw sweep on the fixtures URL are the DEV fixture-harness nav chrome, not shipping UI, excluded.
- Could not stress-test arbitrary ultra-long names beyond fixed fixtures + live account data; observed names all wrap/ellipsize without overlap.
