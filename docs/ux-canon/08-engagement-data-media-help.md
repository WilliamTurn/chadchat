# UX Canon 08 — Engagement & Habit Mechanics, Data Surfaces, Media, Help & Self-Service

Scope: four domains owned by this agent. Each principle: **imperative rule** — plain-English explanation — [sources] — [mechanical] (checkable pass/fail) or [judgment] (requires design judgment to apply). Items without genuine industry consensus are marked [contested] and collected at the end.

---

# A. Engagement and Habit Mechanics

## A1. Streaks

1. **Only attach a streak to a behavior the user actually wants to do daily (or on their chosen cadence).** A streak on a behavior with no natural daily rhythm manufactures anxiety instead of habit; the streak must track the user's own goal, not the app's engagement goal. — [Fogg Behavior Model; Duolingo published experiments; growth.design case studies] — [judgment]
2. **Provide a grace mechanism (freeze, repair, or rest day) — never make a streak all-or-nothing.** Every major streak product (Duolingo, Snapchat post-2023, Apple Fitness+, Whoop) added forgiveness after learning that a single missed day causes churn, not motivation. A missed day without a safety net converts your most loyal users into ex-users. — [Duolingo streak-freeze data (21% churn reduction for at-risk users); Apptitude teardown; trophy.so streak survey] — [mechanical]
3. **Prefer earn-back recovery over pay-to-repair.** Letting a user restore a broken streak by doing extra work preserves the streak's meaning; selling repairs converts the streak into a hostage and reads as manipulation. If paid repair exists at all, an effort-based path must also exist. — [Duolingo "Earn Back" design; UX Magazine ethics-of-engagement-loops] — [mechanical]
4. **Apply grace automatically when the reason is knowable (travel, illness flag, planned rest day), and silently.** The best-behaved streaks freeze without a guilt notification; the user discovers they were protected, not that they failed. — [UX Magazine hot-streak design; Apple Fitness rest-day handling] — [judgment]
5. **Show streak state before the deadline, not only after the loss.** A visible "streak at risk today" indicator with time remaining is fair warning; discovering the loss after the fact feels like the app stole something. One reminder near the deadline is acceptable; repeated same-day pressure notifications are not. — [Duolingo convention; NN/g on notification restraint] — [mechanical]
6. **Design the day-after-a-broken-streak screen deliberately, with zero shame.** The moment after a loss decides retention. Show what was kept (total days, records, level), offer the recovery path if one exists, and restart the count matter-of-factly. Never display guilt copy ("You let your streak die"). — [growth.design case studies; UX Magazine "without shame"] — [judgment]
7. **Count streaks in the user's local timezone with a clearly stated cutoff.** Ambiguity about "when does the day end" (server midnight vs. local midnight vs. rolling 24h) causes unjust losses that users experience as bugs and betrayal. State the rule; honor timezone travel. — [Duolingo/Snapchat support-forum failure history; converged practice] — [mechanical]
8. **Let long-cadence users have long-cadence streaks (weekly streaks for 3×/week goals).** For behaviors like lifting, a "daily" streak punishes correct behavior (rest days). Streak unit must match the goal cadence the user set. — [Whoop/Strava weekly-goal conventions; Fogg on tiny-habit fit] — [judgment]
9. **Never let a streak become the product's primary value claim.** Streak is a motivator layered on real value; when the streak IS the reason to open the app, users eventually rebel (documented Snapchat streak backlash). Keep the core loop rewarding without it. — [NN/g social-media gamification video; published Hooked critiques] — [judgment]

## A2. Progress mechanics (bars, levels, milestones)

10. **Show progress toward the next milestone, not just lifetime totals.** "1,240 lifetime workouts" is inert; "3 workouts to your next level" creates a near-term pull (goal-gradient effect). Pair a proximate target with the lifetime stat. — [goal-gradient literature (Kivetz); Duolingo/Strava convention] — [mechanical]
11. **Never show an empty progress bar — grant earned starting progress when honest.** The endowed-progress effect: a bar at 2/12 (with 2 legitimately credited, e.g., "account created, first workout logged") gets far more completion than 0/10. Fabricated credit is manipulation; credit for real completed steps is good design. — [Nunes & Drèze endowed-progress study; growth.design] — [judgment]
12. **Make progress bars truthful: linear, monotonic, and tied to real state.** Bars that jump backward, sit at 99%, or animate to fake speed destroy trust in every other number the app shows. (Perceived-performance tricks belong to loading indicators, not achievement progress.) — [NN/g progress-indicator research] — [mechanical]
13. **Space milestones on a stretching curve: dense early, sparser later.** Early milestones (first workout, first week) come fast to build momentum; later ones spread out as intrinsic habit takes over. A flat cadence bores early users and spams veterans. — [game-design leveling convention; Duolingo league/level pacing] — [judgment]
14. **Levels and tiers must confer meaning, not just a number.** A level that unlocks nothing and signifies nothing is "badges for the sake of badges" — the canonical gamification failure. Either attach recognition/utility or drop the level system. — [NN/g gamification critique; UX Magazine Gamification 2.0] — [judgment]
15. **Show the user's own trajectory (past-self comparison) as the default progress frame.** "Stronger than you were in March" motivates nearly everyone; "weaker than 80% of users" motivates almost no one. Self-comparison is the safe default; peer comparison is opt-in (see A6). — [Strava/Apple Fitness convention; self-determination-theory literature] — [judgment]
16. **Never reset earned progress as punishment for absence.** Decaying levels, expiring XP, and rank demotion for not opening the app are loss-aversion coercion, widely identified as a dark pattern. Progress earned by real activity stays earned. [contested at the edges: competitive seasonal leagues legitimately reset by design, when clearly framed as seasons] — [UX Magazine ethics articles; deceptive-design pattern catalogs] — [mechanical]

## A3. Celebrations

17. **Scale the celebration to the achievement.** A personal record or first-ever completion earns a full-screen moment; a routine daily completion earns a small, fast acknowledgment. Uniform confetti for everything makes real wins feel cheap. — [Apple Fitness (ring-close vs. award animations); Duolingo tiering; growth.design] — [judgment]
18. **Celebrate immediately at the moment of completion, inside the flow.** The reward must land within the action's afterglow — not on next app open, not in a notification an hour later. Delayed praise doesn't reinforce the habit loop. — [Fogg (celebration as habit-wiring); Hooked reward-timing] — [mechanical]
19. **Make every celebration skippable and short.** Ceremony must never hold the user hostage. Tap-to-dismiss, and the routine tier resolves itself in about a second without interaction. — [HIG/Material animation guidance; converged practice] — [mechanical]
20. **Say specifically what was achieved, in the user's terms.** "New 5-rep max on bench: 185 lb" beats "Awesome job!" Specific celebrations double as a record and feel earned; generic praise reads as noise. — [NN/g on specific feedback; Strava PR cards] — [mechanical]
21. **Cap celebration frequency per session.** If one session yields five milestone popups, batch them into one summary moment. Back-to-back interstitials teach users to dismiss without reading. — [converged practice (Strava activity summary, Apple Fitness awards stack)] — [mechanical]
22. **Design first-time completions as a distinct class.** The first workout, first week, first shared item are one-shot conversion moments proven to drive retention; they deserve deliberately crafted (not template) celebrations. — [growth.design onboarding case studies; aha-moment retention literature] — [judgment]
23. **Respect reduced-motion preferences in celebrations.** Confetti, fireworks, and screen-filling animation must honor the OS reduced-motion setting with a calm equivalent. (Cross-ref: accessibility agent.) — [WCAG 2.3.3 / prefers-reduced-motion] — [mechanical]

