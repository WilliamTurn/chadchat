# P56-C harness verification report (Opus agent run, persisted by the session)

Data artifacts in this folder: measurements.json, contrast-both.json, 10 sweep PNGs, 4 crops. The FIX-39 capture + diff ran to completion; screenshot:approve was NOT run.

## PASS/FAIL per task area (pre-fix run)

| Area | Result |
|---|---|
| 1a. Screenshots, 5 widths x 2 themes | PASS (10 full-page captures) |
| 1b. Horizontal overflow at 390/360/320 | PASS (scrollWidth == clientWidth on all 6; both themes) |
| 1c. Height vs min | PASS (min 208 met on all 120 measurements) |
| 1c. Height vs max | FINDINGS (Nutrition + Sleep exceeded; see below and the fix log) |
| 1d. Touch targets (390 dark, consistent persona) | PASS (all 12 targets 47px tall) |
| 1e. Contrast, both themes | FINDINGS (light-theme macro labels; future-day labels) |
| 2. FIX-39 capture + diff (run-only) | PASS: 0 changed, 0 missing, 98 new (14 today-panels = P56-C; 84 progress-overview = P56-A's page) |

## Height budget (pre-fix numbers; effective max 320 desktop, 400 phone per DEC-07)

- Hydration: peak 395px (phone), within allowance everywhere. PASS.
- Nutrition: peak 460px (1.44x); over at 1440/768 populated (+39), over phone budget at 360 (+43) and 320 (+60).
- Sleep: peak 488px (1.52x); over desktop in populated + stale; over 400 at all phone widths.

## Contrast findings (pre-fix)

1. Light-theme macro labels (Protein/Carbs/Fat as text-sky/amber/violet-400 on white): 1.72 to 2.85, below AA 4.5. Dark passes.
2. Future-day week-strip labels (text-muted-foreground/50): 2.05 light / 2.08 dark. Shared P2 chrome, deliberate de-emphasis; flagged for P56-Z, not restyled by P56-C (would repaint every strip surface).
3. Sleep "short" DeltaTag neutral (light): 4.40 vs 4.5, 2% near-miss on the shared token pairing; P56-C stopped using the chip for the shortfall (plain muted text now), token pairing flagged for P56-Z.
- Non-finding: the Water gauge "85%" white-on-white measurement is a DOM-walk artifact; the text sits on the sky liquid fill (visually confirmed clean); a drop shadow was added anyway.

## Visual-quality observations (agent's top 3, pre-fix)

1. Empty-state inconsistency across the trio (sleep carried a hollow chart, siblings did not). FIXED: all three empties now render a 48px hollow 7-slot chart + strip + one quiet action.
2. Water's mid-panel week-bars row read redundant/ambiguous beside the dot strip. FIXED: the gauge is now the hero with an honest weekly context column (remaining + claims-gated days-at-goal); the strip remains the one 7-day encoding.
3. Domain-diverse metaphors (radial ring / fill vessel / capsule columns) read intentional and premium; height overrun was the main polish gap. FIXED: arc 104 to 88, night columns 84 to 64, compact status lines.

## Post-fix session actions (P56-C)

- Macro labels switched to neutral foreground text; macro hues moved into theme-aware bar fills (600-level light / 400-level dark, the FIX-19 pattern); nutrition strip dots and sleep dots/columns got the same dual-theme treatment.
- Nutrition arc 88px; sleep columns 64px (placeholder 48px); sleep footer status compacted to one line with a dot separator.
- A follow-up re-measure run validates the height budgets and the macro-label contrast post-fix (see remeasure section appended below by the re-measure agent, if present).

## Advisory

Next dev-only diagnostic: new Date() inside LogSleepDialog without a Suspense boundary (the documented Q-3 fixture-page class; page serves 200; no member impact).

## Re-measure (post-fix)

Second Opus agent run against the same page after the session's fixes. Script: evidence-p56c/remeasure.mjs (node Playwright, no MCP). Raw data: evidence-p56c/harness/remeasure.json. Screenshots: postfix-dark-1440.png, postfix-dark-390.png, postfix-light-1440.png, postfix-light-390.png. All panels carry data-height-min 208 / data-height-max 320, so effective max = 320 at 1440 and 400 (320 x 1.25) at 320px.

### 1. Panel heights vs budget (dark)

Empty / stale / locked / loading / error states pass at both widths everywhere. The remaining overruns are all in the POPULATED data states, and only there. Improvement vs the pre-fix peaks: Nutrition 460 -> 439 at 320px (359 -> 351 at 1440); Sleep 488 -> 445 at 320px (now 319 and PASS at 1440). Populated rows (identical across sparse / consistent / overshoot personas):

| persona | panel | state | 1440 height | 1440 (max 320) | 320 height | 320 (max 400) |
|---|---|---|---|---|---|---|
| consistent | Nutrition | populated | 351 | OVER 31 | 439 | OVER 39 |
| consistent | Hydration | populated | 323 | OVER 3 | 403 | OVER 3 |
| consistent | Sleep | populated | 319 | PASS | 445 | OVER 45 |
| sparse | Nutrition | populated | 351 | OVER 31 | 439 | OVER 39 |
| sparse | Hydration | populated | 323 | OVER 3 | 403 | OVER 3 |
| sparse | Sleep | populated | 319 | PASS | 443 | OVER 43 |
| overshoot | Nutrition | populated | 351 | OVER 31 | 439 | OVER 39 |
| overshoot | Hydration | populated | 323 | OVER 3 | 403 | OVER 3 |
| overshoot | Sleep | populated | 319 | PASS | 424 | OVER 24 |
| lapsed | Sleep | stale | 319 | PASS | 401 | OVER 1 |

All non-populated states (first-run empty 278/326, lapsed empty 278/305 and 305/326, locked 230/278, loading 230/244, error 208/208) are within budget at both widths. Peaks post-fix: Nutrition 439 (320px), Sleep 445 (320px, consistent), Hydration 403 (320px). Verdict: heights dropped materially and Sleep now clears the desktop budget, but the three populated panels still exceed budget at 320px (Nutrition +39, Sleep up to +45, Hydration +3) and Nutrition/Hydration remain marginally over at 1440 (+31 / +3). Sleep stale is +1 at 320px only.

### 2. Light-theme contrast spot-check (1440, light, consistent section)

Canvas-resolved sRGB (lab/oklab/oklch/color-mix collapsed to painted bytes). All requested targets clear AA 4.5:

| element | text | fg on bg | ratio | verdict |
|---|---|---|---|---|
| Macro label | Protein | rgb(6,6,6) on white | 20.26 | PASS |
| Macro label | Carbs | rgb(6,6,6) on white | 20.26 | PASS |
| Macro label | Fat | rgb(6,6,6) on white | 20.26 | PASS |
| Macro value | 145 / 190 g | rgb(108,108,108) on white | 5.25 | PASS |
| Macro value | 214 g | rgb(108,108,108) on white | 5.25 | PASS |
| Macro value | 59 g | rgb(108,108,108) on white | 5.25 | PASS |
| Sleep footer status | Goal met 0 of 4 nights ... 1h 50m short this week | rgb(108,108,108) on white | 5.25 | PASS |
| Hydration to-go | 20 oz to go | rgb(6,6,6) on white | 20.26 | PASS |
| Headline context (Nutrition) | of 2,300 kcal | rgb(108,108,108) on white | 5.25 | PASS |
| Headline context (Hydration) | of 128 oz goal | rgb(108,108,108) on white | 5.25 | PASS |
| Headline context (Sleep) | of 8h goal ... 50m short | rgb(108,108,108) on white | 5.25 | PASS |

The macro labels are now plain foreground text (fix confirmed: 20.26, was 1.72 to 2.85 as colored 400-level text pre-fix). Two previously-documented non-targets still read low in the same section and are unchanged: future-day week-strip labels Th/Fr/Sa at text-muted-foreground/50 = 2.05 (shared P2 chrome, flagged for P56-Z), and the Hydration gauge "85%" measuring 1.0 (the white-on-white DOM-walk artifact; the text sits on the sky liquid fill, drop-shadow present). Neither is in the spot-check set.

### 3. Horizontal overflow (dark)

| width | scrollWidth | clientWidth | verdict |
|---|---|---|---|
| 390 | 390 | 390 | PASS |
| 360 | 360 | 360 | PASS |
| 320 | 320 | 320 | PASS |

scrollWidth <= clientWidth at all three phone widths. No horizontal overflow.

### 4. Screenshots

postfix-dark-1440.png, postfix-dark-390.png, postfix-light-1440.png, postfix-light-390.png (all full-page). Visual sanity check at 390 dark: all three populated panels render clean with strip + chart, no clipping or overflow.
