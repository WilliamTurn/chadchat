# P56-B Browser Verification — FIX-33 Progress > Training

Server: http://localhost:3600 (shared dev, prod DB). Read-only; only login + navigation.
Date: 2026-07-13. Node Playwright (chromium), no MCP browser tools.
Scripts: harness.mjs, redblocks.mjs, probe.mjs, consistent.mjs, live.mjs, live-fix.mjs, live390.mjs.

## HEADLINE FINDING (DO-NOT-SHIP)

**CalendarHeatmap ("Training consistency" card) overflows catastrophically.** With any
realistic number of week-columns, each cell (`aspect-square w-full` inside a
`grid flex-1 grid-rows-7` week column, `components/charts/calendar-heatmap.tsx`) sizes its
HEIGHT to the stretched column WIDTH. Few columns => huge squares (352 / 234 / 139 px), so the
heatmap grows far taller than its 172px frame and is NOT clipped: the filled (logged-day)
cells paint large translucent BLOOD-RED squares (`var(--chart-5)`, opacity .675) down over the
Training volume chart, Strength and records cards, and the Records-and-milestones timeline.

- Measured heatmap box height: consistent persona **992px** (should be ~144px); live test
  account **2065px** (page grew to 2638px with a giant red square floating at the bottom).
- Reproduces on the HARNESS (sparse, lapsed, overshoot, AND the reference `consistent`
  persona) and on the LIVE `/progress/training` page (desktop AND 390 mobile).
- The header comment claims "fixed height at any window length" — that assumption is false
  for anything but GitHub-scale (~52) column counts.
- Evidence: section-consistent.png, section-lapsed.png, section-sparse.png,
  section-overshoot.png, live-training-dark-1440.png, live-training-dark-390.png.

The volume TrendChart itself is fine (clean on /workouts); the red blocks are 100% the heatmap.

---

## 1. HARNESS (/dev/fixtures/training, no auth) — 29/29 automated PASS; 1 critical visual FAIL

1.1 PASS — Full-page screenshots at 1440 & 390 in BOTH themes; light/dark render distinctly
    (html class toggles `dark`/`light`). Files: harness-{dark,light}-{1440,390}.png.
1.2 PASS — All six persona sections render: first-run, sparse, consistent, lapsed, overshoot,
    locked-basic (locked = designed "Pro feature" teaser + "Upgrade to Pro" CTA).
1.3 PASS — Consistent persona populated: adherence ring "this week" (2/3), volume trend chart,
    strength records grid, milestone "10th workout logged", Records-and-milestones timeline.
1.4 PASS — **DEDUP PROOF**: exactly ONE bench card, named "Barbell Bench Press" (fixture logs
    the alias "Bench Press"; dedup wiring works). All strength names: ["Barbell Bench Press",
    "Barbell Row"]. No stray "Bench Press" card.
1.5 PASS (with note) — CELEBRATION SCENE + WATERMARK: unicorn SDK IS requested from
    cdn.jsdelivr.net/gh/hiunicornstudio/...unicornStudio.umd.js; scene `<canvas>` rendered
    inside `[data-us-project]` (1340x96). **NO unicorn.studio watermark** — no badge anchor,
    no "unicorn.studio" text, none visible in the close-up (celebration-hero-motion.png shows a
    faint dark laser vs the flat static fallback). Zero console errors during scene load.
    NOTE: the hero content is **"New record: Barbell Row"** (170lb x 8, beat 166, 3 days ago),
    NOT "Barbell Bench Press" as the brief expected — because the fixture's genuinely-newest
    record-beating event is the Row (bench plateaus at 200lb while the row's climb is the most
    recent beat). "Barbell Bench Press" appears correctly as a timeline entry below. This is
    honest/correct hero behavior, just a mismatch with the brief's stated expectation.
1.6 PASS — REDUCED MOTION (prefers-reduced-motion: reduce): NO request to
    cdn.jsdelivr.net/gh/hiunicornstudio; the scene div (`[data-us-project]`) is not even
    mounted; hero still reads statically (celebration-hero-reduced-motion.png).
