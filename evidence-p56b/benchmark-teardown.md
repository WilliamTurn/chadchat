# Benchmark Teardown: Progress > Training Analytics + Rewards Surface

Session P56-B, task FIX-33. Rule-8 benchmark teardown for the Chad "Progress > Training" page (workout frequency/completion, plan adherence, volume trend, strength/est-1RM trends, PR timeline, milestone timeline, plus PR/milestone celebration reward visuals).

Owner bar for this wave: state-of-the-art, award-grade visuals. "Bar graphs everywhere" is an explicit failure state. The PR-timeline and celebration sections are the wave's signature reward surface and carry the most weight below.

This document is research and reference only. No app code was written or read for it. All screenshots referenced live in `./references/` and are listed in the Manifest at the end.

---

## 0. Method and honesty note

- Category leaders were researched via web search plus direct fetch/screenshot of PUBLIC marketing pages and help-center articles. No accounts were logged into.
- Screenshots were captured with Playwright at 1440px width, lazy images force-loaded by scripted scroll before capture, then copied into `./references/`.
- What is genuinely login-walled or has no public product screenshot is recorded honestly in Section 8. In-app analytics detail views (per-exercise Charts/Records tabs in Hevy and Strong, the Fitbod Results screen, Garmin Connect web dashboards, Apple's Awards grid) sit behind an account or a device, so those are documented from official help text plus the marketing mockups that were captured, not from live authenticated captures.

---

## 1. The leaders, one line each

| App | What it is best at for our purposes |
| --- | --- |
| Hevy | The closest single analog to what we are building. Per-exercise stats, the richest PR taxonomy in the category, live PR reward moment, consistency calendar + streaks. |
| Strong | Clean per-exercise About/History/Charts/Records model; est-1RM progression as the hero strength chart. |
| TrainingPeaks (PMC) | The category's gold standard for a single dense longitudinal chart (Fitness/Fatigue/Form). The anti-bar-graph reference. |
| Strava | Best PR + achievement + trophy-case reward system; gold-dot PR marker on the effort chart; Fitness & Freshness for the mass market. |
| Fitbod | Strength as a normalized 0 to 100+ score per muscle, muscle-recovery body heatmap, benchmark-lift 1RM charts. |
| WHOOP (Strength Trainer) | Muscular load as a single training-load number; strain-style domain-diverse gauge instead of bars. |
| Garmin Connect | Training Status labels, VO2max trend, Training Load and Load Focus breakdown, running PR table, badge challenges. |
| Apple Fitness | Activity rings (the most recognizable non-bar progress visual on earth), Awards grid, monthly challenges, retroactive/honest award calculation. |
| Oura | Crowns for score >= 85, triple-crown celebration, community reactions. Lightweight honest milestone pattern. |
| Peloton | Milestone badges (1/10/25/50/75/100), streak badges, trophy cabinet, live shoutout + high-five celebration, Club tiers Bronze to Legend. |

---

## 2. RANKED leaders per surface

### (a) Overall training-analytics dashboard

1. **Hevy (Statistics + per-exercise stats).** Ranked first because it is the same product shape we are building (a strength-training log with an analytics layer) and it solves the whole surface, not one card. It shows a body heatmap of muscles trained in the last 7 days, set-count-per-muscle-group, muscle distribution, most-logged-exercises, training frequency, and a consistency calendar with streaks, and then lets you drill into any single exercise for its own charts and records. Range control is a first-class, consistent selector (30 days / 3 months / year / all time). Why best-in-class: one coherent system of views, each drillable, with a single global range control rather than per-card chrome.
2. **TrainingPeaks (dashboard built around the PMC).** Ranked second for a different reason: it proves that a serious analytics dashboard can lead with ONE information-dense longitudinal chart (see surface c/strength discussion) rather than a wall of small bars. The dashboard is configurable (add/remove charts), and the PMC is the anchor tile everything else supports.
3. **Garmin Connect.** Ranked third for breadth of interconnected views done tastefully: Training Status label + VO2max trend graph + Training Load chart + Load Focus breakdown + historical status changes, all cross-linked. Good model for "a status headline backed by the chart that justifies it."

Takeaway for us: a dashboard is a system of drillable views under one global range control, anchored by at least one dense longitudinal chart, not a grid of isolated bar cards.

### (b) Strength / est-1RM trend presentation

1. **Strong.** Tap an exercise title to open four tabs: About, History, Charts, Records. The Charts tab's hero is the estimated-1RM progression line over time (est-1RM computed from working sets via the Brzycki formula, updated automatically). This is the single most useful strength-development metric and Strong makes it the headline. Why best-in-class: one clear line chart of the one metric that matters, per exercise, with a paired Records tab.
2. **Fitbod.** Two complementary ideas. First, mStrength: a normalized Muscle Strength score per muscle group on a 0 to 100+ scale where 50 is an average Fitbod user, recomputed weekly, plus an aggregate Overall Strength Score. Second, the Results screen charts your estimated 1RM over time for benchmark lifts (squat, bench, deadlift, overhead press). Why notable: normalization turns raw kilos into a comparable, motivating index, and it curates to the few lifts that define foundational strength instead of charting everything.
3. **Hevy.** Per-exercise estimated-1RM chart trending over time, plus a "Best 1RM" record card. Solid and standard; ranked third only because Strong's dedicated Charts/Records split is slightly cleaner and Fitbod's normalized score is more novel.

Takeaway for us: the strength hero is an est-1RM line per exercise over time (not bars). A normalized strength index (Fitbod-style) and a small curated set of benchmark lifts are strong differentiators worth considering. State the estimator (for example Epley or Brzycki) so the number is trustworthy.

### (c) Volume / frequency presentation

1. **Hevy.** Best mix of forms: set-count-per-muscle-group as a horizontal breakdown, a last-7-days body heatmap for where volume landed, session-volume as a record, and a consistency CALENDAR plus streak for frequency. Frequency is shown as a calendar heatmap, not a bar chart, which is the more rewarding and legible form.
2. **TrainingPeaks / Strava (load over time).** For "how much am I doing and is it trending up," the impulse-response Fitness curve (CTL in TrainingPeaks, Fitness score in Strava) is the best longitudinal answer: a smooth filled area that rises stepwise as you train and decays when you stop. This reframes "volume/frequency" as a single trend line the user reads at a glance.
3. **Strong.** Profile shows a "Workout for the Week" volume bar chart and tracks best session volume. This is the honest baseline (weekly volume as bars). We should treat pure weekly-volume bars as the FLOOR to beat, not the target.

Takeaway for us: frequency should be a calendar heatmap + streak, not a bar chart. Volume can be a filled area/line trend (rewarding) with per-muscle breakdown for detail. Weekly-volume bars alone are the failure state the owner warned about.

### (d) PR / records presentation (grouping per exercise + link to source workout)

1. **Hevy.** The category's most complete PR system and the single most important reference for us. Records are grouped PER EXERCISE and the record type depends on the exercise MODALITY (see the full taxonomy in Section 3). Crucially: "You can tap on any record to see the workout where it occurred." The History tab lists every workout that contains the exercise with dates and the sets/reps/weights done, and tapping a session opens the full completed workout. So the record card is a link into the source session, and the exercise page is effectively a per-exercise PR timeline. Why best-in-class: complete modality-aware taxonomy + record-to-source tap-through + per-exercise history in one place.
2. **Strong.** The Records tab per exercise shows the estimated-1RM record, weight record, and max-volume record, and you can view the HISTORY of a record to see its progression over time, with a predicted-1RM table below. Why notable: it treats a record as a series (record progression), not just a current-best number.
3. **Strava.** Different domain (segments/distance) but the best PR-on-a-chart pattern: on a segment's effort chart your PR is a GOLD DOT, and it surfaces your 1st to 3rd best efforts alongside the effort you are viewing. PR medals are awarded automatically the moment you beat a prior best. Why notable: a PR is rendered as a marker on the trend, tying the record directly to the point in time it happened, and PRs are private and unaffected by privacy settings.

Takeaway for us: records are grouped per exercise, typed by modality, each record card taps through to the exact source workout, and a record is ideally shown as a marker on the trend line plus a progression history, not a lone number. This is the crown-jewel interaction to match or exceed.

### (e) Milestone / achievement timelines and celebration moments

1. **Strava (Trophy Case + PR medals).** Best overall reward system. The Trophy Case is a dedicated page of 3D geometric finisher badges, each labeled with challenge name + month + a stat (for example distance), ordered by completion date, with the four most recent surfaced on the profile and a "View More / All trophies" affordance to the full set; tapping a badge opens the challenge detail. PR medals (gold) and place trophies (2nd to 10th) are awarded automatically for real performances. Why best-in-class: a real trophy-case page, honest triggers, recency-surfaced with a path to the full history, and tap-through to detail.
2. **Peloton (milestones + live celebration).** Best emotional celebration. Milestone badges at 1/10/25/50/75/100 classes per discipline (then every 50), daily and weekly streak badges, monthly challenges, and special-event badges, all stored in a "trophy cabinet" on the Achievements tab. The celebration is social and loud: instructor shoutouts and a burst of high-fives from other members when you hit a milestone. Club Peloton layers points and tiers Bronze to Legend. Badge art was refreshed to be brighter and multi-color. Why notable: milestone thresholds + streak rewards + a genuine in-the-moment celebration.
3. **Apple Fitness (Awards + rings) and Oura (crowns), tied for the honest-celebration pattern.** Apple: an Awards grid of collectible 3D metallic badges (Move goal every day of a week, a new personal Move Record, 2x/3x/4x days, monthly challenges, and "All Rings Closed" streak awards) that Apple calculates RETROACTIVELY from real history so long-time users are credited honestly and never asked to start from scratch. Oura: a crown icon appears next to Readiness/Sleep/Activity only when the score is 85 or higher, and the community "triple crown" is the celebrated milestone. Why notable: both are strictly earned (honest), and Apple's retroactive calculation is the model for crediting a user's real past.

Takeaway for us: ship a real milestone timeline / trophy case (dedicated surface, recent-first with a link to the full history, each item tapping through to its source), award only real earned achievements, credit the user's real past retroactively, and give PRs and milestones a genuine in-the-moment celebration that respects reduced motion.

---

## 3. The Hevy PR taxonomy (load-bearing detail for our metrics contract)

Captured verbatim from the Hevy help-center article (reference 09). The record type available depends on the exercise modality. This is the model to encode in `lib/contracts/metrics.ts` so every PR shown is a registered metric.

| Exercise modality | Example | Personal records available |
| --- | --- | --- |
| Weight & reps | Bench press, bent-over row | Heaviest Weight; Best 1RM (estimated); Best Set Volume; Best Session Volume |
| Assisted | Assisted pull-up, assisted dip | Best total reps; Most reps (set) |
| Bodyweight reps | Push-ups, pull-ups | Best set; Most session reps |
| Weighted bodyweight | Weighted pull-ups, weighted dips | Heaviest weight; Best Set Volume |
| Duration | Plank, yoga, wall sit | Best Time (longest) |
| Weighted duration | Weighted plank, weighted wall sit | Heaviest weight; Best Time |
| Distance & duration | Running, biking | Longest Distance; Longest Time |

Definitions worth copying:
- **Best 1RM**: highest estimated one-rep-max ever achieved, estimated from a set's reps and weight.
- **Best Set Volume**: the single set with the most weight x reps.
- **Best Session Volume**: the session with the most total volume across all sets of that exercise.
- **Most Session Reps**: most reps completed in a single workout.

Two more Hevy mechanics we should match:
- **Live PR**: the moment a set is marked complete and beats a prior best, a PR banner appears in-workout; the PR is saved to the workout summary; the user can revisit the workout later and see which PRs it contained.
- **Ranges**: 30 days / 3 months / year / all time, with the longer ranges gated to Pro. (Gating is a monetization choice, not a design requirement; noted for parity awareness.)

---

## 4. Per-leader deep dive (form, interaction, why it wins)

### Hevy
- **Shows**: muscle heatmap (last 7 days), set-count-per-muscle-group breakdown, muscle distribution, most-logged exercises, training frequency, consistency calendar + streak, per-exercise est-1RM chart, per-exercise records, per-exercise history.
- **Visual forms**: anatomical body heatmap; horizontal category breakdowns; line chart for est-1RM; calendar heatmap for consistency; record cards; a live in-workout PR banner.
- **Interaction**: global range selector; tap exercise to open its stats; tap a record to jump to the source workout; History lists every session with that exercise and each opens the full workout.
- **Why best-in-class**: it is the whole surface done coherently, with the record-to-source tap-through and modality-aware PR taxonomy that nobody else matches.

### Strong
- **Shows**: per-exercise About / History / Charts / Records; est-1RM progression; volume progression; records (est-1RM, weight, max volume) with record-history progression and a predicted-1RM table; profile weekly-volume bar chart.
- **Visual forms**: line charts (est-1RM, volume); records-as-series; weekly bars on profile.
- **Interaction**: tap exercise title to reach the four tabs; open a record to view its progression over time.
- **Why it wins**: cleanest mental model (four tabs), and it treats a record as a progression series rather than a static number.

### TrainingPeaks (PMC)
- **Shows**: Fitness (CTL, a 42-day exponentially-weighted average of daily Training Stress Score), Fatigue (ATL, ~7-day), and Form (TSB = CTL minus ATL).
- **Visual form**: one dense longitudinal chart. CTL is a filled area (fitness), ATL a line (fatigue), TSB a second line (form), with daily TSS as scatter dots underneath, annotated. See reference 03.
- **Interaction**: configurable dashboard chart; positive TSB reads as "fresh," negative as "fatigued/at risk."
- **Why it wins**: it is the definitive proof that a single, information-rich, multi-series time-series beats a wall of bars. This is the exact aesthetic the owner is pointing at with "not all bar graphs." Our volume/adherence/readiness story can borrow this fitness-vs-fatigue framing.

### Strava
- **Shows**: PR medals (gold), place trophies (2nd to 10th all-time), KOM/QOM/CR, Local Legend, Fitness & Freshness (fitness/fatigue/form for the mass market via Relative Effort / TRIMP), Trophy Case of challenge finisher badges.
- **Visual forms**: 3D geometric finisher badges; gold-dot PR marker on the segment effort chart; staircase Fitness ramp; medal iconography.
- **Interaction**: automatic awarding on real performances; Trophy Case page with recency on profile and a link to all; tap a badge for challenge detail; effort chart surfaces your 1st to 3rd best efforts around the one you are viewing.
- **Why it wins**: the most complete honest reward system, and the gold-dot-on-the-trend pattern is the ideal way to render a PR as a moment in time.

### Fitbod
- **Shows**: mStrength per muscle (0 to 100+, 50 = average user, weekly recompute), Overall Strength Score, muscle-recovery heatmap (0 to 100% per muscle on a body map), Results screen with benchmark-lift est-1RM charts (squat, bench, deadlift, overhead press).
- **Visual forms**: normalized score tiles; anatomical recovery heatmap; benchmark-lift line charts.
- **Why it matters to us**: normalization (a comparable index instead of raw kilos) and curation to a few benchmark lifts are both strong differentiators, and the recovery heatmap is a domain-diverse visual that is not a bar chart.
- **Capture note**: the marketing article captured (reference 07) is text-heavy; the Results-screen charts are described from official text, not shown in a clean product shot.

### WHOOP (Strength Trainer)
- **Shows**: muscular load as a single number (strain-style scale), computed from volume (effective mass) x intensity (speed, proximity to failure).
- **Ways to log**: automatic estimate by activity type/duration; link exercises after the workout for a better estimate; real-time set/rep/weight logging for the most precise value.
- **Why it matters**: collapses a whole session into one honest training-load number on a gauge, a domain-diverse alternative to volume bars. WHOOP markets itself as the first wearable to measure muscular load.

### Garmin Connect
- **Shows**: Training Status label (for example Productive, Maintaining, Peaking, Recovery, Unproductive, Overreaching, Detraining), VO2max trend graph, Training Load chart, Load Focus breakdown (anaerobic / high-aerobic / low-aerobic), historical status changes, running PRs (5k/10k/half/marathon/furthest) on web, badge challenges.
- **Why it matters**: the "status headline justified by the chart beneath it" pattern, and Load Focus as a stacked breakdown that tells you what KIND of training you have been doing, not just how much.

### Apple Fitness
- **Shows**: Move / Exercise / Stand rings (concentric, close daily); Awards grid of 3D metallic badges (weekly perfect Move, new Move Record, 2x/3x/4x, monthly challenges, All Rings Closed streak awards).
- **Visual forms**: the concentric ring (see reference 06) is the most recognizable non-bar progress visual anywhere; collectible spinning 3D badges.
- **Honesty model**: awards are calculated RETROACTIVELY from real history, so users are credited for their genuine past and never fake-started.

### Oura
- **Shows**: crown next to Readiness/Sleep/Activity only when the score is 85+; Circles community with crown/fire reactions; the "triple crown" as the celebrated milestone.
- **Why it matters**: a strictly-earned, low-cost, honest micro-celebration attached directly to a real threshold.

### Peloton
- **Shows**: milestone badges (1/10/25/50/75/100 per discipline, then every 50), daily and weekly streak badges, monthly challenges, special-event badges, all in an Achievements trophy cabinet; Club Peloton points/tiers Bronze to Legend.
- **Celebration**: instructor shoutouts and a burst of member high-fives at the milestone moment; refreshed brighter multi-color badge art.
- **Why it matters**: the reference for milestone thresholds + streak rewards + a genuine emotional in-the-moment celebration.

---

## 5. Celebration and reward visual patterns (the signature surface)

### What triggers a celebration in the leaders
- **PR beaten** (Hevy live PR banner; Strava gold PR medal): fires the instant a set/effort beats a prior registered best.
- **Milestone threshold** (Peloton class counts; Apple weekly/streak awards; Strava challenge finish): fires when a counted total crosses a defined threshold (1/10/25/50/100, a full week, an N-day streak).
- **Score threshold** (Oura crown at 85+; Apple 2x/3x/4x goal): fires when a real score/goal ratio is met.
- **Streak continuation** (Apple, Peloton, Hevy streaks): a running count that is itself the reward; visible even before a milestone.

### Forms used (all non-bar, domain-diverse)
- In-workout PR banner (Hevy).
- Gold marker/dot on the trend chart (Strava PR on the effort chart).
- Collectible 3D badge in a grid/trophy case (Strava, Apple, Peloton, Garmin).
- Crown/fire micro-icon next to the number (Oura).
- Concentric ring fill and ring-close moment (Apple).
- Social burst (high-fives, shoutout) at the milestone moment (Peloton).

### Honesty (only real achievements) — matches our owner laws
- Every leader awards strictly on real performance. Strava PRs are computed from actual efforts; Peloton badges from actual class counts; Oura crowns from actual scores; Apple awards from actual ring history.
- Apple's RETROACTIVE calculation is the standard to copy: when we introduce PRs/milestones we should backfill the user's genuine history so their real past is credited, never fabricated and never zeroed.
- This aligns with our "one canonical value law" (every displayed number is a registered metric computed in one module) and "never undercut the app" (frame outputs as calculated results). A celebration must be backed by a registered metric crossing a registered threshold; no decorative confetti for a non-event.

### Reduced motion and accessibility (shipping requirement under our accessibility law)
- Gate all celebratory motion behind `window.matchMedia('(prefers-reduced-motion: reduce)').matches`. Note the well-documented gotcha: canvas-confetti and similar libraries do NOT auto-respect reduced motion (see catdad/canvas-confetti issue 114); you must check the query yourself and skip or replace the animation.
- Provide a STATIC equivalent when motion is reduced: the same badge/banner/gold marker appears without particles or spin, so the achievement is still communicated.
- Respect WCAG 2.2.2 (Pause, Stop, Hide) for anything moving/flashing; keep celebrations short and self-dismissing, and never obscure content or controls behind them.
- Avoid rapid flashing (seizure risk); keep particle color transitions gentle.
- Announce the achievement to assistive tech as text (an aria-live region), so a screen-reader user gets "New PR: Bench Press, 102.5 kg" even with visuals suppressed.
- This dovetails with our owner reward-glow direction (tokenized glow/flourish for streak strips, PRs, emerald accents) and the Unicorn Studio candidacy for reward flourishes: any such flourish must still pass the reduced-motion gate and the honesty gate.

---

## 6. "What we must match or exceed" checklist (gradeable, line by line)

Grade each row Pass / Fail against the shipped Progress > Training page. Any Fail on a MUST is a shipping blocker.

### Dashboard shell
1. MUST: one global range control (for example 30d / 3m / 1y / all) that drives every view, not per-card range chrome. (Benchmark: Hevy.)
2. MUST: at least one dense longitudinal chart as an anchor (fitness/volume/adherence trend), not a grid of isolated bars. (Benchmark: TrainingPeaks PMC.)
3. MUST: every card is a real visual (chart, heatmap, calendar, ring, gauge), zero blank/dot-only panels. (Owner law + Hevy.)
4. SHOULD: a status headline backed by the chart that justifies it (for example "Volume trending up" over the volume trend). (Benchmark: Garmin.)

### Frequency / completion / adherence
5. MUST: frequency shown as a calendar heatmap + streak, not a frequency bar chart. (Benchmark: Hevy, Apple, Peloton.)
6. MUST: plan adherence shown as completion against plan (ring or progress form), not raw counts alone. (Benchmark: Apple rings.)
7. SHOULD: streak strip present and never removed (owner law), paired with a chart in the same panel.

### Volume
8. MUST: volume trend shown as a filled area/line over time (rewarding, legible), with a per-muscle breakdown available for detail. (Benchmark: TrainingPeaks fitness curve + Hevy per-muscle.)
9. MUST NOT: weekly-volume bars as the ONLY volume visual. (Explicit owner failure state; Strong bars are the floor to beat.)

### Strength / est-1RM
10. MUST: per-exercise estimated-1RM line chart over time as the strength hero. (Benchmark: Strong.)
11. MUST: the 1RM estimator is stated/trustworthy (name the formula, for example Epley/Brzycki) and computed in one module (canonical-value law). (Benchmark: Strong/Brzycki.)
12. SHOULD: a normalized strength index and/or a curated benchmark-lift set (squat/bench/deadlift/OHP) rather than charting every movement flat. (Benchmark: Fitbod.)
13. COULD: a muscle-recovery or muscle-emphasis body heatmap as a domain-diverse visual. (Benchmark: Fitbod, Hevy.)

### PR / records (crown-jewel)
14. MUST: records grouped PER EXERCISE. (Benchmark: Hevy, Strong.)
15. MUST: record TYPE is modality-aware (weight&reps vs bodyweight vs duration vs distance) per the Section 3 taxonomy; each PR shown is a registered metric. (Benchmark: Hevy.)
16. MUST: every record card taps through to the exact source workout where it was set. (Benchmark: Hevy. This is the single most important interaction.)
17. MUST: a per-exercise PR timeline/history exists (every session with that exercise, dated), and a record is ideally rendered as a marker on the trend, not only a lone number. (Benchmark: Strava gold dot + Strong record progression.)
18. SHOULD: PRs are computed from real logged sets only, backfilled from genuine history (no fabricated records). (Owner honesty laws + Apple retroactive model.)

### Milestone / achievement + celebration (signature)
19. MUST: a dedicated milestone timeline / trophy case surface (a real page, not a popup), recent-first on the dashboard with a link to the full history. (Benchmark: Strava Trophy Case; our no-core-features-in-popups law.)
20. MUST: milestones and PRs trigger a genuine in-the-moment celebration (banner, gold marker, badge reveal, or glow). (Benchmark: Hevy live PR, Peloton, Strava.)
21. MUST: all celebratory motion is gated behind prefers-reduced-motion with a static equivalent, respects WCAG 2.2.2, and announces the achievement via aria-live. (Accessibility law + confetti gotcha.)
22. MUST: only real earned achievements celebrate; each celebration maps to a registered metric crossing a registered threshold. (Owner honesty laws.)
23. SHOULD: badge/milestone art is on-brand, tokenized (reward glow), and diverse across domains (not one badge shape reused). (Benchmark: Peloton refreshed badges; owner reward-glow + diverse-visuals direction.)
24. COULD: retroactive backfill so a user's real past PRs/milestones are credited on first view. (Benchmark: Apple.)

### Cross-cutting (our standing laws)
25. MUST: AA contrast both themes, 44px touch targets, mobile-first verified at 390px, full-width desktop layout (no narrow centered column).
26. MUST: every displayed number is a registered metric computed in one module (no per-card math).
27. MUST: labels instantly self-explanatory (for example "Estimated 1-Rep Max," not "e1RM" unlabeled).

---

## 7. Screenshot manifest

All files in `./references/`. Captured 2026-07-13 at 1440px width via Playwright, lazy images force-loaded before capture.

| File | Source URL | What it shows |
| --- | --- | --- |
| 01-hevy-gym-performance-full.png | https://www.hevyapp.com/features/gym-performance/ | Hevy gym performance overview: last-7-days body heatmap, per-muscle set-count charts, muscle distribution, main exercises, individual exercise performance data, and set records. The closest full analog to our page. |
| 02-hevy-live-pr-full.png | https://www.hevyapp.com/features/live-pr/ | Hevy Live PR: in-workout PR banner the moment a set beats a prior best, PR saved to the workout summary, and the wider feature list (Year in Review, Muscle Distribution Chart, Progress Photos, consistency calendar). The celebration-trigger reference. |
| 03-trainingpeaks-pmc-chart.png | https://help.trainingpeaks.com/hc/en-us/articles/204071874-Performance-Management-Chart-PMC | The annotated Performance Management Chart: CTL (Fitness, filled area), ATL (Fatigue, line), TSB (Form, line), daily TSS dots. The definitive "dense longitudinal chart beats bars" reference. |
| 04-strava-trophy-case.png | https://support.strava.com/hc/en-us/articles/216918557-The-Strava-Trophy-Case | Strava Trophy Case: 3D geometric finisher badges with name + month + stat, on a profile tab, plus the mobile profile trophy row with an "All trophies" link. The milestone/trophy-case + tap-to-detail reference. |
| 05-peloton-milestones.png | https://www.onepeloton.com/blog/milestones | Peloton milestone celebration ethos: milestones/badges explained, member shoutouts and celebration stories. Marketing-heavy (member photos), not the badge-cabinet UI; used for the celebration ethos, backed by search facts. |
| 06-apple-activity-rings-hero.png | https://www.apple.com/watch/close-your-rings/ | Apple Move/Exercise/Stand concentric activity rings hero. The most recognizable non-bar progress visual; reference for rings and honest/retroactive awards. Viewport shot only (page is background-video/animation heavy). |
| 07-fitbod-strength-progress.png | https://fitbod.me/blog/how-fitbod-tracks-your-strength-progress-with-real-time-metrics-and-scores/ | Fitbod strength-tracking article: mStrength 0 to 100+ scoring, Results screen benchmark-lift 1RM charts, muscle recovery. Text-heavy capture; Results-screen charts described from text, not shown in a clean product shot. |
| 08-strong-homepage.png | https://www.strong.app/ | Strong positioning + profile dashboard with a weekly-volume bar chart and the workout logger; "Visualize your progress with Strong PRO: best sets, max 1RM, body fat." Reference for the four-tab exercise model and the volume-bars floor. |
| 09-hevy-pr-records-explained.png | https://help.hevyapp.com/hc/en-us/articles/35649367857175-Personal-Records-PRs-and-Set-Records-Explained-How-They-Work-in-the-Hevy-App | Hevy PR help article: the full modality-aware PR taxonomy table (Section 3) and how the set-records table works, including that a record taps through to its source workout. The crown-jewel PR reference. |

---

## 8. Recorded honestly: what could not be captured

- **In-app authenticated analytics detail views** (Hevy and Strong per-exercise Charts/Records tabs, Fitbod Results screen, Garmin Connect web Training Status/VO2max/Load Focus dashboards, Apple Fitness Awards grid, Oura crowns UI, Peloton Achievements trophy cabinet) sit behind an account or an Apple/Garmin/Oura device. No logins were performed (per instructions). These are documented from official help text plus the public marketing mockups captured above.
- **Apple close-your-rings page** is background-video/animation driven (0 standard image tags, ~14700px tall). A single clean viewport of the rings hero was captured (reference 06); a full-page capture would be mostly mid-animation and was not taken.
- **Peloton badge-cabinet UI**: the official blog captured (reference 05) is marketing/member-photo heavy and does not show the actual badge-grid UI. Badge specifics (thresholds, streak badges, trophy cabinet, live shoutout/high-five) are documented from search of Peloton support and PeloBuddy, not from a captured product screenshot.
- **Fitbod Results-screen charts**: the captured article (reference 07) is text-dominant; the benchmark-lift 1RM charts and recovery heatmap are described from official Fitbod text, not shown in a clean captured product shot.
- **Strava gold-dot PR marker on the segment effort chart** is described from Strava support text; it was not captured as a live authenticated screenshot (segment effort views are per-account).

---

## 9. Sources

Hevy: https://www.hevyapp.com/features/gym-performance/ , https://www.hevyapp.com/features/live-pr/ , https://help.hevyapp.com/hc/en-us/articles/35649367857175-Personal-Records-PRs-and-Set-Records-Explained-How-They-Work-in-the-Hevy-App , https://help.hevyapp.com/hc/en-us/articles/35382889578135 , https://www.hevyapp.com/features/exercise-performance/
Strong: https://www.strong.app/ , https://help.strongapp.io/article/133-1rm
TrainingPeaks: https://help.trainingpeaks.com/hc/en-us/articles/204071874-Performance-Management-Chart-PMC , https://www.trainingpeaks.com/learn/articles/what-is-the-performance-management-chart/ , https://www.trainingpeaks.com/coach-blog/a-coachs-guide-to-atl-ctl-tsb/
Strava: https://support.strava.com/hc/en-us/articles/216918557-The-Strava-Trophy-Case , https://support.strava.com/hc/en-us/articles/216918477-Fitness-Freshness , https://communityhub.strava.com/insider-journal-9/getting-started-with-strava-achievements-1534
Fitbod: https://fitbod.me/blog/how-fitbod-tracks-your-strength-progress-with-real-time-metrics-and-scores/ , https://fitbod.me/blog/muscle-strength/ , https://fitbod.me/blog/estimated-strength/ , https://fitbod.zendesk.com/hc/en-us/articles/360006269014-Muscle-Recovery
WHOOP: https://www.whoop.com/us/en/thelocker/introducing-strength-trainer-a-new-way-to-quantify-the-impact-of-your-strength-training/ , https://www.whoop.com/us/en/thelocker/how-whoop-measures-muscular-load/
Garmin: https://support.garmin.com/en-US/?faq=VxKazDQ2mkAmDoQbJriEBA , https://www8.garmin.com/manuals-apac/webhelp/fenix7series/EN-SG/GUID-6F726699-0535-4A66-8F51-84A31CE81CD5-8601.html
Apple: https://www.apple.com/watch/close-your-rings/ , https://support.apple.com/guide/iphone/see-your-activity-summary-iph4c34a8a95/ios , https://www.apple.com/newsroom/2025/04/get-active-with-apple-watch/
Oura: https://ouraring.com/blog/introducing-oura-circles/ , https://support.ouraring.com/hc/en-us/articles/360046061373-Oura-Reports
Peloton: https://www.onepeloton.com/blog/milestones , https://www.onepeloton.com/blog/what-is-club-peloton , https://www.pelobuddy.com/list-peloton-badges/
Reduced motion / celebration a11y: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion , https://github.com/catdad/canvas-confetti/issues/114 , https://www.w3.org/WAI/WCAG21/Understanding/pause-stop-hide.html
