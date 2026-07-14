# P56-Z Fix Verification (dev server localhost:3600)

Date: 2026-07-13
Method: node Playwright (headless chromium) run from `C:\Users\jon17\Desktop\chadchat-p56z-build`. No MCP browser used. No server restarted. Read-only except opening/cancelling (no delete confirmed, no data created).

Accounts:
- Showcase (STRICT read-only): stellarluxedecor@gmail.com
- Test (Pro): claude-testing@example.com

Screenshots in `./fix-verification/`.

---

## Check 1 — ONE-CANONICAL LIFT VALUE  →  BLOCKED (no lift goal exists)

Discovery result: neither provided account has a lift goal (est. 1RM outcome), so the one-canonical lift value could not be exercised. Creating a goal is not authorized, so no verification was possible.

- Showcase `/goals`: **1 active goal, 0 past goals**. The single goal is a WEIGHT goal: "Drop to 195 lb" (Start 221.6 → now 208.8 → goal 195 lb, 48%). No lift/1RM goal. (screenshot: `s1-goals-list.png`)
- Test `/goals`: 1 active goal "Lose 200 lb and build a strong, muscular body" + 1 past goal "Lose 60 lb and get my life back" (archived). The active goal's detail + `/today` Primary-goal card show its only tracked outcome is **"Trend weight — Not logged / 220 lbs"** — a weight outcome, not a lift. No 1RM anywhere. Test account also has 0 logged workouts. (screenshot: `s1b-test-goals.png`)

Conclusion: cannot PASS/FAIL — no lift goal on either account to test.

---

## Check 2 — 30-DAY WINDOW RECONCILIATION  →  PASS

Showcase weight goal `c52bd2ac-f4c5-48eb-a2cf-6a1d21d0e588` ("Drop to 195 lb"). Coverage line read on all three surfaces at the matched 30-day window. The bug being verified was a one-day window shift (22 vs 23 of 30) at the same range; all three now agree.

| Surface | Coverage line (exact) | Rate / ETA (exact) |
|---|---|---|
| `/today` Weight-trend card | `Weight trend, all time: 208.8 lb (estimated). Goal 195 lb. 23 of 30 days logged.` | `208.8 lb trend weight · weighed in 205.8 lb · -12.6 lb since your first weigh-in` (no explicit lb/wk rate on the compact card) |
| `/progress/body?range=1m` | `23 of 30 days logged` | `−1.9 lb/wk` · `Goal 195 lb · 48% there · at this pace: ~Aug 26 · last 30 days` (KPI strip: −6.1 lb change, −1.9 lb/wk rate, 13.8 lb to goal · ~Aug 26) |
| `/goals/[id]` (weight goal) | `23 of 30 days logged` | `−1.9 lb/wk` · `Goal 195 lb · 48% there · at this pace: ~Aug 26 · last 30 days` |

All three: **23 of 30 days logged** — IDENTICAL N of 30. Rate/ETA identical between `/progress/body` and `/goals/[id]` (−1.9 lb/wk, ~Aug 26). Screenshots: `s2-today.png`, `s2-progress-body.png`, `s2-goal-detail.png`.

---

## Check 3 — /plans DELETE CONFIRM  →  SKIPPED (test account has no plan)

Logged in as the TEST account and opened `/plans`. Training section reads: **"No plan on file yet. Ask Chad to build your split, then save it here, or add your own."** Zero delete/trash controls present (`[aria-label="Delete plan"]` count = 0). Per instructions, did NOT create a plan and skipped the click. (screenshot: `s3-plans-list.png`)

Caveat (not a verification): the source in `chadchat-p56z-build` (`components/today/plan-list.tsx`, `RowDeletePlan`) implements the row delete as an INLINE trash→Delete/Cancel confirm, not an AlertDialog titled `Delete the training plan "..."?`. The string "Delete the training plan" does not exist in that tree. This could not be confirmed against the live UI because the test account has no plan to click, and the showcase account (which does have a plan) is strict read-only so its trash icon must not be clicked.

---

## Plan delete confirm, exercised live

Date: 2026-07-13. Server: http://localhost:3600 (chadchat dev, live tree). Account: claude-testing@example.com (Pro test). Driver: node Playwright (chadchat-p56z-build), NOT MCP browser. This supersedes the earlier "could not be confirmed" note above: the named-confirm AlertDialog is now in the live tree at components/today/plan-list.tsx (RowDeletePlan → ConfirmActionDialog) and was exercised end to end.

