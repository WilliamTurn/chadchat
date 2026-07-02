# /today Dashboard — Audit Findings (DSH-38)

> Executed per `dashboard-audit-spec.md` (s111, 2026-07-02). Audit only — nothing was fixed.
> Method: code analysis of `app/today/page.tsx` + every card component; live sweep on dev `:3100`
> as the Pro test account (every control clicked, outcomes verified without reload) at 1440/768/390,
> dark + light; a fresh non-subscribed account (`dsh38-audit@example.com`, left in the shared Neon DB)
> to probe the new-member path; benchmark research on MyFitnessPal Today, Whoop Home, Apple Fitness
> Summary, Fitbit Today (sources in §4 notes).
> Screenshots (chadlatest root): `dsh38-full-1440.png`, `dsh38-full-768.png`, `dsh38-full-390.png`,
> `dsh38-light-1440.png`, `dsh38-newuser-1440.png` (caught the post-redirect /pricing).
> Known-open DSH-33/34/35/36/37 are folded into the recommendations below, not re-reported as new.

---

## 1. Phase 0 — The intended model (the missing underlying logic)

The page never states what it is, and the code confirms there is no rule system — each card
accreted its own controls. Here is the model the audit proposes DSH-39 make real. **The page's job:
answer "Am I on track today, and what do I do next?" in one glance, then hand every deeper question
to a detail page.** Every card gets exactly one ROLE:

- **STATUS** — the hero: today's verdict, no inputs.
- **LOGGER** — a daily-quantity habit you record *on the card* (calories via nav-out, water, sleep).
- **PLAN** — documents you maintain (goals, training plans, meal plan).
- **REVIEW** — read-only rear-view (last workout, weight trend); primary action navigates away.

### The rules (answers to the spec's five questions)

1. **Who gets a goal control on /today?** Rule: *daily-quota domains (LOGGERs) edit their quota
   in-card; milestone domains (weight, lifts) set goals in the Goals card.* Current state mostly
   fits — calories (TargetEditor) ✅, water (Goal popover) ✅, weight/lift via Goals card ✅ — with
   ONE violation: **sleep's target is hard-coded** (`SLEEP_GOAL_MINUTES = 420`, `lib/validation/sleep.ts:7`)
   and drives "Nights hit target" as if it were personal.
