# Overhaul-session template — the deterministic "go fix page X" prompt skeleton

**This is the living copy** (registered via D2, 2026-07-23; the chadlatest copy at `audits/design-standards-2026-07-23/` is the frozen research artifact). Referenced from CLAUDE.md's canon digest.

**Date:** 2026-07-23 · **Status:** APPROVED (owner, 2026-07-23 — D2 gap-audit approval)
**Purpose:** the owner says "overhaul page X." This template makes that session deterministic: same inputs, same rulebooks, same order, same exit gates, every time — instead of a session improvising and minting 20 new flaws while fixing 5.

Copy this skeleton into `prompts/YYYY-MM-DD-<surface>-overhaul.md`, fill the bracketed slots, launch on fresh context (one surface per session).

---

## <Surface> overhaul — [date]

**Model:** Opus (the decisions are already made — they live in the canons). Fable only if the owner explicitly wants the surface re-*designed*, not brought to standard.
**Repo:** `C:\Users\jon17\Desktop\chadchat`. **Surface:** [route(s)]. **Budget:** finish under ~200k tokens; if the audit says the surface needs more, STOP after the audit and hand the owner a split proposal instead of pushing through.

### 1. Load the law (before looking at the surface)
- Skills: [the 2–3 composition skills matching this surface type] + [the ux-* skills matching what it does] + `member-copy` if any string might change.
- Read: the flaw taxonomy (`../chadlatest/audits/design-standards-2026-07-23/flaw-taxonomy.md`), the screen recipe for this surface's archetype (`docs/composition-canon/05-screen-recipes.md`), and the north star. Owner decisions in the decision log bind you.

### 2. Audit before touching anything
- Drive the real surface (Playwright) at 320 / 360 / 384 / 390 / desktop. Screenshot each.
- List every defect found, classified by the five taxonomy categories, each with the owning canon rule number. The audit list is the session's contract — the owner sees it in the closing report with each item marked fixed / not fixed / out of scope.
- Run the mechanical gates first (`pnpm lint:design`, the smoke slice for this surface) — their failures join the list.

### 3. Fix by category, in this order
1. **Layout-execution** (broken rendering) — mechanical, no judgment.
2. **Composition** (assembly) — apply the canon rules cited in the audit; any container added or kept must pass canon 01's earning tests; peers get identical treatment.
3. **Element-level** — compose from shared components and tokens only; a needed-but-missing shared piece gets built ONCE in the shared layer (owner permission per CLAUDE.md §3), never inline.
4. **Copy** — every changed or new member-facing string comes from `member-copy-writer`, cited. No freelancing words.
5. **Interaction** — specs from `interaction-spec-advisor` for any behavior change, cited.
- Rule for scope creep: a defect you notice OUTSIDE this surface goes in the closing report, not in the diff.

### 4. Exit gates (all of them, in order)
1. `pnpm lint:design` clean (baseline never hand-raised).
2. `pnpm test:unit`.
3. Browser slice: the surface's smoke group + `test:contracts` if flows changed; `test:gates` before merge.
4. Auditors: `ux-composition-auditor` + [domain-matched auditor(s)]; fix every BLOCKER/MAJOR or report why not.
5. Screenshots at 360 / 390 / desktop (spot-check 320), actually inspected, attached for the owner.
6. Every behavioral bug fixed gets a regression test in the same change.

### 5. Close
- Closing report to `chadlatest/closing-reports/` (.md): the audit list with per-item disposition, what was driven end-to-end, screenshots, defects observed elsewhere, anything contested left for the owner.
- Paperwork (MTL/MTLN + handoff) via `model: opus` subagents. VCPDHN only when the owner says so.

---

**Template maintenance rule:** this file changes only via an owner-approved session; sessions using it may not edit it to fit their case.
