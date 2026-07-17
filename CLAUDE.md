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