## A4. Goals

24. **Let users set their own goal targets, with a recommended default.** A default (e.g., 3 workouts/week) removes decision paralysis; an editable target respects that the app cannot know the user's life. Locked goals are a top complaint against fitness apps. — [Apple Fitness ring editing; Whoop/Strava goal settings; SDT autonomy] — [mechanical]
25. **Make goals adjustable at any time without penalty or friction.** Life changes; a goal that can only be lowered by "giving up" pushes users to quit the app instead. Lowering a target is a settings change, not a confession. — [Apple Fitness "change move goal" convention; without-shame design] — [mechanical]
26. **Proactively suggest lowering a goal the user is chronically missing.** When someone misses a target for weeks, the kind and effective move is "want to try 2 days a week instead?" — it keeps them in the game. Silence plus continued failure notifications drives churn. — [Apple Watch goal-adjustment prompts; behavioral-design consensus on tiny habits] — [judgment]
27. **Allow pausing or abandoning a goal cleanly, keeping its history.** "End this goal" should archive it with its record intact, not delete or brand it FAILED. Users return to apps that let them leave gracefully. — [converged practice; loss-aversion ethics] — [mechanical]
28. **Frame goals over recoverable windows (weekly), not fragile single days, wherever the domain allows.** A weekly target self-absorbs one bad day; a daily target makes one bad day a failure event. Prefer the resilient frame as default. — [Whoop/Strava weekly targets; streak-fragility research] — [judgment]
29. **Show goal progress as done-so-far plus what's-left-and-when.** "2 of 3 workouts — 3 days left this week" is actionable; a bare percentage is not. — [Material progress guidance; fitness-app convergence] — [mechanical]

## A5. Reminders and habit loops

30. **Tie reminders to the user's stated intention and schedule, not the app's re-engagement wishes.** The consensus ethical line: a reminder serves a plan the user made ("you planned legs today at 6pm"); a nag serves DAU ("we miss you 😢"). Implementation-intention prompts measurably work; generic nags measurably cause uninstalls. — [implementation-intentions research (Gollwitzer); NN/g push-notification guidelines] — [judgment]
31. **Let the user pick reminder time and days at setup, with sensible defaults.** Timing chosen by the user roughly matches their real routine; a fixed global send time hits most users at the wrong moment. — [Duolingo/most fitness apps; Fogg anchor-prompt matching] — [mechanical]
32. **Cap habit-reminder frequency at one per behavior per day, and stop after non-response.** If several consecutive reminders are ignored, back off automatically and say so ("These don't seem to be working — we'll pause them"). Duolingo's self-aware backoff is the canonical example. — [Duolingo backoff copy; NN/g notification fatigue] — [mechanical]
33. **Offer snooze and per-category opt-down before opt-out.** "Remind me later / only on my workout days / weekly summary only" keeps a channel alive that a binary allow/deny would kill. Notification settings must be granular by purpose (reminders vs. social vs. product news). — [HIG notification guidance; Material; converged practice] — [mechanical]
34. **Never use guilt, shame, or fake social pressure in reminder copy.** "Your streak is about to die," passive-aggressive mascots, and fabricated urgency are documented dark patterns that trade short-term opens for brand damage. State the fact; skip the emotional lever. — [deceptive-design catalogs; UX Magazine ethics; NN/g] — [mechanical]
35. **Make the habit loop completable in a genuinely small unit.** The prompted action must have a low floor (one exercise, five minutes) so that a low-motivation day still yields a success, which is what wires the habit. Prompting a 90-minute commitment daily guarantees failure days. — [Fogg Tiny Habits; Duolingo lesson sizing] — [judgment]
36. **Ask for notification permission in context, after value is shown, with a pre-prompt explaining what will be sent.** (Cross-ref: performance/mobile/trust agent owns the permission-priming pattern; listed here because reminders are its main consumer.) — [HIG; Material; NN/g permission-request research] — [mechanical]

## A6. Social comparison ethics

37. **Make leaderboards and peer comparison strictly opt-in.** Being ranked against others without consenting is a top-cited gamification harm; many users are demotivated, not motivated, by competition. Default is private; joining is a choice. — [NN/g social-media gamification; SDT research on competition; Strava opt-in segments/clubs] — [mechanical]
38. **Bucket competitive comparisons among rough peers, never the global population.** A beginner shown elite numbers disengages. League tiers (Duolingo), similar-athlete segments (Strava), and friend-only boards exist because within-reach comparison is the only motivating kind. — [Duolingo leagues; Strava age/weight segment filters] — [judgment]
39. **Let users leave or hide a leaderboard without leaving the product, and control what others see of them.** Exit from competition must not cost core functionality, and per-item audience control (private by default or explicit visibility choice at share time) is the norm. — [Strava privacy controls precedent (incl. its heatmap privacy failure as the cautionary case)] — [mechanical]
40. **Celebrate others' achievements as give-kudos moments, not zero-sum framing.** Supportive social mechanics (kudos, cheers, comments) show durable positive effects; rivalry framing ("You dropped below Jake") shows churn. If you have social features, build the supportive kind first. — [Strava kudos convention; fitness-social research] — [judgment]

## A7. Variable rewards and the anti-manipulation lines

41. **Variable reward is acceptable only on top of a guaranteed base reward.** Surprise bonuses ("double XP today," a rare badge) layered on predictable credit are motivating; making the core reward itself a slot machine (maybe you get credit, maybe not) is the casino line the ethics literature converges on. — [Eyal's Hooked + published critiques (incl. Eyal's own Indistractable reversal); UX Magazine ethics] — [judgment]
42. **Never sell or randomize outcomes that carry real value with hidden odds.** Loot-box mechanics — pay or grind for a randomized reward with undisclosed probabilities — are regulated as gambling in multiple jurisdictions and are outside the consensus ethical boundary for non-game apps entirely. — [EU/UK loot-box regulatory record; deceptive-design catalogs] — [mechanical]
43. **The user's goal and the engagement mechanic's goal must be the same goal.** The consensus manipulation test: does the mechanic reward progress toward what the user came for (fitness, learning), or reward mere presence (opens, watch time)? Mechanics rewarding presence alone are engagement farming. — [NN/g; Center for Humane Technology framing; Gamification 2.0 series] — [judgment]
44. **Pass the regret test.** If a user would feel tricked or regretful upon fully understanding the mechanic (hidden odds, manufactured scarcity, notifications engineered for FOMO), the mechanic is manipulative regardless of its metrics. This is the widely cited practitioner's ethical smoke test. — [Eyal's own regret test; UX ethics consensus] — [judgment]
45. **Never fabricate scarcity, urgency, or social proof in engagement mechanics.** Fake countdowns, invented "3 people are looking at this," and false last-chance framing are legally actionable dark patterns (FTC/EU enforcement) and destroy trust permanently. — [FTC dark-patterns enforcement; EU Digital Services Act; deceptive-design catalogs] — [mechanical]
46. **Design for graduation: the app should need its extrinsic motivators less over time.** Healthy gamification scaffolds an intrinsic habit and then quiets down (fewer prompts, subtler rewards for veterans); a system that must escalate stimulation to hold users is failing. — [SDT (intrinsic motivation crowding-out); Gamification 2.0] — [judgment]

