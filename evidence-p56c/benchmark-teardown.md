# P56-C Benchmark Teardown: Daily Dashboard Tracker Panels

Scope: FIX-25 (Nutrition), FIX-26 (Hydration), FIX-27 (Sleep) daily "Today" dashboard cards.
Surface class studied: compact daily-dashboard tracker cards that combine status + quick log + week context.
Method: text and DOM research only via web search, help docs, product pages, app-store listings, and reviews with screenshots. No browser automation was used.
Date: 2026-07-13.

Honesty note (per project honest-evidence rule): I did not log in to any of these apps and did not capture pixel measurements. Findings describe layout, framing, and interaction from official help articles, product pages, and detailed third-party reviews. Anything I could not confirm is flagged in the "Could not capture" section at the end. Several apps (Whoop, Oura, AutoSleep) are wearable-gated and their live in-app cards are behind a device plus login, so those are documented from official docs and reviews, not first-hand screenshots.

Our fixed constraints (used to flag conflicts throughout):
1. Exactly one primary action per panel.
2. Settings live in an overflow menu, not on the card face.
3. Missing data is never rendered as a zero value.
4. No auto-focus (no keyboard or timer starting on open).
5. Both a streak strip AND a chart are present on every panel.
6. Sleep data we own is limited to: per-night DURATION + optional 1 to 5 QUALITY rating + a nightly goal. No stages, no bedtime, no heart rate.

---

## Domain 1: NUTRITION daily panel

### MacroFactor (Nutrition and Targets tile)
- Headline: a compact number block. Top row (bold) is energy consumed vs target; a second row shows macros P, F, C consumed vs target. Numbers are the hero, not a big ring.
- Visual form: horizontal BAR graphs, not a ring. Calories bar carries a fire icon; each macro (P, F, C) is its own labeled bar. A box frames the selected day's target bars.
- Framing: an explicit CONSUMED vs REMAINING toggle. You tap the words "Consumed" or "Remaining" at the bottom of the tile, or swipe left/right on the bars, to flip every number and bar between what you have eaten and what you have left. Either can be set as the default view, and overages can be opted in.
- Weekly cue: the tile shows the current day in the context of the week. You can tap individual day columns to focus a day, or deselect to see full-week totals. This is a genuine strip-plus-detail pattern inside one tile.
- ONE primary action: log food (opens the food logger). Everything else on the tile is a view toggle or a day selector.
- Settings: dashboard tiles can be toggled on/off and reordered; macro-target editing lives in the program/settings area, off the card face.

### MyFitnessPal (Today tab calories/macros card)
- Headline: "Calories" with consumed and remaining shown together at the top of the Today tab, plus a macro breakdown directly under it. Clean, large, glanceable, no scrolling to reach it.
- Visual form: calories use a progress element with the remaining number as the hero; macros are shown as three values with progress. Free users see macros as percent-of-calories; Premium can tap the macro card to cycle consumed grams, remaining grams, or percent, and can swap in a fourth "Heart Healthy" (sat fat, sodium, fiber) or "Carb Conscious" (carbs, sugar, fiber) view.
- Framing: remaining-first is the cultural default of MFP ("calories remaining = goal - food + exercise"), but consumed is shown alongside.
- Weekly cue: the card itself is day-focused; week/trend context is pushed to the separate Progress tab rather than embedded in the card.
- ONE primary action: log food (the diary and a prominent add button).
- Settings: goal and macro customization live in Goals settings, not on the card.

### Lose It! (daily Budget card)
- Headline: the "Budget" number is the hero. The home screen shows budget, calories eaten, calories remaining, and a macro breakdown, all above the fold without scrolling.
- Visual form: a bar/progress budget line with a remaining number; macros as a compact secondary row.
- Framing: BUDGET/REMAINING is the core mental model (Lose It pioneered the "daily budget" framing).
- Weekly cue: minimal on the card; week trends live in reports.
- ONE primary action: log food.
- Settings: budget and macro goals in settings.

