# P56-D Live Verification (Today-shell rebuild)

Session P56-D live-verification agent. Dev server http://localhost:3600 (shared, prod DB). Pro test account claude-testing@example.com. Read-only toward code. Node Playwright scripts (no MCP browser). Screenshots in `evidence-p56d/ours/`.

Date of run: 2026-07-13. Root font-size observed: 17px (relevant to the strip finding below).

## Per-check results

| Check | Verdict | Evidence (one line) |
|-------|---------|---------------------|
| A. /today @1440 dark+light | **FAIL** (one sub-point) | Compact header (eyebrow "MONDAY, JULY 13", "Welcome back" + Pro badge, one "Talk to Chad"), NO silhouette img, NO Personalize control (0), Up next reason sentence present, Up next + Consistency side by side (y 782 vs 778), sections Today's log / Your plans / Results present, no quit-date card in body, ZERO console errors — ALL PASS **except**: the status strip renders 4 cells STACKED in one column (4 rows), NOT "4 cells in one row". Same in dark and light. |
| B. /today @390 & @320 dark | **FAIL** (one sub-point) | No horizontal overflow (scrollW==viewport at both). activeElement==BODY (nothing autofocused). Bottom nav visible with Today/Log/Progress/Coach/More. NO hamburger in top bar (only "Account menu"). Account menu opens with Plans & pricing / Account / Toggle light-dark / Sign out. Zero console errors. **BUT**: status strip is 1-column at 390 (spec expected 2x2). At 320 it is 1-column (correct). Sub-44px offenders listed below. |
| C. Toast @390 dark | **PASS** | Water panel "Log water" → dialog → tapped Glass (+8 oz). Toast "Added 8 oz. 8 oz of 128 oz today." with Undo. Toast bottom at y=768, 76px from viewport bottom (<=180), nav top at 784 → no overlap. Clicked Undo → water returned to 0 (reload-confirmed). **Water entry UNDONE.** |
| D. /account/appearance @1440 & @390 dark | **PASS** | Back link "Account", "Current" preview card, Male/Female tiles, "Upload your own" present. BEFORE active = Male (hero-male.png). Clicked Female → preview swapped to hero-female.png, tile pressed=Female (persisted across reload). Clicked Male → restored to hero-male.png (persisted). **Figure RESTORED to Male.** All appearance targets >=44px at 390. /account Preferences shows "Appearance" row; "Open Appearance" link href=/account/appearance navigates correctly. |
| E. Chat shell @390 & @1440 dark | **PASS** | @390 drawer (open via chat-header panel toggle): shows "New chat" + 14 chat-history links + "Delete all chats"; nav-group labels Track/Plan/Review and destination links Workouts/Hydration/Sleep are in DOM but display:none (wrapper `hidden md:block` computed display:none; all w=0/h=0/no offsetParent) — NOT visible. @1440 desktop chat sidebar shows grouped nav labels TRACK/PLAN/REVIEW + Workouts/Hydration links. |
| F. Up next inspectability @1440 dark | **PASS** | Up next reason "Last night's sleep isn't logged yet." "?" button → popover text contains "fixed order" AND "training session". Consistency headline "0 of 7" + "days logged this week" present. Focus/hover a day dot → tooltip "Sun, Jul 12 · Nothing logged" (real date). |
| G. DEC-08 breadth @390 dark | **PASS** | /nutrition and /hydration top bars each show only wordmark ("CHAD") + "Account menu" button — NO hamburger. Account menu opens with Plans & pricing / Account / Toggle / Sign out on both. Removal is shell-wide. |

## Sub-44px offender list (Check B, /today page body, excluding bottom nav)

Measured at 390 (identical set at 320). Heights ~34px (< 44px):

- BUTTON "Edit targets" — 118x34
- A "Ask Chad" — 117x34 (appears in multiple panels: Calories, Sleep panels)
- BUTTON "Edit nightly sleep goal" — 77x34
- BUTTON "Add a plan" — 124x34
- A "Chad dashboard" (wordmark, header chrome) — 91x30

