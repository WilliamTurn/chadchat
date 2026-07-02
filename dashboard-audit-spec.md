# /today Dashboard — Comprehensive Audit Spec (DSH-38)

> **Why this exists (user, s110):** DSH-32 fixed the *card layout* grammar, but the user's
> specific complaints were off-the-cuff, **not exhaustive**, and the deeper problem remains:
> there is no discernible underlying LOGIC to the dashboard. Their words: "it's just extremely
> confusing to make sense of any underlying logic or order grounding this dashboard, and seems
> like things were just strewn together randomly."
>
> **Examples the user gave (seed findings — verify and generalize, don't stop at them):**
> - The weight trend gets a really small area while the hydration trend gets a huge area — why?
> - Hydration has a *Goal* control **and** a separate full-width trend section elsewhere on the
>   page; Weight has a *View all* link + *Log weight* but **no** goal control and **no** undo;
>   Hydration has *Goal* + *Undo last* but its trend card has no *View all*. No rule explains
>   who gets what.
> - What IS each card? Are some cards just a passive view of what's happening, and others
>   controls? The dashboard never makes that distinction legible.
>
> **Process (user-mandated, two sessions):**
> 1. **DSH-38 (next session):** execute this spec. Output = a prioritized findings +
>    recommendations list written to **`dashboard-audit-findings.md`** (chadchat root).
>    **Do NOT fix anything in the audit session.**
> 2. **DSH-39 (the session after):** implement the findings list.

---

## Phase 0 — Establish the intended model (the missing "underlying logic")

Before testing anything, write down what the dashboard is SUPPOSED to be. Every finding in
later phases is measured against this. Produce a **card-by-card capability matrix**:

| Card | Domain | Role (monitor / logger / both) | Goal concept? | Where does its history live? | Undo? | Ask Chad? | Primary action |
|---|---|---|---|---|---|---|---|

Fill it for: header/hero + stat pills + streak, Calorie Tracker, Your goals, Your training,
Last workout, Meal plan, Hydration, Weight trend, Sleep & recovery, Hydration trend (full-width),
Sleep trend (full-width), Quick actions.

Then answer, explicitly, in the findings doc:

1. **What rule decides whether a domain gets a goal control on /today?** (Hydration: yes.
   Calories: targets editor. Sleep: hard-coded 7h. Weight: only via the separate Goals card.
   Lifts: via Goals card.) Either one consistent rule or a documented per-domain reason.
2. **What rule decides whether a domain gets an undo?** (Water has one because one-tap logging
   is accident-prone. Nothing else does — is that right? What's the correction path for a
   fat-fingered weigh-in / sleep log, and is it discoverable from /today?)
3. **What rule decides in-card trend vs a separate full-width trend card?** (Weight: in-card
   compact chart. Water/sleep: bare week strip in-card PLUS a separate full-width trend card
   below — duplicated surface, and the duplicate lacks the card grammar's header link.)
4. **What decides card ORDER on the page?** Is there a narrative (today's actions → plans →
   trends), and does the current order tell it?
5. **Is the monitor-vs-logger distinction legible?** A member should be able to answer "what
   do I DO here?" for every card in under a second.

## Phase 1 — Space-allocation audit (the "small weight chart, huge hydration trend" class)

At 1440, 768, and 390, screenshot the full page and measure (Playwright `getBoundingClientRect`)
each card's rendered height. For each card compute rough **pixels vs information value** and flag:

- Any card whose height is dominated by chrome/whitespace rather than data.
- The weight chart's plot area vs the hydration/sleep trend plot areas — justify or equalize.
- The two full-width trend cards specifically: do they earn a full row each (DSH-33 already
  says the hydration one doesn't)?
- Anything that forces scroll past low-value content to reach high-value content.

## Phase 2 — Interactive sweep (every control, every state)

On dev (`:3100`, Pro test account — memory `pro-test-account`; clear cookies first):

1. Click EVERY control on EVERY card: view links, primary actions, config popovers/dialogs
   (targets, water goal, goal/plan editors incl. add/edit/delete/reopen), undo, Ask Chad
   prefills (verify the composer actually prefills), hero customizer, quick actions.
2. Verify each action's outcome is visible without a manual reload (counts/charts refresh).
3. Check every empty state (no meals / no goals / no plans / no workouts / no weigh-ins /
   no sleep / no water) — does each tell the user what to do, once, without duplicate CTAs?
4. Check the non-Pro view (LockedCards) and the trial/Basic/Pro/Elite badge states.
5. Light AND dark theme; keyboard focus order on one representative card.

## Phase 3 — Comprehension walkthrough (personas)

Walk the page cold in each state and narrate what a member would conclude:

- **Brand-new member** (nothing logged): is there ONE obvious first action?
- **Active member mid-day**: can they answer "am I on track today?" from the top half alone?
- For every number on the page (hero stats included — overlaps DSH-35): would a non-lifter
  understand it without explanation? Flag jargon (pairs with HLP-1).

## Phase 4 — Benchmark (memory `benchmark-against-pro-apps`)

Compare the page's structure against 2–3 category leaders (e.g. MyFitnessPal dashboard,
Whoop home, Apple Fitness summary): how do THEY order modules, distinguish monitor vs logger,
size trends, and handle per-domain goals? Note table-stakes patterns we're missing.

## Known-open items — do not re-report as new

DSH-33 (hydration trend row), DSH-34 (oz/gal quick-add), DSH-35 (hero stat labels),
DSH-36 (hydration bar chart layout), DSH-37 (hero customizer bugs). The findings doc should
REFERENCE these where relevant and may fold them into its recommendations so DSH-39 can fix
everything in one coherent pass.

## Output format (`dashboard-audit-findings.md`)

1. The Phase-0 capability matrix + the written "intended model" (the rules).
2. Findings, prioritized: **P1** broken or actively confusing · **P2** inconsistent logic /
   violates the intended model · **P3** polish. Each finding = what/where, why it's wrong
   against the model, and a concrete recommendation.
3. A short proposed execution order for DSH-39.

Screenshots referenced by filename (drop them in chadlatest as usual).
