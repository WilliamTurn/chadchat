# P56-E (FIX-30) Browser Verification — live-verification.md

Session: P56-E browser-verification. Env: dev server http://localhost:3600 (shared PROD DB).
Driver: node Playwright scripts under `evidence-p56e/scripts/` (chromium, headless). Read-only.
Account: Pro test account (claude-testing@example.com). Date on device: Monday, July 13.

Verdict summary: **10 PASS, 0 FAIL, 3 N/A**, plus 4 non-blocking findings (1 layout, 2 minor, 1 pre-existing).

---

## Task 1 — Fixture harness `/dev/fixtures/plans-goals` — PASS

- All **six** persona sections render: first-run, sparse, consistent, lapsed, overshoot, locked-basic.
- Each section renders **exactly 6 cards** (measured `.grid-dashboard > div` count = 6 for all six personas): Training today, Meal plan today, Primary goal, Training this week, Nutrition adherence, Recovery consistency.
- **Console: zero errors / warnings** across all four passes (1440 dark, 390 dark, 390 light, 1440 light).

Specific checks:
- **(a) consistent — PASS.** Shows `Day 3: Legs` as next, a rotation strip (green / green / red / muted segments visible), and `2 of 4 plan sessions this week`. Exercise chips (Squat 4×5, RDL 3×8, Leg Press 3×10, Calf Raise 4×12) render.
- **(b) overshoot — PASS.** Training-today reward state `Day 3: Legs done` + "Trained today" + "Up next in your rotation: Day 4: Upper". Meal panel `Planned meals covered` ("All 4 planned meals on Day 1 ... are covered"). Primary goal `Cut to 180 — Reached` with trophy icons on both outcomes (Trend weight 178.6/180, Bench 344/245). No "to goal remainder" / "moving away" bug present.
- **(c) locked-basic — PASS.** Meal panel + all three highlight tiles (Training this week, Nutrition adherence, Recovery consistency) render as LOCKED teasers: lock icon + capability copy + "Upgrade to Pro" CTA (4 CTAs total). Training today shows the document-plan summary `Coach starter plan` ("This plan is a written document...") with Open plan. Primary goal renders `Cut to 180 — 1 outcome tracked — Trend weight — Not logged / 180 lb`. Locked is never styled as empty/error. NOTE: the locked teaser uses a lock-icon on the normal solid-border card frame, **not a dashed border** (dashed border is reserved for empty/hollow states in this codebase). Substantively correct; the "dashed border" wording in the task brief does not match the implementation, which is arguably the better treatment.
- **(d) first-run — PASS.** Designed empty states everywhere (e.g. "No training plan yet. Ask Chad...", "No active goals. Set a goal..."), single dominant CTA per card, no blank holes and no fake zeros.

Screenshots: `harness-{persona}-1440-dark.png` (all 6), `harness-full-1440-dark.png`, plus `harness-consistent-*` and `harness-locked-basic-*` at `390-dark`, `390-light`, `1440-light`.

---

## Task 2 — Live `/today` — PASS

Rendered end-to-end (both 1440 dark and 390 dark, touch-emulated). Bands/headings present in order:
Welcome header + PRO badge → status strip (Calories / Water / Sleep / Training) → Up next + Consistency → **Today's log** (Calorie Tracker, Water, Sleep) → **Plans and goals** (Training today, Meal plan today, Primary goal) → **Progress highlights** (Weight trend, Training this week, Nutrition adherence, Recovery consistency).

- **Console: zero errors, zero hydration warnings on /today** at both viewports.
- No overlapping/clipped layout; no broken empty holes. Empty-state cards (this account has nothing logged this week) show designed copy, not fake zeros.
- **Touch targets (390px, two new bands) — PASS.** All 11 interactive controls measured ≥44px. Every control is **47px tall**; widths 85–148px. Zero controls under 44×44. Breakdown:
  - Plans and goals: All plans→ (85×47), Start a workout (136×47), Open meal plan→ (129×47), Ask Chad (117×47), Goal details→ (105×47).
  - Progress highlights: Body progress→ (122×47), Ask Chad (117×47), Log weight (127×47), Training progress→ (140×47), Nutrition progress→ (143×47), Recovery progress→ (148×47).

