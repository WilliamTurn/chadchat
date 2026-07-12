# The dashboard contract layer (Phase 1, DSH-66)

This directory is the rulebook the dashboard overhaul builds on. Phases 2 to 8 import these contracts instead of re-deciding, per card, what a metric means, what "empty" looks like, what a button says, or what quality bar a surface must clear. Program tracker: `audits/dashboard-overhaul-2026-07-11/11-engineer-ready-fix-list.md`. Design rationale and the flaw-ownership map: `audits/dashboard-overhaul-2026-07-11/14-phase1-contracts-design-rationale.md`.

## The contracts

| File | Owns | Enforced by |
|---|---|---|
| `metrics.ts` | Every displayed number: source, unit, grain, target, allowed claims, staleness, access | Contract tests; owner-approved definitions |
| `data-state.ts` | The 7 render states; missing is never zero; locked != empty != error; `resolvePanelState` | Types + tests + fixtures |
| `claims.ts` | What may be asserted at what coverage; goal standing (reached/overshoot, DSH-62); evidence envelope | `canClaim` at call sites; tests |
| `units.ts` | Unit registry, canonical formatters, conversion constants (one `LB_PER_KG`) | Formatters at display boundaries; tests |
| `routes.ts` | One owner per destination; canonical names; rename PROPOSALS (owner-gated) | Drift test against `lib/nav-links.ts` |
| `panels.ts` | Panel role taxonomy, slots, action budget, height ranges; logger capability law (backfill/edit/delete) | Phase 2 typed components; fixtures |
| `copy.ts` | Banned system-copy tripwires + positive microcopy rules | `findBannedCopy` in tests/linters |
| `copy-boundary.md` | System voice vs Chad's voice (Chad's is off-limits) | Review policy |
| `standards/visual-excellence.md` | Layout, width, type, color, chart, target-size rubric | Visual auditor grades per line |
| `standards/density-hierarchy.md` | Prominence, action budget, density ceilings, four-depth ladder | Review rubric |
| `standards/motion-interaction.md` | Feedback latency, motion tokens, loading, overlay tree, destructive-action rule | Review rubric + traces |
| `standards/first-run.md` | First-run/empty/sparse/locked as designed states | Fixtures + screenshots |
| `standards/reward-visual.md` | Owner reward laws: real visuals everywhere, strips never removed, backfill | Review rubric |
| `standards/performance-budget.md` | LCP/CLS/INP, zero-shift data loads, JS and chart budgets | Measured in QA slices |

Deterministic fixtures live at `tests/fixtures/dashboard-states.ts` (six member personas covering every panel state); contract invariants are tested in `tests/unit/contracts.test.ts`.

## Import direction

`contracts/` may import types from `lib/db/schema`, pure lib modules, and each other. The actual dependency order: `units` and `data-state` are base modules; `claims` builds on `data-state`; `routes` is a base registry; `metrics` imports `claims`/`routes`/`units` types; `panels` sits on top of `data-state`/`metrics`/`routes`. Nothing in `contracts/` imports React, the DB client, or anything with side effects. App code imports contracts, never the reverse.

## Change protocol

- `metrics.ts` definitions and `data-state.ts` semantics are OWNER-APPROVED (2026-07-12, s185). Changing a definition is a product decision recorded in the program tracker's decision log, not a refactor.
- Claim thresholds (`claims.ts`) are owner-tunable policy; change the constant, cite the reason in the PR.
- Rename proposals in `routes.ts` stay proposals until the owner approves them (P3).
- Standards docs evolve by addition; weakening a rubric line needs the same owner visibility as a gate waiver.

## Phase gating (who consumes what, when)

- **P2 (shared UI)**: panels.ts roles onto ModuleCard; units/data-state/claims wired into the shared chart system; visual/density/motion/first-run/reward standards drive the fixture stories; performance baseline recorded.
- **P3 (navigation)**: routes.ts becomes the nav source; rename decisions go to the owner.
- **P4 (data)**: effective-dated targets and the refresh graph implement the target/refresh rules named in metrics.ts and motion-interaction.md.
- **P5/P6 (Progress/Today)**: compose registered metrics through role panels; every fixture state screenshotted against the standards. Known registry gaps to BATCH-REGISTER (with owner approval) at the start of P5, not mid-build: weekly nutrition adherence, sleep/hydration consistency summaries, training frequency as a trend, plan-slice numbers (next meal's calories), milestone-timeline values.
- **P7 (reports/insight)**: claims.ts evidence envelope becomes structural; copy.ts runs as a lint over report/system strings.