All are >=44px wide but <44px tall. These use the `sm:min-h-8` pattern (32px) with `min-h-11` only applying below the sm breakpoint in some cases; the rendered height at phone widths is ~34px. Note the "Ask Chad" / panel action buttons carry `min-h-11 sm:min-h-8` but render 34px tall at 390 — flagging for owner review against the 44px mobile-target law.

## Primary finding (blocks A + B)

**Status strip never becomes multi-column.** The four-domain strip (`section[aria-label="Today's status"]`) renders as a single vertical column at EVERY width tested: 390px, 320px, 700px, 768px, and 1440px (1136px-wide container, still 1 column / 4 rows). Root cause is in `components/today/status-strip.tsx` line ~171-173: the `@container` marker and the `@[22rem]:grid-cols-2` / `@[56rem]:grid-cols-4` query utilities are on the SAME element. CSS container queries style the container's DESCENDANTS, not the container element itself, so the column breakpoints never match from the strip's own width and it stays `grid-cols-1`. (Root font is 17px, so `@[22rem]`=374px — but even the 386/406px containers at vp420/vp440 stayed 1-column, confirming the breakpoints never fire.)

Impact: check A "status strip renders 4 cells in one row" (desktop) FAILS, and check B "status strip is 2x2 at 390" FAILS. The 320 "1-column" expectation happens to match. Visible in `today-1440-dark.png` (4 full-width stacked cells) and `today-390-dark.png`.

## Console errors

None on any surface (A dark, A light, B 390, B 320) after filtering React DevTools / sourcemap / searchParams-Suspense dev noise.

## Cleanup confirmation

- Check C water write: added 8 oz, then clicked Undo; reload confirmed water back to 0 (unlogged). **Undone.**
- Check D figure choice: swapped Male→Female→Male; final persisted state = Male / hero-male.png (the before state). **Restored.**

## Screenshots saved (evidence-p56d/ours/)

- today-1440-dark.png, today-1440-light.png
- today-390-dark.png, today-320-dark.png, today-390-menu-dark.png
- today-390-water-toast-dark.png
- appearance-1440-before-dark.png, appearance-1440-after-dark.png, appearance-1440-swapped-dark.png, appearance-390-dark.png
- chat-390-drawer-dark.png, chat-1440-sidebar-dark.png
- today-1440-upnext-popover-dark.png, today-1440-consistency-tooltip-dark.png
- nutrition-390-topbar-dark.png, hydration-390-topbar-dark.png

## Round 2 (re-verification after fixes, same day)

Fixes verified: (1) status-strip container wrapper + px thresholds, (2) AskChadButton min-h-11 phone floor.

### 1. Status strip columns — PASS at every viewport

| Viewport | Columns measured | Layout | Grid template |
|----------|-----------------|--------|---------------|
| 1440 | 4 in one row (1 row) | 4x1 | 275px x4 |
| 768 | 2 (2 rows) | 2x2 | 226px x2 |
| 390 | 2 (2 rows) | 2x2 | 171.6px x2 |
| 360 | 2 (2 rows) | 2x2 | 156.6px x2 |
| 320 | 1 (4 rows) | 1-col | 286px |

All match spec. Screenshots: today-1440-dark-r2.png, today-390-dark-r2.png.

### 2. Ask Chad + wordmark targets @390 — PASS

All 8 visible "Ask Chad" links on /today measured 117x47 px (>=44). Header wordmark link "Chad dashboard": 91x47 px (>=44).

### 3. Overflow + console — PASS (one transient noted)

No horizontal overflow at any viewport (scrollWidth == viewport at 1440/768/390/360/320). Console errors: zero at 1440/390/360/320. At 768 the FIRST load logged one React hydration-mismatch error on the wordmark link (server HTML had the pre-fix className without `min-h-11`, client had the new one) — a stale-SSR-chunk transient from the just-landed edit; an immediate clean re-run at 768 logged ZERO errors. Not reproducible; no action needed unless it recurs on a cold prod build.

Round 2 verdict: both findings fixed; checks A and B status-strip sub-points now PASS.