## A8. Personal records and achievement systems

47. **Detect and surface personal records automatically at the moment they happen.** PRs are the highest-value celebration in any tracked-activity app and must never require the user to notice them manually. Strava's PR/"estimated best effort" detection is the reference implementation. — [Strava/Apple Fitness convention] — [mechanical]
48. **Keep an always-accessible records page (PRs, bests, milestones) per category.** Achievements viewed once in a toast and never again are wasted; a trophy case gives them a home and gives returning users a pride surface. — [Apple Fitness Awards, Strava profile bests; Duolingo achievements] — [mechanical]
49. **Make achievements earnable by every user type, not only the elite.** Consistency awards, comeback awards, and volume awards let a beginner earn recognition on day 3; if only top performance unlocks anything, most users are locked out of the system entirely. — [Apple Fitness award taxonomy; game-design achievement spread] — [judgment]
50. **Show locked achievements with clear criteria (except deliberate rare surprises).** Visible criteria turn achievements into goals; fully hidden ones generate no motivation. Reserve hidden achievements for delight, not for the core set. — [game-design convention; Duolingo/Strava practice] — [judgment]
51. **Handle edited or deleted activity data honestly in records.** If a user corrects a typo'd 500 lb lift, dependent PRs must recalculate. Stale false records poison the trust in all stats. — [data-integrity convention in tracked-activity apps] — [mechanical]
52. **Never award achievements for spending money or watching ads.** The consensus line: achievements certify user accomplishment. Purchase badges convert the whole system into marketing and cheapen every earned badge. — [gamification ethics literature] — [mechanical]

---

# B. Data Tables, Lists, and Data-Heavy Surfaces

## B1. Sorting

53. **Show which column is sorted and in which direction, always.** An arrow (or equivalent indicator) on the active column header is mandatory; users must never have to infer sort state from the data. — [Material data tables; Carbon; Polaris; NN/g table guidance] — [mechanical]
54. **Choose a meaningful default sort and state it.** Newest-first for activity/history, relevance for search, alphabetical for reference lists. An apparently random order reads as broken. Recency is the consensus default for anything time-based. — [NN/g; converged platform practice] — [mechanical]
55. **Toggle sort by tapping/clicking the column header; reverse on second tap.** This is the universal expectation on desktop tables. On mobile (where headers may not exist), expose sort as a labeled control showing the current choice (e.g., "Sort: Newest"). — [Material/Carbon/Polaris convergence; iOS/Android list conventions] — [mechanical]
56. **Sort by the underlying value, not the displayed string.** "9 kg" must sort before "10 kg"; dates sort chronologically regardless of display format; mixed-unit columns normalize first. String-sorting numbers is a classic data-table defect. — [Carbon/enterprise table guidance] — [mechanical]

## B2. Filtering

57. **Keep active filters visible as removable chips/tags with a one-tap Clear All.** Users must always see what's constraining the list and be able to undo each constraint individually. Hidden active filters are the top cause of "where did my data go" confusion. — [Baymard filtering research; Polaris/Material filter patterns] — [mechanical]
58. **Show the result count, and update it live (or preview it) as filters change.** "142 workouts" → "17 workouts" confirms the filter worked and calibrates whether to narrow further. On mobile filter sheets, the apply button shows the count ("Show 17 results"). — [Baymard; Airbnb/commerce convergence] — [mechanical]
59. **A filtered-to-zero state must say which filters caused it and offer to relax them.** "No results — try removing 'This week'" with tappable removal. A bare empty state after filtering strands the user. (Cross-ref: feedback/states agent owns empty states generally.) — [Baymard zero-results research; NN/g] — [mechanical]
60. **Filters narrow within a category (AND across categories, OR within one) unless explicitly stated otherwise.** This is the near-universal mental model (e.g., type=Push AND month=June; type=Push OR Pull within the type facet). Deviating silently produces results users can't explain. — [Baymard faceted-search research] — [mechanical]
61. **Persist a user's filter/sort context while they drill in and come back.** Opening item 5 of a filtered list and returning must land on the same filtered list at the same scroll position. Losing context on back is a canonical list defect. — [Baymard; NN/g back-button expectations] — [mechanical]
62. **Expose the few high-value filters directly; fold the long tail into a filter panel.** One or two always-visible quick filters (time range, category) plus an "All filters" sheet outperforms both extremes (everything buried, or twenty visible controls). — [Polaris/Material filter layout; Baymard] — [judgment]
63. **Distinguish search from filter and let them combine.** Search finds by name/text; filters constrain by attribute; power comes from using both at once, and the active-state display must show both. — [Baymard search+filter research] — [judgment]

## B3. Pagination, infinite scroll, and load-more

64. **Default to Load More (with lazy loading) for browse lists; it is the researched winner over both classic pagination and pure infinite scroll.** Load More keeps the footer reachable, keeps position shareable enough, and users attend to more items than under infinite scroll. — [Baymard load-more research; Smashing usability findings] — [mechanical]
65. **Reserve infinite scroll for leisure feeds; never use it for goal-driven or comparison-driven lists.** Infinite scroll breaks backtracking, item relocation, and reaching the footer; it fits Pinterest-style browsing only. — [Baymard; NN/g infinite-scroll critique] — [judgment]
66. **Reserve numbered pagination for reference/lookup contexts where users cite or jump to positions.** Directories, admin tables, and search results that users revisit by page benefit from stable page numbers; casual browse lists do not. — [Baymard; enterprise-table convention] — [judgment]
67. **Whatever the mechanism, restore scroll position on back-navigation.** Returning from a detail view must not dump the user at the top of page one. This single defect accounts for a large share of list-abandonment complaints. — [Baymard; NN/g] — [mechanical]
68. **State list position and extent where feasible ("Showing 40 of 213").** Users pace their scanning by knowing how much exists; unbounded mystery lists cause premature abandonment. — [Baymard; NN/g] — [mechanical]

## B4. List item anatomy

69. **Give every list item one primary line, supporting metadata, and one obvious tap target.** Primary identifier in the strongest type; secondary attributes (date, count, status) visually subordinate; the whole row tappable, not just the text. — [Material lists; HIG; NN/g list scannability] — [mechanical]
70. **Front-load the differentiating information in each row.** Users scan the left edge (LTR) of each row; identical prefixes ("Workout — ", "Workout — ") hide the difference. Lead with what distinguishes items. — [NN/g F-pattern/scannability research] — [mechanical]
71. **Keep row height and structure consistent within a list; truncate predictably.** Uniform rows scan fast; per-row layout surprises break the scanning rhythm. Long values truncate with ellipsis in the middle only for identifiers where the end matters (filenames), end-truncate otherwise, and the full value is available on the detail view. — [Material/HIG list specs] — [mechanical]
72. **Use meaningful visual anchors (icon, thumbnail, status dot) only when they encode information.** A decorative identical icon on every row is noise; a per-type icon or status color is a scanning accelerator. — [NN/g; Material] — [judgment]
73. **Group long lists under sticky section headers users understand (date buckets: Today, Yesterday, This Week…).** Time bucketing is the consensus grouping for history/activity lists; headers stick while their section scrolls. — [iOS/Android platform convention; Material] — [mechanical]