Steps performed:
1. Logged in, opened /plans. No active training plan existed beforehand (created nothing was displaced; no pre-existing plan was auto-archived by the create).
2. Used the "Add plan" control (PlanEditor) to create a TRAINING plan titled exactly `P56Z Confirm Check`, minimal detail, kind=Training, status=Active. Saved ("Plan saved." toast). On PlanEditor open, document.activeElement was a BUTTON (not the title input — nothing-starts-uninvited honored).
3. Clicked the row trash icon (aria-label `Delete plan: P56Z Confirm Check`). A modal AlertDialog opened.

Observed dialog text (verbatim, identical at desktop 1280px and mobile 390px touch):

```
Delete the training plan "P56Z Confirm Check"?

It leaves Today and your plans list immediately. Workouts and meals you already logged stay.

Cancel
Delete plan
```

- Title observed: `Delete the training plan "P56Z Confirm Check"?` — matches spec exactly.
- Consequence sentence: matches spec exactly.
- Buttons: `Delete plan` (destructive) and `Cancel` — present.
- On dialog open, document.activeElement was the `Cancel` BUTTON (role null, not an input/textarea) at BOTH viewports — assertion PASS (no input focused, no keyboard raised).

Screenshots (open dialog):
- fix-verification/plan-delete-confirm-desktop.png (1280px)
- fix-verification/plan-delete-confirm-mobile-390.png (390px, touch context)

4. Pressed Cancel → plan row still present (survived cancel = true).
5. Clicked trash again, pressed `Delete plan` → toast `Plan deleted.` shown; row disappeared. After reload, /plans shows zero active plan rows and NO occurrence of "P56Z Confirm Check" anywhere on the page.
6. /today residue check: no occurrence of "P56Z Confirm Check". Cleanup complete — the delete WAS the cleanup; nothing created remains.

Result: PASS. Test plan fully removed from /plans and /today; no side effects (no pre-existing plan was archived).

---

## Up next CTA at 320px, post-fix  →  FAIL (fix present but insufficient for long labels)

Date: 2026-07-13. Server: http://localhost:3600 (chadchat dev, live tree). Account: claude-testing@example.com (Pro test). Driver: node Playwright (chadchat-p56z-build), touch context, viewport 320x844. READ-ONLY.

Fix under test: the /today "Up next" panel primary CTA was made `max-w-full` with the label wrapped in a `truncate` span (previously the ~328px "Start DAY 1: UPPER (HEAVY PUSH FOCUS)" button overflowed its ~267px card).

**The served DOM does carry the fix classes.** The Up next primary CTA renders as `<a data-slot="button" ... max-w-full ...>` (computed `max-width: 100%`) with an inner `<span class="truncate">` (computed `overflow:hidden; text-overflow:ellipsis; white-space:nowrap`). Confirmed at 320 / 360 / 390.

**Live account state note:** this account has no active training plan, so the Up next verdict is currently a SLEEP action, and the live CTA label is the short `Log last night` — it never needs to truncate. For the short live label all four checks PASS (measured at 320): button width **123.2px** vs card (panel section) width **286px**; right edge 166.7 < card right 303; height **46.75px** (≥44); no horizontal page overflow (docW 320 = scrollW 320). Renders normally, not needlessly truncated, at 360 and 390 too. Screenshot: `fix-verification/upnext-320-postfix.png`.

