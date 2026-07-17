# RC-8 handoff — every number states its scope

Status: **WIP, NOT done, do NOT merge.** Wind-down mid-session (context low).
Branch: `rc8-number-scope` (base `ce9fce5`, main after RC-4). A fresh session
finishes this.

RC-8 = the "displayed numbers with no scope/unit" root cause (~20 register
rows). Fix per fix-plan §5.1: a shared value component whose scope and unit are
REQUIRED, so a scopeless number can't be written; then sweep the cited rows +
cousins onto it.

---

## The mechanism (DONE)

`components/dashboard/metric-value.tsx` — new shared component `MetricValue`.

- **Required at the type level:**
  - `unit: UnitId` (from `lib/contracts/units.ts`). The value is formatted ONCE
    here through the canonical `formatQuantity(value, unit)` — no hand-rolled
    `${n} ${unit}`. `"count"` renders a bare tally (no suffix).
  - a scope, via a discriminated union `ScopeProp`:
    `{ scope: MetricScope }` **OR** `{ scopeInChart: true }`. Passing NEITHER
    does not compile. `MetricScope` is a union of plain member phrases
    ("all time", "this week", "today", "last 7/14/30/90 days", "this month",
    "this year", "last 12 weeks").
  - `scopeInChart` is the **deliberate, opt-in** escape for a number that sits
    under a chart whose visible range control already states the span; it
    suppresses the scope caption and nothing else. Not silent — you must ask
    for it.
- **Renders** the number + a caption (`label · scope`) within the caller's
  existing tile. It owns no colors/sizes/spacing beyond shared defaults;
  `valueClassName`/`captionClassName` let each surface keep its exact size and
  responsive order. `layout:"pieces"` returns the number and caption as a
  fragment so an existing tile arranges them itself (used to preserve the
  workouts mobile-row / desktop-column order and the training caption-first
  order). `captionFirst` puts the caption above the number.
- **Pure, exported helpers** `metricValueText(value,unit)` and
  `metricScopeText(props)` carry the testable logic (this repo's unit tests are
  pure node:test, no DOM render).

**Recurrence gate is real and proven:** `tsc --noEmit` passes clean, AND the
unit test `tests/unit/metric-value.test.ts` contains a `@ts-expect-error` on a
scopeless `metricScopeText({})` call — if the type gate ever stops erroring,
that directive becomes "unused" and `tsc` FAILS there. So a scopeless call site
no longer compiles, checked by CI, not by eyeball.

**What is NOT yet type-gated:** the string-based surfaces (`/today`
StatusPanel `headline`/`targetContext`, `/progress` section VMs) take
pre-formatted strings, so their numbers are copy-corrected but not behind the
type gate. Bringing them behind it means threading `MetricValue` (or required
props) into `StatusPanel` / the overview `*Section` panels — a bigger shared-
primitive change that edges into restyling; deliberately deferred (see NOT
STARTED). The tile surfaces (`/workouts`, `/progress/training` status band) ARE
type-gated now.

---

## DONE and verified (swept onto MetricValue / copy-corrected)

### `/workouts` — `app/workouts/page.tsx` (tiles → MetricValue, `layout:"pieces"`)
- **WKT-05** — "Workouts logged" tile: `unit="count"`, **scope "all time"**
  (value = `totalSessions`, the uncapped all-time header count). Owner note was
  "Total workouts logged" → all time.
- cousin — "This week" tile: relabeled **"Workouts"**, `unit="count"`,
  **scope "this week"** (value = `weekWorkouts.length`, current Sun–Sat week).
- cousin — "Volume this week" tile: relabeled **"Volume"**, `unit="lb"`,
  **scope "this week"** (value = `weekVolume`).
  - Behavior note: zero volume now renders "0 lb" (was "-"), matching the
    sibling `/progress/training` tile. Truthful; flag if owner prefers the dash.
- Also fixed a member-facing "Sessions you logged" → "Workouts you logged" in a
  tile help string (dropped 1 `copy-vocabulary` hit).

### `/progress/training` — `components/progress/training/training-analytics-view.tsx`
- **TRN-05** — status-band "Workouts logged" tile → MetricValue `unit="count"`,
  **scope "all time"** (value = `data.totalSessions`). Was a bare all-time count.
- cousins — the other two numeric status tiles → MetricValue: "Workouts"
  count **this week** (`data.sessionsThisWeek`, keeps the `· N planned`
  annotation in the label), and "Volume" `lb` **this week**
  (`data.volumeThisWeek`).
- **TRN-22** — Training-volume chart headline label "Latest day" → **"Latest
  logged day"** (it's the most recent LOGGED day's volume within the range; the
  chart's global range control supplies the span — the scopeInChart case).