### Cronometer (Diary top banner + Dashboard)
- Headline: an energy summary banner at the top of the Diary. Swipe the banner to reveal the macronutrient breakdown with per-macro target bars and percent-of-target labels.
- Visual form: macro TARGET BARS with percent labels; tap "Consumed" in the top corner to flip to grams remaining. Distinct from the others in that it foregrounds micronutrient completeness, not just macros.
- Framing: consumed with a one-tap flip to remaining.
- Weekly cue: a separate customizable Dashboard page (energy history, fasting history, weight change) carries the trend; the diary banner is day-only.
- ONE primary action: log food.
- Settings: nutrient targets and visibility toggles are deep in settings (every nutrient has a Visible checkbox), deliberately off the daily banner.

### Ranking: Nutrition

| Rank | App | Why it is the category best for THIS panel |
|------|-----|--------------------------------------------|
| 1 | MacroFactor | The only one that solves status + quick-log + week context inside a single tile: consumed-on-top / target-on-bottom bars, an explicit Consumed/Remaining toggle, AND an in-tile weekday strip you can tap to focus a day or expand to the week. This is the closest existing analog to our "strip AND chart, one primary action" mandate, and it keeps target editing off the card. |
| 2 | MyFitnessPal (2025 Today tab) | Best-in-class at the "everything glanceable, zero tab-hopping" job: calories remaining + macros the instant you open, with a tap-to-cycle macro card (grams consumed / grams remaining / percent). Loses to MacroFactor only because week context is exiled to a separate Progress tab rather than embedded. |
| 3 | Lose It! | Cleanest single-number mental model ("Budget") with everything above the fold and no scroll. Strong for a compact card, but the thinnest week context and macro treatment of the four. |

### Nutrition table-stakes checklist (every leader has these)
- A single hero number for energy (remaining or budget), with consumed shown alongside.
- Macro breakdown (protein, fat, carbs) visible on the same card without a tap.
- A consumed vs remaining framing, ideally togglable with a per-user default.
- Progress rendered against the day's target (bar or ring), not a bare number.
- One dominant "log food" action; the card is not itself the logger.
- Goal/target editing removed to settings, never on the card face.

---

## Domain 2: HYDRATION daily panel

### WaterMinder
- Signature metaphor: a single filling vessel graphic. As you log, the container fills with blue and the percentage rises toward the daily goal; it also shows total consumed and amount still needed.
- Quick-add: preset "cups" (defaults 8 / 14 / 17 oz) plus unlimited custom vessels sized to your real bottles. One tap on a cup logs that amount instantly (works from the app, a home-screen widget, or Apple Watch).
- Goal framing: a calculated daily goal (editable in settings) expressed as consumed, remaining, and percent simultaneously.
- Week strip: a dedicated History tab spanning today / week / month / year, listing each logged entry and size.
- Undo/edit: entries are individually visible in History; the model is add-a-drink then correct via history rather than an inline undo on the main dial (I could not confirm an on-dial swipe-to-undo).
- ONE primary action: log a drink (tap a cup). Everything else is glance or history.

### Waterllama
- Signature metaphor: a character (default llama, 128+ options) whose body fills with sloshing liquid as you approach goal. Apple Design Award 2022 finalist for Delight and Fun. The reward is watching the character fill.
- Quick-add: 40+ beverage types each with a built-in hydration ratio; you choose which drinks appear on the home screen, widget, and Watch for one-tap logging, and pick or customize glass sizes rather than being locked to presets.
- Goal framing: one daily hydration goal; logging a non-water drink credits it by its hydration ratio (a nuance most competitors lack).
- Week strip: history/stats views for trends (plus streak-style challenges).
- ONE primary action: log a sip/drink.
- Notable: notifications only fire when you have fallen behind, not on a fixed schedule (respects a "nothing nags uninvited" sensibility).

