# P56 Wave — Pre-Delivery Cross-Session Seam Audit

Auditor: Pre-Delivery Product Auditor (Opus). Target: dev http://localhost:3600, Pro test account (claude-testing@example.com, shown as "Marcus / Elite"). Date: 2026-07-13 (data), audited 2026-07-14 UTC.
Method: drove the real running app (Playwright MCP), desktop 1440 + mobile 390. Read-only on product. All test mutations reverted (water entry added then deleted; plan-delete opened then cancelled). Evidence in `evidence-p56z/pre-delivery/`.

Scope: /today, /progress, /progress/body, /progress/training, /plans, /account/appearance + siblings /hydration, /sleep, /nutrition, /workouts, /goals. Focus: cross-session seams (one-canonical-value, cross-surface refresh, relocations, navigation coherence).

---

## VERDICT: SHIP-WITH-FIXES — 1 P1, 1 P2 (must fix before owner review)

The wave is fundamentally sound: cross-surface propagation is flawless, relocations lost nothing, mobile passes, empty states are honest, and canonical values for water/sleep/goal/training all reconcile. Two defects must be fixed first: one flagship-law violation (weight-trend metric computes differently on different surfaces) and one sub-standard destructive confirm on /plans.

---

## FINDINGS (most severe first)

### [P1] Weight-trend metric renders DIFFERENT numbers on different surfaces (One Canonical Value law, s185)
- **Surfaces:** `/today` Weight-trend card + `/goals/{id}` detail  vs  `/progress` Body card + `/progress/body`.
- **Repro:** Load each and read the weight-trend caption/derived stats.
- **What happens (same metric, both explicitly labeled "last 30 days"):**
  - `/today` weight card: "**22 of 30 days logged**".
  - `/goals/c52bd2ac…` detail widget: "last 30 days … **22 of 30 days logged** … **5.9 lb** down over the last month … at this pace: **~Aug 23**".
  - `/progress` Body card: "**23 of 30 days logged**".
  - `/progress/body`: "last 30 days … **23 of 30 days logged** … **6.1 lb** down over the last month … at this pace: **~Aug 26**".
  - So three correlated stats diverge across surfaces: days-logged (22 vs 23), month delta (5.9 vs 6.1 lb), and goal ETA (**Aug 23 vs Aug 26, a 3-day gap**). The hero value (208.8 lb trend / 205.8 weigh-in / 195 goal / 48% / 13.8 to go) IS consistent everywhere — only the derived 30-day stats diverge, which points to two different "last-30-days" window computations (one includes today Jul 13, one ends Jul 12).
- **Why it's P1:** directly violates the wave's flagship OWNER LAW s185 ("every displayed number = a registered metric computed in one module; no per-card math"). A user who taps from /progress to /goals sees the same goal projected to two different finish dates. This is exactly the cross-session seam this audit exists to catch — two sessions each rendered the weight widget from a slightly different window.
- **Pro-app standard:** MyFitnessPal/MacroFactor compute a goal projection once and show the identical date/pace on every surface.
- **Evidence:** `goal-detail-weight-widget.png`, `progress-body-full.png`, `today-desktop-full.png`.

### [P2] /plans "Delete plan" confirmation is below the destructive law and inconsistent with siblings
- **Surface:** `/plans`, "Your training" card, trash icon → "Delete plan".
- **Repro:** Click the trash icon on the training plan.
- **What happens:** the icon collapses to a bare inline "**Delete / Cancel**" pair — no named object, no consequence text, no Undo — for deleting the member's ENTIRE current training plan. By contrast the hydration entry delete (`/hydration`) opens a proper confirm: "**Delete the 9:50 PM entry of 8 oz? Today's total updates immediately.**" So the lower-stakes action (one water entry) has the stronger, named confirmation and the higher-stakes action (whole plan) has the weaker one.
- **Why it's P2:** destructive-confirm-or-undo law (s185) requires the named object + consequence OR an immediate Undo. Bare "Delete/Cancel" provides neither; it's also an internal inconsistency a pro app would never ship.
- **Fix:** name the plan and its consequence in the confirm (e.g. "Delete '4-Day Upper/Lower Strength & Shred'? This removes your current training plan."), or offer Undo — matching the hydration pattern.
- **Evidence:** `plans-delete-state.png`.

### [P3] Desktop dead space on /plans and /account/appearance
- Both pages cluster their content in the top-left and leave a large empty right/bottom void on a 1440 canvas (two cards on /plans; one figure-picker card on /account/appearance). Content-dependent (few plans, small customizer), but a pro app would balance the layout (wider cards / centered composition / supporting panel). Evidence: `plans-desktop-full.png`, `account-appearance-full.png`.

