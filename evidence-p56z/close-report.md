# P56-Z wave-close report (Phase 5 + Phase 6, DSH-66)

| Field | Value |
|---|---|
| Closer | P56-Z, 2026-07-14 (s190) |
| Wave state at open | A/B/C/D/E completion lines verified against commits `dfd635a` `87a5ed3` `73e1a55` `37cfbcc` `496d50e` `d4276d1` `b9713ac` `0f1ee38` (+ docs `c9755bb`); zero modified tracked files; co-mingled shared-file blocks all swept as declared |
| Verdict | GATE-05 PASSED with fresh evidence; Today acceptance slice PASSED (ACC-01/02/09/11 + ACC-04/05); every review-battery P1/P2 fixed same-session and re-verified live; owner-deferred design items recorded, not gated |

## 1. What the close verified (fresh, dated, independent)

- GATE-05: `gate05-evidence.md` + gate05/ (Opus, node Playwright, prod :3601 build `c9755bb`, dual-cookie harness correct, zero console errors). Body preservation exact; nine sections; canonical + source-linked training; authenticated redirects.
- Today slice: `today-slice-evidence.md` + today-slice/ (ACC-01/02/09/11 with measurements).
- Perf: `perf/perf-baseline-p56z.md`: /today first-load JS 519.8 KB gz / 30 files (budget 350, still open as FIX-41/GATE-06; improved from P34-Z 542.8 and P56-D 540.7); LCP 520/576 ms; CLS 0.00/0.00.
- FIX-39: full 490-image capture diffed against the frozen baseline: 126 new + 192 changed, EVERY one matching the sessions' declarations (one benign non-change: E's declared overlays-quicklog/light-390 did not materialize); single reviewed re-approval run; post-fix re-capture diffed again before commit (see §3). CI linux-baseline dispatch owed: `gh` unavailable on this machine, flagged in the handoff.
- Prod dedup evidence: the owner-run `evidence-p56b/dedup-demo-prod.md` cited per the coordinator's ruling; no prod queries re-run.

## 2. Review battery and same-session fixes

| Finding | Source | Severity | Fix | Re-verification |
|---|---|---|---|---|
| /goals + /goals/[id] computed lift e1rm over RAW history while /today + /progress went canonical; alias-spelled goal refs matched nothing on the canonical surfaces | Adversarial review (`adversarial-review.md`) | P1 | Both goal pages onto `canonicalizeWorkouts` + `resolveExerciseIdentity`-resolved refs; `buildGoalVM` resolves its e1rm `metricRef` through the member's ResolveOptions (threaded from /today's assembler and /progress) | New regression test `tests/unit/goal-outcome-values.test.ts` (2 tests; alias ref folds and grades); 290/290 suite green |
| "Last 30 days" window shifted one day on the /today and /goals/[id] weight-chart embeds (UTC fallback vs member-local anchor): 22 vs 23 of 30, ETA Aug 23 vs Aug 26 | Pre-delivery audit (`pre-delivery-audit.md`) | P1 | Member-local `todayMs` threaded into both embeds (the owning page already passed it) | Live: all three surfaces read identical "23 of 30 days logged", same rate/ETA (`fix-verification.md`) |
| /plans Delete plan was a bare inline Delete/Cancel: no named object, no consequence | Pre-delivery audit | P2 | `RowDeletePlan` onto `ConfirmActionDialog` (names the exact plan, consequence line, Delete plan/Cancel) | Exercised live end-to-end incl. create-confirm-cancel-delete-cleanup; focus lands on Cancel, no keyboard (`fix-verification.md`) |
| Up next primary CTA clipped off-card at 320px (silent mid-word cut) | Mobile audit (`mobile-audit.md`) | P2 | TWO rounds, honestly recorded: round 1 (`max-w-full` + truncate span on the button) FAILED live verification because the intermediate flex ancestors' `min-width:auto` grew to fit the button; round 2 added `min-w-0`/`max-w-full` down the ModuleFooter-to-ActionCluster chain and `shrink` on the button | Round-2 stress test at 320: button 233px inside the 286px card, ellipsis genuinely fires, 46.8px height, no page overflow; short labels unaffected at 320/360/390 (`fix-verification.md`) |
| `training.exercise.e1rm` + `nutrition.calories.today` registry derivation notes stale/incomplete; status-strip source comment misattributed | Adversarial review | P2 | Derivation notes updated (canonicalized-input contract; honest rewiring status naming /nutrition as the last inline-reduce reader, queued) | Registry tests green |

Surfaced to the OWNER, deliberately not fixed at close (flag-don't-settle): future-day week-strip label contrast (2.06/2.01:1; inactive-exemption argument + recommendation in the inventory §3); light-theme emerald reward text (2.47:1, tension with the reward-glow order; token decision); red-on-positive training accent; DEC-10 heights. Queued to MTL: MOB-sweep sub-44 heights (range controls 34px on /progress/training + /hydration + /sleep; secondary actions 34-38px; app-wide dialog X 34px), /nutrition inline-reduce rewire, panel-demos.tsx `daysAgoOf` Math.round bucketing (dev-only), `lib/ai/app-guide.ts` stale Progress wording (owner-authorized rewording needed), meal-plan title em-dash class (generator-taught via `lib/validation/meal-plan.ts` example; COPY-1), `QuitDateCard` dead export, B's P3s (volume y-axis floor tick, history 200-slice month groups, strength-index owner decision).

## 3. Excellence-standards pass for the close-time code changes

The five build sessions filed their own checklists. For the closer's own changes (goals canonicalization, window anchors, plan-delete dialog, CTA truncation):
- Mobile-first gate: verified via the Opus mobile audit (390/360/320 both themes) + dedicated 320px post-fix check with touch context; no uninvited focus (dialog focus lands on Cancel); 44px maintained on the new dialog buttons (140x47 measured).
- Pre-delivery auditor: ran (Opus) on the wave surfaces; all P1/P2 fixed, not noted.
- Playwright: all browser work delegated to Opus agents; the main session drove none.
- Contract laws: one-canonical-value restored where broken (that WAS the fix); no per-card math added; every displayed number untouched otherwise; destructive confirm now names its object; no em-dashes; plain direct copy in the new dialog.
- Nothing starts uninvited: dialog opens only on tap; no autofocus (asserted).
- Surgical scope: every changed line traces to a filed P1/P2; pre-existing dead code (QuitDateCard) noted, not deleted.

## 4. Subagent-output hygiene (owner ruling 5)

Every subagent report this close was treated as data. No agent returned instruction-shaped output; nothing was discarded or re-run for hygiene reasons. (P56-C's discarded misfire remains recorded in its own evidence.)

## 5. SEC-3 standing note

`decideExerciseAlias` remains dormant with zero callers (auditor-verified in-wave); the ownership-scoping fix is still owed BEFORE any member-facing alias-decision wiring. Recorded in the FIX-33 tracker row and MTL.