- **TRN-23** + jargon — Muscle-focus "working sets, all loaded history" →
  **"working sets, all time"** and the summary `rangeLabel: "all loaded
  history"` → **"all time"**. Removes both `jargon-leak` hits (baseline 2→0)
  and gives the number a referent (working sets). NOTE: the underlying data is
  capped at MAX_WORKOUTS=400; "all time" is the approved member phrase, close
  enough for real members, but the cap exists.
- Also fixed two more member-facing "session(s)" → "workout(s)" in tile help
  strings (`copy-vocabulary` 8→6).
- `StatTile` was refactored to a label-optional container; the milestone tile
  (tile 4) keeps its own big-number wrapper so it renders unchanged.

### `/progress` — `app/progress/page.tsx` (string VMs; copy only, ZERO computation change)
- **PRG-37 / PRG-40** — hydration headline `${daysAtTarget} of ${gradableDays}
  days at goal` → **"… logged days at goal"**. The query
  (`lib/progress/overview.ts summarizeWindow`) defines `gradableDays` = days you
  LOGGED that had a goal that day (hit or missed). Adding "logged" makes the 9
  reconcile with the "last 30 days" window (9 = logged days, NOT the window) and
  the 89% ring (= 8/9). PRG-40 was a WORDING bug, not a math bug — no
  computation touched. If the owner still wants Q-32 verification of the
  underlying counts, that's separate.
- **PRG-39** — the blue 89% ring "with no explanation": now explained by the
  coherent headline beside it ("8 of 9 logged days at goal", 8/9 ≈ 89%). No
  restyle. If the owner wants an explicit label on the ring itself, that's a
  follow-up (would touch the shared `sections.tsx` visual).
- cousins (same "logged" fix, same reasoning): nutrition headline "… logged days
  within target"; sleep context "… logged nights at goal".

### `/today` — `components/today/status-strip.tsx`
- **TDY-09** — training panel "1 of 5 planned this week" (one of five WHAT):
  headline now `formatQuantity(sessionsThisWeek, "count")` (canonical), and
  targetContext → **"of N workout(s) planned this week"** (adds the unit noun;
  properly pluralized) with the no-plan fallback **"workout(s) this week"**
  (was banned "session(s)"). Answers of-what (workouts) + since-when (this week).

---

## IN PROGRESS
Nothing is mid-edit — every file above is in a complete, compiling, lint-clean
state. The work is PARTIAL only in that surfaces/rows below are NOT STARTED and
the browser gates + screenshots were not run (context ran out).

---

## NOT STARTED (remaining RC-8 work)
- **Browser gates + screenshots (REQUIRED before done).** Not run: the
  `surface-smoke` groups for /today, /workouts, /progress, /progress/training at
  all 6 widths; full `pnpm test:gates`; a real-browser pass at :3100; and
  360/390/desktop (+320 spot-check) screenshots for the owner. The added scope
  captions are exactly the kind of text that can wrap/clip at 320–390 in the
  dense half-width status tiles — VERIFY there. In particular the training
  "Workouts · N planned · this week" caption is three segments; confirm it wraps
  cleanly and doesn't clip.
- **TRN-25** ("seven days logged" unexplained) — could NOT reproduce the audit's
  exact text in current code (the FIX-33 refactor changed this area). Best
  current analogs: the 7-day WeekBars strip under the consistency calendar
  (self-labeled by weekday) and the consistency summary "N of M days trained"
  (already scoped). Drive `/progress/training` and confirm no scopeless number
  remains there; if one does, sweep it; otherwise mark TRN-25 resolved-by-refactor.
- **The wider ~20 "cousins"** across other surfaces (the fix-plan says RC-8 is
  ~20 rows). Only the 4 cited surfaces were touched. Remaining scopeless numbers
  on other surfaces (hydration, sleep, nutrition, body detail pages, workout
  history) are NOT swept.
- **`components/progress/overview/demo/overview-demo.tsx`** (dev-only fixture)
  mirrors the /progress VM strings and still says "days at goal" without
  "logged". Left for consistency-only; update if you want the demo to match.
- **String surfaces behind the type gate** — see mechanism section; deferred.
- Bare "session" copy still present as pre-existing cousins I did NOT touch
  (out of the scope-defect lane): status-strip empty state "No sessions this
  week."; training-analytics coverage line "N sessions in range" and the
  AdherenceCard "planned sessions completed" / "Plan: N sessions a week".
  These are Q-D naming (a separate cross-surface rename session), not scope.
  Reported as observed, not fixed.

---

## Needs an owner ruling (deliberately skipped, do NOT guess)
- **Q-F milestones** — the `/progress/training` status "Next milestone · Nth
  workout" tile (and its "N to go" progress) was left entirely as-is. Its help
  still says "Session-count milestones" (pre-existing "session"). What a
  milestone IS = owner ruling.
