# Reward-visual standard

Part of the Phase 1 contract layer (DSH-66). Encodes the owner's reward laws as contract: progress must FEEL rewarding, every panel earns a real visual, and habit rewards are never taken away. A blank or bland panel is a shipping blocker, equal in weight to a broken one.

## 1. Owner laws, verbatim force

1. **Every dashboard panel carries a real visual** (chart, ring, bars, diagram), not just numbers, buttons, or a dot strip alone (s181). If one loggable domain has a chart, every comparable domain has one; asymmetry reads as neglect.
2. **Streak strips are never removed** (s181). Dot strips are habit-streak rewards. Charts go ALONGSIDE the strip, never instead of it. Every tracker panel gets strip AND chart.
3. **Rich visuals live ON the dashboard**, not only behind drill-downs (the /today workout card surfacing the volume/PR visuals is DSH-58; analytics reachable without starting a workout is ACC-05).
4. **Every logger backfills** ("Log a past day", s181); a domain a member can log they can also repair, so streaks and strips stay truthful (capability law in panels.ts).

## 2. Reward without lying (reconciling with claims.ts)

The reward laws never license fake visuals. The reconciliation:

- A REAL visual is required in every state, but each state gets its DESIGNED variant (first-run.md): hollow strips and axis placeholders when empty, true points in an honest window when sparse, the full treatment when populated.
- Missing is never drawn as zero; trends never appear below thresholds. The reward comes from composition, motion, and celebration, not from inflated data.
- Framing is always forward and never undercuts the member's results (owner law: outputs are calculated results, no hedging badges). "Down 4.2 lb since Jun 1" beats "weight changed".

## 3. What "rewarding" means, concretely

- **Filling things fill.** Rings, bars, and strips visibly advance on every log, animated once (motion contract). A log that changes nothing on screen is a contract violation (immediate-refresh capability).
- **Wins get named.** PRs, streak milestones, goal-reached, first-week-complete produce a specific celebration: the concrete achievement in words ("New PR: Bench 225 lb x 5") plus one short motion burst, reduced-motion-safe.
- **Consistency is visible history.** The week strip shows the streak breathing day by day; the dashboard shows "4 of 7 days logged" trending. Members should be able to SEE the habit forming.
- **Direction is colored by meaning.** Emerald toward goal, blood away, neutral when ambiguous (the Color Law). A member scanning the page reads their day in color before reading a number.
- **Milestones accumulate somewhere.** PRs and achievements have a home surface (Progress, P5); the dashboard shows the latest one, never a permanent empty trophy case.

## 4. Per-panel minimums (the anti-bland floor)

| Panel | Strip | Chart/visual | Celebration hooks |
|---|---|---|---|
| Nutrition | weekly adherence cue | macro rings (live) | target met |
| Hydration | 7-day goal bars (live) | progress toward daily goal | goal reached |
| Sleep | 7-night strip, hollow when empty (DSH-64 fix) | nightly bars vs goal line | goal streak |
| Workout log | 7-day strip (live) | volume trend or PR sparkline (DSH-58) | PR, sessions/week |
| Weight trend | n/a | raw + trend + goal line chart (live) | goal reached / rate milestone |
| Goals | n/a | progress bar + linked-outcome status | reached |

("live" = already shipped; the rest are the P2/P6 obligations this standard pins.)

## 5. Checkable rubric

- [ ] Every dashboard panel shows a real visual in EVERY data state (designed variants included). Zero text-only or buttons-only panels.
- [ ] Every tracker panel shows its week strip in every state; no strip was removed or hidden behind a condition.
- [ ] Every log visibly moves at least one on-screen visual immediately.
- [ ] Every loggable domain has "Log a past day" and permanent edit/delete for past entries.
- [ ] PR/streak/goal wins produce a named, specific celebration; reduced-motion honored.
- [ ] Visual richness is symmetric across domains (no chart-rich nutrition next to a bare sleep card).
- [ ] Nothing rewarded is fabricated: every visual passes the claims/data-state contracts.
