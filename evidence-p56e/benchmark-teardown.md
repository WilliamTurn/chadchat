# Benchmark teardown: /today summary cards (P56-E, rule-8)

Date: 2026-07-13. Researcher: P56-E benchmark agent. Scope: the four /today surfaces (Training today, Meal plan today, Primary goal, Progress highlights band).

Evidence basis: vendor docs/blogs, help centers, App Store listings, and third-party design breakdowns fetched 2026-07-13. Several app home screens sit behind login (Hevy, Strong, Boostcamp, MyFitnessPal Today tab article 403'd); where evidence is secondhand it is flagged. No claim below is invented; anything not cited is marked INFERENCE.

---

## Surface 1: "Training today" (next planned session card)

### Ranking

**1. TrainingPeaks — workout card + compliance system.** The color-coded workout card is the strongest planned-vs-done grammar shipping anywhere: the same card appears on calendar, Home view, and mobile, and colorizes by compliance with the plan. Green = completed within +/-20% of planned, yellow = 50-79% or 121-150%, orange = >50% off, red = not completed, grey = unplanned extra work. The compliance indicator also names WHICH value it graded (duration, distance, or TSS) and whether you were over or under. That is a full semantics for "how am I tracking against my plan" in one glance.
- https://help.trainingpeaks.com/hc/en-us/articles/204861204-Workout-Card-Overview
- https://www.joinbasecamp.com/support/compliancecolors
- Why it wins: the card is not just "here is a workout"; it is a plan-state machine. Information hierarchy = workout name, then planned key numbers, then compliance color as ambient state. Weakness for us: TP's card is calendar-dense coach software, visually utilitarian, no big Start CTA.

**2. Boostcamp — program day card.** The organizing principle is the PROGRAM: you are on week X, day Y of a named program (nSuns, GZCLP, 5/3/1...). The day card "shows the exercise, target sets and reps, and your last logged weight. Hit the set, tap to log it. The rest timer starts automatically." Charts of progress live behind it.
- https://www.boostcamp.app/workout-tracker
- https://barbend.com/boostcamp-review/ (PT-tested review)
- Why it ranks: closest analog to our rotation-position model (session N within a named plan), and the card carries actionable exercise detail (targets + last performance), not bare chips. Evidence-thin caveat: the exact home-card layout is behind login; specifics above are from Boostcamp's own marketing copy and a hands-on review, not screenshots we could inspect.

**3. Hevy — routine card + one-tap start.** Routines live as cards with exercise lists; the key interaction detail (from Hevy's own widget docs) is that "tapping on a routine... automatically starts it as a live workout" — start friction is near zero. Hevy's home tab itself is a social feed; the next-workout surface is the Routines tab and widgets.
- https://www.hevyapp.com/features/home-screen-widgets/
- https://www.hevyapp.com/features/
- Why it ranks lower: no plan-position or weekly-completion concept on the card; the routine card is a static list, progression lives in per-exercise charts.

**Honorable mention: Strong.** Templates sit under a dedicated "Start Workout" tab; free tier caps at 3 templates. An independent UX case study flags its new-user empty state as weak ("the initial screen could feel slightly empty... highlighting a recommended 'First Workout' template could provide a clearer starting point") — a mistake to avoid, not copy.
- https://help.strongapp.io/article/105-about-templates
- https://medium.com/@hwaijunyap/ui-ux-case-study-strong-workout-app-redesign-fc22afbada65

### Checklist: what the best do that we must match or exceed

| # | Requirement | Source |
|---|---|---|
| T1 | Session name + position in the plan ("Upper A · session 2 of 4", week context) is on the card, not behind the link | Boostcamp program model |
| T2 | Exercise preview carries substance (target sets x reps and/or last logged weight), not bare name chips | Boostcamp workout-tracker page |
| T3 | ONE dominant Start CTA that drops straight into live logging (zero intermediate screens) | Hevy widget one-tap start |
| T4 | Weekly plan completion shown as plan-state, with consistent color semantics for done / partial / missed / unplanned | TrainingPeaks compliance colors |
| T5 | The completion indicator says what it is measuring (sessions done of planned), never an unlabeled bar | TrainingPeaks compliance indicator naming duration/distance/TSS |
| T6 | Empty/rest-day state still answers "what's next" and offers a recommended action (Strong's bare empty tab is the documented anti-pattern) | Strong case study |

---

## Surface 2: "Meal plan today" (next-meal card)

### Ranking

**1. MacroFactor — revamped dashboard.** The 2024+ dashboard revamp is explicitly built around the planning use case: users choose between "total calories consumed for the day against their targets" and — for "meal planners" — "remaining calories" to budget upcoming meals, swappable and lockable "with just one tap," and the app "will remember your latest selection." When a target is met, "the target line is highlighted." Deselecting recent day columns reveals a weekly summary.
- https://macrofactor.com/dashboard-revamp/
- https://calorierankings.com/reviews/macrofactor/
- Why it wins: it is the only major tracker that formally designs for the forward-looking question our card asks ("what should my NEXT meal be"), and it rewards target attainment visually.

**2. Lose It! — above-the-fold budget.** Reviewers single out the home screen: "shows your daily calorie budget, what you've eaten, what's remaining, and a macro breakdown — all without scrolling," with exercise calories adjusting the budget in real time.
- https://www.amyfoodjournal.com/blog/lose-it-app-review
- Why it ranks: the density benchmark — budget, consumed, remaining, macros in one glance. No meal-plan progression concept, though (it is a logger, not a planner).

**3. MyFitnessPal — Today tab.** The 2024+ Today tab leads with a food-logging streak, then a Calories card; tapping it opens a per-meal pie breakdown, and meal-level calorie/macro rows were added "for all users." Macro-card detail is a premium upsell.
- https://support.myfitnesspal.com/hc/en-us/articles/39985611667341-Introducing-the-brand-new-Today-tab (fetch 403'd; details corroborated via search snippet of the same article)
- https://www.prnewswire.com/news-releases/myfitnesspal-launches-new-customizable-dashboard-for-an-instant-snapshot-of-what-matters-most-301830189.html
- Why it ranks lower: meal-level info is one tap deep, and the card grammar is fragmented by the free/premium split. The streak-at-top pattern is worth stealing.

### Checklist

| # | Requirement | Source |
|---|---|---|
| M1 | Frame numbers for the NEXT decision: remaining calories (and protein) toward target, not only consumed totals | MacroFactor "meal planners" view |
| M2 | Meal progression is explicit: meal N of M today, with the next planned meal named + its cal/protein | MacroFactor meal budgeting; MFP per-meal breakdown |
| M3 | Calories + protein visible without any tap; full macro detail one link away | Lose It above-the-fold standard |
| M4 | Target attainment gets a visible reward state (highlighted target line / met-state color) | MacroFactor target-line highlight |
| M5 | One-tap path to log or open the plan; remembered user preference where a view can toggle | MacroFactor one-tap swap + remembered selection |
| M6 | Nothing-planned/nothing-logged state points at the plan ("Plan today's meals") rather than showing zeros | INFERENCE from M1-M5 + Strong empty-state anti-pattern |

---

## Surface 3: "Primary goal" (featured goal + linked outcomes)

### Ranking

**1. WHOOP — home dials + Weekly Plan.** The home screen answers one question with a strict hierarchy: Recovery dominates (~72pt numeral per the 925 Studios breakdown), Strain and Sleep secondary; a three-color vocabulary (green/yellow/red) "repeats across every screen" so "users learn the visual language once." Overview layer has "no graphs, no charts, no noise. Just the answer"; each tile is "a doorway, not a destination." Weekly Plan sets targets "using your individual baseline data" and ends each week with "a performance summary showing where you met goals."
- https://www.925studios.co/blog/whoop-design-breakdown
- https://www.whoop.com/us/en/thelocker/set-and-reach-your-goals-with-weekly-plan/
- https://www.whoop.com/us/en/thelocker/everything-whoop-launched-in-2025/
- Why it wins: personal-baseline targets + explicit met/missed recap + one loud number is exactly the "Primary goal" job. Caveat: the home-screen typographic specifics come from a third-party teardown, not WHOOP's own spec.

**2. Apple Fitness — activity rings + awards.** The canonical current-vs-target visual: three rings whose closure IS the progress state; Summary tab merges History/Trends/Workouts/Awards into one personalizable dashboard; awards ("digital enamel pins") fire on goal completion; Trends compares last 90 days vs last year.
- https://support.apple.com/guide/iphone/see-your-activity-summary-iph4c34a8a95/ios
- https://www.macstories.net/stories/the-new-fitness-app-in-ios-14/
- Why it ranks: the reward loop (ring closes -> celebration -> award) is the most habit-proven goal visual in the category. Weakness: rings are same-every-day quotas, not target-value goals like "195 lb".

**3. Oura — Today tab "one big thing".** The 2025 redesign cuts five tabs to three; Today "cuts through the clutter to help you focus on 'one big thing' — the most important score or insight you need right now," with scores at top and a design system that "uses color to signal your body's different states" anchored to personal baselines.
- https://ouraring.com/blog/new-oura-app-experience/
- https://ouraring.com/blog/new-app-design/
- Why it ranks: the featured-single-item editorial stance validates our "one featured goal" design; less applicable mechanically (scores, not target-value goals).

**Honorable mention: Gentler Streak** (Apple Design Award 2024) — the Activity Path gives at-a-glance readiness "if your body is ready for a challenge, in need of rest, or maintaining a good balance"; its Monthly Summary is "less about hard comparisons and more about progress." Good tone reference, wrong mechanics for a target-goal card.
- https://docs.gentler.app/understanding-your-activity-path/interpret-the-activity-path
- https://developer.apple.com/news/?id=3m0ht22s

### Checklist

| # | Requirement | Source |
|---|---|---|
| G1 | ONE featured goal, editorially chosen — never a list of equal goals on /today | Oura "one big thing"; WHOOP single-answer overview |
| G2 | Current AND target as absolute numbers (208.8 of 195 lb), with the visual (bar/ring) as reinforcement, never %-only | WHOOP big-numeral hierarchy; Apple rings encode the quota |
| G3 | Consistent 2-3 color state vocabulary reused across every card (on-track / drifting / off-track) | WHOOP three-color system |
| G4 | Linked outcomes ride under the headline goal as smaller rows, each a doorway to detail | WHOOP tiles-as-doorways |
| G5 | Reaching a target triggers a visible celebration/reward state (ring-close moment, award, glow) | Apple awards; MacroFactor target-line highlight; owner reward-glow law |
| G6 | Progress is framed against the member's own baseline/trend, not population averages | WHOOP Weekly Plan baselines; Oura baselines |

---

## Surface 4: "Progress highlights" band (compact cross-domain tiles)

### Ranking

**1. Apple Fitness — Trends.** The category-defining highlights band: compact per-metric tiles with up/down arrows comparing "the last 90 days and the last year," unlocked after enough data; lives inside the Summary dashboard next to rings and awards, each tile opening a detail view.
- https://www.androidpolice.com/apple-fitness-guide/
- https://support.apple.com/guide/iphone/see-your-activity-summary-iph4c34a8a95/ios
- Why it wins: metric + timeframe + direction in a tiny, absolutely uniform tile grammar, with a hard link into detail per metric.

**2. Oura — Vitals tab.** "An intuitive, quick-glance view of your core health pillars... all anchored to your unique, personalized baselines," cards grouped by health area (readiness, sleep, activity, stress, heart, metabolic), color signaling state.
- https://ouraring.com/blog/new-oura-app-experience/
- Why it ranks: the grouping-by-domain + baseline-anchored state coloring maps 1:1 to our Training/Nutrition/Recovery tiles.

**3. WHOOP — trend views + weekly recap.** Weekly/monthly/6-month trend views per pillar; Weekly Plan ends with a recap of met vs missed targets. Progressive disclosure doctrine: overview stays clean, trends one tap deep.
- https://www.whoop.com/us/en/thelocker/track-progress-with-new-trend-views/
- https://www.925studios.co/blog/whoop-design-breakdown

**Also noted:** MyFitnessPal puts the logging streak at the very top of Today (habit reinforcement as the first highlight); MacroFactor's week summary appears by widening the selection on the same chart rather than a separate surface.
- https://support.myfitnesspal.com/hc/en-us/articles/39985611667341-Introducing-the-brand-new-Today-tab (via search snippet)
- https://macrofactor.com/dashboard-revamp/

### Checklist

| # | Requirement | Source |
|---|---|---|
| H1 | Every tile states metric + timeframe + direction/delta ("Sessions · this week · 3 of 4, up vs last week"), no naked numbers | Apple Trends arrows + timeframe |
| H2 | One uniform tile grammar across all three domains (same slots for label, value, viz, delta) — domain variety comes from the viz, not the layout | Apple Trends uniformity; Oura Vitals card system |
| H3 | Each tile is a doorway: links to a NAMED Progress category page, whole tile tappable | WHOOP tiles-as-doorways; Apple per-metric detail |
| H4 | Weekly framing with vs-prior comparison, computed from the member's own history | Apple 90d-vs-year; Oura baselines |
| H5 | A glanceable micro-viz per tile (sparkline/day-dots), never text-only; band stays compact (one row scan on mobile) | Oura quick-glance cards; WHOOP progressive disclosure |
| H6 | Habit/streak signal is welcome at this level (streak strips law) — MFP leads its Today tab with the streak | MFP Today tab |

---

## Honesty ledger (where evidence is thin)

- **Boostcamp, Hevy, Strong, MFP** home screens are behind app logins; card-level claims rest on vendor marketing/help pages and third-party reviews, not our own screenshots. Layout minutiae (spacing, exact card order) are NOT established.
- **WHOOP** typographic specifics (72pt Recovery numeral, tier structure) come from one third-party teardown (925studios.co); whoop.com's own home-screen post 403'd on fetch.
- **Apple support page** fetch returned truncated content; ring/Trends/Awards claims are corroborated across MacStories and Android Police instead.
- **TrainingPeaks** compliance thresholds are from its help center and a partner page and apply across web + mobile card renders; we did not verify the mobile "today" layout visually.
- No ranking above should be read as pixel guidance; they are information-architecture and semantics rankings, which is what the checklists encode.
