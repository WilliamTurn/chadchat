/**
 * INTERACTION-CONTRACT GATE (flaws-triage 2026-07-15, testing-gates wave).
 *
 * One test per interaction TRAP CLASS from the flaws register, driving the
 * SHARED component that owns the contract (not one test per surface). These
 * assert invariants (closes, confirms, stays reachable, returns), never
 * styling, so they survive the upcoming design-system change.
 *
 *   SYS-03  Chart tooltips dismiss on Escape, tap-away, and scroll
 *           (driven on the shared ChartContainer via the dev chart fixture).
 *   SYS-23  Destructive actions confirm (ConfirmActionDialog names the
 *           object + consequence) or offer a >=5s Undo toast (LAW 7),
 *           driven on the dev overlay fixture's real components.
 *   SYS-05  No overlay ever makes the bottom nav unreachable: with the
 *           active-workout dock up, every tab still navigates.
 *   SYS-16  The in-app back control on a detail page returns to the page
 *           you came from. KNOWN OPEN (test.fail): BackToDashboard is a
 *           hardcoded href today; the RC-1 back-button wave fixes it and
 *           flips this gate to a plain test.
 *   SYS-15  Returning to a long page preserves scroll position. KNOWN OPEN
 *           (test.fail): owned by the same RC-1 wave.
 *
 * The sibling "?" popover contract (SYS-04) is gated in s1-traps.test.ts on
 * a live surface (Escape, scroll, tap-away). The workouts-feature
 * ConfirmDialog (the second confirm primitive) is driven end to end by the
 * s1-traps discard/finish flows.
 *
 * Fixture-driven tests need no auth (dev-only pages); the member-flow tests
 * provision a Pro user the same way surface-smoke.test.ts does.
 */

import {
  type Browser,
  type BrowserContext,
  expect,
  type Page,
  test,
} from "@playwright/test";
import postgres from "postgres";

const PHONE = { width: 390, height: 844 };

let storageState: Awaited<ReturnType<BrowserContext["storageState"]>>;

test.beforeAll(async ({ browser }, workerInfo) => {
  const email = `contract-${Date.now()}-w${workerInfo.workerIndex}@playwright.com`;
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
  // Generous: registration on this dev box takes ~40s when routes are cold.
  await page.waitForURL((url) => !url.pathname.startsWith("/register"), {
    timeout: 120_000,
  });

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
      throw new Error(`contract setup: provisioning failed for ${email}`);
    }
  } finally {
    await sql.end();
  }

  storageState = await context.storageState();
  await context.close();
});

async function openPage(
  browser: Browser,
  { authed = false }: { authed?: boolean } = {}
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    ...(authed ? { storageState } : {}),
    viewport: PHONE,
  });
  return { context, page: await context.newPage() };
}

/* --------------------------------------------------------------------------
 * SYS-03: the chart tooltip dismissal contract, on the shared ChartContainer.
 * ------------------------------------------------------------------------ */

test("chart tooltips dismiss on Escape, tap-away, and scroll (SYS-03)", async ({
  browser,
}) => {
  const { context, page } = await openPage(browser);
  await page.goto("/dev/fixtures/charts");

  // A chart from the "chart types" matrix: the default fixture persona has
  // data there, so a tooltip is always summonable (some grammar-state charts
  // are deliberately empty).
  const chart = page
    .locator('[data-testid="chart-types"] .recharts-surface')
    .first();
  await chart.waitFor({ state: "visible", timeout: 30_000 });
  await chart.scrollIntoViewIfNeeded();

  const tooltipVisible = () =>
    page.evaluate(() => {
      for (const tip of document.querySelectorAll<HTMLElement>(
        ".recharts-tooltip-wrapper"
      )) {
        if (tip.style.visibility !== "hidden") {
          return true;
        }
      }
      return false;
    });

  const summonTooltip = async () => {
    // Each attempt is a real hover gesture: leave the chart, re-enter, and
    // sweep to the middle. (After a dismissal, Recharts re-arms on re-entry;
    // and a single mousemove can land before hydration attaches handlers.)
    await expect
      .poll(
        async () => {
          const box = await chart.boundingBox();
          if (!box) {
            return false;
          }
          await page.mouse.move(box.x - 40, box.y + box.height / 2);
          await page.mouse.move(box.x + 10, box.y + box.height / 2);
          await page.mouse.move(
            box.x + box.width / 2,
            box.y + box.height / 2,
            { steps: 4 }
          );
          return await tooltipVisible();
        },
        { timeout: 15_000 }
      )
      .toBe(true);
  };

  // Escape clears it (pointer still hovering the chart).
  await summonTooltip();
  await page.keyboard.press("Escape");
  await expect.poll(tooltipVisible, { timeout: 5_000 }).toBe(false);

  // Tap-away clears it: a pointerdown outside the chart, without moving the
  // hover pointer off the chart (the touch case that trapped six surfaces).
  await summonTooltip();
  await page.evaluate(() => {
    document.body.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true })
    );
  });
  await expect.poll(tooltipVisible, { timeout: 5_000 }).toBe(false);

  // Scroll clears it.
  await summonTooltip();
  await page.mouse.wheel(0, 200);
  await expect.poll(tooltipVisible, { timeout: 5_000 }).toBe(false);

  await context.close();
});

/* --------------------------------------------------------------------------
 * SYS-23: destructive actions confirm (naming the object) or offer Undo.
 * ------------------------------------------------------------------------ */

