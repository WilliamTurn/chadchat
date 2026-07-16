# CLAUDE.md — chadchat (the app)

This repo previously had no rulebook; sessions shipped unverified work. The working rules in `../chadlatest/CLAUDE.md` apply here in full. The gates below are this repo's non-negotiable exit checks — a change is not "done" until all of them pass.

## Exit gates (run before calling anything done)

1. **`pnpm lint:design`** — hardcoded colors/sizes, raw controls, banned copy. It runs inside `pnpm build`, so a violation blocks the Vercel deploy. The baseline (`scripts/design-lint-baseline.json`) auto-shrinks on every run: when your fix lowers a file's count, the new lower count is pinned immediately — commit the baseline change with your fix. Never hand-edit a baseline number upward.
2. **`pnpm test:smoke`** — renders /today, /nutrition, /hydration, /sleep, /workouts, and /progress in a real browser at 320, 360, 384, 390, 768, and 1280px. Fails on: redirect away from the surface, horizontal overflow, console errors, or uncaught page errors. Requires `POSTGRES_URL` in `.env.local`; it registers a throwaway `smoke-*@playwright.com` user per run.
3. **`pnpm test:unit`** — the unit suite.
4. **Look at what you made.** Screenshots at 360px, 390px, and desktop; actually inspect them. Layouts are fluid — never tuned to one width. The owner's phone is about 384px wide.

## Facts sessions keep getting wrong

- The owner's phone is NOT 390px; it is about 384px. Fluid layouts, verified at multiple widths, are the requirement — not any single number.
- `User.email` is unique, enforced by the database (`User_email_unique`, migration 0039, fixed 2026-07-16). If an insert loses a concurrent-signup race it throws a unique violation; the register action maps that to the "already exists" inline error.
- The screenshot fixture diffs (`pnpm screenshot:*`) compare dev fixture pages, not real surfaces. Passing them proves nothing about the member-facing app.
- The defect register for this app lives in `../chadlatest/audits/flaws-triage-2026-07-15/`.
