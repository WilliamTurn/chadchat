/**
 * S1-TRAP REGRESSION GATE (flaws-triage 2026-07-15, S1 wave).
 *
 * Each test pins one of the user-trapping defects fixed in the S1 wave so it
 * cannot quietly return:
 *
 *   RUN-06/07/08  Entering a workout page creates a PENDING session; it must
 *                 not summon the mini bar or lock every Start button behind
 *                 "Finish your current workout first".
 *   RUN-01/02     An ENGAGED session (Play pressed) shows the mini bar ABOVE
 *                 the bottom tab bar, with a working stop control.
 *   XPK-15/16     Adding exercises lands back on the workout in ONE
 *                 navigation, with visible confirmation.
 *   RUN-72        Finish never defaults to marking unchecked sets done, and
 *                 refuses an empty save with a corrective message.
 *   XCU-13        A duplicate custom-exercise name is refused.
 *   SYS-04        The "?" explainer popover closes on Escape and on scroll.
 *
 * Same provisioning approach as surface-smoke.test.ts: register through the
 * real UI, grant Pro + onboarded in the database. Requires POSTGRES_URL.
 */

import { type BrowserContext, expect, test } from "@playwright/test";
import postgres from "postgres";

let storageState: Awaited<ReturnType<BrowserContext["storageState"]>>;

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ browser }, workerInfo) => {
  const email = `s1trap-${Date.now()}-w${workerInfo.workerIndex}@playwright.com`;
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
  await page.waitForURL((url) => !url.pathname.startsWith("/register"), {
    timeout: 30_000,
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
      throw new Error(`s1-trap setup: provisioning failed for ${email}`);
    }
  } finally {
    await sql.end();
  }

  storageState = await context.storageState();
  await context.close();
});

