# P34-C benchmark teardown (rule 8, data-model design)

| Field | Value |
|---|---|
| Session | P34-C (FIX-07 effective-dated targets, FIX-10 mutation receipt + refresh coordinator) |
| Kind | Written data-model teardown (data-layer packet; no screenshot captures required per briefing rule 8) |
| Date | 2026-07-13 |

## What is being designed

1. **FIX-07:** target history. When a member changes a daily/nightly target
   (nutrition calories/protein/carbs/fat, water goal, sleep goal), historical
   adherence must keep using the target that was active on each past day.
2. **FIX-10:** mutation receipts. Every mutation names what changed (domain,
   entity, member-local day range) and every dependent surface reconciles
   without a manual reload.

## Ranked references, and why

1. **MacroFactor (bar-setter for target versioning).** Targets live in
   dated "programs". A new or edited program takes effect from its creation
   moment forward; creating a new program loses no history and past days keep
   the program that was active then. Its coaching loop re-reads INTAKE and
   WEIGHT history, never rewrites past targets. Sources:
   - https://help.macrofactorapp.com/en/articles/205-why-does-my-new-program-have-slightly-different-calorie-and-macronutrient-targets-than-my-old-program-even-though-i-didn-t-change-my-goal
   - https://macrofactor.com/macrofactors-algorithms-and-core-philosophy/
2. **MyFitnessPal (the mainstream pattern, explicit in their help center).**
   "Can I change my calorie goal without affecting my historical entries?":
   goal changes update the diary FROM THE CURRENT DAY FORWARD; past diary days
   display the goal that was set at that time; there is deliberately no way to
   rewrite a past day's goal. Source:
   - https://support.myfitnesspal.com/hc/en-us/articles/360032624071-Can-I-change-my-calorie-goal-without-affecting-my-historical-entries
3. **Stripe (refresh/receipt pattern).** Every mutating API call returns the
   changed object plus emits typed events naming the changed entity; dependent
   surfaces (dashboard panels, webhooks) reconcile from the event, not from a
   page reload. The FIX-10 receipt is this shape adapted to server actions +
   Next.js revalidation. (Linear's sync engine is the same idea: mutations
   carry an entity + version delta that every open view applies.)

## Observed design decisions adopted

| Decision | Benchmark practice | Ours |
|---|---|---|
| Target changes are forward-only | MFP: "from the current day moving forward"; MacroFactor: program effective from creation | Version rows with an `effectiveDay`; a change is effective from the member's local TODAY (grain law, `todayAnchorInTz(user.timezone)`) |
| Past days keep their target | MFP web diary shows historical goals per date | Resolution = latest version with `effectiveDay <= day`, `createdAt` tiebreak for same-day re-edits |
| History is never rewritten | Both leaders | Versions are append-only; the mutation funnels INSERT, never UPDATE, version rows |
| Full target set versions atomically | MacroFactor programs carry kcal + all macros as one unit | `NutritionTargetVersion` snapshots the 4-tuple per version, not per-macro rows |
| No data loss on change | MacroFactor "creating a new program doesn't result in any data loss" | Legacy current-pointer rows (`NutritionTarget`, `User.waterGoalMl/sleepGoalMinutes`) keep being written (deployed code reads them); versions are additive alongside |
| Mutations name what changed | Stripe events / Linear sync deltas | `MutationReceipt { domain, entity, op, days }` in contract vocabulary (`DomainId` from routes.ts) |
| Dependent surfaces derive from one registry | Stripe dashboards subscribe by object type | Refresh graph DERIVED from `lib/contracts/metrics.ts` (domain -> union of registered `surfaces`), never a per-action hardcoded list |

## Deliberate deviations

- **Lazy epoch seeding instead of a data migration.** On the FIRST version
  write for a member who already had a target, the old value is snapshotted as
  a version effective from epoch (inside the same transaction). This preserves
  the exact pre-FIX-07 interpretation of old days without any data-writing
  migration against the shared prod Neon DB (briefing rule 6).
- **Days before a member's first-ever target resolve to NO target.** MFP
  renders a goal on every past day because goals are set at signup; Chad
  members can predate having any target. Adherence against a target that did
  not exist is not computable (claims.ts discipline), so the resolution API
  returns null for those days rather than inventing one.
