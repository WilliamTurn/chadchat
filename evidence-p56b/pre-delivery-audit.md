# Pre-Delivery Audit — P56-B / FIX-33 "Training analytics and rewards"

**VERDICT: SHIP (conditional)** — no P1 blockers. Two P2 findings touch explicit owner laws and
should be fixed before merge; both are small and localized. Correctness, data-state honesty,
server/client boundary, security (no write path), and the benchmark bar are all met. Browser pass
found **zero console/page errors on the training and workouts surfaces**, working `?pr` drill-down
with Back-to-close, working record→source links, and fully designed empty/locked states.

Auditor: Opus stand-in for the registered pre-delivery-auditor type (P34-E precedent). Read-only;
nothing was written to the app or DB. Evidence: code review of all shipped files + siblings; live
Playwright pass (Pro test account) over `/dev/fixtures/training` (6 personas), `/progress/training`,
`/workouts`, `/workouts/history`, `/workouts/exercises/[slug]`; light + dark; 1440px + 390px.

---

## P1 — blockers
None.

## P2 — fix before ship

- **P2-1 · "Workouts logged" is an unregistered number that can diverge across two surfaces
  (one-canonical-value law).** `/progress/training` shows `data.totalSessions` (uncapped header
  count) as "Workouts logged" (`components/progress/training/training-analytics-view.tsx` StatTile;
  `lib/workouts/training-data.ts:218` `totalSessions: headers.length`), while `/workouts` shows
  `workouts.length` under the *same label* (`app/workouts/page.tsx:231`), and that array is capped at
  `MAX_WORKOUTS = 200` (`app/workouts/data.ts:31`). They agree today (test account = 6) but diverge
  for any member past 200 workouts — exactly the DSH-26/DSH-62 class the registry exists to prevent.
  There is **no total-sessions metric registered** in `lib/contracts/metrics.ts` (only
  `training.sessions.thisWeek`). Fix: register a `training.sessions.total` metric computed in one
  module and have both cards read it (or drop the cap-affected count on `/workouts`).

- **P2-2 · Sub-44px touch targets on CTA buttons at 390px (44px-target owner law).** At phone width
  the celebration hero's "View the workout" link renders 34px tall and the empty-state / secondary
  "Start a workout" buttons render 36–40px (`size="sm"` / default `Button`, no `min-h` override).
  Files: `components/progress/training/rewards-timeline.tsx` (CelebrationHero "View the workout");
  `components/progress/training/training-analytics-view.tsx` (`StartWorkoutButton`, bottom action row).
  The builder clearly knew the rule — timeline rows and record-source links use `min-h-11`, and the
  range control uses `pointer-coarse:min-h-11` — so this is a localized miss. Borderline (buttons are
  wide and tappable) but below the owner's explicit 44px bar.

## P3 — notes (count: 8)

1. Dark-theme muted-foreground on the adherence empty-state card measured ~4.42:1 at 15px (AA normal
   text wants 4.5); most other muted text measured 4.86:1. Marginal, token is used app-wide, likely
   pre-existing. Verify in a real browser.
2. Light-theme amber-500 / emerald accent icons measured ~2.05–3.65:1. They are `aria-hidden`
   decorative icons beside text that also carries the info, so not a strict failure — but the
   meaningful gold PR dots on the est-1RM chart use the same amber; consider a darker amber for
   graphical (non-text) elements in light theme.