### Plant Nanny
- Signature metaphor: a virtual plant that grows and thrives the more you drink; neglect and it wilts. This is a delayed-reward / consequence metaphor rather than a fill-to-goal dial. 9.5M+ users, strong ratings.
- Quick-add: tap to pour a cup; goal is suggested from body data and activity.
- Goal framing: daily goal, but the emotional frame is the plant's health, not a percentage.
- Note: this is the "gamified companion" end of the spectrum. Great for delight, weaker for precise at-a-glance status than WaterMinder.

### Fitbit (Hydration tile, 2025 redesign)
- Tile: a Hydration tile on the Today tab showing progress to the daily water goal; add via Edit if hidden.
- 2025 redesign detail (important cautionary case): the logging screen uses preset increments (Glass 8, Bottle 16, Large bottle 24 oz) with plus/minus steppers and a custom field, and the water page moved to Day/Week/Month/Year tabs. BUT the redesign REMOVED the "Quick Add For Today" from the main page and pushed logging into a floating action button menu; reviewers explicitly called this worse for frequent loggers.
- Primary action: log water, now one layer deeper than before.

### MacroFactor (water)
- MacroFactor does NOT ship a dedicated hydration dial. Water is treated as a micronutrient inside the Nutrition Overview (tap the macro bar, view energy/macros/micros over day/week/month). It relies on food-database water content and "common foods," so it is a weak, non-visual water tracker. Included only to show that a macro app can reasonably choose NOT to build a hydration metaphor. Not a model for our panel.

### Ranking: Hydration

| Rank | App | Why it is the category best for THIS panel |
|------|-----|--------------------------------------------|
| 1 | WaterMinder | The reference implementation of the compact hydration card: one filling vessel, consumed + remaining + percent shown together, one-tap favorite cups (preset and custom), and a clean history for week context and correction. It nails "signature visual + quick-add + goal framing + week strip" with a single obvious primary action. |
| 2 | Waterllama | Best at the reward/delight axis (character fills, ADA-recognized), with the smartest quick-add model (per-beverage hydration ratios, user-chosen home-screen drinks) and behavior-respecting reminders. Slightly less precise as a pure status dial than WaterMinder. |
| 3 | Plant Nanny | Category leader for emotional stickiness via a growth/consequence metaphor and huge user base. Ranked third because the plant frame trades precise at-a-glance numeric status for narrative reward. |