## B5. Sticky headers and row actions

74. **Keep table column headers visible while data scrolls (sticky header).** Data without visible column labels is unreadable past one screen. Same for the first identifying column when scrolling horizontally (frozen column). — [Carbon/Material data tables; NN/g] — [mechanical]
75. **Every swipe or hover action must have a visible, discoverable equivalent.** Swipe-to-delete and hover-revealed buttons are accelerators, not the only path; an overflow (⋯) menu or detail-screen action provides the discoverable route. — [HIG swipe-action guidance; NN/g gesture discoverability] — [mechanical]
76. **Reserve swipe actions for the one or two most frequent actions, destructive ones behind full-swipe-plus-confirm or undo.** Mail-style: short swipe reveals buttons, full swipe triggers the default; delete without undo requires confirmation. (Cross-ref: interaction agent owns undo conventions.) — [HIG; Material swipe patterns] — [mechanical]
77. **Put at most 2–3 actions per row inline; the rest in an overflow menu with consistent ordering across rows.** Rows crowded with five buttons defeat scanning; the overflow menu keeps identical order and wording everywhere. — [Polaris/Carbon row-action guidance] — [mechanical]

## B6. Density, columns, and table management

78. **Offer density options (comfortable/compact) on data-heavy desktop tables; pick one right density on mobile.** Analysts scanning hundreds of rows want compact; casual review wants comfortable. Density choice persists per user. — [Carbon/Material density guidance; Gmail precedent] — [judgment]
79. **Right-align numbers with consistent decimal places and tabular (monospaced) figures; left-align text.** Column-aligned digits are the difference between comparable numbers and a soup. Include the unit once (header) rather than on every cell when uniform. — [Carbon/Material data-table specs; practitioner consensus] — [mechanical]
80. **Let users hide/show and reorder columns on wide tables, with a sensible default set and reset option.** Nobody's twelve columns are the same; column management with persistence is standard in every mature table system. — [Carbon/Polaris/AG-Grid convergence] — [mechanical]
81. **Never let a table force the whole page to scroll horizontally; the table scrolls within its own container with visible affordance.** Page-level horizontal overflow is a defect; container-level scrolling with a shadow/fade edge cue is the convention. — [responsive-table consensus; Carbon] — [mechanical]

## B7. Mobile table strategies

82. **On phones, transform wide tables — don't shrink them.** The three legitimate strategies: (a) collapse each row into a stacked card/list item showing priority fields, (b) show priority columns with the rest in expandable detail, (c) horizontal scroll with a frozen identifier column. Squeezing 8 columns to fit 360px is never the answer. — [responsive-table consensus (Material/Carbon adaptive guidance)] — [mechanical]
83. **Choose the mobile strategy by task: card-collapse for browse/review, frozen-column scroll for genuine cross-column comparison.** If users compare values across columns (a comparison matrix), preserve columns; if they scan items, cards win. — [enterprise responsive-table practice] — [judgment]
84. **Priority fields on mobile are chosen by user need, not by column order.** The 2–3 fields shown in the collapsed view are the decision-driving ones (name, key metric, status), even if they were columns 1, 4, and 7 on desktop. — [responsive-design consensus] — [judgment]

## B8. Selection and bulk actions

85. **Selection mode announces itself: entering it shows a count and a contextual action bar; leaving it is one tap.** Checkbox column (desktop) or long-press-to-select (mobile) flips the top bar into "3 selected — Delete / Export / Cancel." The bar shows the live count. — [Material selection pattern; Gmail/Photos precedent; Polaris bulk actions] — [mechanical]
86. **Provide select-all with an explicit scope, and distinguish "all visible" from "all matching."** Gmail's "Select all 2,431 conversations matching this search" banner is the reference: selecting the visible page must not silently act on the whole dataset, and vice versa. — [Gmail precedent; Polaris] — [mechanical]
87. **Bulk destructive actions get a count-confirming dialog and, where feasible, undo.** "Delete 47 workouts?" with the number in the button. Silent bulk destruction is unrecoverable trust damage. — [platform convention; NN/g error prevention] — [mechanical]
88. **Disable (with explanation) rather than hide bulk actions that don't apply to the current selection.** Users need to learn why "Merge" is unavailable for a single-item selection; hiding it makes the feature undiscoverable. [contested: hide-vs-disable has a live debate; disabled-with-tooltip is the majority position for temporarily-inapplicable actions] — [Polaris/Carbon guidance; NN/g disabled-state discussion] — [judgment]

## B9. Dashboard composition

89. **Compose dashboards overview-first: the top answers "how am I doing?" at a glance, details follow.** The visual hierarchy of a dashboard is an inverted pyramid — key status numbers, then trends, then detail tables. Shneiderman's mantra: overview first, zoom and filter, details on demand. — [NN/g dashboard research; Shneiderman] — [judgment]
90. **Every dashboard number links to its detail (drill-down).** A stat you can't tap to see the underlying data is a dead end that forces users to hunt for the source screen. — [NN/g dashboards; enterprise-BI convention] — [mechanical]
91. **State the time period on every metric, and keep one consistent default period per dashboard.** "Volume: 12,400 kg" is meaningless without "this week"; mixing this-week and this-month tiles without labels is the most common dashboard honesty failure. — [dataviz/dashboard consensus; NN/g] — [mechanical]
92. **Limit a dashboard to the metrics that drive action; move the long tail to reports.** A wall of 20 equal tiles is a data dump, not a dashboard. If no decision or behavior changes when a number moves, it doesn't belong on the overview. — [NN/g; dashboard-design literature (Few)] — [judgment]
93. **Keep comparisons honest: shared baselines, unclipped axes for magnitude claims, same period lengths.** Truncated bar axes and mismatched comparison windows (this 6-day week vs. last full week) are the canonical ways dashboards lie. (Cross-ref: dataviz conventions; visual agent.) — [Few; dataviz consensus] — [mechanical]
94. **Design the sparse-data dashboard state deliberately.** Week one of any tracked-activity app has almost no data; tiles must degrade to useful ("2 workouts logged — trends appear after 3 weeks") rather than empty charts or fake zeros. — [empty-state consensus applied to dashboards] — [judgment]

## B10. Stats and metrics display

95. **Pair every headline metric with its comparison delta, and mark the direction's meaning.** "+12% vs. last week" with explicit good/bad encoding (color plus arrow, never color alone). A number without a reference point is trivia. — [dashboard convention; accessibility cross-ref for color] — [mechanical]
96. **Use sparklines/mini-trends beside stats where the trajectory matters more than the instant value.** Weight, volume, and recovery metrics are trend quantities; a 30-day sparkline next to the number communicates more than the number. Keep sparklines unlabeled-axis simple; full charts live in drill-down. — [Tufte sparkline convention; Whoop/Apple Health practice] — [judgment]
97. **Round displayed stats to decision-relevant precision.** "12,438.27 kg" implies false precision; "12,440 kg" reads instantly. Store precise, display rounded, expose precise in detail. — [dataviz consensus] — [mechanical]
98. **Show units and definitions on demand for computed metrics.** Any derived score (strain, readiness, estimated 1RM) needs a tap-to-learn "how is this calculated?" — undefined proprietary numbers erode trust. (Cross-ref: help domain D1.) — [Whoop/Oura convention; explainability consensus] — [mechanical]
99. **Never animate numbers so slowly that reading is delayed; count-up flourishes stay under ~1 second and respect reduced motion.** The stat exists to be read; the animation is garnish. — [motion-design consensus] — [mechanical]