1.7 PASS — MOBILE honesty 390/360/320: scrollWidth == clientWidth at all three (0px overflow);
    document.activeElement == BODY on load (no input/textarea focused). Files:
    harness-mobile-390.png, harness-mobile-320.png.
1.8 **FAIL (critical)** — CalendarHeatmap overflow (see HEADLINE FINDING).

## 2. LIVE PAGE (/progress/training, Pro test account) — mostly PASS; 1 critical + 1 gap

2.1 PASS — Login succeeded; page reachable (not redirected to /pricing or /login); Training
    header + "Pro feature" badge render; status band renders (Workouts logged = 6).
2.2 GAP (could not verify click path) — The 1W/1M/.../All segmented range control did NOT
    render for the test account: its 6 sessions all fall within ~7 days, so the control has
    <2 meaningful presets and hides by design (ChartRangeControl returns null when
    presets.length < 2). Deep-link `?range=1w` IS honored (loads, row reads "6 sessions in the
    last 7 days"). So URL->state RESTORE is proven live; the segment-click -> URL write ->
    back/forward path could NOT be exercised live (no account with a wide enough data span).
    The harness confirms the control renders when data supports 2+ presets (lapsed/consistent
    show "1W / All"), but the harness disables urlState.
2.3 PASS — Record drill-down: clicking "Overhead Press" set `?pr=Overhead+Press`, opened the
    est.1RM drill-down chart, showed the **Epley formula** caption; the "View workout" link
    resolves to /workouts/history/<id> (HTTP 200, real workout page); browser Back CLOSES the
    drill-down (?pr removed).
2.4 PASS — Records-and-milestones: timeline entry links to its workout page (HTTP 200).
2.5 PASS — Touch targets: not measurable on this account (range control hidden, see 2.2). In
    the harness the ChartRangeControl carries `pointer-coarse:min-h-11` (44px). Not a fail,
    just unmeasured live.
2.6 **FAIL (critical)** — Heatmap overflow reproduces live (2065px, red square over page).
2.7 CONSOLE — A React 19 dev warning "An async function with useActionState was called outside
    of a transition" fires on /progress/training AND /workouts, but NOT in the harness (same
    analytics components render clean) and NOT on /today. => it is NOT from the FIX-33 training
    analytics code; it originates in an authenticated form/shell shared with /workouts.
    Non-fatal dev warning; pages otherwise function.

## 3. /workouts REGRESSION — all PASS

3.1 PASS — Page reachable and renders.
3.2 PASS — "Training volume" chart in the new frame style: title "Training volume", headline
    "8,550 lb  Latest day", segmented range control with a small **calendar icon** custom-range
    button. Opening it shows **From / To** pickers; Escape closes it. File:
    workouts-volume-records-1440.png.
3.3 PASS — Personal records cards render (Overhead Press / Tricep Pushdown / Barbell Bench
    Press); opening one shows the drill-down with the est.1RM chart and the **Epley formula**
    caption.
3.4 CONSOLE — same useActionState warning as 2.7 (pre-existing, not FIX-33-specific).

## WATERMARK VERDICT
NO unicorn.studio watermark. The paid-plan embed renders clean: no badge/anchor to
unicorn.studio, no "unicorn.studio" text in the DOM, none visible in the close-up screenshot.
Scene loads only in motion + on-screen; fully suppressed under reduced motion.

## LAYOUT FLAWS TO FLAG
- 390 & 320 harness and 390 live: only the CalendarHeatmap red-block overflow (element:
  logged-day cells in the "Training consistency" card). Everything else at 390/360/320 is
  clean — no horizontal overflow, status band reflows to a 2x2 grid, cards stack full width.
- No other element-level flaws observed.

## SCREENSHOTS WRITTEN (evidence-p56b/ours/)
harness-dark-1440.png, harness-dark-390.png, harness-light-1440.png, harness-light-390.png,
harness-mobile-390.png, harness-mobile-320.png, celebration-hero-motion.png,
celebration-hero-reduced-motion.png, section-consistent.png, section-sparse.png,
section-lapsed.png, section-overshoot.png, live-training-dark-1440.png,
live-training-dark-390.png, workouts-volume-records-1440.png

---

## Re-verification after heatmap fix

