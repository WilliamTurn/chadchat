# P56-Z Today acceptance slice — fresh evidence (ACC-01, ACC-02, ACC-09, ACC-11)

- Generated: 2026-07-13 (P56 wave close)
- Primary target: `http://localhost:3601` — production `next start` of the wave-final code
- Harness target (ACC-09 only): `http://localhost:3600` — dev fixtures at `/dev/fixtures/*`
- Account: Pro test account `claude-testing@example.com`
- Method: node Playwright (dark theme). :3601 used the exact dual-cookie auth bootstrap
  from `scripts/p34z-perf-today.mjs` (real login → mint `__Secure-authjs.session-token` twin).
- Scripts: `scripts/p56z-acc-today-3601.mjs`, `p56z-acc-v2.mjs`, `p56z-acc02-v3.mjs`, `p56z-acc09-harness.mjs`
- READ-ONLY: navigation, viewport, DOM measurement, screenshots only. Nothing submitted/saved/deleted.
- Console on :3601: **zero errors / zero React #310** across every run (dual-cookie bootstrap correct).

Raw data: `today-slice/acc-3601-raw.json`, `acc-v2-raw.json`, `acc02-v3-raw.json`, `acc09-harness-raw.json`.

---

## ACC-01 — Member understands today's status in ≤10s — **PASS**

Compact header present on both viewports: **date** "MONDAY, JULY 13", **greeting** "Welcome back",
**tier** "PRO" badge — all above the fold.

Four-domain status strip (the four cells are labeled **CALORIES / WATER / SLEEP / TRAINING**):

**Desktop 1440 (vh 900):** strip is one row, cells top=176px bottom=311px → fully above the fold. All four visible without scrolling.
**Phone 390 (vh 844, touch: hasTouch+isMobile):** strip is a 2×2 grid, container top=232px bottom=629px → fully above the fold. All four (CALORIES/WATER top row, SLEEP/TRAINING bottom row) visible without scrolling. The four-domain strip begins **232px** from the top (right under the header + a "Talk to Chad" button).

Each cell communicates state in **words + number**, not color alone:
| Cell | Text content |
|---|---|
| CALORIES | "Not logged yet. Log a meal below." |
| WATER | "Not logged yet. One tap below." |
| SLEEP | "Not logged yet. Log last night below." |
| TRAINING | "0 sessions this week" |

Screenshots: `acc01-desktop1440-abovefold-dark.png`, `acc01-phone390-abovefold-dark.png`,
`acc01-desktop1440-fullpage-dark.png`, `acc01-phone390-fullpage-dark.png`.

---

## ACC-02 — Every panel has one role and ≤1 primary action — **PASS**

Definition used: PRIMARY = the solid/filled CTA treatment. On /today the only solid-filled
CTA is the white pill `Log last night` (`lab(93 …)`, alpha 1, dark text) in the **UP NEXT** panel.
All logger buttons (`Log meal`, `Log water`, `Log weight`, `Start a workout`) and every `Ask Chad`
use a subtle **secondary** translucent treatment (`oklab(0.92 … / 0.03)` + hairline border);
`→` items are ghost text nav-links. Full enumeration top→bottom (sidebar/topbar excluded):

| Panel | Solid-primary count | Buttons present |
|---|---|---|
| Status strip (CALORIES/WATER/SLEEP/TRAINING cells) | 0 | display-only status cells |
| UP NEXT | **1** | Sleep trends → (ghost), Ask Chad (secondary), **Log last night (primary)**, ? help |
| CONSISTENCY | 0 | Progress → (ghost), ? help |
| CALORIE TRACKER | 0 | Food diary → (ghost), Log meal (secondary) |
| WATER | 0 | Hydration history → (ghost), Log water (secondary) |
| SLEEP | 0 | Sleep trends → (ghost), Log last night (secondary) |
| TRAINING TODAY | 0 | All plans → (ghost), Start a workout (secondary) |
| MEAL PLAN TODAY | 0 | Open meal plan → (ghost), Ask Chad (secondary) |
| PRIMARY GOAL | 0 | Goal details → (ghost) |
| WEIGHT TREND | 0 | Body progress → (ghost), Ask Chad (secondary), Log weight (secondary) |
| TRAINING THIS WEEK | 0 | Training progress → (ghost) |
| NUTRITION ADHERENCE | 0 | Nutrition progress → (ghost) |
| RECOVERY CONSISTENCY | 0 | Recovery progress → (ghost) |