---

# C. Media Handling

## C1. Photo capture and upload

100. **Always offer both camera capture and gallery pick, in one chooser.** Users split roughly evenly by context; forcing either path alone fails half of them. Use the platform's native picker (which also avoids broad photo-library permissions on iOS). — [HIG PhotosPicker guidance; Material; platform convergence] — [mechanical]
101. **Preview before commit: show the selected/captured image with confirm, retake/replace, and cancel.** Uploading instantly on selection strands users with blurry or wrong shots; the confirm step is universal in messaging, social, and profile flows. — [platform convergence (Messages/Instagram/Slack)] — [mechanical]
102. **Show determinate upload progress, and allow cancel during upload.** Percent or progress bar per file for anything beyond a trivial size; multi-file uploads show per-file plus overall status. — [Material progress guidance; NN/g progress research] — [mechanical]
103. **On upload failure, keep the local image and offer one-tap retry — never make the user re-select.** The file is still on the device; losing the user's selection on a network blip is a pure implementation defect. Queue and auto-retry when connectivity returns where feasible. — [messaging-app convergence; offline-first practice] — [mechanical]
104. **State limits (size, count, formats) before selection, and validate immediately on selection — not after upload.** "Up to 10 photos, 20 MB each, JPG/PNG/HEIC" at the picker; an oversize file errors at pick time with the actual limit in the message. — [form-validation consensus applied to files; Baymard upload research] — [mechanical]
105. **Respect and normalize EXIF orientation; never show a sideways photo.** Rotation metadata must be applied on preview, upload, and render. Sideways user photos are a canonical amateur-app defect. — [EXIF handling consensus] — [mechanical]
106. **Compress/resize client-side before upload when full resolution isn't needed, silently.** A 12 MB camera photo destined for a 200px avatar should not cost the user 12 MB of mobile data and a 30-second wait. — [mobile-performance consensus; cross-ref performance agent] — [mechanical]
107. **Strip or consciously handle sensitive metadata (GPS/EXIF location) on user-shared images, and say so.** Location baked into shared photos is a privacy leak users don't expect; major platforms strip it on share. — [platform convergence (Instagram/Twitter strip EXIF GPS); privacy consensus] — [mechanical]

## C2. Image viewing

108. **Any meaningful user-content image opens full-screen on tap.** Thumbnails of user photos (progress pics, form checks) that don't expand are dead ends. Decorative imagery is exempt. — [platform convention] — [mechanical]
109. **Full-screen viewers support pinch-zoom, double-tap-to-zoom, and pan — on web too (scroll/buttons for zoom).** Zoom is not optional for photos users inspect (form, physique, documents). — [HIG/Material image-viewer conventions; Baymard image-zoom research] — [mechanical]
110. **Dismiss full-screen viewers by swipe-down (mobile), tap-outside/X, and Esc/back — all of them.** The swipe-down-to-dismiss lightbox is the established mobile convention (Photos, Instagram); back button must close the viewer, not exit the screen behind it. — [platform convergence; Android back-stack convention] — [mechanical]
111. **In multi-image contexts, swipe horizontally between images with a position indicator ("2 / 5").** The full-screen viewer inherits the set, not just the tapped image. — [platform convergence] — [mechanical]
112. **Show progressive placeholders while images load (blur-up/dominant color/skeleton), preserving layout space.** Images popping in and shoving layout (CLS) is a defect; reserved aspect-ratio boxes with a placeholder are the norm. (Cross-ref: performance agent.) — [web-performance consensus; Medium/Instagram blur-up precedent] — [mechanical]

## C3. Cropping and avatars

113. **When a target shape exists (avatar, cover), crop at upload time with a live shape overlay.** The crop UI shows the actual mask (circle for round avatars), pinch/drag to position, and the result preview. Auto-center-cropping faces out of frame with no adjustment is a known failure. — [platform convergence (every major avatar flow)] — [mechanical]
114. **Crop non-destructively where the original persists; re-crop should be possible without re-upload.** Keep the source image so the user can re-frame later; destructive cropping of the only copy loses user data. [contested in scope: universally done for avatars/covers by storing the original; less standard for one-shot uploads] — [Google/Apple photo-editing convention] — [judgment]
115. **Provide a decent default avatar (initials or generated) and never block flows on having a photo.** Photo-less users are the majority early on; initial-based avatars (Google style) keep lists personal without nagging. Avatar upload lives in profile/settings and as an inline affordance on the empty avatar itself. — [Google/Slack initials-avatar convergence] — [mechanical]
116. **Changing an avatar takes effect everywhere immediately and offers remove-photo as well as replace.** A remove option is routinely forgotten; users must be able to return to the default state. — [settings-pattern consensus] — [mechanical]

## C4. Video playback

117. **Autoplay only muted, only where video is the content of the surface, and always with instant user override.** The converged rule across platforms and browsers: no sound without a user gesture; controls to pause/unmute one tap away; honor OS reduced-motion/data-saver by not autoplaying. — [browser autoplay policies (Chrome/Safari); HIG; NN/g video guidance] — [mechanical]
118. **Provide standard controls: play/pause, scrub with preview, volume/mute, fullscreen, and (for content videos) captions toggle and speed.** Custom players must reimplement the full expected control set or use the platform player; a video without scrubbing is broken. Keyboard: space toggles, arrows seek. — [HIG/Material video-player conventions] — [mechanical]
119. **Remember playback position on longer videos and resume there.** Instructional/long-form video that restarts from zero on every open punishes interruption, which is the mobile norm. — [YouTube/Netflix convention] — [mechanical]
120. **Captions for speech-bearing video are required, and default-on when autoplaying muted.** (Cross-ref: accessibility agent owns caption quality rules; the product-level rule is they exist and are one tap away.) — [WCAG 1.2.2; platform convergence] — [mechanical]
121. **Short looping demonstration clips (exercise form loops) run controls-light but must still be pausable.** GIF-style loops are the exception to full controls, but WCAG still requires a pause affordance for motion longer than 5 seconds. — [WCAG 2.2.2; fitness-app convention (MuscleWiki/Apple Fitness demo loops)] — [mechanical]

## C5. Audio playback

122. **Audio continues in the background and integrates with system media controls (lock screen, control center, headphone buttons).** An app whose audio dies on screen lock or that ignores the system media session breaks a hard platform expectation. — [HIG audio guidance; Android MediaSession] — [mechanical]
123. **Respect the audio-focus/ducking contract: pause for interruptions (calls), duck or pause for other apps' audio, resume sensibly.** Coexisting with the user's music is table stakes for any app that speaks or beeps during activities (workout cues over Spotify). — [platform audio-focus APIs; fitness-app convergence] — [mechanical]
124. **Give audio a persistent mini-player with scrub, ±skip (10–30s), and speed for spoken content.** Spoken-word conventions (podcasts, guided sessions): jump-back button, playback speed, and position memory. — [Apple Podcasts/Spotify convergence] — [mechanical]
125. **Never play sound on surface entry without a user gesture.** Same consensus as video: sound is opt-in per interaction. Cue sounds during an explicitly started session (rest-timer beep) are fine because the session start was the gesture. — [browser/platform autoplay policies] — [mechanical]

## C6. Galleries and carousels