### [P3] /progress "Records and milestones" count labels don't agree
- Header reads "**52 record sets in the last 30 days · 110 all time**" but the expander button says "**Show all 55**". 55 matches neither 52 nor 110 (likely a distinct-exercise count). Ambiguous per labels-always-instantly-clear. Evidence: `progress-training-page-full.png`.

### [Note — owner-aware, not re-filed] Brand-red on positive training data
- Training achievement data is rendered in brand red across `/progress` (weekly session bars) and `/progress/training` (consistency dots, volume trend line, muscle-focus bars). Red universally reads as risk/error, yet here it marks sessions done / PRs / volume. This is precisely the "red = brand vs red = risk" semantic collision the P56-D benchmark teardown itself pre-flagged to the owner as "must resolve," and it overlaps the deferred heatmap color-ramp review. Flagging that it remains unresolved; not a new defect. NB: the 4/4/4/4 uniform bar heights are CORRECT (full-week session counts for a consistent 4x/week athlete; 13 of them fall in the trailing-30-day window) — verified, not a rendering bug.

---

## VERIFIED GOOD (no-flaw proof / coverage)

**Cross-surface refresh (add AND delete) — flawless, no manual reload:**
- Logged 8 oz water via `/today` quick-log dialog → toast "Added 8 oz" WITH Undo → status strip ("8 oz of 128 oz · 6%"), water panel ("120 oz to go", Mon Jul 13: 8 oz), consistency panel ("1 of 7 / 1-day streak"), and the bottom Recovery card ALL updated live.
- Verified same 8 oz on `/hydration`; deleted it there → `/hydration` reset AND `/today` status strip/consistency/recovery all reset to empty.

**One-canonical-value holds for:**
- Water: 8 oz / 128 oz / 6% / 120 oz to go — identical on /today strip, /today panel, /hydration.
- Sleep: 8h 12m last logged Jul 6 / 117% (goal 7h) on /today strip, /today panel, /sleep; 7h 29m 14-night avg on /progress + /sleep.
- Goal/body hero: 208.8 lb trend, 205.8 weigh-in, 195 goal, 48%, 13.8 to go, start 221.6 — consistent on /today, /progress, /goals, /goals detail, /progress/body.
- Training: 13 sessions/30d (matches /progress ↔ /progress/training), 32 workouts + 18 to 50th milestone, bench 268 est-1RM (matches /progress milestones), muscle-focus sets sum to 589.

**Destructive law (hydration):** confirm dialog names object + consequence. **Backfill:** /hydration "Log a past day" present.

**Relocations intact:** `/account/appearance` = full customizer (Current preview + Male/Female silhouettes + Upload your own + back link). `/plans` = add plan / edit / delete / View all + Meal-plan card.

**Navigation:** deep links resolve, no dead ends — /plans/{id} (plan detail) and /goals/{id} (goal detail) both render with content + breadcrumb. (Minor: those breadcrumbs point to "Dashboard"/today rather than the originating list; browser-back works.)

**Mobile /today @390px:** no horizontal overflow (scrollW == clientW == 380), no auto-focused input on load, water quick-log dialog does NOT auto-focus an input (no uninvited keyboard), bottom tab nav present, single-column layout clean.

**Empty states honest:** missing rendered as "Not logged yet" / "No meals logged this week", never fake zeros.

**Side-by-side grade (rendered result):**
- `/today` vs P56-D references (WHOOP / MacroFactor / Oura / Duolingo): **MATCH.** Compact dateline header (MacroFactor), value-over-target status cells, Oura-style "Up next" with inline WHY + dual CTA, Duolingo/Hevy 7-day consistency strip. Slightly BELOW WHOOP only on hero-number glanceability (denser 4-domain cells vs WHOOP's 72pt single scores) — a reasonable density tradeoff.
- `/progress/training` vs P56-B references (Hevy / Strong / Fitbod): **MATCH+.** est-1RM strength records, muscle-focus set distribution, plan-adherence ring, volume trend, PR/milestone feed — all Hevy/Strong table-stakes present or exceeded. Only reservation is the red-on-positive-data palette (owner-flagged, above).

## Coverage list
Pages visited/driven: /today (desktop + 390 mobile), /hydration, /progress, /progress/training, /progress/body, /goals, /goals/{id}, /plans, /plans/{id}, /account/appearance, /sleep.
Flows completed: water log (add → verify 4 surfaces → delete → verify reset on 2 surfaces); hydration entry delete (confirm dialog); plan delete (opened confirm, cancelled); mobile water dialog open (keyboard check); deep-link resolution (plan + goal detail).
Controls exercised: Log water, serving quick-add, entry Delete + confirm, Delete plan + Cancel, range/nav links, mobile bottom nav dialog.
Not re-filed (owner-deferred/known): WeekBars dashed-empty treatment, raw unicorn embed on /progress/training, heatmap color ramp, quick-log panel heights (DEC-10), 34px dialog close X, FIX-41 JS budget.
