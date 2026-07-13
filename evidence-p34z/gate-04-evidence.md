# GATE-04 (Data readiness) evidence — P34-Z, 2026-07-13

Criteria (tracker): FIX-07, 10, 28, 29, 34 done; migration previews approved.
Unlocks: authoritative Progress and Today summaries.

## Migrations

0036/0037/0038 (all verified additive-only: CREATE TABLE IF NOT EXISTS + guarded
FKs + 2 unique indexes; nothing the deployed 9e0cdb1 code reads is dropped,
renamed, or retyped) were APPLIED to the shared Neon DB by P34-Z on 2026-07-13
(`pnpm db:migrate`, completed in 2664 ms, no errors). Serialization honored:
C (0036, `5a84f4a`) then D (0037, `9ab4e3c`) then E (0038, `e6cc152`), per the
wave log.

## FIX-07 effective-dated targets (P34-C, `5a84f4a`)

- Append-only `NutritionTargetVersion` + `UserTargetVersion`, dual-writing
  funnels, pure resolution in `lib/targets/effective.ts`.
- Invariant "a target change never rewrites a prior day's adherence" proven in
  `tests/unit/effective-targets.test.ts`; suite green at close (250/250,
  re-run by P34-Z 2026-07-13 post-migration).
- Post-migration live smoke of the write path (saves errored before the tables
  existed): see `gate-03-04-live-run.md` (target save + version-row check).

## FIX-10 mutation receipt / refresh coordinator (P34-C, `2060e62`)

- Published API (wave log): `lib/refresh/receipt.ts` (pure) +
  `lib/refresh/coordinator.ts` (server). Fan-out DERIVED from the contracts
  (metrics.ts surfaces + routes.ts domains), proven a superset of every
  replaced hardcoded revalidate list in `tests/unit/refresh-graph.test.ts`.
- Cross-surface refresh proven live on the Hydration pilot: Opus node-Playwright
  run 9/9 PASS (`evidence-p34c/refresh-proof.md`).
- Adopted by P34-D for plan/goal mutations (saveWorkout completion write rides
  `loggingReceipt(training, alsoDomains:["plans"])`, commit `0aa3812`).

## FIX-28 structured training plans, DEC-06 honored (P34-D, `9ab4e3c` + `0aa3812`)

- One structured schedule (`resolvePlanScheduleView`, adapter chain
  structured -> legacy-days -> document) powers plan detail, workout selection
  + logger prefill, deterministic Up next, and adherence over the
  `PlanSessionCompletion` event stream. Raw `Plan.detail` never rewritten.
- DEC-06 legacy fallback: adapter scan over ALL real member plans 4/4 resolve,
  0 blocked, raw detail preserved (`evidence-p34d/plan-adapter-scan-output.txt`);
  pre-migration live run exercised the legacy-days fallback end to end
  (`evidence-p34d/live-verification.md`).
- POST-MIGRATION structured path verified by P34-Z (Opus agent, node
  Playwright, dev :3600, 2026-07-13): lazy materialization created the
  PlanSession rows; completing Day 1 in the logger wrote exactly one
  `PlanSessionCompletion`; /plans/[id] shows "Last done Jul 13" and Up next
  advanced to Day 2; an exact double-submit replay of the same workoutId left
  the count at 1 (unique-index guard held). Full report + screenshots:
  `evidence-p34z/plan-structured-path-check.md`. Seeded data cleaned up after.

## FIX-29 goals linked to outcomes (P34-D, `9ab4e3c`)

- `GoalOutcome` links goals to registered MetricIds or explicitly-unsupported
  labeled outcomes (metrics.ts is the vocabulary); legacy single-metric goals
  adapt at read time. Evidence: `evidence-p34d/` + tracker FIX-29 row.

## FIX-34 canonical exercise identity (P34-E, `8301e40` + `e6cc152`)

- Read-time identity layer `lib/workouts/exercise-identity.ts` (~150 curated
  aliases, precedence member-custom > built-in > member-alias > curated > self);
  NO row rewrites; merges reversible. `tests/unit/exercise-identity.test.ts`
  20/20. Pre-delivery audit (Opus): SHIP, 0 P1/P2.
- **Merge preview approval (the GATE-04 "migration previews approved"
  criterion): OWNER PRE-APPROVED 2026-07-13**, in-session direct message to
  P34-E, ahead of preview generation; provenance recorded in the tracker
  FIX-34 row and the wave log. The concrete artifact:
  `evidence-p34e/alias-merge-preview-2026-07-13.md` + `.json` (read-only prod
  scan: 3 members, 2 affected, 7 merge groups, all single-name renames, zero
  live record collisions, 1 protected custom shadow). Verified by P34-Z:
  approval record present in both places; preview generated; demonstrably NOT
  applied (no app/components consumer imports the identity or alias modules;
  auditor-verified at session close). Nothing auto-applies; consumers adopt in
  P5 (FIX-33).

## Closer review battery addendum (2026-07-13)

A fresh-context adversarial review of the wave diff found a P1 data-integrity
cluster (the new FK'd tables were missing from the queries.ts delete funnels,
and materializeSchedule raced under concurrent first views). All FIXED by
P34-Z pre-push and verified LIVE (Opus agent, dev :3600): plan-linked workout
delete, plan delete, 6-way parallel materialization (no duplicate
prescriptions), and a throwaway-account "Delete my data" wipe across every new
table - all PASS. Report: `evidence-p34z/p1-fix-verification.md`; wave-log
disclosure in the briefing. The FIX-07 write funnel was also proven live
(water goal change: 0 -> 3 append-only UserTargetVersion rows incl. the epoch
seed; `evidence-p34z/gate-03-04-live-run.md`).

## Gates re-certified at close (P34-Z, 2026-07-13, post-merge of all five packets)

- `pnpm build` exit 0 (applies migrations, design-lint, copy tripwires).
- `tsc --noEmit` clean tree-wide.
- `pnpm test:unit` 250/250.
- `pnpm lint:design` OK.