126. **Avoid auto-advancing carousels; if one exists, it pauses on hover/touch/focus, is pausable explicitly, and never auto-advances on mobile.** NN/g's long-standing finding: auto-forwarding banners annoy users and reduce visibility of the very content they rotate; frame 2+ engagement collapses. WCAG 2.2.2 makes pausability a legal requirement. — [NN/g auto-forwarding research; WCAG 2.2.2] — [mechanical]
127. **Every carousel shows its position and extent (dots/counter) and offers both swipe and visible arrows/tappable edges.** Users must know there are more frames and how many; gesture-only navigation is undiscoverable on desktop, arrow-only is hostile on touch. — [NN/g carousel guidelines; Material] — [mechanical]
128. **Put the most important content in frame 1 and keep frames to roughly five or fewer.** Frame-1 gets the overwhelming share of attention; content that must be seen doesn't go in a carousel at all. — [NN/g carousel research] — [judgment]
129. **Peek the next item: partially reveal the following card/image to signal horizontal scrollability.** The cut-off-edge affordance is the consensus cue that a row scrolls; fully-contained rows look complete and don't get swiped. — [Material carousel spec; mobile-commerce convergence] — [mechanical]
130. **In grid galleries, tap opens the viewer at that item and returning restores grid position; support ordering and deletion of own uploads.** Standard gallery contract: grid ↔ viewer round-trips losslessly; user-owned media is manageable (delete with confirm/undo, reorder by drag where order matters). — [Photos-app convergence] — [mechanical]

---

# D. Help, Support, and Self-Service

## D1. Contextual help

131. **Never put information required to complete a task only in a tooltip.** Tooltips are for reminders and supplements (keyboard shortcut, field example, definition); anything essential lives in visible text. Tooltips don't exist on touch in any reliable form. — [NN/g tooltip guidelines] — [mechanical]
132. **Give unfamiliar or derived terms an inline "what's this?" affordance (info icon / tappable term) opening a short explainer.** One or two sentences in a popover, with "Learn more" linking to the fuller article. Computed scores and jargon (1RM, RPE, tonnage) all get this treatment. — [NN/g contextual help; Whoop/Oura score explainers] — [mechanical]
133. **Explain the "why" at the point of asking.** Any request for data, permissions, or unusual effort carries a one-line justification in place ("Bodyweight improves calorie estimates"). — [NN/g; permission-priming consensus] — [mechanical]
134. **Keep contextual help short, task-phrased, and dismissible; deep-link "Learn more" to the exact article section.** In-place help answers the immediate question in a breath; the link goes to the precise anchor, not the help-center home. — [NN/g help research] — [mechanical]
135. **Prefer explaining the interface to be self-evident over adding help to a confusing interface.** The consensus hierarchy: fix the design first; help is for irreducible complexity, not a patch over bad labels. If a control needs a tooltip to be understood, rename the control. — [NN/g; universal practitioner consensus] — [judgment]

## D2. Progressive education (onboarding help)

136. **Teach in the moment of need, one thing at a time; never front-load a multi-step product tour.** Long upfront tours are skipped and forgotten (NN/g finds most users skip and retain nothing). The consensus alternative: contextual first-use hints when the user first meets the feature. — [NN/g onboarding tutorials research; growth.design onboarding cases] — [mechanical]
137. **Coach marks/first-use hints appear at most one at a time, are dismissible, never repeat after dismissal, and never block input.** A hint that reappears every session or a queue of five overlays is the anti-pattern. Track shown-state per user. — [Material feature-discovery guidance; NN/g] — [mechanical]
138. **Prefer learn-by-doing over learn-by-reading: the first-run experience is a real, slightly-guided task.** Do-first onboarding (Duolingo starts with a lesson, not a manual) outperforms description; empty states double as onboarding by prompting the first real action. — [growth.design; NN/g; converged app practice] — [judgment]
139. **Make skipped education recoverable.** Anything teachable in onboarding must be reachable later (help center, "?" affordances); a skippable tour that gates unique information is a design error. — [NN/g onboarding] — [mechanical]
140. **Announce new features in context on first encounter, not with a login-blocking modal per feature.** A subtle "New" badge or one-time inline callout at the feature's location; feature-broadcast interstitials on open train dismissal reflexes. — [Material "new feature" convention; NN/g] — [judgment]

## D3. Help centers and FAQs

141. **Make help searchable, and write titles as user tasks/questions, not internal feature names.** "How do I fix a wrongly logged set?" outperforms "Set Editor." Users arrive with a problem phrased in their words; titles and search synonyms must match those words. — [NN/g help/FAQ research] — [mechanical]
142. **Structure articles for scanning: the answer's first sentence answers the question; steps are numbered with the UI's exact labels and current screenshots.** Users don't read help linearly; the inverted pyramid plus verbatim label matching ("tap **Log Workout**") is the difference between self-service success and a support ticket. — [NN/g help documentation guidelines] — [mechanical]
143. **Keep help content versioned with the product; stale screenshots and renamed buttons in help actively harm trust.** A help article showing the old UI reads as an abandoned product. Review help on every feature rename. — [support-content consensus] — [mechanical]
144. **Cluster and cross-link related answers, and show "related articles" at the article's end.** The user's real question is often adjacent to the one they clicked. — [help-center convergence (Intercom/Zendesk defaults); NN/g] — [judgment]
145. **Reserve FAQ format for genuinely asked questions, not marketing copy in question form.** FAQ pages stuffed with "Why is [Product] so great?" are a documented anti-pattern; real FAQs derive from real tickets. — [NN/g FAQ critique] — [judgment]

## D4. Contact and support flows

146. **Keep a visible, findable path to a human; never build a contact dead-end.** Self-service first is fine, but "Contact us" must be reachable from help within a couple of taps, not hidden behind an unanswerable bot loop. Bot-only support with no human escape is a top-cited trust destroyer. — [NN/g; customer-support consensus; FTC dark-pattern attention to obstruction] — [mechanical]
147. **Set response expectations at submission time ("We reply within 1 business day") and confirm receipt immediately with a reference.** The anxiety of a support request is not knowing whether it landed and when to expect an answer; confirmation plus honest ETA removes both. — [support-flow convergence; NN/g feedback-timing] — [mechanical]
148. **Pre-fill context the user shouldn't have to type: app version, device, account, and the screen they came from.** Attach diagnostics with consent. Asking users to find their version number is friction the app can delete. — [mobile-support convergence (in-app support SDK norms)] — [mechanical]
149. **Offer channel choice appropriate to urgency and let users leave and return without losing the thread.** Email/ticket for async, chat where staffed honestly (fake "live" chat that answers in days breaks expectation-setting worse than honest email). Conversation history persists in-app. — [support-channel consensus] — [judgment]
150. **Escalation from any error or failed self-service path carries its context along.** "Still stuck? Contact us" from an error screen sends the error details with the ticket instead of making the user retype the story. — [support-flow convergence] — [mechanical]

## D5. Feedback collection and rating prompts