- **Q-G plan-adherence** — the AdherenceCard (ring, "of N planned this week",
  weekly perfect-week rings) left as-is. The training tile 2 keeps the existing
  "· N planned" annotation but does NOT add any adherence claim.
- **Q-E records** — records/PR numbers (PersonalRecords, rewards timeline,
  milestone "225 lb est. 1RM · Jul 2") left as-is.
- **PRG-40 / Q-32** — resolved as a wording bug (above); if the owner wants the
  underlying "why only 9 gradable in a 30-day window" surfaced or verified as a
  computation, that's still open.

---

## Gates
- **RUN, PASS:** `npx tsc --noEmit` → exit 0 (also proves the type gate, see
  mechanism). `pnpm test:unit` → 295 pass / 0 fail (includes the 5 new
  MetricValue tests). `pnpm lint:design` → OK (baseline auto-shrank; the shrink
  is committed with this WIP — see below).
- **NOT RUN:** `pnpm test:gates` and the individual `surface-smoke` groups; the
  real-browser :3100 pass; screenshots. (CI-7 reminder: the `pnpm
  test:gates/traps/contracts` wrappers don't launch under Windows cmd — run the
  underlying `pnpm exec playwright test …` commands from a POSIX shell, per
  chadchat/CLAUDE.md.)

## Baseline change committed with this WIP
`scripts/design-lint-baseline.json` auto-shrank — ONLY my files:
`app/workouts/page.tsx::copy-vocabulary` 2→1;
`training-analytics-view.tsx::copy-vocabulary` 8→6 and its `jargon-leak` 2
entry removed. No other file's entry changed. Never hand-edit these upward.

---

## Gotchas (so the next session doesn't re-learn them)
- **design-lint scans COMMENTS too** (line-based, not AST). An em-dash or the
  literal phrase "all loaded history" IN A JSDOC comment fails the build. The
  new file tripped this and was fixed; keep prose in `.tsx` clean (the copy
  rules only fire on `.tsx`/`.ts`, so this `.md` is exempt).
- **`session-vocab` / `copy-vocabulary`** fires only on quoted, sentence-like
  strings that contain a space and the word "session(s)". Bare `"sessions"`
  (single word, no space) and `${session.x}` are legal. Your NEW copy must add
  ZERO new hits — the baseline never grows after first run; a new violation in a
  file with no baseline entry FAILS the build outright.
- **`formatQuantity` precision is per-unit but min-fraction is 0**, so
  `formatQuantity(6880, "lb")` = "6,880 lb" (no ".0") and 208.8 → "208.8 lb".
  Volume-as-lb renders correctly with no trailing zeros. Good.
- **`gradableDays` ≠ window days.** It's logged days that had a goal that day
  (hydration always has the default 1-gallon goal, so gradable == logged there;
  nutrition/sleep can have fewer if a day had no target). The scope copy says
  "logged days" per the VM contract comments; the gradable-vs-logged nuance is
  an edge for nutrition/sleep.
- **`CountUp`** animates the first numeric token inside an already-formatted
  string and leaves units/signs alone, so passing it `formatQuantity(...)`
  output is correct.
- **Shared working tree hazard was live this session:** HEAD is on
  `design-system-port`; `app/globals.css` and `app/fonts/` are that session's,
  NOT mine — untouched.

---

## Precise next steps, in order
1. On `rc8-number-scope`: start dev at :3100 (kill stale port holder; `rm -rf
   .next` on a Turbopack CSS panic). Log in claude-testing@example.com /
   12345678 (Pro).
2. Drive all four surfaces; read every changed number as a member — does each
   answer "of what, since when" at a glance? Watch the dense training status
   tiles for caption wrap/clip at 320/360/390.
3. Run the `surface-smoke` groups covering /today, /workouts, /progress,
   /progress/training at all 6 widths (via the underlying playwright command).
   Fix any overflow/clip. Then the full three-suite `test:gates` sweep.
4. Screenshot each changed surface at 360/390/desktop (+320 spot-check);
   actually inspect for truncation/overflow/legibility.
5. Resolve TRN-25 (verify /progress/training) and decide on the wider ~20
   cousins scope for this wave vs a follow-up.
6. `smoke-known-failures.json` is remove-only: delete any entry your change now
   makes pass; never add one.
7. Then, and only then, write the closing report and STOP for owner review. Do
   NOT push, merge, or touch handoff/MTL/MTLN.

## Files in this WIP commit
- `components/dashboard/metric-value.tsx` (new — the mechanism)
- `tests/unit/metric-value.test.ts` (new — 5 tests, incl. the type-gate proof)
- `app/workouts/page.tsx`
- `components/progress/training/training-analytics-view.tsx`
- `app/progress/page.tsx`
- `components/today/status-strip.tsx`
- `scripts/design-lint-baseline.json` (auto-shrink, mine only)
- `rc8-handoff.md` (this file)