Every panel has **0 or 1** solid-primary action. No panel exceeds one.
Note (non-blocking): WEIGHT TREND carries two *secondary*-treatment buttons (Ask Chad + Log weight),
but neither is the bold solid-primary treatment, so the ≤1-primary rule holds.

Screenshots: `acc02-desktop1440-fullpage-dark.png`, `acc02-lognight-button-crop.png`.

---

## ACC-09 — Empty panels stay compact, no blank chart furniture — **PASS**

Measured on the :3600 harness (no login). Empty panel height vs the same panel populated (consistent):

**`/dev/fixtures/today-panels` — height (px):**
| Panel | first-run (empty) | lapsed | consistent (populated) |
|---|---|---|---|
| CALORIE TRACKER @1440 | 278 | 278 | 347 |
| WATER @1440 | 278 | 278 | 315 |
| SLEEP @1440 | 278 (empty) | 319 (stale/dated) | 319 |
| CALORIE TRACKER @390 | 326 | 326 | 379 |
| WATER @390 | 305 | 305 | 340 |
| SLEEP @390 | 302 (empty) | 401 (stale/dated) | 445 |

Every empty panel is **shorter than its populated sibling** (never taller/arbitrary). Each empty
state shows **designed copy + streak strip + a single logging CTA** (e.g. CALORIE TRACKER: "No meals
logged this week. Log a meal…" + Su–Sa hollow strip + `Log meal`), plus one ghost `→` nav-link.
The faint dashed cells are the intentional "week fills in as you go" placeholders, not axes-only
ghost charts or gray voids. SLEEP first-run is the **designed DSH-64 empty** (hollow strip + placeholder);
SLEEP lapsed is the DATED stale state (8h last logged Fri Jun 26) and matches populated height — graded designed, not blank.

**`/dev/fixtures/panels?persona=first-run` @1440** — all 8 panels render the compact designed-empty
treatment (facts + at most one CTA), size following information, no blank chart furniture:
CALORIES TODAY 124px, PROGRESS 124px, MILESTONE 164px, PROTEIN THIS WEEK 164px, SLEEP 208px,
TODAY'S TRAINING 208px, WATER 218px, WEIGHT TREND 240px.

Console note: the :3600 dev harness logs Next.js **dev-only advisories** ("new Date() in a Client
Component without Suspense" on today-panels; "runtime data outside <Suspense>" on panels). These are
dev-server prerender warnings, not runtime errors, and do not affect the measured empty-state rendering.
(The shipping prod build on :3601 logged zero console errors.)

Screenshots: `acc09-todaypanels-{first-run,lapsed,consistent}-{1440,390}.png`, `acc09-panels-firstrun-1440.png`.

---

## ACC-11 — No settings/destructive actions in default dashboard chrome — **PASS**

Default /today scan (no overlays open): **no** settings/gear affordance, **no** delete/remove/trash
control, **no** goal-editing control exposed in the default chrome (exposed-hits list empty).

Overflow affordances present (both allowed, both closed by default):
1. **"Toggle Sidebar" / "Collapse menu"** — a nav collapse control, not settings/destructive.
2. **Account avatar ("C") / "Account menu"** (`aria-haspopup=menu`, top-right). Opened it and read
   the items, then pressed Escape (nothing confirmed): header `claude-testing@example.com`, then
   **Plans & pricing · Account · Toggle light mode · Sign out**.

Settings-type items (Account) live **behind** the overflow (allowed); there is no delete/remove/goal-edit
in the menu, and nothing is one-tap-destructive from the dashboard surface. `Sign out` is non-data-destructive.

Screenshots: `acc11-desktop1440-default-dark.png`, `acc11-overflow-1-open-dark.png` (account menu open).

---

## Summary

| Row | Verdict |
|---|---|
| ACC-01 | **PASS** — header + four-domain strip above the fold both viewports; each cell states words+number |
| ACC-02 | **PASS** — exactly one solid-primary on the page (UP NEXT "Log last night"); every panel ≤1 |
| ACC-09 | **PASS** — empty panels compact (< populated), designed copy + single CTA, no blank furniture |
| ACC-11 | **PASS** — no gear/delete/goal-edit in default chrome; only account overflow + sidebar toggle |