151. **Ask for ratings/feedback only after a success moment, never during a task.** The converged timing rule: post-achievement (finished workout, hit a PR, completed a plan week), a beat after the celebration settles, never mid-flow or at app open. — [refiner.io/Chameleon timing research; Apple's SKStoreReviewController guidance; NN/g interruption cost] — [mechanical]
152. **Cap prompt frequency hard: one survey/rating ask per user per multi-week window; never re-ask soon after a dismissal; never re-ask a given question type more than every ~90 days (NPS-class).** Survey fatigue is measurable and prompt-caps are the standard countermeasure; iOS enforces 3 review prompts/year at the OS level. — [Apple review-prompt limits; NPS-tooling consensus (Retently/Refiner)] — [mechanical]
153. **A feedback prompt is dismissible in one tap, and "no" means not-now-for-a-long-time.** Dismissal is an answer; re-prompting next session is nagging. Provide a permanent opt-out for survey programs. — [platform convergence; NN/g] — [mechanical]
154. **Never gate ratings ("love it? rate 5 stars / problems? email us") — send everyone through the same door.** Filtering unhappy users away from the store review is prohibited by both app stores and reads as manipulation when discovered. Collect problem feedback in-app for everyone, and separately (unconditionally) allow store rating. — [App Store / Play Store policy; deceptive-design catalogs] — [mechanical]
155. **Keep in-app feedback low-effort and open-ended where the goal is discovery: one question, optional detail, thanks that says what happens next.** "Thanks — we read every note" with an honest statement of use beats a 12-question matrix nobody finishes. Close the loop when feedback ships ("You asked, we built"). — [feedback-etiquette consensus; product-community convergence] — [judgment]
156. **Offer an always-available feedback door (settings/help: "Send feedback"), independent of prompts.** Users with something to say now shouldn't need to wait for the app to ask. — [platform convergence] — [mechanical]

## D6. Release notes and what's-new

157. **Write release notes about user-visible value in plain language, not commit logs.** "You can now edit a logged set" beats "Bug fixes and improvements" — the latter is a documented trust-eroder when repeated forever. Group by New / Improved / Fixed. — [release-notes consensus; app-store best-practice guidance] — [mechanical]
158. **Surface significant changes in-app once, non-blocking, with deep links to the feature; keep a browsable changelog.** A dismissible "What's new" card or sheet on first launch after a major update — never a forced tour — and a settings-reachable history for the curious. — [converged practice (major apps' what's-new sheets); NN/g on modal restraint] — [judgment]
159. **When a change moves or removes something users relied on, say so proactively at the old location.** A one-time in-place signpost ("Timers moved into the workout screen") prevents the "the update broke my app" support wave. Silent removals are the top cause of post-update one-star reviews. — [change-management convergence] — [mechanical]

## D7. Error self-service

160. **Every error message states what happened, why (if known), and the user's next step — and links directly to that step.** "Couldn't sync — you're offline. Your workout is saved and will sync automatically" self-resolves; "Error 500" generates a ticket. The fix link goes to the setting/screen/article that resolves it, not to the help home. (Cross-ref: feedback/states agent owns error-message anatomy; this rule is the self-service linkage.) — [NN/g error-message guidelines] — [mechanical]
161. **If the app can perform the fix, offer it as the error's primary action.** "Storage full — Free up space" opens the cleanup tool; "Session expired — Log in" opens login and returns the user to where they were with their data intact. Telling users to do what the app could do for them is a defect. — [NN/g; platform convergence] — [mechanical]
162. **Escalate recurring or unresolvable errors to support with context attached, from the error itself.** After a retry fails repeatedly, the error surface itself grows a "Get help" path that carries the error code and diagnostics (see D4-150). Error codes shown to users must be searchable in the help center. — [support-flow consensus] — [mechanical]

---

# E. Sharing and Invites

## E1. Sharing off-platform

163. **Share through the native share sheet; don't rebuild it.** The OS share sheet (Web Share API on the web where available) reaches the user's actual apps and contacts and carries platform trust; a custom share menu exists only to add in-product destinations or where the platform API is absent, with copy-link as the universal fallback. — [Apple HIG activity views; Android Sharesheet; MDN Web Share API] — [mechanical]
164. **What gets shared is a designed artifact, previewed before it leaves.** A shared workout or achievement renders as a composed card / link preview (OG image, title, description) that makes sense with zero app context, and the user sees exactly what recipients will see before sending (canon 07 §G.56 states the same rule for AI conversations). — [Apple HIG collaboration and sharing; Open Graph convention; fitness share-card convergence (Strava/Apple Fitness)] — [mechanical]
165. **Share only what the user chose: private data never rides along.** Sharing a workout excludes bodyweight, location, notes, and anything not explicitly part of the shared artifact; strip sensitive metadata (C1-107) and default the share's scope to the minimum. — [privacy-by-default (GDPR Art. 25); Strava heatmap cautionary precedent] — [mechanical]
166. **Shared links state and honor their permissions: who can open, what they can do, how to revoke.** View-only vs edit, anyone-with-link vs invited-only, chosen at share time; a manage-shared-links surface allows revocation, and revoked links land on a graceful "no longer available" (canon 02 §5.61). — [Google Drive/Docs-class convergence; HIG collaboration] — [mechanical]
167. **"Copy link" confirms, and the link works for its audience.** Toast confirmation (canon 03 §5.33), and the copied URL shows a logged-out recipient the shared thing — a share link that dead-ends at a login wall without ever showing what was shared breaks the promise. — [canon 02 §5.57; link-sharing convergence] — [mechanical]
168. **Shares are user-initiated, one at a time; the product never posts or messages on the user's behalf without per-action review.** No default auto-posting of achievements to feeds or socials, no "share to unlock". — [deceptive-design catalogs; canon 06 §S.158] — [mechanical]
169. **Off-platform recipients land on a working web view of the shared thing first; the app offer comes second.** Content before install prompt; and when the app is installed, the link deep-links into it with correct context (canon 02 §5.58). — [universal/app links guidance; content-first landing consensus] — [mechanical]

## E2. Invites and referrals

170. **Contacts are never harvested: invites are per-person, user-triggered, and honestly attributed.** Address-book access (if any) asks with a specific stated purpose; invites go only to people the user individually picked; the message identifies the real sender and is one the sender saw — never fabricated "X wants you to join!" mail. — [canon 06 §S.158; platform policy consensus; FTC] — [mechanical]
171. **Referral rewards state the full terms at the offer: what each side gets, when, and under what conditions.** "You both get a free month when they complete a workout" — conditions up front, not discovered at redemption failure. — [FTC disclosure logic; referral-program convergence (Dropbox-class)] — [mechanical]
172. **The invitee's first experience honors the invite: the link shows who invited them and lands them in the promised context after signup — including through app install.** Deferred deep-linking or equivalent, so install → signup → the shared template, not the generic home screen. — [deferred deep-link convention; canon 02 §5.57] — [mechanical]
173. **Invite status is visible to the sender without nagging the recipient.** Pending/joined state on the sender's side; the product never auto-re-invites or reminder-spams invitees on the sender's behalf. — [referral convergence; anti-nagging (canon 06 §S.155)] — [mechanical]

# F. UGC Safety, Moderation, and Reviews

## F1. Report and block

174. **Every piece of user-generated content and every user profile carries a reachable report affordance.** In the item's overflow menu at minimum. For UGC apps this is an app-store requirement, not polish: Apple Guideline 1.2 requires content flagging, user blocking, objectionable-content filtering, agreed terms, and published contact info, with timely (24h-class) response to reports; Google Play mirrors it. — [App Store Review Guideline 1.2; Google Play UGC policy] — [mechanical]
175. **Reporting is a short structured flow: pick a reason, optional detail, immediate confirmation of receipt and what happens next.** The reporter is never exposed to the reported user, can block in the same flow, and can hide the reported content immediately. — [platform UGC convergence (Instagram/Reddit-class); App Store 1.2] — [mechanical]
176. **Block works completely and silently: two-way invisibility, immediate effect, no notification to the blocked user.** Blocking hides the blocked user's content, comments, and interactions in both directions across every surface, and a settings list shows and manages blocked users. — [platform convergence; App Store 1.2] — [mechanical]
177. **Content rules are published in plain language and linked from every composer and report flow.** Users agree to them before first post (a UGC-app requirement); rules users can't find can't be fairly enforced. — [App Store 1.2 (terms agreement); trust-and-safety consensus] — [mechanical]
178. **Moderation closes the loop on both sides: reporters learn the outcome; authors of removed content learn which rule was broken and how to appeal.** "We removed this because X — you can appeal here" beats silent disappearance, which reads as a bug and breeds repeat violations; appeals get a stated response window. — [trust-and-safety consensus (Santa Clara Principles-class); EU DSA statement-of-reasons logic] — [mechanical]

## F2. Profiles, comments, and community surfaces

179. **Public-profile contents are opt-in and previewable: each field's visibility is user-controlled, with a "view as others see it" check.** Display name is user-chosen (never forced legal name), and stats/history visibility is per-category, private by default (A6-39; canon 06 §P.126). — [platform privacy convergence; Strava privacy precedent] — [mechanical]
180. **Comments follow the converged anatomy: author + relative time + content; sort clearly labeled (newest or top); shallow threading (one reply level on mobile); author can always delete their own; report and block reachable per comment.** — [platform comment convergence; Material list anatomy] — [mechanical]
181. **Community-surfaced content is attributed and dated.** A shared template shows its creator, its recency (created/updated), and an honest usage signal where available ("used 214 times"); anonymous, dateless UGC cannot be evaluated. — [marketplace/UGC convergence; trust consensus] — [mechanical]
182. **Muting and feed control exist independent of blocking.** Hide-this, see-less-of-this, and unfollow let users shape a community surface without the social weight of blocking; blocking is for abuse, curation needs a lighter tool. — [platform convergence (mute vs block); NN/g user control and freedom] — [judgment]

## F3. Ratings and reviews display

183. **A rating summary shows the average, the total count, and the distribution — never a bare star average.** The star histogram (5→1 with counts) is the documented anatomy; 4.6 from 3 ratings and 4.6 from 3,000 are different facts, and users read distribution shape before trusting. — [Baymard user-reviews research; commerce convergence] — [mechanical]
184. **Reviews are sortable (most helpful, most recent) and filterable by star level — and negative reviews are as reachable as positive ones.** Users deliberately read 1–2 star reviews to find failure modes; suppressing or burying them is FTC-actionable deception, not just bad form. — [Baymard; FTC fake-reviews rule (16 CFR Part 465)] — [mechanical]
185. **Each displayed review carries the context that makes it evaluable: rating, date, and relevant reviewer attributes — with "verified" labels only when actually verified.** For workout templates: experience level or how long the reviewer used it, where available. — [Baymard; FTC verification honesty] — [mechanical]
186. **Rating is one tap; the written review is optional on top.** Require the stars, invite the words; forced text minimums produce junk reviews and suppress rating volume. Prompt timing follows D5 (post-success, hard-capped). — [ratings convergence; Baymard; D5-151/152] — [mechanical]
187. **Never fabricate, seed, purchase, or selectively solicit reviews — and disclose any incentivized ones on the review itself.** Fake and undisclosed-incentive reviews are banned by regulation and destroy the surface's entire value; solicitation goes to everyone (D5-154). — [FTC 16 CFR Part 465; deceptive-design catalogs] — [mechanical]

# G. Downloads and Export Delivery

188. **Exports and downloads produce descriptively named files: product, content, date.** `chad-workout-history-2026-07-22.csv`, not `export(3).csv` — the filename is the only context the file keeps once it leaves the app. — [file-delivery consensus; canon 06 §P.125] — [mechanical]
189. **Long-running exports follow the background-work contract: progress, cancel, and a completion notice that carries the file.** Kick off, let the user keep working, then "Your export is ready — Download" (canon 03 §14.103–107); short exports just deliver immediately. — [canon 03 §14; platform convergence] — [mechanical]
190. **Delivery matches the platform: a visible browser download on desktop; the share-sheet / save-to-Files route on mobile.** Mobile browsers bury silent downloads; routing the file through the share sheet lets users put it where they actually want it. In-app webviews may block downloads entirely — detect and offer "open in browser" (canon 06 §M.105). — [platform convergence; mobile-web download behavior] — [mechanical]
191. **After delivery, say where it went and what it is.** The completion state names the destination ("Saved to Files" / the browser's downloads UI) and the format/size; a silent success indistinguishable from failure generates re-taps and duplicate exports. — [canon 03 §5.33 logic; file-UX consensus] — [mechanical]

---

## Cross-references (owned by sibling agents, touched here)

- **Undo/confirmation conventions** for destructive row and bulk actions → interaction/forms agent (B5-76, B8-87).
- **Empty states** generally → feedback/states agent; here only filtered-zero (B2-59) and sparse dashboards (B9-94).
- **Error-message anatomy and tone** → feedback/states agent; here only the self-service linkage (D7).
- **Notification permission priming and trust** → performance/mobile/trust agent (A5-36).
- **Caption quality, reduced motion, color-independence** → accessibility agent (A3-23, C4-120, C6-126, B10-95).
- **Image loading performance, CLS, client-side compression budgets** → performance agent (C1-106, C2-112).
- **Chart/axis honesty and dataviz specifics** → visual/content agent (B9-93, B10-96).
- **Back-navigation and scroll restoration as a navigation contract** → navigation/flows agent (B2-61, B3-67).
- **Explaining AI/derived scores conversationally** → conversational/AI agent (B10-98, D1-132).

## Contested / no-consensus (excluded or flagged)

- **Seasonal rank resets** (leagues that demote): legitimate in explicitly competitive, opt-in contexts; manipulation elsewhere. No universal rule — flagged inside A2-16.
- **Hide vs. disable inapplicable actions**: majority position is disable-with-explanation for temporarily unavailable, hide for never-applicable, but the debate is live — flagged at B8-88.
- **Non-destructive crop for all uploads**: universal for avatars/covers; storage-cost tradeoffs make it non-universal elsewhere — flagged at C3-114.
- **Streak monetization (paid freezes/repairs)**: Duolingo profitably sells them; ethics literature splits on whether paid protection of an artificial asset is acceptable. Consensus exists only that an effort-based path must also exist (A1-3).
- **Gamified daily-goal chests / spin-wheels with disclosed odds**: some practitioners accept them with transparency; the ethics literature trends against. Only the hidden-odds/real-value case (A7-42) has consensus.
- **Infinite scroll with a footer-reveal hack**: workarounds exist but no agreed pattern; the consensus remains "don't use infinite scroll where a footer matters" (B3-65).
- **NPS itself as a metric**: heavily criticized methodologically; the timing/frequency etiquette (D5-151/152) is consensus, the instrument is not.
- **Public follower/like counts**: platform-dependent; no cross-product consensus (Instagram's own hide-likes experiments). Excluded.
