/**
 * SURFACE SMOKE GATE.
 *
 * The first browser test that renders the real member surfaces (not the
 * dev fixtures). For every dashboard surface, at every supported viewport
 * width, it verifies the three things a member notices immediately:
 *
 *   1. The surface actually renders (no redirect loop, no error screen,
 *      the page's <main> landmark is visible).
 *   2. Nothing overflows horizontally (no sideways scroll on any phone —
 *      the owner's own device is a 384px-wide Samsung; layouts must be
 *      fluid across ALL of these widths, never tuned to one number).
 *   3. No console errors or uncaught page errors while it renders.
 *
 * Runs with `pnpm test` (or `pnpm test:smoke` alone). Each worker registers
 * a fresh user through the real /register UI, then grants it an active Pro
 * plan + onboarded flag directly in the database (the same fields the
 * Stripe webhook would set) so the paywall and welcome wizard don't block
 * the dashboards. Requires POSTGRES_URL (loaded from .env.local by
 * playwright.config.ts).
 */

import { type BrowserContext, expect, test } from "@playwright/test";
import postgres from "postgres";

const SURFACES = [
  "/today",
  "/nutrition",
  "/hydration",
  "/sleep",
  "/workouts",
  "/progress",
];

// Fluid-layout coverage: smallest supported phone up to desktop. 384 is the
// owner's actual Samsung viewport; it is deliberately NOT the only width.
const VIEWPORTS = [
  { name: "phone-320", width: 320, height: 568 },
  { name: "phone-360", width: 360, height: 800 },
  { name: "phone-384", width: 384, height: 832 },
  { name: "phone-390", width: 390, height: 844 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "desktop-1280", width: 1280, height: 800 },
];

// Console noise that is not a product defect.
const CONSOLE_IGNORE = [
  /Download the React DevTools/i,
  /\[Fast Refresh\]/i,
];

let storageState: Awaited<ReturnType<BrowserContext["storageState"]>>;

test.beforeAll(async ({ browser }, workerInfo) => {
  // Unique per worker AND per run: second-precision timestamps collide when
  // parallel workers start together (User.email has no unique index, so a
  // collision registers two rows — see the check-then-insert race in
  // app/(auth)/actions.ts).
  const email = `smoke-${Date.now()}-w${workerInfo.workerIndex}@playwright.com`;
  // The register form enforces the full requirements checklist.
  const strongPassword = `Aa1-${Math.random().toString(36).slice(2, 12)}`;

  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/register");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(strongPassword);
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill(strongPassword);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Sign up" }).click();
  // Success signs the user in and refreshes; wherever it lands, the session
  // cookie is what we need.
  await page.waitForURL((url) => !url.pathname.startsWith("/register"), {
    timeout: 30_000,
  });

  // Grant access the way a completed checkout would (subscription fields) and
  // skip the welcome wizard (onboardedAt), so every dashboard is reachable.
  const sql = postgres(process.env.POSTGRES_URL as string, { max: 1 });
  try {
    const updated = await sql`
      UPDATE "User"
      SET "subscriptionStatus" = 'active',
          "subscriptionTier"   = 'pro',
          "currentPeriodEnd"   = now() + interval '30 days',
          "onboardedAt"        = now()
      WHERE email = ${email}
      RETURNING id
    `;
    if (updated.length !== 1) {
      throw new Error(
        `smoke setup: expected to provision exactly 1 user for ${email}, got ${updated.length}`
      );
    }
  } finally {
    await sql.end();
  }

  storageState = await context.storageState();
  await context.close();
});

for (const viewport of VIEWPORTS) {
  test(`surfaces render clean at ${viewport.name} (${viewport.width}px)`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      storageState,
      viewport: { width: viewport.width, height: viewport.height },
    });
    const page = await context.newPage();

    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (
        msg.type() === "error" &&
        !CONSOLE_IGNORE.some((re) => re.test(msg.text()))
      ) {
        consoleErrors.push(`[${page.url()}] ${msg.text()}`);
      }
    });
    page.on("pageerror", (err) => {
      consoleErrors.push(`[${page.url()}] uncaught: ${err.message}`);
    });

    for (const surface of SURFACES) {
      await page.goto(surface, { waitUntil: "load" });

      // 1. Reachable: still on the surface (not bounced to /login, /pricing,
      //    /welcome, or /legal) and the page landmark rendered.
      expect
        .soft(
          new URL(page.url()).pathname,
          `${surface} @ ${viewport.name}: member was redirected away`
        )
        .toBe(surface);
      await expect
        .soft(
          page.locator("main").first(),
          `${surface} @ ${viewport.name}: page <main> never rendered`
        )
        .toBeVisible({ timeout: 30_000 });

      // Let streamed/suspended content settle before measuring.
      await page.waitForLoadState("networkidle").catch(() => {
        // Long-polling keeps some pages from ever going idle; proceed.
      });

      // 2. No sideways scroll: content must fit the viewport width.
      const overflowPx = await page.evaluate(() => {
        const doc = document.documentElement;
        const widest = Math.max(
          doc.scrollWidth,
          document.body ? document.body.scrollWidth : 0
        );
        return widest - doc.clientWidth;
      });
      expect
        .soft(
          overflowPx,
          `${surface} @ ${viewport.name}: content overflows the viewport horizontally by ${overflowPx}px`
        )
        .toBeLessThanOrEqual(1);
    }

    // 3. Silent console across the whole sweep.
    expect
      .soft(consoleErrors, `console/page errors at ${viewport.name}`)
      .toEqual([]);

    await context.close();
  });
}