2. **Who gets an undo?** Rule: *one-tap loggers (accident-prone) get "Undo last"; form-based loggers
   (a dialog with a confirm step) get edit/delete on their detail page, reachable via the card's
   View-all link.* Water ✅ (only card with undo — correct, it's the only one-tap logger). Meals →
   /nutrition ✅, weight → /progress ✅. **Sleep fails both halves**: no undo, no View-all, and the
   only correction is re-logging the same "Night of" date (upsert) — undiscoverable, and deletion is
   impossible anywhere in the app.
3. **In-card trend vs full-width trend card?** Rule (unanimous across all four benchmark apps):
   *one surface per domain on the home screen — a compact in-card readout/sparkline; the full chart
   lives on the detail page.* Weight follows it. **Sleep and hydration violate it** — week strip
   in-card PLUS a full-width trend card below (and sleep ALSO has `/sleep`, which contains the same
   two cards a third time).
4. **What decides card order?** There is currently no narrative: hero → Calorie → Goals+Training →
   Last workout+Meal plan → Hydration+Weight → Sleep → Sleep trend → Quick actions interleaves
   loggers, plans and reviews. Proposed narrative: **STATUS → today's LOGGERs → PLANs → REVIEW**
   (matches MFP/Whoop/Apple: status verdict → today's log → secondary → slow metrics last).
5. **Is monitor-vs-logger legible?** No. Water logs in its body, sleep logs from a footer popover,
   calories/weight/workout have identical-looking footer primaries that actually navigate away.
   Rule: *LOGGER cards carry their input controls in the BODY (like Hydration); any footer primary
   that navigates gets a consistent nav treatment.* Then "what do I DO here?" is answerable in <1s.

### Card-by-card capability matrix (current state, code-verified)

| Card | Role (actual) | Goal? | Where set | History link | Undo/fix path | Ask Chad | Primary action | In-card trend | Dup. surface |
|---|---|---|---|---|---|---|---|---|---|
| Hero + pills + streak | STATUS | — | — | — | — | ✗ (Talk to Chad) | Talk to Chad → `/` | week dots | — |
| Calorie Tracker | LOGGER (nav-out) | ✅ targets | TargetEditor dialog (card) | "View history →" /nutrition | edit on /nutrition | ✅ | Log a meal → /nutrition | rings only | — |
| Your goals | PLAN (+editor) | *is* the goals surface | in-card editor | ✗ (no goals page) | inline edit/delete/reopen | ✅ | Add goal | lift-goal 1RM chart | weight goal ↔ Weight card |
| Your training | PLAN | ✗ | — | "View all →" /workouts | inline edit/delete | ✅ | Add plan | ✗ | — |
| Last workout | REVIEW | ✗ | — | "View all →" /workouts | on /workouts | ✅ | Log a workout → /workouts | ✗ | — |
| Meal plan | PLAN (readout) | plan's own target line | — | "View plan →" (only when plan exists) | on /meal-plan | ✅ | Open plan / Build | ✗ | — |
| Hydration | LOGGER | ✅ | Goal popover (card) | **✗** | **Undo last** ✅ | ✅ | +8oz/+16oz/Custom (body) | vessel | full-width Water trend |
| Weight trend | REVIEW | ✅ goal line | Goals card | "View all →" /progress | on /progress | ✅ | Log weight → /progress | compact interactive ✅ | — |
| Sleep & recovery | LOGGER | **hard-coded 7h** | nowhere | **✗ (but /sleep exists!)** | **none** (silent same-night overwrite) | ✅ | Log sleep popover (footer) | bare week bars | full-width Sleep trend AND /sleep |
| Water trend (full-w) | REVIEW | reuses water goal | — | ✗ | — | ✅ (in header) | none | full bar chart | Hydration card |
| Sleep trend (full-w) | REVIEW | hard-coded 7h | — | ✗ | — | ✅ (in header) | none | full bar chart | Sleep card + /sleep |
| Quick actions | NAV | — | — | — | — | ✗ | 7 nav tiles | — | duplicates top nav |

---

## 2. Findings, prioritized

### P1 — broken or actively confusing

**P1-1 · Sleep/hydration double-surface + full-width rows are the "no logic" core.**
At 1440, Sleep & recovery (405px full-width) + Sleep trend (403px full-width) sit back-to-back:
**~810px, 27% of the page, for one domain with 4 data points** — while the weight chart (15+
points, the product's central promise) gets a 427×170 plot in a half-width card. The Sleep trend
plot alone is 927×200 (2.6× the weight plot's area). Hydration duplicates the same way once it has
≥2 days of data (DSH-33). And `/sleep` already exists containing the same two cards again.
No benchmark app puts any full-width trend chart on home ("no graphs, no noise" — Whoop; MFP exiles
all charts to Progress; Apple shows trend *arrows* only).
**Recommendation:** delete both full-width trend cards from /today. Sleep card keeps its in-card
week strip + gains "View all →" `/sleep` (full chart lives there). Hydration keeps vessel + a small
week strip; give water a home for its full chart (simplest: a `/hydration` page cloned from
`/sleep`'s pattern, or a section on /progress) and link it. This single change resolves DSH-33,
removes the sizing absurdity, and makes rule 3 true everywhere. Fix DSH-36 (bar/axis collision)
in whatever chart survives.

**P1-2 · Stale sleep presented as current status.** The card said "**Last night** · 3 days ago ·
7h 30m · **Well rested**" (see `dsh38-full-1440.png`) — a 3-day-old entry framed as last night's
verdict, with a green "Well rested" for a night that may not have been slept well at all.
**Recommendation:** when the latest entry isn't yesterday/today, flip the framing: "No sleep logged
for last night — Log it" + show the old entry as "Wed, Jun 29 · 7h 30m". (Post-log wording is also
off: it reads "Last night · Today".)

**P1-3 · Sleep has no correction path and no history link anywhere.** No undo, no View-all (despite
`/sleep` existing and being in the top nav), no delete on `/sleep` either; the only fix is
re-opening "Log sleep" and re-picking the same "Night of" date, which silently overwrites — nothing
tells the user this. A fat-fingered "12h" night pollutes the streak, the trend, and Chad's context
forever. **Recommendation:** View-all → /sleep on the card (rule 2/3); edit+delete per night on
/sleep; consider an "Undo" toast right after logging (matches the water pattern).

**P1-4 · No single first action for a new member.** A fresh account never actually reaches /today
(it flashes, then hard-redirects to /pricing — so "brand-new" in practice = a just-subscribed trial
member with nothing logged). That member gets first-run hero copy "Set your goal below, then tell
Chad about yourself in chat" plus **eight competing empty-state CTAs** (set targets, set goal, add
plan, log workout, build meal plan, 3 water buttons, log sleep, log weight). Benchmarks all drive
ONE action first (MFP: log your first food; Whoop: explicit calibration story; Apple: pick a Move
goal). **Recommendation:** a first-run path — make "Tell Chad about yourself" (or "Set your goal")
the one visually dominant CTA, and let the empty cards state what will appear rather than each
shouting its own button. (Each empty state's copy is individually fine; it's the chorus that fails.)

### P2 — inconsistent logic / violates the intended model

**P2-1 · Sleep target hard-coded 7h while every other quota is user-set** (rule 1's only violation).
Either make it editable like the water goal popover, or consistently label it "recommended" —
currently the footer says "7+ hrs recommended" but the trend KPI says "Nights hit **target**".

**P2-2 · Monitor-vs-logger grammar isn't legible** (rule 5). Water logs in the body; sleep logs from
a footer popover; Calorie/Weight/Workout footers look identical but navigate away. Move sleep's
logging affordance into the card body (like water's quick-adds), keep navigation-primaries visually
distinct.

**P2-3 · Page order tells no story** (rule 4). Daily loggers (hydration, sleep) sit BELOW plan
documents; the mid-day member cannot answer "am I on track today?" from the top half — hydration
starts at y≈1599 of a 900px viewport. **Recommendation:** reorder to hero → Calorie → Hydration+Sleep
→ Goals+Training → Meal plan+Last workout → Weight trend (or Weight paired with Last workout as the
REVIEW row). Loggers up top also concentrates the "what do I do here" surfaces.

**P2-4 · The page contradicts itself on calories.** Active goal says "Daily calories capped at
**1,800**… protein 200g"; the Calorie Tracker targets **2,200**. Both render on one screen with no
link between goal ↔ nutrition target. Also two simultaneously active cut goals (183lb and 180lb)
show contradictory progress — **0% vs 26%** from the same 198.6lb current weight — because each
anchors on its own `startValue`. **Recommendation:** DSH-39 should at least (a) nudge when an
active goal's text conflicts with targets ("Ask Chad to align these"), and (b) visually mark
overlapping same-metric goals (or warn on creation).

**P2-5 · Trend charts hide missing days.** The sleep trend x-axis ran Jun 27, 28, 29, **Jul 2** with
evenly spaced bars — unlogged nights silently vanish (categorical, not time, axis), so "3/4 nights
hit target" reads as a complete record of a 6-night span. Water trend builds the same way.
**Recommendation:** render the full date range with empty slots (the in-card week strip already
does this correctly — F S S M T W T with gaps).

**P2-6 · Conditional full-width cards make the layout unstable.** The trend rows only render at
≥2 days of data (`page.tsx:820,825`), so cards appear/vanish as data crosses thresholds — part of
why the page feels randomly assembled; the user's own screenshots (with water trend) and this
audit's (without) show different pages. Deleting the rows (P1-1) resolves this too.

**P2-7 · Non-Pro treatment is two different rules.** Calorie/Hydration/Weight/Sleep render locked
teaser cards for Basic members, but the Last workout + Meal plan row is **hidden entirely**
(`page.tsx:649`), and the hero stat pills just disappear. Locked teasers sell upgrades; invisible
rows don't. Pick one rule: every Pro module shows its locked state. (Note: only paid-Basic members
ever see this — unsubscribed users are redirected to /pricing.)

**P2-8 · Quick actions duplicate the top nav, incompletely.** Seven tiles at the very bottom mirror
the header nav but omit Sleep and Weekly Report (both in the nav). Every benchmark app has zero
such row. **Recommendation:** delete the row (its one arguable job — mobile reach — is better served
by the mobile sheet nav), or make it a true complete shortcut grid.

**P2-9 · Hero stats need labels and reconciliation** (= DSH-35, expanded). "0 cal Eaten today/ 2,200"
(missing space), "-13.8 lb Since start" (start of what? — first weigh-in), and "5 / 7 Active this
week" sitting directly above "1 day Current streak" with no explanation of why 5 active days ≠ a
5-day streak (different windows, same activity source). Plain-language labels + one `?` help
popover (HLP-1 pattern, already built for weight KPIs) fix all four.

### P3 — polish

- **P3-1** Header link labels vary: "View history →" (Calorie) / "View all →" / "View plan →". Pick
  one convention (domain-specific is fine, but deliberate).
- **P3-2** TargetEditor's "Not sure what to aim for? **Ask Chad**" links to bare `/` with no prompt
  prefill — the only Ask-Chad on the page that doesn't use the established prefill pattern (works:
  verified composer prefill e2e).
- **P3-3** A goal at 0% renders no progress-bar track at all (goal 1 vs goal 2 rows look like
  different components). Show the empty track.
- **P3-4** Unit words mixed inside Hydration: "0 oz / 1 gal · 0 **glasses** today · 128 oz to go"
  (DSH-34 covers the units rework; kill "glasses" in the same pass). Meal plan says "**kcal**",
  Calorie Tracker says "**cal**" — pick one.
- **P3-5** Meal-plan target line "200P / 190C / 65F" is lifter shorthand — pairs with HLP-1.
- **P3-6** Stray floating "Jun 1" text node rendered at the page bottom outside any card (Recharts
  tooltip portal artifact, seen in the 1440 a11y snapshot) — investigate/reproduce.
- **P3-7** Mobile (390): page is 4,862px; the hero alone is 647px (~77% of the first viewport) and
  the first real action is ~2 screens down. Compress the stat pills to one compact row on mobile.
- **P3-8** DSH-37 hero-customizer bugs confirmed still present (e.g. "Upload your own" is the one
  control without a pointer cursor) — fix as specced.

**What works (keep):** the DSH-32 card grammar itself reads well; every logging action verified
live-updating with no manual reload (water add/undo, sleep log → card, trend, streak 1→2, active
5/7→6/7 all refreshed); Ask Chad prefill works from every card; keyboard focus order on Hydration
is logical (quick-adds → footer, disabled Undo skipped); light theme is fully legible; no horizontal
overflow at any viewport; goal/plan viewer dialogs (Delete/PDF/Discuss) all function.

---

## 3. Proposed DSH-39 execution order

1. **Kill the full-width trend rows; one surface per domain** (P1-1, P2-5, P2-6; resolves DSH-33,
   absorbs DSH-36): sleep week strip in-card + "View all →" /sleep; water strip in-card + a real
   water-history home; honest date axes in the surviving charts.
2. **Reorder the page to the narrative** (P2-3) and encode the role rules from §1 (P2-2): loggers'
   inputs in the body, navigation primaries consistent.
3. **Sleep card integrity** (P1-2, P1-3, P2-1): stale-data framing, View-all link, editable-or-
   explicitly-recommended target, edit/delete on /sleep.
4. **Hero pass** (P2-9 = DSH-35, P3-7): plain labels, `?` popovers, mobile compression.
5. **Hydration units** (P3-4 = DSH-34) in the now-single hydration surface.
6. **First-run path** (P1-4): one dominant first action, quieted empty-state chorus.
7. **Coherence nudges** (P2-4): goal↔target conflict callout, overlapping-goal warning.
8. **Quick actions + non-Pro rule** (P2-8, P2-7).
9. **Hero customizer fixes** (P3-8 = DSH-37).
10. **Polish batch** (P3-1/2/3/5/6): link labels, TargetEditor prefill, 0% bar track, kcal/cal,
    stray tooltip node.

Steps 1–3 are the audit's heart — they install the missing logic. 4–10 make it visible everywhere.

---

*Audit session notes: dev data added to the Pro test account — one sleep entry ("Night of" Jul 2,
7h30m, streak now includes it); water was added then undone (net zero). A non-subscribed account
`dsh38-audit@example.com` / `Dsh38-Audit!2026` now exists in the shared Neon DB (harmless; reusable
for paywall tests). Registration itself silently rejects weak passwords with inline-only errors —
out of scope here, noted for the carried s22 registration sweep.*