test("destructive actions confirm with a named object, or offer a lasting Undo (SYS-23)", async ({
  browser,
}) => {
  const { context, page } = await openPage(browser);
  await page.goto("/dev/fixtures/overlays");

  // The confirm path: ConfirmActionDialog renders role=alertdialog, names
  // the exact object, states the consequence, and Cancel is a true no-op.
  await page.getByTestId("open-confirm").click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  await expect(
    dialog.getByText(/Delete the .* weigh-in of .*\?/i)
  ).toBeVisible({ timeout: 5_000 });
  await expect(
    dialog.getByText(/This will update your weight trend/i)
  ).toBeVisible({ timeout: 5_000 });
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toHaveCount(0, { timeout: 5_000 });

  // Confirming actually runs the action and reports a receipt.
  await page.getByTestId("open-confirm").click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete weigh-in" })
    .click();
  await expect(page.getByText(/Weigh-in deleted/i)).toBeVisible({
    timeout: 10_000,
  });

  // The undo path: a quick-add's Undo toast persists at least 5 seconds
  // (LAW 7 says destructive/optimistic actions confirm OR undo).
  await page.getByTestId("open-undo").click();
  const undo = page.getByRole("button", { name: "Undo" }).first();
  await expect(undo).toBeVisible({ timeout: 5_000 });
  await page.waitForTimeout(5_000);
  await expect(
    undo,
    "the Undo action must persist at least 5 seconds"
  ).toBeVisible();

  await context.close();
});

/* --------------------------------------------------------------------------
 * SYS-05: the bottom nav is never made unreachable by an overlay.
 * ------------------------------------------------------------------------ */

test("bottom nav tabs stay tappable while the active-workout dock is up (SYS-05)", async ({
  browser,
}) => {
  const { context, page } = await openPage(browser, { authed: true });

  // Engage a workout so the dock (the register's worst persistent overlay)
  // is on screen.
  await page.goto("/workouts");
  await page
    .getByRole("button", { name: /start an empty workout/i })
    .first()
    .click();
  await page.waitForURL("**/workouts/session**");
  await page.getByRole("button", { name: "Start the workout timer" }).click();
  await page.goto("/workouts");
  await expect(
    page.getByRole("button", { name: "Stop this workout" })
  ).toBeVisible({ timeout: 10_000 });

  // The Next.js dev-tools badge (<nextjs-portal>) floats over the bottom-left
  // corner in dev and would swallow the "Today" tap. It does not exist in
  // prod; strip it so only PRODUCT overlays can fail this gate.
  await page.addStyleTag({
    content: "nextjs-portal { display: none !important; }",
  });

  // Every routed tab must still take the tap. Playwright refuses the click
  // if another element would swallow the pointer, which is exactly the trap.
  const nav = page.locator('nav[aria-label="Primary"]');
  await nav.getByRole("link", { name: "Progress" }).click();
  await expect(page).toHaveURL(/\/progress/, { timeout: 15_000 });
  await nav.getByRole("link", { name: "Today" }).click();
  await expect(page).toHaveURL(/\/today/, { timeout: 15_000 });

  await context.close();
});

/* --------------------------------------------------------------------------
 * SYS-16 / SYS-15: back returns to the referrer; scroll position survives.
 *
 * BOTH KNOWN OPEN: BackToDashboard is a hardcoded-href link today, and
 * returning to /progress lands at the top (register PRG-47, HYD-16). The
 * RC-1 "back button + scroll memory" wave owns the fix. test.fail() keeps
 * the invariant executable and flips loudly (reported as an error) the
 * moment the fix lands, so RC-1 must promote these to plain tests.
 * ------------------------------------------------------------------------ */

test("back from a detail page returns to the referrer (SYS-16) [KNOWN OPEN: RC-1]", async ({
  browser,
}) => {
  test.fail(
    true,
    "BackToDashboard hardcodes href=/today; RC-1 makes it referrer-aware"
  );
  const { context, page } = await openPage(browser, { authed: true });

  // Arrive at /hydration FROM /progress (not from the dashboard).
  await page.goto("/progress");
  await page.locator('a[href^="/hydration"]').first().click();
  await expect(page).toHaveURL(/\/hydration/, { timeout: 15_000 });

  // The in-app back control must return to where the member came from.
  // (Locator note for RC-1: today this is the BackToDashboard link, whose
  // accessible name is its visible label.)
  await page
    .getByRole("link", { name: /^(?:Back(?: to .+)?|Dashboard)$/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/progress(?:$|\?)/, { timeout: 10_000 });

  await context.close();
});

test("returning to a long page preserves scroll position (SYS-15) [KNOWN OPEN: RC-1]", async ({
  browser,
}) => {
  test.fail(
    true,
    "Returning to /progress resets scroll to the top (PRG-47); RC-1 owns scroll memory"
  );
  const { context, page } = await openPage(browser, { authed: true });

  await page.goto("/progress");
  await page.waitForLoadState("networkidle").catch(() => {
    // Proceed if the page never goes idle.
  });
  await page.evaluate(() => {
    window.scrollTo(0, document.documentElement.scrollHeight);
  });
  const departedAt = await page.evaluate(() => window.scrollY);
  expect(
    departedAt,
    "smoke premise: /progress must be long enough to scroll at 390px"
  ).toBeGreaterThan(200);

  // Leave for a detail page, then return the way the register describes:
  // via the bottom nav, the only route back from several pages.
  await page.locator('a[href^="/hydration"]').first().click();
  await expect(page).toHaveURL(/\/hydration/, { timeout: 15_000 });
  await page
    .locator('nav[aria-label="Primary"]')
    .getByRole("link", { name: "Progress" })
    .click();
  await expect(page).toHaveURL(/\/progress/, { timeout: 15_000 });

  const returnedAt = await page.evaluate(() => window.scrollY);
  expect(
    returnedAt,
    `scroll position must survive the round trip (left at ${departedAt}px, returned at ${returnedAt}px)`
  ).toBeGreaterThan(departedAt * 0.5);

  await context.close();
});
