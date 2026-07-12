# First-run and empty-state experience standard

Part of the Phase 1 contract layer (DSH-66). The empty product is where cheap apps look cheapest, and every member sees it first. First-run, empty, and locked are DESIGNED states with their own composition, not the populated layout with holes in it. This standard is tied to the deterministic fixtures: the `firstRun`, `sparse`, and `locked` personas exist so every later phase can build and screenshot these states on demand.

## 1. Definitions (pinned to the live logic)

- **First-run member**: no profile, no weigh-ins, and no meals logged today (the Today page's live `isReturning` test). They landed after /welcome and have logged nothing.
- **Empty panel**: nothing logged in the panel's SCOPE (data-state `empty`). Scope follows the metric's grain: a day-grain panel is empty when today has no logs even if history exists; a history-grain panel is empty only when the domain has never been logged. The two cases share the state but not the copy: first-ever empties use the "Log your first..." variant; nothing-today empties on a member with history use "No meals logged yet today", never "first".
- **Sparse panel**: some data, below claim thresholds (data-state `sparse`).
- **Locked panel**: entitlement gate (data-state `locked`). Never conflated with empty or error (FIX-11).

## 2. First-run page laws

- Exactly **ONE dominant CTA** on the page (P1-4; today it is "Tell Chad about yourself"). Every other panel goes quiet: no competing buttons, no per-card shouting.
- The greeting explains what will happen ("this page fills in as you log"), not "Welcome back" (illogical on day one).
- Every empty panel answers three things in <= 2 sentences: what is absent, what appears once they log, and (when the page CTA is not enough) the one quiet action to start. Approved copy shapes live in doc 05 and copy.ts rules.
- Nothing on first-run looks broken: no empty chart frames, no "0" readouts, no error-tinted blanks.

## 3. Empty panels earn their space (the DSH-64 rule)

Empty is a state of the SAME rewarding panel, not a different bare one:

- The panel keeps its identity: icon chip, canonical title, named detail link.
- The week strip renders with hollow slots (the workout card's empty week is the reference; the sleep card's missing strip was the DSH-64 violation). Streak strips are never removed (owner law).
- The visual slot shows the DESIGNED empty variant: hollow strip + a quiet axis-only chart placeholder or explanatory diagram, sized to the role's compact height. Never a full-size blank frame, never fake data.
- Copy states the unlock plainly, tied to real thresholds from `claims.ts`: "Log your weight to see the trend." / "Log at least 3 weigh-ins across a week to unlock your trend line."

## 4. Sparse panels tell the truth warmly

- Show every real fact at full size (2 weigh-ins are 2 honest points at their true dates inside the full time window; see the DSH-60 axis rule).
- State coverage in the standard form ("2 of 7 days logged") and what unlocks next.
- No trend/rate/adherence language below thresholds (claims contract enforces).
- Tone is forward ("2 days in. Log 5 more to unlock your weekly trend."), never scolding; scolding is Chad's, in chat, if he chooses.

## 5. Locked panels sell, honestly

- Locked shows: the capability in one concrete sentence, what the member's data would look like there (described, or a clearly-labeled sample visual), and the upgrade path. The current LockedCard pattern (dashed border, lock icon, one Upgrade CTA) is the baseline.
- Locked never shows fake member data as if real, never an error tone, and never hides data the member's tier already earned elsewhere.

## 6. The return curve (day 2 to week 2)

- Day 2+: greeting flips to returning mode; the one-CTA law relaxes to the normal action budget (density-hierarchy.md).
- Each panel graduates independently (nutrition may be populated while sleep is still empty). Per-panel state comes from `resolvePanelState`, never from a page-level "new user" flag alone.
- Stale (logged before, gone quiet) is its own state: show the last value DATED, plus the one action to refresh it. A 10-day-old weigh-in is "Last weigh-in Jun 28", never today's number.

## 7. Checkable rubric

- [ ] First-run screenshot shows exactly one dominant CTA; all other panels quiet.
- [ ] Every panel's empty state: identity kept, hollow strip rendered, designed compact visual, unlock copy naming a real threshold.
- [ ] No empty chart frames, no zeros for missing data, anywhere.
- [ ] Sparse states show real points in the full time window + coverage line; no trend language.
- [ ] Locked states name capability + tier and preserve earned data; never styled like errors.
- [ ] All of the above screenshotted from the fixtures at 390px and desktop, both themes.
