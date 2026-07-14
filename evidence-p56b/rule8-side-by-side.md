# FIX-33 side-by-side grade vs the benchmark checklist

Session P56-B. Graded line by line against `benchmark-teardown.md` section 6
(the 27-line "match or exceed" checklist distilled from Hevy / Strong /
TrainingPeaks / Strava / Fitbod / Peloton / Apple captures in
`references/`). Visual rows cite the captures in `ours/` (Opus
browser-verification run) next to the reference captures.

| # | Line (MUST unless noted) | Verdict | Evidence |
|---|---|---|---|
| 1 | One global range control drives every view | PASS | `training-analytics-view.tsx`: ONE `ChartRangeControl` (`?range`, URL-synced) windows the calendar, volume, and PR timeline; no per-card range chrome on /progress/training. Benchmark: Hevy. |
| 2 | At least one dense longitudinal anchor chart | PASS | Volume section: raw daily volume dots under a gap-aware smoothed EMA trend on a window-spanning axis (P2 TrendChart), the TrainingPeaks-curve form, not bars. |
| 3 | Every card a real visual, zero blank/dot-only panels | PASS | Calendar heatmap, adherence rings, volume trend, breakdown bars, e1rm line, glowing timeline; every state designed (ChartFrame grammar). |
| 4 | (SHOULD) Status headline backed by its chart | PASS | Status band (registered facts) + "N sessions in the last X" line directly above the views that justify it. |
| 5 | Frequency = calendar heatmap + streak, not bars | PASS | P56-A's `CalendarHeatmap` primitive (Hevy/GitHub form) + the 7-day week strip in the SAME panel; the registered weekly-frequency trend backs the headline. |
| 6 | Adherence = completion against plan (ring form) | PASS | `RingGauge` hero (completed/planned this week, emerald at perfect) + 8 mini weekly rings; plannedPerWeek from the FIX-28 rotation. |
| 7 | (SHOULD) Strip present, never removed, chart alongside | PASS | Week strip in the consistency panel next to the calendar (s181 law). |
| 8 | Volume = filled area/line trend + per-muscle detail | PASS | TrendChart (filled gradient + smoothed line) + Muscle focus BreakdownBars (Hevy set-count form). |
| 9 | MUST NOT: weekly-volume bars as the only visual | PASS | No volume bars anywhere on the surface; /workouts' migrated chart is the same trend form. |
| 10 | Per-exercise est-1RM line as the strength hero | PASS | Migrated `ExerciseTrendChart` inside the record drill-down, window-spanning axis. Benchmark: Strong. |
| 11 | 1RM estimator named + one module | PASS | "Estimated with the Epley formula" caption; computed only by `lib/workouts/stats.ts` (epley1RM), registered metric training.exercise.e1rm. |
| 12 | (SHOULD) Normalized strength index / benchmark-lift set | DEFERRED | A Fitbod-style normalized index is a NEW metric definition (owner approval per contract change protocol); flagged for the tracker rather than invented mid-wave. Top-8 records by e1RM stand in as the curated set. |
| 13 | (COULD) Muscle body heatmap | PARTIAL | Muscle focus ships as labeled breakdown bars (honest with current muscleGroup coverage); an anatomical heatmap is queued as a follow-on once tag coverage supports it. |
| 14 | Records grouped per exercise | PASS | `computePersonalRecords` over CANONICALIZED history: one card per exercise identity, aliases merged (FIX-34 wired). |
| 15 | Record type modality-aware, each PR a registered metric | PASS | Weight&reps records (top set, est. 1RM, session volume), bodyweight fallback ("Best N reps"), timed exercises never PR (`prEventsByWorkout` excludes them); metrics registered (training.prs, training.pr.timeline, training.exercise.e1rm). |
| 16 | Every record card taps through to the source workout | PASS | `PersonalRecord` now carries source workout ids; drill-down links "Top set … · View workout" and "Best est. 1RM … · View workout" to /workouts/history/[id]; every timeline entry links to its workout. THE crown-jewel interaction (Hevy). |
| 17 | Per-exercise PR timeline + record-as-marker on trend | PASS | Gold dots (Strava pattern) on the e1rm trend at record sessions, same replay as the pills; the Records-and-milestones timeline is the cross-exercise history. |
| 18 | (SHOULD) PRs from real logged sets, backfilled honestly | PASS | Replay over full real history; first-ever session is a baseline, not a record; unit-tested (tests/unit/training-analytics.test.ts). |
| 19 | Dedicated milestone/trophy surface, recent-first + full history | PASS | Records-and-milestones section: recent-first, celebration hero for a fresh win, "Show all N" to full history; a page section with back-button page (never a popup). |
| 20 | PRs/milestones trigger a genuine in-the-moment celebration | PASS | The celebration hero: tokenized gold wash + glow + the owner's unicorn.studio "Huly" laser scene behind a recent win; timeline entries carry tokenized gold/emerald glows. |
| 21 | Motion gated (reduced-motion), static equivalent, aria text | PASS | `celebration-scene.tsx`: scene never loads under prefers-reduced-motion (verified: no CDN request); static gradient hero stands alone; the win is stated in words (aria-live polite region); no sound/haptics fire on page load (nothing-starts-uninvited). |
| 22 | Only real earned achievements celebrate | PASS | Hero renders only when the newest REAL event is <= 7 days old; every entry maps to a registered metric event. |
| 23 | (SHOULD) Badge/milestone art tokenized + diverse | PASS | REWARD_GOLD/REWARD_GOLD_WASH tokens in lib/chart/palette.ts (the Color Law home); gold = records, emerald = milestones; glow derived via color-mix from the same tokens as the marks. |
| 24 | (COULD) Retroactive backfill on first view | PASS | The timeline replays the member's full genuine history the first time they open the page (the Apple model). |
| 25 | AA both themes, 44px targets, mobile-first, full width | PASS after fixes | Opus pre-delivery audit: SHIP conditional, 0 P1; mobile audit: 0 P1, 4 P2. ALL SIX P2s FIXED same session and re-verified: registered training.sessions.total (uncapped count, both surfaces one source); pointer-coarse 44px CTAs; hero text basis (no more one-word-per-line collapse at 360/390); compact volume y-ticks ("55k", no clipped digits); drill-down scroll-into-view; adherence rings stack + wrap (nothing clipped at 320). Full trails: pre-delivery-audit.md + mobile-audit/ + ours/verification.md. |
| 26 | Every number a registered metric in one module | PASS | 7 new metrics batch-registered; `getTrainingAnalytics` is the one assembly; /workouts' week-volume tile switched to the same `volumeSinceLb` symbol. |
| 27 | Labels instantly self-explanatory | PASS | "Workouts logged", "Volume this week", "Plan adherence", "est. 1RM" always expanded in help popovers ("estimated one-rep max" + formula), "Records and milestones". |

Screenshots: `ours/` (this session's captures) vs `references/01-09`
(the ranked leaders). The pre-delivery and mobile audits grade the same
rows independently.