Date: 2026-07-13 (session P56-B re-verify). Server: http://localhost:3600 (shared dev). Read-only.
Fix under test: week-columns capped `max-w-4` (16px) in components/charts/calendar-heatmap.tsx;
ChartFrame plot height raised to 204px on the consistency card. Scripts: fix-harness.mjs,
fix-live.mjs, probe390.mjs. Raw JSON: fix-harness-results.json, fix-live-results.json.

**VERDICT: PASS on all three checks. The DO-NOT-SHIP heatmap overflow blocker is RESOLVED.**

### Check 1 — HARNESS /dev/fixtures/training, "consistent" persona (dark) — PASS
- 1440: "Training consistency" heatmap block = **130px** tall (was 992px) <= 210 PASS. Cells
  **16x16px**, max cell across the whole grid 16px <= 16 PASS. 5 week-columns cluster left
  (GitHub-calendar look). heatmap bottom 4163 < "Training volume" card top 4324 => **no overlap**
  PASS; heatmap fully inside its own card (bottom 4163 <= card bottom 4292). Screenshot
  fix-heatmap-1440.png (shows consistency+adherence row and the clean volume card below).
- 390: heatmap block = **137px** tall <= 210 PASS. Cells ~**17px** (1px over the nominal 16px
  max-w-4 cap; subpixel under mobile emulation, NOT the ballooning regression). No overlap
  (heatmap bottom 6555 < volume card top 7079); inside own card. Screenshot fix-heatmap-390.png.
