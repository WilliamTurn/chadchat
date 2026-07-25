# CLAUDE.md — chadchat (the app)

This repo previously had no rulebook; sessions shipped unverified work. The working rules in `../chadlatest/CLAUDE.md` apply here in full. The gates below are this repo's non-negotiable exit checks — a change is not "done" until all of them pass.

## Exit gates (run before calling anything done)

1. **`pnpm lint:design`** — hardcoded colors/sizes, raw controls, banned copy, per-page Toasters, silent truncation, native confirm(), member-facing jargon. It runs inside `pnpm build`, so a violation blocks the Vercel deploy. The baseline (`scripts/design-lint-baseline.json`) auto-shrinks on every run: when your fix lowers a file's count, the new lower count is pinned immediately — commit the baseline change with your fix. Never hand-edit a baseline number upward. Adding a NEW copy pattern? It needs a NEW rule id (see `jargon-leak`) or it trips an old baseline instead of grandfathering.
2. **`pnpm test:unit`** — the unit suite (seconds).
3. **The browser gates — run the slice that covers what you touched** (each suite registers a throwaway `@playwright.com` user; requires `POSTGRES_URL` in `.env.local`):

   | You touched… | Run |
   |---|---|
   | One member surface | That surface's smoke group at all 6 widths: `pnpm exec playwright test tests/e2e/surface-smoke.test.ts -g "<group>"` — groups are `core-dashboards`, `training-screens`, `plans-goals-reports`, `account-misc` (see `SURFACE_GROUPS` in the file). ~2–4 min warm |
   | The workout runner / picker / custom exercise / finish flow | `pnpm test:traps` (every S1 trap at 320/384/390 + the Finish-button/dialog fit gate) and the smoke `-g "in-flow"` sweep. ~5 min warm |
   | A shared primitive (dialog, tooltip, popover, chart, toast, bottom nav, back control) | `pnpm test:contracts` (one test per interaction trap class) plus the two rows above — a primitive change can break every surface. ~1 min warm |
   | Anything about to merge toward `main`/prod (wave close) | **`pnpm test:gates`** — all three suites, full width sweep. ~15–30 min on the dev box. Non-negotiable before a merge |

   The smoke gate asserts, per screen per width: no redirect, `<main>` visible, no horizontal overflow, no console/page errors, and no action control clipped by the viewport edge. `tests/e2e/smoke-known-failures.json` pins pre-existing defects (remove-only: when your fix clears a pinned entry the run tells you to delete it — do so in the same change; never add an entry for a defect you just shipped).
4. **Look at what you made.** Screenshots at 360px, 390px, and desktop; actually inspect them. Layouts are fluid — never tuned to one width. The owner's phone is about 384px wide.

Known expected failures: the old template suites (`api.test.ts`, `model-selector.test.ts`, `chat.test.ts`) are broken (they visit chat unauthenticated) and are NOT part of the gates; bare `pnpm test` is red because of them until the owner decides fix-or-delete. (The SYS-15/16 `test.fail()` pins in `interaction-contracts.test.ts` were promoted to plain tests by the RC-1 back-button + scroll-memory wave.)

## Facts sessions keep getting wrong

- The owner's phone is NOT 390px; it is about 384px. Fluid layouts, verified at multiple widths, are the requirement — not any single number.
- `User.email` is unique, enforced by the database (`User_email_unique`, migration 0039, fixed 2026-07-16). If an insert loses a concurrent-signup race it throws a unique violation; the register action maps that to the "already exists" inline error.
- The screenshot fixture diffs (`pnpm screenshot:*`) compare dev fixture pages, not real surfaces. Passing them proves nothing about the member-facing app.
- The defect register for this app lives in `../chadlatest/audits/flaws-triage-2026-07-15/`.

## UX conventions (hard rules)

- Dialog dismiss buttons say "Cancel" (info-only dialogs: "Close"). Themed copy never goes on action buttons; Chad's voice lives in body text and chat only.
- Never "tap" or "click" in copy any device can see. Write "select" or "choose".
- Destructive buttons name verb + object ("Delete all sets for this exercise"), never OK / Yes / Confirm / bare "Delete all". Bulk actions state their scope in the label; the confirmation body states the count.
- Commit model: a control changing ONE setting with a visible, immediate effect applies instantly. Anything batched, or whose effect isn't visible on screen, gets explicit Save + Cancel. Never silent auto-close; never auto-apply AND a Save button on the same surface.
- Every destructive action has exactly ONE safety net: a confirmation (rare, severe, or bulk) or an undo toast (frequent, single item). Bulk destructive always confirms. Never zero.
- If an action's result is not visible right where the user acted, show a toast. If it is plainly visible, stay quiet (or undo-toast only).
- Anything slower than 1 second shows progress; button presses show a pressed or disabled state immediately.
- Dialogs: Cancel on the left, confirming action on the right (top in stacked layouts); the SAFE action is the focused default; destructive actions use the destructive style.
- Reordering uses visible drag handles (a menu path may exist as secondary).
- Every empty state says why it is empty and offers the action that fills it, and never strands the user without a way back.
- Type floor is 12px, labels 13px+ on phones (permanent owner order; the floors live in the `app/globals.css` tokens (ds.css port landed, W2 2026-07-24)).

The full canon lives in `docs/ux-canon/` (ten files, landed via S0b-3) and `docs/composition-canon/` (ten files, landed via D2 — grouping/containers, density, forms, overlays, screen recipes, rhythm, responsive, placement); the chadlatest copies are the frozen research artifacts. The skills load the relevant domain automatically (`ux-*` for element behavior/rendering, `composition-*` for assembly); read the owning section before building anything it covers. "Overhaul page X" sessions follow `docs/overhaul-session-template.md`.

## The examples rule

Examples are samples, never the list. When the owner gives examples of a problem, they are instances of a CLASS. Work out the class, state it back in one line, and fix/build for the whole class across the surface. Handling only the named examples is a failed task.

## The convention-lookup mandate

At any UX decision point the canon doesn't cover, STOP and establish the convention first: canon sources, real-app references (Mobbin), or the interaction-spec-advisor. No established convention → closest mainstream pattern or ask the owner. Deciding UX from imagination is a defect even when the result looks fine.

Building or changing any member-facing control, flow, or copy? Get the spec from `interaction-spec-advisor` / the strings from `member-copy-writer` FIRST, then implement. Don't invent.

Assembling or modifying any screen region? Load the matching composition skill FIRST (`composition-grouping` for containers/gaps/headers/density, `composition-screens` for screen skeletons and reflow, `composition-forms-overlays` for forms, dialog interiors, and element placement) and follow the owning canon sections. Before adding or keeping ANY container (card, box, pill, outlined chip), it must pass composition canon 01 §4's earning tests — record the passing test (01 #74) or flatten it.

## Exit gate 5

Before calling a member-facing surface done: run the UX auditors whose domain you touched (copy → ux-copy-auditor; flows → ux-flow-auditor; layout/controls → ux-placement-auditor; screen assembly/grouping/density/recipes → ux-composition-auditor; new surface or surface fix/overhaul → all four, plus mobile-experience-auditor). Fix or report every BLOCKER and MAJOR.

## Precedence note

Vercel Web Interface Guidelines (installed) are the mechanics floor. Where they conflict with the `app/globals.css` tokens (ds.css port landed, W2 2026-07-24) or an owner decision, the owner's decision wins; log the conflict in the decision log.
