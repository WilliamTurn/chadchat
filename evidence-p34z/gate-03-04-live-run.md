# GATE-04 support — live water-goal funnel run (item 6)

**Date:** 2026-07-13
**Account:** claude-testing@example.com (Pro test account, id `c073b912-082f-43aa-9e77-da9fffb8b4f1`)
**Server:** http://localhost:3600 (shared dev tree, shared prod Neon DB)
**Scripts:** `scripts/p34z-gate03-water-goal.mjs` (UI drive), `scripts/p34z-gate03-db-check.ts` (read-only DB verify)
**Nature:** MUTATING run (water goal changed then restored). The append-only version rows are intentionally left in place as evidence, per the item-6 instruction.

## Purpose

Prove the FIX-07 effective-dated target funnel end-to-end through the real UI: a
water-goal change writes an append-only `UserTargetVersion` row (kind `water`)
without rewriting history, and restoring the value appends another row rather
than mutating the first.

## Pre-state (DB, before any change)

`UserTargetVersion(kind=water)` rows for the account: **0** — the account was on
the resolved default goal (one US gallon = 3785 ml = 128 oz).

## UI run (via `EditWaterGoalDialog` / `WaterGoalEditor` on /hydration)

| Step | Action | Result |
|---|---|---|
| 1 | Open "Edit daily hydration goal" popover; read seeded value | **original = 128 oz** (matches resolved default) |
| 2 | Change to **100 oz**, click Save | popover **closed** (success), **0** error toasts |
| 3 | Cold reload /hydration, reopen popover | seeded value = **100 oz** — page reflects the saved change |
| 4 | Restore to **128 oz**, click Save | popover **closed** (success), **0** error toasts |
| 5 | Cold reload /hydration, reopen popover | seeded value = **128 oz** — original restored |

No error toast at any save; both saves succeeded and were reflected after a cold reload.
Screenshot: `gate03/item6-goal-changed.png`.

## Post-state (DB, after change + restore) — append-only funnel PROVEN

`UserTargetVersion(kind=water)` rows: **3** (was 0; nothing updated or deleted):

| value (ml) | ≈ oz | effectiveDay | createdAt | meaning |
|---|---|---|---|---|
| 2957 | 100 | 2026-07-13T00:00:00Z (today, member-local anchor) | 19:30:41.715Z | the **change** to 100 oz |
| 3785 | 128 | **1970-01-01T00:00:00Z (epoch)** | 19:30:41.715Z | **epoch-seeded first write**: backfills the prior default so adherence for every day *before* today still resolves to the old 128 oz goal (FIX-07: target changes never rewrite history) |
| 3785 | 128 | 2026-07-13T00:00:00Z (today, member-local anchor) | 19:30:47.958Z | the **restore** to 128 oz |

### What this demonstrates

- **PASS — row with kind `water`, effectiveDay = today exists** (two of them: the 100 oz change and the 128 oz restore, both anchored at the member-local calendar day `2026-07-13T00:00:00Z`).
- **PASS — append-only**: three writes produced three rows; the first row was never mutated when the goal was restored. Same-day changes append (two today-anchored rows), consistent with a resolver that takes the latest `createdAt` for the day.
- **PASS — history preserved (FIX-07 core)**: the very first goal change auto-seeded an **epoch-anchored** row carrying the *old* default (3785 ml), so any historical day's adherence still resolves against the goal that was in force then, not the new one.

### Net user-visible state

The effective goal is back to the original **128 oz** (latest today-anchored row = 3785 ml, identical to the default). Only append-only history rows remain — the intended evidence artifact.

## Console errors during this run

1 unique: the known pre-existing `useActionState was called outside of a transition` warning. No hydration or product errors.
