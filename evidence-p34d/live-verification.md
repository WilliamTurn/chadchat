# P34-D live verification (2026-07-13, delegated Opus agent, node Playwright, dev :3600)

Method: seeded one legacy-shaped training plan (days json, the pre-FIX-28 shape) onto the
Pro test account with `scripts/p34d-seed-test-plan.ts`, drove the member surfaces with a
node Playwright script (`scripts/p34d-live-check.mjs`), then removed the seed with
`--cleanup`. Migration 0037 was generated + committed but deliberately NOT applied by this
session (build sessions do not run prod-DB migrations; it applies on the wave's build), so
this run exercised the adapter's LEGACY-DAYS FALLBACK path end to end, which is exactly the
DEC-06 resilience branch.

## Results (all PASS; full agent report in the session record)

- Login via credentials form; /workouts renders the "Chad's Training Plan" section from the
  resolved schedule: 3 day cards with exercises and Start buttons.
  Screenshot: `live-workouts-plan-section.png`.
- /plans/[id] renders the new "Weekly schedule" section through the SAME resolved schedule:
  per-exercise prescriptions ("4 x 4-6 @ 185 lb · RPE 8"), per-session "Not done yet"
  pairing, exactly one "Up next" badge (Day 1, from `selectUpNextSession` with zero
  completions), and the raw plan document rendering unchanged below.
  Screenshot: `live-plan-detail.png`.
- Start Day 1 prefills the logger from the schedule (bench 4 x 4-6 @ 185 with RPE note,
  row 4 x 8-12, OHP 3 x 8-10 @ 95). Nothing was saved.
  Screenshot: `live-session-prefill.png`.
- Console: 2 pre-existing app-wide warnings unrelated to plan surfaces (useActionState
  transition warning; SessionMiniBar hydration mismatch in WorkoutDocks).

## Adapter coverage over REAL member data (read-only scan)

`scripts/p34d-plan-adapter-scan.ts` classified every Plan row in the shared DB through the
adapter's resolution pipeline: 4/4 plans resolve to a structured schedule (1 to 5 sessions
each), 0 blocked, raw `detail` preserved on all (output:
`plan-adapter-scan-output.txt`). Text-only/diet plans resolve to the document view by
construction (unit-tested; none exist in the corpus today).

## Queued for P34-Z (post-migration, one item)

After the wave build applies 0037: re-run the seed script, load /workouts once (lazy
materialization creates PlanSession/Exercise/Set rows), complete one seeded session in the
logger, and verify (a) a PlanSessionCompletion row exists for the workout, (b) /plans/[id]
shows "Last done <day>" and the Up next badge advances to Day 2, (c) re-saving the same
workout id cannot double-record (unique workoutId). The structured branch and completion
write are unit-tested and code-reviewed; this is the one live pass that needs the tables
to exist. NOTE: my `app/workouts/actions.ts` completion write + `session-player.tsx`
planRef arg ride a follow-up commit gated on P34-C's receipt-layer commit (wave log).