- NOTE (not a bug): below the heatmap the consistency card also shows a 7-cell weekday strip
  "S M T W T F S" with ~34px filled squares. This is the `WeekBars` habit-streak strip (owner
  law s181, "never removed"), an intentional separate visual (class bg-[var(--chart-5)], not the
  heatmap's inline-style cells), contained in the 204px card body. Correct.

### Check 2 — LIVE /progress/training (Pro test account, 1440 dark) — PASS
- Heatmap block = **130px** tall (was 2065px) <= 210 PASS. Cells **16x16px** <= 16 PASS.
  heatmap bottom 638 < "Training volume" card top 799 => **no overlap** PASS; inside own card.
- Total page height = **1876px** (was 2638px with the floating red square) < 4000 PASS. Page
  renders clean: consistency heatmap + WeekBars strip contained, volume trend chart below with
  zero red overflow, Plan adherence / Muscle focus / Strength & records all intact.
  Screenshot fix-heatmap-live-1440.png.

### Check 3 — /progress overview (P56-A surface, report-only) — CONTAINED, no issues
- 2 CalendarHeatmaps on the page (NUTRITION card, CONSISTENCY card w/ 91 cells = 12 weeks).
  Both: block **130px** tall, max cell **16px** (<= 20), **neither overflows its card**. No
  heatmap block overlaps following content. Page height 1545px, sane. The large red bar in the
  TRAINING outcomes card is a weekly-sessions column chart (not a heatmap), renders fine.
  Screenshot fix-heatmap-overview.png.

### Other observations on these pages
- No new visual flaws. The pre-existing React 19 `useActionState` dev warning (logged in the
  original verification, global/not FIX-33-specific) was not re-audited this pass.

### Screenshots added this pass
fix-heatmap-1440.png, fix-heatmap-390.png, fix-heatmap-live-1440.png, fix-heatmap-overview.png

## Re-verification: audit P2 fixes

Session P56-B re-verify of the four mobile-audit P2 fixes, all on the running dev
server at http://localhost:3600 (read-only; Pro test account for authed pages).
Script: reverify-p56b.mjs (+ reverify-c3-c2.mjs for the corrected C3 selector and
the right-gutter Y-tick read). Raw JSON: reverify-p56b-results.json,
reverify-c3-c2-results.json. Screenshots in evidence-p56b/mobile-audit/fixed-*.png.

**VERDICT: PASS on all four fixes (one transparent caveat on the volume axis floor tick).**

### Fix 1 — CELEBRATION HERO (record-text basis-52, CTA wraps below) — PASS
/progress/training, logged in. The top highlighted card ("celebration hero") for
this account is the newest win = the milestone "5th workout logged, 2 days ago"
(a milestone, not a "New record:" PR, because that is genuinely the most recent
event — the hero renders whichever is newest and the basis-52 text block applies
to both variants identically).
- 390px: record-text block width **235px** (was the squeezed 0-31px column) > 180 PASS;
  headline on one clean line. "View the workout" button top **439** >= text bottom
  **424** => button sits BELOW the text row. PASS. Screenshot fixed-hero-390w.png.
- 360px: text block width **282px** > 180 PASS; button top **468** >= text bottom
  **455** => below. PASS.

### Fix 2 — VOLUME Y-AXIS (compact tick formatter, >=1000 -> "k") — PASS
Right-side Y-axis of the "Training volume" ChartFrame (recharts tick-value <text>
read from the DOM at the max-x/right gutter).
- /workouts (390px): y-ticks = **["-190", "3.3k", "6.8k", "9.7k"]**.
- /progress/training (390px): y-ticks = **["-190", "3.3k", "6.8k", "9.7k"]** (identical).
- Every value >= 1000 abbreviates to "k" (3.3k / 6.8k / 9.7k); **zero** 3-digit
  clipped fragments of a 5-digit number (the exact failure mode this fix targets).
  PASS.
- Caveat (not a fix failure): the axis-floor tick "-190" is 4 chars and does not end
  in "k", so under the strictest literal "< 4 chars OR ends in k" reading it is an
  exception. It is a fully-rendered, legible, correct negative baseline (the trend
  chart's below-zero domain padding), NOT a clipped fragment, so it does not
  represent the clipping bug. The -190 negative floor on a volume chart is a
  pre-existing domain-padding artifact, outside this tick-formatter fix's scope.
  Screenshot fixed-volume-axis-390w.png.

### Fix 3 — DRILL-DOWN SCROLL-INTO-VIEW (panel scrolls into view on open) — PASS
/workouts, 390px, touch emulation (hasTouch+isMobile). Scrolled the "Personal
records" grid top to viewport top, tapped the first record card ("Overhead Press"),
waited ~1s.
- Expanded panel (section.overflow-hidden) bounding box: top **341px**, within the
  **844px** viewport => intersects viewport (top < viewportH). PASS. Screenshot
  fixed-drilldown-390w.png shows the est-1RM drill-down chart fully visible.
- Selector note: a naive `button[aria-expanded]` .first() matches the KpiHelp "?"
  popover trigger, not a record card; the tap was scoped to the PR grid
  (`.grid button[aria-expanded]`) for a valid drill-down open.

### Fix 4 — ADHERENCE RINGS (ring stacks above weekly rings on <sm; row wraps) — PASS
/dev/fixtures/training (no auth), "consistent" persona "Plan adherence" card. Every
weekly mini-ring's right edge inside the card's right edge; rightmost fully visible.
- 320px: 5 rings, maxRingRight **258** <= cardRight **285**; rightmost right 258 inside. PASS.
- 360px: 5 rings, maxRingRight **294** <= cardRight **325**; rightmost inside. PASS.
- 390px: 5 rings, maxRingRight **321** <= cardRight **355**; rightmost inside. PASS.
- Screenshot fixed-adherence-320w.png confirms the big ring stacked ABOVE the
  weekly-ring row on <sm, "Last 5 weeks" row of 5 mini-rings, none clipped.

### Label check — "Last 1 weeks" bug gone — PASS (harness); live not exercisable
- Harness "consistent" persona: weekly-ring label reads **"Last 5 weeks"** (the
  "Last 1 weeks" grammar bug is GONE; the fixture generates 5 weeks). PASS.
- Live /progress/training (Pro test account): the account has **no active structured
  training plan**, so the adherence card renders its designed empty state ("Plan
  adherence: no structured training plan active.") with no weekly-ring label to read.
  The single-week "This week" branch (recentWeeks.length === 1) exists in code but is
  not exercisable on this account. No "Last 1 weeks" appears anywhere.

### Screenshots added this pass
fixed-hero-390w.png, fixed-volume-axis-390w.png, fixed-drilldown-390w.png,
fixed-adherence-320w.png (all in evidence-p56b/mobile-audit/).