### Hydration table-stakes checklist (every leader has these)
- One signature fill visual that maps directly to goal progress (vessel, character, or ring).
- Consumed + remaining + percent all readable at a glance.
- One-tap quick-add via saved/favorite vessel sizes (preset AND custom).
- A calculated, user-editable daily goal.
- A history/week view for trends and for correcting mistaken entries.
- Quick-add reachable from the card itself (Fitbit's regression proves burying it is a mistake).

---

## Domain 3: SLEEP daily panel

Critical filter: our data is duration + optional 1 to 5 quality + a nightly goal. I graded each leader's card by whether its visual stays HONEST on duration-only data (H = honest with our data, P = partial, X = depends on stages/HR/efficiency we do not have).

### Whoop (Sleep Performance card) [X for the headline, H for one component]
- Headline: a "Sleep Performance" percentage = total sleep time / dynamic sleep need. The card also carries Efficiency, Consistency, and Sleep Debt.
- Honesty for us: the composite score depends on efficiency and stages we do NOT have (X). BUT the underlying "hours vs need" component (Sleep Sufficiency: how many hours you got vs how many you needed, as a percent and as a hours-got-vs-hours-needed comparison) is pure duration and is fully honest for us (H). This "X of Y hours = Z% of your need" framing is the single most reusable idea for our duration-only card.
- Goal framing: three coach tiers (100% best self, 85% adequate, 70% get by) turn a duration goal into a motivational band rather than a hard pass/fail.

### Oura (Sleep Score ring) [X]
- Headline: a 0 to 100 Sleep Score in a ring with color bands (85+ green optimal, 70 to 84 yellow, under 70 red). Four quick metrics sit above (Total Sleep Time, Time in Bed, Efficiency, Resting HR); seven contributors sit below (Total Sleep, Efficiency, Restfulness, REM, Deep, Latency, Timing).
- Honesty for us: the SCORE is built from stages, HR, latency, and timing, so we cannot honestly reproduce the Oura ring (X). The reusable, honest pieces are: Total Sleep Time as a top glance metric, and the color-banded "how did last night rate" language applied to duration-vs-goal only.

### RISE (Sleep Debt) [H]
- Headline: a single Sleep Debt number ("you owe ~9 hours"), computed purely from duration: sum of nightly shortfalls (sleep need minus sleep obtained) over a rolling ~14 nights, last night weighted ~15%.
- Visual: one running total plus a trend, surfaced on-card and as a home-screen widget. This is entirely duration-based and therefore FULLY honest for a duration-only app (H). It is the strongest "chart" candidate that never touches stages.
- Framing: rolling-window debt deliberately lowers the stakes of any single bad night, which pairs well with a gentle-accountability product.

### Gentler Streak (Sleep) [H]
- Headline: a plain-language morning summary of duration and consistency, plus a 14-night overview showing trends in duration and consistency.
- Honesty for us: it also mentions restorative sleep and stages when available, but its CORE honest surface is the 14-night duration + consistency plot (H). Apple Design Award winner; "gold standard" native iOS look. Best model for a duration+consistency chart with a warm, non-punitive tone.

### AutoSleep (Sleep Rating rings) [P]
- Headline: a consolidated four-ring graphic (time asleep, quality, deep sleep, heart rate) with a single Sleep Rating score in the center; also a "sleep bank" balance (cumulative debt/credit).
- Honesty for us: two of the four rings (deep sleep, heart rate) require data we lack (X for those), but the "time asleep" ring against goal and a center rating score are reproducible from duration + a quality input (P). The sleep-bank/balance idea overlaps RISE's debt and is honest on duration alone.

### Apple Health (Sleep card) [H]
- Headline: a duration bar chart. Default daily view; tap W / M / 6M to switch spans; tap a column for that night's Sleep Goal vs Time Asleep. Highlights whether you met your goal and how regular your schedule was.
- Honesty for us: this is the purest duration-only model in the set (H). Duration COLUMNS against a goal line, with weekly averages and explicit goal-met highlighting, and gaps shown as gaps (missing nights are absent, not plotted as zero). This is the safest, most defensible base visual for our chart.

### Missing-night / last-night framing across leaders
- Apple Health: a missing night is simply an empty column (a gap), never a zero bar. Weekly average is computed over nights with data.
- RISE / Gentler Streak: use rolling multi-night windows so one missing night degrades gracefully; they show "no data" states rather than fabricating a zero.
- Whoop / Oura: last-night framing is "you got X of your ~Y hour need" or a score with a band label; a skipped night shows no score rather than a 0.
- Takeaway for us: last-night headline should read as duration vs goal ("6h 40m of your 8h goal"), and a missing night must render as an explicit empty/no-data state, never a 0.

### Ranking: Sleep (weighted to our duration-only constraint)

| Rank | App | Honesty | Why it is the best model for OUR duration-only panel |
|------|-----|---------|------------------------------------------------------|
| 1 | Apple Health Sleep | H | The most honest and directly copyable base: duration columns vs a goal line, tap-a-column for that night's goal-vs-actual, W/M/6M spans with weekly averages, explicit goal-met highlighting, and missing nights shown as gaps not zeros. Everything it does, we can do truthfully with duration + goal. |
| 2 | RISE (Sleep Debt) | H | The single best "insight from duration alone" idea: a rolling ~14-night debt number plus trend that needs no stages or HR, reduces single-night pressure, and gives our card a meaningful chart and a headline number beyond "last night." |
| 3 | Gentler Streak (Sleep) | H | Best tone-and-consistency model: a 14-night duration + consistency plot with warm plain-language morning summaries, award-grade native design, and a non-punitive frame that fits gentle accountability. Proves a duration + consistency chart can feel premium without stage data. |

Honorable mention: Whoop's "X of Y hours = Z% of need" sentence is the best last-night HEADLINE phrasing for duration-only data and should be borrowed even though Whoop's full score is not honest for us.

### Sleep table-stakes checklist (honest subset for duration + quality + goal)
- A last-night headline as duration vs nightly goal (hours got, hours needed, or percent of goal).
- A per-night duration chart (columns) against a visible goal line/band.
- Week context: multi-night strip AND a trend/average (7 to 14 nights).
- A running "debt" or "bank" or "consistency" insight derived only from duration.
- A quality signal surfaced when present (our 1 to 5), degrading gracefully when absent.
- Missing nights shown as explicit gaps/no-data states, never zeros.
- Color/band language for "how last night rated" applied to duration-vs-goal, not to a stage-based score.

---

## Patterns that CONFLICT with our constraints (flag before building)

1. One primary action per panel: MacroFactor, MFP, Lose It, WaterMinder, Waterllama all already converge on ONE primary action (log food / log a drink). No conflict; this is validated as the norm. The cautionary exception is Fitbit's 2025 redesign, which REMOVED quick-add from the main hydration page into a FAB menu and was criticized. Lesson: keep our single primary action visible ON the card, do not bury it.

2. Settings in overflow: leaders keep goal/target editing off the card (MacroFactor program area, Cronometer nutrient settings, WaterMinder settings, Apple Sleep schedule in settings). No conflict; matches our law. Watch item: MacroFactor and MFP put VIEW toggles (Consumed/Remaining, macro cycle) on the card face. Those are view toggles, not settings, so they are compatible with "settings in overflow." Do not confuse a view toggle with a setting.

3. Missing data never rendered as zero: Apple Health, RISE, and Gentler Streak all honor this (gaps, not zero bars; rolling windows over available nights). Whoop/Oura show "no score" rather than 0. No conflict; adopt the gap/no-data pattern directly.

4. No auto-focus on open: none of the studied cards auto-open a keyboard or start a timer on load. Hydration leaders log via tap-a-vessel or plus/minus steppers (no text focus), and nutrition cards open a separate logger only on explicit tap. This validates our no-auto-focus law. Conflict risk is only if we make the "custom amount" field the default entry point; keep custom behind the vessel/step buttons like WaterMinder and Fitbit do.

5. Strip AND chart both present: MacroFactor's in-tile weekday strip-plus-focus and Apple Health's column chart show both are achievable, but NO single studied app puts a habit-style dot STRIP and a separate trend CHART on the same compact card at once. Most pick one (MacroFactor uses a weekday bar strip that doubles as the chart; Apple uses columns only). This is a place where our mandate is more demanding than the benchmarks, so we should design the strip and chart to be visually distinct (streak-dots strip for consistency, separate bar/debt chart for magnitude) rather than collapsing them, and verify the combined density still reads cleanly at 390px.

6. Consumed vs remaining default: leaders disagree (MFP/Lose It lean remaining/budget; MacroFactor and Cronometer default nearer consumed with a toggle). Not a hard conflict, but our "one canonical value" law means we should pick one default, register it as the metric, and offer the toggle as a view, not compute both ad hoc per card.

---

## Could NOT capture (honest-evidence log)
- No first-hand in-app screenshots or pixel measurements for any app (text/DOM research only, per instructions). Layout facts come from official help docs, product pages, and reviews.
- Whoop's own "app-update sleep details page" article returned HTTP 403 and could not be fetched; Whoop sleep-card facts are reconstructed from Whoop support pages, the Whoop experience/sleep page, and third-party explainers (whoopal, gridmaster), plus the Sleep Sufficiency support content. Treat exact card layout as approximate.
- Whoop, Oura, and AutoSleep live cards are wearable- and login-gated; their card visuals are documented from docs/reviews, not observed.
- WaterMinder on-dial UNDO/edit gesture: I confirmed per-entry correction exists via the History tab but could NOT confirm an inline swipe-to-undo on the main dial. Verify in-app before copying an undo affordance.
- MacroFactor default view (Consumed vs Remaining out of the box): docs say either can be set as default and imply Consumed is first, but did not state the factory default definitively.
- Exact numeric goal-calculation formulas (hydration goal, sleep need) were out of scope and not captured beyond high-level descriptions.
- Mobbin and other paywalled design galleries were not accessed; screenshot-level teardown relied on open reviews and official help media instead.

---

## Sources
Nutrition:
- MacroFactor dashboard widgets: https://help.macrofactorapp.com/en/articles/225-understanding-the-widgets-at-the-top-of-the-dashboard
- MacroFactor consumed vs remaining: https://help.macrofactorapp.com/en/articles/42-switch-between-consumed-and-remaining-views
- MacroFactor dashboard overview: https://help.macrofactorapp.com/en/articles/22-get-to-know-your-dashboard
- MyFitnessPal new Today tab: https://support.myfitnesspal.com/hc/en-us/articles/39985611667341-Introducing-the-brand-new-Today-tab
- MyFitnessPal Today screen blog: https://blog.myfitnesspal.com/myfitnesspal-today-screen-progress-tab-update/
- Lose It review (home screen): https://www.amyfoodjournal.com/blog/lose-it-app-review
- Cronometer macronutrient breakdown (mobile): https://support.cronometer.com/hc/en-us/articles/32659895319444-Mobile-Macronutrient-Breakdown
- Cronometer iOS widgets: https://support.cronometer.com/hc/en-us/articles/4407693442324-iOS-Home-Screen-Widgets

Hydration:
- WaterMinder overview: https://funnmedia.zendesk.com/hc/en-us/articles/204071810-WaterMinder-Overview
- WaterMinder widgets: https://funnmedia.zendesk.com/hc/en-us/articles/360050083631-Adding-WaterMinder-Widgets-to-Your-Home-Screen
- WaterMinder review (MacStories): https://www.macstories.net/reviews/track-your-water-consumption-with-waterminder/
- Waterllama site: https://waterllama.com/
- Waterllama review (TechRadar): https://www.techradar.com/computing/websites-apps/waterllama
- Waterllama challenges (MakeUseOf): https://www.makeuseof.com/waterllama-ios-app-hydration-fun-challenges/
- Plant Nanny (SPARKFUL): https://sparkful.app/plant-nanny
- Plant Nanny (Wikipedia): https://en.wikipedia.org/wiki/Plant_Nanny
- Fitbit water redesign (9to5Google): https://9to5google.com/2025/04/03/fitbit-water-redesign/
- MacroFactor water: https://help.macrofactorapp.com/en/articles/195-water

Sleep:
- WHOOP Sleep support: https://support.whoop.com/s/article/WHOOP-Sleep?language=en_US
- WHOOP sleep explainer (whoopal): https://whoopal.com/whoop-sleep
- WHOOP sleep planner: https://www.whoop.com/us/en/thelocker/feature-update-whoop-app-sleep-planner/
- Oura sleep score blog: https://ouraring.com/blog/sleep-score/
- Oura sleep contributors: https://support.ouraring.com/hc/en-us/articles/360057792293-Sleep-Contributors
- RISE sleep debt: https://www.risescience.com/blog/how-much-sleep-debt-do-i-have
- RISE what is sleep debt: https://help.risescience.com/hc/en-us/articles/6047219133079-What-is-Sleep-Dept-And-how-to-track-it-with-RISE
- Gentler Streak sleep insights (9to5Mac): https://9to5mac.com/2024/10/29/gentler-streak-sleep-insights/
- AutoSleep user guide: https://autosleepapp.tantsissa.com/user-guide
- AutoSleep App Store: https://apps.apple.com/us/app/autosleep-watch-sleep-tracker/id1164801111
- Apple Health sleep history: https://support.apple.com/guide/iphone/view-your-sleep-history-iph72b370881/ios
