# FIX-39 wave diff review and light-baseline re-approval — P34-Z, 2026-07-13

The one full 364-image diff for the P3/P4 wave (`pnpm screenshot:fixtures` on a
fresh :3600 dev server, then `pnpm screenshot:diff`).

## Result before re-approval

182 changed, 0 missing, 0 new. Composition verified: **182/182 light, 0 dark**
(counted from the full changed list; every light render of all 26 fixture pages
x 7 widths).

## Review against the declared surface changes

- P34-A declared ZERO baseline moves (nav chrome does not render in the fixture
  harness) and empirically proved their globals.css block does not move light
  hashes (byte-identical capture with the block removed, plus a determinism
  double-capture). Confirmed here: 0 dark changes, 0 new/missing images.
- P34-B declared zero diffs on their surfaces (behavior-only wiring); their
  disclosure first flagged this all-light/zero-dark set as pre-existing.
- Root cause (per the wave-log analysis, accepted): the P2-Z baseline
  re-freezes after commits `dfafa8c` (text-secondary -> text-body-sm, light-
  visible at 27 call sites) and `5b947d0` (light `--muted-foreground` 0.58 ->
  0.53, a global light token) hashed STALE pre-fix light captures, so every
  correct fresh light render mismatches while dark stays byte-identical.
- Spot review of the current light captures (this session): `tokens/light-1440`
  visibly carries both fixes (the type ramp lists `.text-body-sm`, muted text at
  the darkened contrast; AA contrast table healthy); `panels-consistent/
  light-390` healthy (strips + charts intact). Renders are correct; the frozen
  hashes were stale.

Nothing in the diff falls outside these two documented explanations. No
findings.

## Action

Single reviewed re-approval executed: `pnpm screenshot:approve` (win32 baseline
re-frozen 2026-07-13, 364 images), then `pnpm screenshot:diff` re-run: OK,
364/364 match. `tests/visual-baseline.json` committed with the wave.

## CI linux baseline

STILL OWED: `gh` is not installed on this box, so the linux-baseline dispatch
(`gh workflow run visual-regression.yml -f update_baseline=true -R
WilliamTurn/chadchat`) could not be run; flagged in the handoff (carried from
P2-Z).
