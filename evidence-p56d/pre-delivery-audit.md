# P56-D Pre-Delivery Audit — Today shell rebuild (commit 496d50e)

**Auditor:** Pre-delivery auditor (Opus), adversarial quality gate. Changed no code.
**Target:** production build of 496d50e on http://localhost:3601 (isolated worktree). Pro test account.
**Method:** node @playwright/test scripts from chadchat (auth = credential login + minted `__Secure-` twin, both cookies held). Screenshots in `evidence-p56d/audit/`. Read-only toward data — no water/meal/sleep/figure writes; login only.
**Date:** 2026-07-13 (Monday; member wall clock = Los Angeles Pacific).

## VERDICT: SHIP

No P1 blockers. The shell is truthful, contract-conformant, keyboard-accessible, passes AA contrast in light theme (zero failures across ~400 visible text nodes), has zero React #310 and zero console errors on every surface, no horizontal overflow at 320/390, and the DEC-08 phone-nav + DEC-05 Appearance relocation both landed correctly. Two P2 visual-quality items and several P3 polish notes below should be picked up before the wave closes, but none rise to blocking this delivery.

Important context for the grade: **the shared test account currently has an all-empty / zero-today data state** (no meals, no water, no sleep logged today; last workout was Sat Jul 11 = last week). That is the honest live state and it exercised every designed-empty path — but it also means the *reward* states (emerald ring on goal-met, "Goal reached", perfect-week capsule glow, filled sleep bars) could NOT be observed live. Their correctness rests on source review, not live capture (see P3-5).

---

## What PASSED (adversarially checked, held up)

- **Truthfulness.** Every status word is backed by visible data. Nutrition/Water/Sleep render designed-empty copy ("No meals yet.", "Not logged yet.", "Last night isn't logged.") — never a fake `0`. Training shows `0 sessions this week` (the declared truthful-zero carve-out). Up next = "Log last night's sleep" with reason "Last night's sleep isn't logged yet." — matches the sleep-unlogged state. Consistency `0 of 7` matches the dot strip (2 elapsed days both "Nothing logged", 5 "Upcoming"); `0-day streak` matches. No contradiction between "0 sessions this week" and the "Push Day · 2 days ago" workout card (Jul 11 = last week; week starts Sun Jul 12).
- **Contract conformance.** Whole-cell status links, each aria-named to its destination ("Open Calorie Tracker"→/nutrition, "Open Hydration"→/hydration, "Open Sleep"→/sleep, "Open Workouts"→/workouts). Zero logging controls inside the strip. New surfaces use named detail links ("Sleep trends →", "Progress →"), no generic "View all" on the new surfaces. No destructive action on dashboard chrome (Delete my data lives on /account "Your data", correct). Sleep stale-state renders dated ("Last logged …"), not "last night".
- **Status strip responsive.** 1440 = 4-in-a-row (`275px ×4`); 390 = 2×2; 320 = 1-col stacked. The round-2 container-query fix is confirmed on the prod build.
- **A11y.** Keyboard-Tab onto a status cell shows a real 2px blood-red focus ring (`rgb(164,22,26) 0 0 0 2px` box-shadow via `--ring`) — the earlier "no ring" reading was a programmatic-focus false alarm. The Up next "?" popover opens on Enter ("fixed order" text present). Consistency dots are keyboard-reachable (UA outline). Domain rows carry aria summaries.
- **Light theme.** Renders correctly (class-based next-themes; had to set localStorage `theme=light` — OS `prefers-color-scheme` does NOT flip it). Contrast probe: **0 AA failures** on all visible text, including muted-foreground, eyebrow, and cell headlines.
- **DEC-08 phone-nav.** No top-bar hamburger on /today, /nutrition, /hydration, /sleep, /goals, /account at 390 (wordmark + account-menu only). Bottom nav = Today/Log/Progress/Coach/More. Account menu present at every width.
- **DEC-05 Appearance.** /account/appearance works (Current preview + Male/Female tiles + Upload) at 1440 and 390; /account Preferences shows the "Appearance" row + "Open Appearance" link.
- **Sibling regression.** /nutrition, /hydration, /sleep, /goals, /account intact at 390 — no overflow (scrollW==clientW==390), no #310. Chat composer + sidebar render at 390 and 1440, no overflow, no #310.

---

## FINDINGS (ranked)

**P2-1 — Up next "sleep" empty visual reads as an unfinished placeholder.** In the no-sleep-logged state the Up next card's visual is a row of **7 blank/hollow rounded boxes** (the honest-empty `WeekBars` with all-null fractions). It is honest-by-design, but visually it reads as skeleton/placeholder that never loaded, not an informative graphic — the weakest element on the marquee surface against the Oura "one big thing" benchmark and arguably a "bland panel" per the s181 visually-rewarding law. Only appears in the empty state (a populated week shows filled bars), but many day-1 users will see exactly this. `components/today/up-next-panel.tsx` visualNode, sleep branch. Evidence: `audit/upnext-card-LIGHT.png`.

**P2-2 — Status strip is non-uniform / low-information in the all-empty state.** Three cells render two-line instructional copy + a hollow ring that carries no data, while Training shows a bold number — so the strip reads as three onboarding prompts + one metric rather than a uniform glanceable status row (the WHOOP bar it's benchmarked against). ACC-01 "read status in <=10s" still passes (the copy is readable), and a populated account would be uniform, but the empty-state hollow rings are decorative-without-information. Consider a denser empty treatment (e.g. faint target dash instead of an empty circle). Evidence: `audit/today-1440-dark.png`, `today-1440-LIGHT-verify.png`.

**P3-1 — Consistency dots use the browser default outline on focus,** not the app's custom focus-visible ring that the status cells get. Reachable and visible, but inconsistent focus styling across the same page. `components/today/consistency-panel.tsx` dot `tabIndex={0}`.

**P3-2 — Streak-meaning line truncates the actionable instruction.** "No streak yet. Log anything today to start one." renders as "…today t…" (single-line `truncate`) even where horizontal room exists in the consistency panel, cutting the CTA. Consider allowing a second line or widening. `consistency-panel.tsx` streakMeaning span.

**P3-3 — Generic "View all →" persists on the older Today's-log / Your-plans cards** below the new surfaces (Calorie Tracker, Sleep, Goals, Your Training all show "View all →"). The NEW surfaces correctly use named links, so this is not a contract breach on the new work — but it's a visible naming inconsistency directly beneath them.

**P3-4 — /account/appearance is sparse on 1440 desktop.** Content occupies ~2/3 width, top-aligned, leaving a large empty lower region. Acceptable for a focused settings sub-page, but reads sparse against the full-width-pages doctrine; a wider preview or supporting content would fill it.

**P3-5 — Reward states unobserved live (residual risk, not a defect).** Because the account is all-empty, the emerald goal-met ring, "Goal reached"/"Done"/"Above target" words, the perfect-week emerald capsule glow, and filled sleep/week bars were not renderable during this audit. Source review shows them wired correctly and truthfully (color + word both gated on the real number), but they were verified by code, not by capture. Toast behavior (bottom-anchored richColors + Undo) likewise could not be re-tested under the write-free mandate — relying on live-verification Check C (PASS).

---

## Evidence index (`evidence-p56d/audit/`)
today-1440-dark.png, today-1440-LIGHT-verify.png, today-390-dark.png, today-320-dark.png, upnext-card-LIGHT.png, appearance-1440-dark.png, appearance-390-dark.png, account-1440-dark.png, nutrition-390-dark.png, chat-390-dark.png, chat-1440-dark.png, today-1440-cellfocus-dark.png; probes: audit-probe.json, light-probe.json.