**The real long-label path was verified by injecting the genuine label into the identical shipping button** (the training verdict's real CTA is `cta.label = "Start " + session.name`, lib/today/up-next.ts:80, and a plan session name can be `DAY 1: UPPER (HEAVY PUSH FOCUS)`). Injecting text changes only intrinsic width; the flex/CSS behavior is identical to a real training render. Result at 320 with label `Start DAY 1: UPPER (HEAVY PUSH FOCUS)`:

- Button width **329.2px** — still WIDER than the **286px** card (and wider than the 233px footer content box). Right edge **372.7px** vs card right **303px**: the button OVERFLOWS and is clipped by the card's `overflow-hidden` at x=303.
- Label span: `scrollWidth 302 == clientWidth 302`, `ellipsized: false`. The `truncate` never fires — the text is cut mid-word by the CARD edge (visible: "…HEAVY PUSH" cut off), NOT ellipsized. Screenshot: `fix-verification/upnext-320-stress-longlabel.png`.
- Height still 46.75px (≥44). No horizontal PAGE overflow — but only because the card's `overflow-hidden` clips the button, which is itself the defect.

**Root cause:** `max-w-full` (= `max-width:100%`) resolves against the button's containing block — the ActionCluster (`div.flex.flex-wrap.justify-end`, components/panels/action-cluster.tsx) and the footer row (`div.flex.flex-wrap.justify-between`). Those ancestors have `min-width: auto` (NOT `min-w-0`), so a `whitespace-nowrap`/`shrink-0` button expands them to its content width; `max-w-full` then equals that already-grown width and never constrains anything. To make the label ellipsize within the card the intermediate flex ancestors (ActionCluster div and the footer `justify-between` row) need `min-w-0`; `max-w-full` + `truncate` on the button alone is insufficient.

Verdict: **FAIL** — for the fix's target case (long "Start …" training label at 320px). Measured: button **329.2px** vs card **286px** (overflows, clipped mid-word, no ellipsis). The fix classes are live and the currently-live short-label CTA passes, but the long-label overflow the fix was meant to solve still occurs.

---

## Up next CTA at 320px, fix round 2  →  PASS

Date: 2026-07-13. Server: http://localhost:3600 (chadchat dev, live tree; NOT restarted). Account: claude-testing@example.com (Pro test). Driver: node Playwright (chadchat-p56z-build), touch context, viewport 320x844. READ-ONLY. Same method as the round-1 check above; hard-reloaded each page before measuring.

Follow-up fix under test: `min-w-0` was added down the whole flex chain so `max-w-full` + `truncate` can finally engage — the ModuleFooter controls row and its inner right-cluster (components/today/module-card.tsx), the ActionCluster div (components/panels/action-cluster.tsx), and the button itself (`min-h-11 min-w-0 max-w-full shrink`).

**New classes confirmed in the served DOM before measuring.** The Up next footer controls row now reads `flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2` (carries `min-w-0`, asserted `footerRowHasMinW0: true`). The primary CTA renders `<a data-slot="button" ... max-w-full ...>` (computed `max-width: 100%`) with an inner `<span class="truncate">` (`text-overflow: ellipsis`).

### 1. Live short-label CTA ("Log last night") — PASS at 320 / 360 / 390

Identical at all three widths: label `Log last night`, button width **123.2px**, height **46.8px** (≥44), span `scrollWidth 96 == clientWidth 96` so `ellipsized: false` (correct — it fits, so it must not truncate). Button sits fully inside its card, no horizontal page overflow (docW == scrollW at every width). At 320: button right edge **166.7** < card right **303**.

### 2. STRESS TEST at 320 — long label `Start DAY 1: UPPER (HEAVY PUSH FOCUS)` injected into the identical shipping button — PASS

| Measure | Round 1 (FAIL) | Round 2 (this check) |
|---|---|---|
| Button width | 329.2px | **233px** |
| Card (Up next section) width | 286px | **286px** |
| Button right edge vs card right | 372.7 > 303 (overflows, clipped) | **276.5 < 303 (inside the card)** |
| Label span scrollWidth vs clientWidth | 302 == 302 | **302 > 206** |
| `ellipsized` | false (cut mid-word by card edge) | **true (CSS ellipsis fires)** |
| Button height | 46.8px | **46.8px** (≥44) |
| Page overflow (docW vs scrollW) | 320 == 320 (only via card clip) | **320 == 320 (button fits, no clip needed)** |

The button no longer grows past the card: width dropped from 329.2px (wider than the 286px card) to **233px** (comfortably inside). The label span's `scrollWidth 302 > clientWidth 206`, so `truncate` now ellipsizes the text. Screenshot `fix-verification/upnext-320-stress-postfix2.png` shows the button fully within the card with a real ellipsis: label reads `Start DAY 1: UPPER (HEAV…`, not clipped at the card edge.

**Root cause from round 1 resolved:** the intermediate flex ancestors that previously had `min-width: auto` and grew to the button's content width now carry `min-w-0`, so `max-w-full` resolves against the constrained card width and `truncate` engages.

Verdict: **PASS** — long-label CTA at 320px now stays inside its card (button **233px** vs card **286px**) and the label **ellipsizes** (`scrollWidth 302 > clientWidth 206`) instead of clipping at the card edge. Live short-label CTA still renders normally at 320/360/390 (≥44px, no overflow, no needless truncation).