3. One console warning fired during the run ("An async function with useActionState was called
   outside of a transition") — it originates in the **login/auth action path, not the training or
   workouts surfaces**, which produced zero console errors. Out of P56-B scope; noted only.
4. Milestones are not windowed while PRs are (documented intent: a trophy case keeps its history), so
   the timeline mixes all-time milestones with range-filtered PRs and the header count only annotates
   PR sets. Minor UX inconsistency, by design.
5. The global range control is hidden when only one window is meaningful (6-workout account showed no
   control); it correctly renders ("1W / All") once ≥2 presets exist (verified on fixtures). Correct
   behavior, but the "one global range control" MUST is only *visible* with enough history.
6. `/workouts/history` groups months with `timeZone: "UTC"` (`app/workouts/history/page.tsx:46`)
   while analytics use member-local day anchors; a near-midnight session could group under a
   different month than its member-local date. Pre-existing, cosmetic.
7. `prMarkersByExercise`, `heatmapCells`, and `interleave` are recomputed inline (unmemoized) each
   render. They are light O(n) transforms (the heavy replay is server-side), so impact is negligible;
   `useMemo` would be tidier.
8. The fixture harness renders multiple `PersonalRecords` that all read the same `?pr` param
   (`urlState={false}` only gates the range control, not `PersonalRecords`' `useUrlParam`), so a
   drill-down could cross-open across personas. Harness-only; not a shipping surface.

---

## Owner-law checklist (evidence)

| Law | Verdict | Evidence |
|---|---|---|
| Every displayed number = a registered metric, one module | **Mostly YES** | All windowed views read `getTrainingAnalytics` (one assembly over canonicalized workouts); metrics registered in `metrics.ts` (`training.volume.week`, `.frequency.weeklyTrend`, `.plan.adherence.weeklyTrend`, `.pr.timeline`, `.milestones.timeline`, `.muscle.distribution`). **Exception: "Workouts logged" total is unregistered and cap-divergent — P2-1.** |
| Strip AND chart in the consistency panel | YES | Calendar heatmap + 7-day WeekBars strip both present (`training-analytics-view.tsx` consistency panel); strip never removed. |
| No core feature in a popup | YES | Full `/progress/training` page; drill-down is an inline expanding panel, not a modal. |
| Nothing auto-starts | YES | No autofocus (no inputs on page); celebration scene is IntersectionObserver-gated and reduced-motion-gated; no sound/haptics on load (RewardProvider fires only on explicit reward events). |
| Confirm-or-undo (destructive) N/A | YES | Read-only analytics surface; no destructive actions exist to confirm. |
| 44px touch targets | **Mostly YES** | Timeline rows/links `min-h-11`; range control `pointer-coarse:min-h-11`. **Exception: hero/empty-state CTA buttons 34–40px — P2-2.** |
| Full-width desktop (no narrow column) | YES | PageShell `max-w-[var(--container-content)]` = **1500px**, identical to sibling `/progress` and `/progress/body`; multi-column xl:grid-cols-12 layout. |
| Charts' axes span the window not the data extent | YES | TrendChart/ExerciseTrendChart use `window={w}` / `domain={[w.startMs,w.endMs]}` + `windowTicks` (DSH-60). |
| Honest data states (missing ≠ zero, no fake states) | YES | First-run shows "Not logged" + designed messages everywhere; counts (sessions/PRs) use the `missingRendersAs:"zero"` carve-out truthfully; locked = designed teaser, no data fetched. |
| Security: no write path; `decideExerciseAlias` zero callers | YES | Grep confirms `decideExerciseAlias`/`proposeExerciseAlias` have zero callers outside `alias-queries.ts`. All analytics reads are `server-only`. |
| Server/client boundary (no Maps/Dates crossing) | YES | `TrainingAnalytics` is all numbers/ISO strings/serializable arrays; `WorkoutWeekDay` is primitive fields; maps (`withAliasKeyEchoes`) stay server-side. |

## Benchmark grade (§6 MUST rows spot-verified against the live/fixture page)

- **#1 one global range control** — PASS (renders "1W/All" with ≥2 presets; drives every windowed view; hidden only when a single window is meaningful).
- **#5 frequency as calendar heatmap + streak** — PASS (heatmap + week strip, not a bar chart).
- **#10/#17 per-exercise est-1RM line + record marker** — PASS (drill-down line chart, gold dots on record sessions, window-spanning axis).
- **#16 record taps through to source workout** — PASS (clicked a live record source link → landed on the exact `/workouts/history/<id>`, not-found = false).
- **#20/#21 celebration + reduced-motion + aria-live** — PASS (celebration hero, `aria-live="polite"` headline, `useReducedMotion` gates the WebGL scene with an always-present static gradient equivalent).

Also verified: `?pr` drill-down opens (`?pr=Overhead+Press`), renders the est-1RM chart, and Back
closes it returning to a clean `/progress/training` URL; volume is a filled trend line (not bars) with
a per-muscle BreakdownBars companion (#8/#9); Epley named in captions (#11); records grouped per
exercise (#14); no unicorn.studio watermark text detected on the celebration scene.
