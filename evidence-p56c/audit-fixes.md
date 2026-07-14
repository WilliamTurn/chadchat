# P56-C audit findings and fixes

Two audit gates ran after the build + e2e + harness verification: mobile-experience-auditor (Opus) and the pre-delivery product audit (Opus, the pre-delivery-auditor charter run via a general-purpose agent because the named agent type did not resolve in this session's registry). Every P1/P2 was fixed in-session; a targeted Opus re-verify run confirms the fixes live (evidence-p56c/audit/refix/).

## Mobile-experience audit (verdict SHIP-WITH-FIXES: 0 P1, 2 P2, 4 P3)

| Finding | Fix |
|---|---|
| [P2] "CALORIE TRACKER" title truncates at every phone width (header link crowds the primary label) | Opt-in `wrapTitle` threaded ModuleHeader -> PanelFrame -> role components (additive, no other surface changes); the panel's detail link renamed "Nutrition details" -> "Food diary" (names its true destination, the /nutrition daily diary); the panel's own name now wraps instead of ellipsizing |
| [P2] LiquidGauge percent label white-on-fill 2.18 (fails AA large-text 3.0) | Dark ink on the light liquid (the WaterMinder pattern): sky-950 label + "Goal hit" check once the label sits on the fill; >= 5:1 on the sky fill in both themes |
| [P3] Sleep quality stars 38px wide | min-w-11 at phone widths (44px) |
| [P3] Custom-amount placeholder clipped | Shortened to "Up to 128 oz" |
| [P3] Undo toast anchors top, out of thumb reach | NOT changed here: the Toaster position is page-level chrome and the /today toast polish (bottom-anchor decision) is P56-D's owned item; filed in the cross-session log |
| [P3] /sleep page empty-state scaffolding thinner than /hydration (no stat tiles) | Out of the FIX-27 panel packet (page scaffolding parity); filed in the cross-session log for MTL |

## Pre-delivery audit (verdict DO-NOT-SHIP: 0 P1, 4 P2, then fixed)

| Finding | Fix |
|---|---|
| [P2] Single-night /sleep History row jammed into a 3-column grid inside the sparse centered column (every member's FIRST log) | SleepHistory grid moved to container queries (@container; 1 col in the centered column, 2/3 columns only when the CONTAINER is wide) |
| [P2] Dead "#history" detail links in the first-run empty state (target sections returned null) | WaterHistory and SleepHistory now render DESIGNED EMPTY sections (the anchor always exists); the /sleep panel link label is "Night history" on-page (names its real target; "Sleep trends" stays the default for dashboard mounts) |
| [P2] /hydration dead band: History spanned full width while everything above sat in the centered sparse column | History joins the page's centered column whenever the sparse layout is active (sections share one alignment) |
| [P2] Water past-day entries had no edit/delete (sibling gap vs sleep; logger capability law) | WaterHistory day rows now EXPAND to their individual entries, each with a named-confirmation Delete (removeWaterEntry, receipt-driven refresh); correction path = delete wrong entry + backfill right amount. History days and sleep history nights now also grade against THAT day's FIX-07 effective-dated goal |
| [P3] First-run panels hide the footer, so goal editing is unreachable before the first log | Consistent designed-empty behavior across all three panels (one quiet action); filed in the cross-session log as a designed-state question for P56-Z/owner |
| [P3] Panel "No water logged yet" beside 30-day stats reads contradictory | Week-scoped wording: "No water logged this week." / "No meals logged this week." (sleep keeps "yet": its empty state genuinely means never logged) |

## Still-open flags carried to the cross-session log

- Populated panel heights exceed the soft DEC-07 budget (Nutrition +31 desktop / +39 at 320; Sleep +45 at 320 only; Hydration cleared after the gauge resize). The budget predates the P5/P6 full anatomy (signature visual + strip + status insight); raising the quick-log max vs trimming anatomy is a decision-log item, not a silent call.
- Future-day week-strip labels at /50 opacity fail AA (shared P2 chrome; repainting it would churn every strip surface undeclared).
- Neutral DeltaTag token pairing measures 4.40 on light (2% under AA); P56-C stopped using it for the sleep shortfall.
- Toast anchor position (P56-D's /today toast polish item) and /sleep page scaffolding parity (stat tiles / streaks like /hydration).