test("a pending session never traps: no mini bar, no locked Start buttons (RUN-06/07/08)", async ({
  browser,
}) => {
  const context = await browser.newContext({
    storageState,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();

  await page.goto("/workouts");
  await page
    .getByRole("button", { name: /start an empty workout/i })
    .first()
    .click();
  await page.waitForURL("**/workouts/session**");

  // Leave WITHOUT pressing Play or logging anything.
  await page.goto("/workouts");
  await expect(
    page.getByRole("button", { name: "Stop this workout" })
  ).toHaveCount(0);
  await expect(
    page.getByText("Finish your current workout first")
  ).toHaveCount(0);

  await context.close();
});

test("picker returns to the workout in one step with confirmation (XPK-15/16)", async ({
  browser,
}) => {
  const context = await browser.newContext({
    storageState,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();

  await page.goto("/workouts");
  await page
    .getByRole("button", { name: /start an empty workout/i })
    .first()
    .click();
  await page.waitForURL("**/workouts/session**");

  await page.getByRole("button", { name: "Add your first exercise" }).click();
  await page.waitForURL("**/exercises/pick**");
  await page
    .getByRole("button", { name: /Barbell Bench Press/i })
    .first()
    .click();
  await page.getByRole("button", { name: /Add 1 exercise to/i }).click();

  // ONE navigation lands on the session; the add is confirmed visibly.
  await page.waitForURL("**/workouts/session**", { timeout: 15_000 });
  await expect(page.getByText(/added to your workout/i)).toBeVisible({
    timeout: 10_000,
  });

  await context.close();
});

test("engaged session shows the mini bar above the tab bar with a stop control (RUN-01/02)", async ({
  browser,
}) => {
  const context = await browser.newContext({
    storageState,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();

  // The live session lives in this context's localStorage: build it here.
  await page.goto("/workouts");
  await page
    .getByRole("button", { name: /start an empty workout/i })
    .first()
    .click();
  await page.waitForURL("**/workouts/session**");
  await page.getByRole("button", { name: "Start the workout timer" }).click();
  await page.goto("/workouts");

  const stop = page.getByRole("button", { name: "Stop this workout" });
  await expect(stop).toBeVisible();

  // The dock must clear the bottom nav entirely.
  const clear = await page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Primary"]');
    const dock = document.querySelector(".bottom-above-tabbar");
    if (!nav || !dock) {
      return { ok: false as const, reason: "nav or dock missing" };
    }
    const n = nav.getBoundingClientRect();
    const d = dock.getBoundingClientRect();
    return { ok: d.bottom <= n.top + 1, navTop: n.top, dockBottom: d.bottom };
  });
  expect(clear.ok, JSON.stringify(clear)).toBe(true);

  await context.close();
});

test("finish never defaults unchecked sets to done and refuses an empty save (RUN-72)", async ({
  browser,
}) => {
  const context = await browser.newContext({
    storageState,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();

  // Self-contained setup: empty workout + one exercise (its default set rows
  // enable Finish while none are checked).
  await page.goto("/workouts");
  await page
    .getByRole("button", { name: /start an empty workout/i })
    .first()
    .click();
  await page.waitForURL("**/workouts/session**");
  await page.getByRole("button", { name: "Add your first exercise" }).click();
  await page.waitForURL("**/exercises/pick**");
  await page
    .getByRole("button", { name: /Barbell Bench Press/i })
    .first()
    .click();
  await page.getByRole("button", { name: /Add 1 exercise to/i }).click();
  await page.waitForURL("**/workouts/session**", { timeout: 15_000 });

  await page.getByRole("button", { name: "Finish", exact: true }).click();

  const dialog = page.locator('[role="alertdialog"]').last();
  await expect(dialog).toBeVisible();
  await expect(
    dialog.locator('input[type="checkbox"]').first()
  ).not.toBeChecked();

  await dialog.getByRole("button", { name: "Finish and save" }).click();
  await expect(page.getByText(/Nothing is checked off yet/i)).toBeVisible({
    timeout: 10_000,
  });
  expect(page.url()).toContain("/workouts/session");

  // Clean up: discard the session so later runs start clean.
  await dialog.getByRole("button", { name: "Keep lifting" }).click();
  await page.getByRole("button", { name: "Discard workout" }).first().click();
  await page
    .locator('[role="alertdialog"]')
    .last()
    .getByRole("button", { name: "Discard workout" })
    .click();
  await page.waitForURL("**/workouts", { timeout: 15_000 });

  await context.close();
});

test("duplicate custom-exercise names are refused (XCU-13)", async ({
  browser,
}) => {
  const context = await browser.newContext({
    storageState,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  const name = `Trap Test Press ${Date.now().toString(36)}`;

  for (const attempt of [1, 2]) {
    await page.goto("/workouts/exercises/new");
    await page
      .getByPlaceholder("Enter the name of your exercise")
      .fill(name);
    await page.getByRole("button", { name: "Save exercise" }).click();
    if (attempt === 1) {
      await expect(page.getByText(/added to your exercises/i)).toBeVisible({
        timeout: 10_000,
      });
    } else {
      await expect(
        page.getByText(/You already have an exercise named/i)
      ).toBeVisible({ timeout: 10_000 });
    }
  }

  await context.close();
});

test("the explainer popover closes on Escape and on scroll (SYS-04)", async ({
  browser,
}) => {
  const context = await browser.newContext({
    storageState,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();

  // The "?" explainers appear once the account has data, so earn them:
  // finish one real workout (empty session + one exercise + one logged set).
  await page.goto("/workouts");
  await page
    .getByRole("button", { name: /start an empty workout/i })
    .first()
    .click();
  await page.waitForURL("**/workouts/session**");
  await page.getByRole("button", { name: "Add your first exercise" }).click();
  await page.waitForURL("**/exercises/pick**");
  await page
    .getByRole("button", { name: /Barbell Bench Press/i })
    .first()
    .click();
  await page.getByRole("button", { name: /Add 1 exercise to/i }).click();
  await page.waitForURL("**/workouts/session**", { timeout: 15_000 });

  await page.getByLabel(/Weight in lb for set 1/).fill("100");
  await page.getByLabel(/Reps for set 1/).fill("5");
  await page.getByRole("button", { name: /Log set 1 .* as done/ }).click();
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  await page
    .locator('[role="alertdialog"]')
    .last()
    .getByRole("button", { name: "Finish and save" })
    .click();
  await page.waitForURL("**/workouts/history/**", { timeout: 30_000 });

  await page.goto("/workouts");
  const help = page.getByRole("button", { name: /What does/ }).first();
  await help.waitFor({ state: "visible", timeout: 30_000 });
  await help.scrollIntoViewIfNeeded();

  const popoverOpen = () =>
    page.locator('[data-slot="popover-content"]').count();

  await help.click();
  await expect
    .poll(popoverOpen, { timeout: 5_000 })
    .toBeGreaterThan(0);
  await page.keyboard.press("Escape");
  await expect.poll(popoverOpen, { timeout: 5_000 }).toBe(0);

  await help.click();
  await expect
    .poll(popoverOpen, { timeout: 5_000 })
    .toBeGreaterThan(0);
  await page.mouse.wheel(0, 250);
  await expect.poll(popoverOpen, { timeout: 5_000 }).toBe(0);

  await context.close();
});
