# P56-C side-by-side grade (rule 8)

Graded line-by-line against the ranked references in `benchmark-teardown.md` (MacroFactor / MyFitnessPal / Lose It for nutrition; WaterMinder / Waterllama / Plant Nanny for hydration; Apple Health / RISE / Gentler Streak for sleep). Reference capture caveat, recorded honestly there: the leaders are native apps behind installs/logins; the teardown is built from official help-center screenshots, product pages, and store listings, so grading is against the documented feature facts and published imagery, not same-viewport pixel captures. Our side: `harness/` PNGs (10 sweep + 4 post-fix) and `live/` (22 e2e screenshots).

Verdict scale: MATCH (indistinguishable from the reference behavior/quality), MATCH+ (exceeds it), MISS (below; blocking until fixed).

## Nutrition panel vs MacroFactor (ranked 1)

| Load-bearing reference fact | Ours | Verdict |
|---|---|---|
| Hero is a single energy number with remaining/budget framing | CalorieArc: remaining-first center ("460 kcal left"), consumed in the headline "1,840 of 2,300 kcal" | MATCH |
| Macros P/C/F on the same card, bar-per-macro vs target | Three macro rows, consumed/target text + goal bars, over flips to critical | MATCH |
| In-tile weekday strip as the week cue | Sunday-start dot strip, per-day tooltip "1,950 of 2,300 kcal", graded against THAT day's effective-dated target | MATCH+ (per-day historical targets; MacroFactor grades against current program) |
| Target editing lives off the card | Overflow > Edit daily targets (reconciling editor); never a visible peer of Log meal | MATCH |
| One primary action | Log meal, to the owned page flow (s168) | MATCH |
| Missing day is never a zero | Hollow dots; today unlogged reads "Nothing logged yet today", never 0 kcal | MATCH+ (MFP renders zeros) |

## Hydration panel vs WaterMinder (ranked 1)

| Load-bearing reference fact | Ours | Verdict |
|---|---|---|
| Signature fill vessel mapped to goal, consumed+remaining+percent visible at once | LiquidGauge (living wave fill, percent center, goal-reached pulse + check) + "44 oz to go" context column + headline "84 oz of 128 oz goal" | MATCH |
| One-tap quick add via saved vessel sizes, visible on the card | Primary Log water opens the overlay with Glass/Mug/Bottle/Big bottle/Gallon + custom; add is one tap from open | MATCH (Fitbit's buried-FAB failure avoided; the action stays on the card) |
| Undo/edit paths | Exact-entry Undo on every quick-add (6s toast); itemized delete on /hydration Today's log | MATCH+ (WaterMinder undo unconfirmed in public docs; ours is proven in e2e) |
| Week context | Dot strip graded per-day against that day's effective goal; claims-gated "Goal hit on X of Y logged days" | MATCH+ (per-day historical goals) |
| Backfill | Log a past day card, deep-linked from the panel overflow | MATCH |

## Sleep panel vs Apple Health (ranked 1) + RISE insight

| Load-bearing reference fact | Ours | Verdict |
|---|---|---|
| Duration columns vs a goal line, gaps not zeros | NightColumns: moonlit gradient capsules vs dashed goal line, hollow dashed slots for missing nights, per-night FIX-07 goals (ticks when the goal changed mid-week) | MATCH+ (per-night goals; Apple draws one line) |
| Last-night headline as duration vs goal | "7h 42m · of 8h goal · 18m short" (Whoop's X-of-Y phrasing); stale entries shown DATED, never framed as last night | MATCH |
| RISE-class duration-only insight | Weekly shortfall line ("Goal met 3 of 5 nights · 2h 10m short this week"), rendered only past the claims.ts adherence threshold | MATCH (honest, coverage-gated) |
| No fabricated scores/stages | No score, no hypnogram, no readiness; quality only brightens what was rated | MATCH (Oura/Whoop rings are unreproducible without their sensors; deliberately not imitated) |
| Missing-night logging is easy | Log last night primary when missing; date field doubles as backfill; edit for the current night | MATCH |

## Mandate exceeding the benchmark

No ranked leader shows BOTH a habit dot strip AND a chart on one compact card (teardown constraint note); our s181 law requires both. Resolution: one 7-day encoding per panel beyond the strip was removed (hydration's redundant bars row), each remaining chart is a different visual language from the dots, and the post-fix heights sit inside the DEC-07 budget, so the density stays glanceable at 390/360/320 (verified in the harness sweep).

## Overall

MATCH or MATCH+ on every load-bearing row after the fix pass; no MISS outstanding. The three panels carry distinct signature visuals (energy gauge arc / liquid vessel / moonlit night columns) with honest data in all seven designed states, which is the directive-1a bar this surface owed.