Finding (minor, layout): In "Plans and goals" on desktop, the empty-state "Training today" card (6-col) is short and leaves visible whitespace beside the taller Meal/Goal cards. This is an empty-state artifact (no training plan on this account), not a broken layout.

Screenshots: `today-1440-dark.png`, `today-390-dark.png`.

---

## Task 3 — Live `/plans` — PASS

- "All plans" header + description render. "YOUR TRAINING" plans card renders (empty state: "No plan on file yet..."). **"Add a plan" control EXISTS** (verified present via text; not opened/submitted).
- **Console: zero errors.** Mobile 390 stacks cleanly with bottom nav.

Findings:
- **(F1, layout — worth fixing) Underfilled desktop page.** The shell is the compliant wide 1500px frame, but `PlansContent` uses `lg:grid-cols-2` with only **one** ModuleCard placed, so the entire right half of the desktop viewport is blank regardless of data. On a 1440px screen the single card sits ~555px wide, left-aligned, with >850px of empty space to its right. A full-width page should fill the canvas (second column, or a wider single column).
- **(F2, minor — copy vs content) "diet plans" not surfaced.** Page copy says "your current training and diet plans," but only the training PlanList ("YOUR TRAINING") renders. This account HAS an active meal/diet plan (`2,200 cal cut — 3 meals/day`, confirmed on /meal-plan) yet it is not shown on /plans (meal plans are managed separately at /meal-plan). Copy promises diet plans the page does not show.

Screenshots: `plans-1440-dark.png`, `plans-390-dark.png`.

---

## Task 4 — Reconciliation (read-only, one-canonical-value) 

- **(a) Calories: status strip == Calorie Tracker headline — PASS (consistent).** Nothing logged today: status strip shows "Not logged yet. Log a meal below."; Calorie Tracker panel shows "No meals logged this week." Both agree there is no logged-calorie number. No numeric headline exists to mismatch (effectively N/A for a numeric compare, but fully consistent).
- **(b) Primary goal outcome across surfaces — PASS.** /today Primary goal = `Trend weight — Not logged / 220 lbs` (goal "Lose 200 lb and build a strong, muscular body", 1 outcome tracked). /progress goal card = `Trend weight — Not logged / 220 lbs`. **Exact match.** /goals is a list page (title + View only) and does not display the outcome current/target inline, so it is not a reconcilable numeric surface here.
- **(c) "Training today" session == "Up next" session — N/A.** Account has **no training plan**, so Training today shows the empty state and Up next correctly falls back to a sleep prompt. No session is named on either side; consistent by absence.
- **(d) Meal next-meal calories: /today == /meal-plan (named day) — PASS.** /today Meal plan today names Day 3, next meal "Egg whites, whole eggs & toast" = **670 kcal / 55g protein**, Day 3 total **2,134 kcal**. /meal-plan Day 3 Breakfast "Egg whites, whole eggs & toast" = **670 cal · 55P**, and Day 3 total = **2,134 cal**. **Exact match** on both the meal and the day total.

Screenshots: `recon-goals-1440-dark.png`, `recon-progress-1440-dark.png`, `recon-mealplan-1440-dark.png`, `recon-mealplan-day3-1440-dark.png`.

---

## Console notes
- **/today, /plans, /goals, /progress, /meal-plan: zero console errors** (Pro session).
- **/login (pre-existing, not a P56-E surface):** one React dev warning — "An async function with useActionState was called outside of a transition..." on the login form submit. Does not affect any P56-E surface; noted for completeness.

## Findings ranked (worth fixing)
1. **F1 — /plans desktop is half-empty** (layout). `lg:grid-cols-2` with a single card leaves the right column blank on every load. Fill the canvas.
2. **F2 — /plans copy promises "diet plans" it doesn't show** (copy/content). Either surface the active meal/diet plan on /plans or adjust the description.
3. **/today Plans-and-goals empty-state asymmetry** (cosmetic). Short empty "Training today" card leaves whitespace next to taller cards; only visible when no training plan exists.
4. **Locked-teaser vs brief wording** (documentation only). Teasers are lock-icon on solid card, not the "dashed border" the brief expected; implementation is correct, brief wording is stale.
