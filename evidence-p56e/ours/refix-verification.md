# P56-E refix re-verification

Re-verification of the five fixes applied after the P56-E audits (see
`../audit-fixes.md`). All measurements taken with Node Playwright against the
running dev server at http://localhost:3600 (read-only; only the /login form was
submitted, only the /plans "Add a plan" dialog was opened, never submitted).

Scripts: `../scripts/20-refix-titles-headers.mjs` (hit-box pass),
`../scripts/21-refix-glyph.mjs` (glyph-precise pass), `../scripts/22-refix-dialog-today.mjs`
(dialog + today desktop), `../scripts/23-narrow-probe.mjs` (narrow-card geometry).

Method note (items 2, 4, 5): the ModuleHeader view link carries a 44px touch
target built with a negative-margin trick (`-my-3.5 py-3.5`), so its *bounding
box* is ~47px tall and deliberately overspills the title's row band. Measuring
box-vs-box therefore reports false "collisions." The authoritative pass measures
the **visible glyph rects** (DOM `Range.getClientRects()`) of the title text and
the link text, which excludes padding and is what a user actually sees.

---

## 1. TITLE TRUNCATION (wrapTitle on six panels) — PASS

`/dev/fixtures/plans-goals`, all persona sections, six titles each
(TRAINING TODAY, MEAL PLAN TODAY, PRIMARY GOAL, TRAINING THIS WEEK,
NUTRITION ADHERENCE, RECOVERY CONSISTENCY). For every title span,
`scrollWidth <= clientWidth` (no ellipsis/clipping; wrapping to 2 lines is
correct and allowed).

| width | six-title instances measured | clipped |
|------:|-----------------------------:|--------:|
| 1440  | 36 | **0** |
| 390   | 36 | **0** |
| 320   | 36 | **0** |

Zero clipping at any width. PASS.

## 2. HEADER COLLISION (ModuleHeader flex-wrap fix) — PASS

Glyph-rect collision check (title text vs link text) across the harness plus the
two shared-system pages the fix also touches, at 320 and 360px, light and dark.
A "collision" = title glyph rect and link glyph rect overlap both vertically and
horizontally. `wrappedBelow` = link dropped to its own right-aligned line;
`sameRowSideBySide` = link beside the title with a positive gap.

| page | 320-light | 320-dark | 360-light | 360-dark |
|------|-----------|----------|-----------|----------|
| plans-goals (36 links) | 0 collide / 35 wrap / 1 side (gap 33px) | 0 / 35 / 1 (33px) | 0 / 28 / 8 (min 34px) | 0 / 28 / 8 (34px) |
| roles (42 links) | 0 / 35 / 7 (min 18px) | 0 / 35 / 7 (18px) | 0 / 21 / 21 (min 24px) | 0 / 21 / 21 (24px) |
| panels (7 links) | 0 / 5 / 2 (min 18px) | 0 / 5 / 2 (18px) | 0 / 3 / 4 (min 24px) | 0 / 3 / 4 (24px) |

**Zero glyph collisions in all 12 page x width x theme combinations.** When space
runs out the link wraps to its own right-aligned line; otherwise it sits beside
the title with a >= 18px gap. This is exactly the fix's intent. PASS.

Record screenshots (320 dark, wrapped example on each page):
`refix-header-harness-320-dark.png`, `refix-header-roles-320-dark.png`.

## 3. DIALOG AUTO-FOCUS (P1 fix) — PASS

Logged in (Pro test account), `/plans`, opened "Add a plan". Immediately read
`document.activeElement`:

- tag: `BUTTON`, id: `""`, `isTitleInput: false`.
- The Title input (`#p-title`) is **not** focused; no keyboard would rise.
- Dialog closed cleanly on Escape (`dialogClosedAfterEscape: true`).

Screenshot: `refix-dialog-open-390.png` (open dialog, Title placeholder inactive,
no focus ring/caret). PASS.

## 4. "All goals" LINK TARGET — PASS

Harness consistent persona, Primary goal card, 390px. The "All goals (2)" inline
body link (`a[href="/goals"]`, `min-h-11` hit area):

- bounding box height = **47px** (>= 44px). width 73px. PASS.

## 5. HEADER LINK REGRESSION CHECK (live /today @1440) — PASS

12 header links measured. 10 sit right-aligned on the same row as their titles
with generous gaps (110-515px): Up next/Sleep trends, Consistency/Progress,
Calorie Tracker/Food diary, Water/Hydration history, Sleep/Sleep trends,
Training today/All plans, Weight trend/Body progress, Training this week/
Training progress, Nutrition adherence/Nutrition progress, Recovery consistency/
Recovery progress.

2 links wrap to their own (right-aligned) line: **Meal plan today / "Open meal
plan"** and **Primary goal / "Goal details"**. These are the two `xl:col-span-3`
(quarter-width) cards. Geometry proves the wrap is **necessary, not gratuitous**:

| card | header inner width | needs for one row (chip+title+link) | title lines |
|------|-------------------:|------------------------------------:|------------:|
| Meal plan today | 216px | 285px | 1 |
| Primary goal    | 224px | 239px | 1 |

The title fits on one line but title+link together exceed the card width, so the
link right-aligns onto the line below rather than colliding — precisely the fix's
disclosed behavior. (Pre-fix, the old non-wrapping header instead squeezed the
link beside a 2-line-compressed title; neither layout kept both on one line,
because these cards were never wide enough.) No **unnecessary** desktop wrapping:
every card with room keeps its link on-row. PASS.

Screenshots: `refix-today-plans-goals-band-1440.png` (TRAINING TODAY/All plans
on-row; the two narrow cards right-align their link just under the title, clean
and intentional), `refix-today-progress-highlights-band-1440.png`.

---

## Verdict

| # | Fix | Result |
|---|-----|--------|
| 1 | Title truncation (wrapTitle x6) | **PASS** — 0/36 clipped @ 1440/390/320 |
| 2 | Header collision (flex-wrap) | **PASS** — 0 glyph collisions across 3 pages x 320/360 x light/dark |
| 3 | Dialog auto-focus | **PASS** — activeElement = BUTTON, not Title input |
| 4 | "All goals (2)" hit box | **PASS** — 47px >= 44px |
| 5 | Header link desktop regression | **PASS** — 10/12 on-row; 2 wraps are width-forced (216/224px cards), right-aligned, no unnecessary wrapping |

All five fixes verified.
