/**
 * S4 START-COUNTDOWN + TIMER REGRESSION GATE (owner order 2026-07-22).
 *
 * The active-workout header owns an explicit Play / Pause / Reset clock, and
 * the FIRST Play press runs a 5-4-3-2-1 start countdown with cues:
 *
 *   Countdown   Play opens the full-screen countdown ("Get ready", digits,
 *               draining ring) and ends in a distinct begun signal ("Go"),
 *               with a vibration per count and a begun pattern (the WebAudio
 *               cues fire from the same code paths).
 *   Skip        Starts the workout immediately; Escape aborts to pre-start.
 *   No re-count Pause/Resume never re-enters the countdown, and the clock
 *               keeps correct time across it. Reset returns to pre-start;
 *               the NEXT Play press counts down again.
 *   Green audit The header carries no go-green controls (S4 owner order:
 *               on this page only the set checkmarks read green).
 *
 * Same provisioning approach as s1-traps.test.ts. Requires POSTGRES_URL.
 */

import {
  type Browser,
  type BrowserContext,
  expect,
  type Page,
  test,
} from "@playwright/test";
import postgres from "postgres";

const VIEWPORT = { width: 384, height: 832 };

let storageState: Awaited<ReturnType<BrowserContext["storageState"]>>;

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ browser }, workerInfo) => {
  const email = `s4count-${Date.now()}-w${workerInfo.workerIndex}@playwright.com`;
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
      throw new Error(`s4-countdown setup: provisioning failed for ${email}`);
    }
  } finally {
    await sql.end();
  }

  storageState = await context.storageState();
  await context.close();
});

async function openContext(
  browser: Browser,
  options: { reducedMotion?: "reduce" } = {}
) {
  const context = await browser.newContext({
    storageState,
    viewport: VIEWPORT,
    ...options,
  });
  // Record vibration calls: the begun/tick cues are asserted through this
  // (audio shares the same code paths and cannot be observed headlessly).
  await context.addInitScript(() => {
    const calls: (number | number[])[] = [];
    (window as unknown as { __vibrations: (number | number[])[] }).__vibrations =
      calls;
    Object.defineProperty(navigator, "vibrate", {
      configurable: true,
      value: (pattern: number | number[]) => {
        calls.push(pattern);
        return true;
      },
    });
  });
  return { context, page: await context.newPage() };
}

async function startEmptyWorkout(page: Page) {
  await page.goto("/workouts");
  await page
    .getByRole("button", { name: /start an empty workout/i })
    .first()
    .click();
  await page.waitForURL("**/workouts/active**");
}

async function addBenchPress(page: Page) {
  await page.getByRole("button", { name: "Add your first exercise" }).click();
  await page.waitForURL("**/exercises/pick**");
  await page
    .getByRole("button", { name: /Barbell Bench Press/i })
    .first()
    .click();
  await page.getByRole("button", { name: /Add 1 exercise to/i }).click();
  await page.waitForURL("**/workouts/active**", { timeout: 15_000 });
}

const clock = (page: Page) => page.getByLabel(/^Workout time:/);
const countdown = (page: Page) =>
  page.getByRole("dialog", { name: "Starting workout" });

test("the first Play press runs the full countdown into a begun signal, and checking a set still fires the rest timer", async ({
  browser,
}) => {
  const { context, page } = await openContext(browser);

  await startEmptyWorkout(page);
  await addBenchPress(page);

  // Green audit: the sticky header composes without go-green controls.
  const header = page.locator("div.sticky.z-30").first();
  await expect(header).toBeVisible();
  expect(await header.locator('[class*="bg-[var(--go)]"]').count()).toBe(0);
  await expect(page.getByText("Press play to begin")).toBeVisible();

  // The "Go" begun-flash lasts under a second; an armed observer records it
  // instead of racing expect-polling against the window.
  await page.evaluate(() => {
    const w = window as unknown as { __sawGo?: boolean };
    w.__sawGo = false;
    const check = () => {
      if (w.__sawGo) {
        return;
      }
      if (
        [...document.querySelectorAll("span")].some(
          (s) => s.textContent === "Go"
        )
      ) {
        w.__sawGo = true;
      }
    };
    check();
    new MutationObserver(check).observe(document.body, {
      characterData: true,
      childList: true,
      subtree: true,
    });
  });

  await page.getByRole("button", { name: "Start the workout timer" }).click();

  // The countdown moment: overlay, label, a live digit, and a Skip control.
  await expect(countdown(page)).toBeVisible();
  await expect(page.getByText("Get ready")).toBeVisible();
  await expect(countdown(page)).toContainText(/[1-5]/);
  await expect(
    page.getByRole("button", { name: "Skip countdown" })
  ).toBeVisible();

  // The begun signal: the clock ends up running, and "Go" flashed on the way.
  await expect(
    page.getByRole("button", { name: "Pause the workout timer" })
  ).toBeVisible({ timeout: 10_000 });
  await expect(countdown(page)).toHaveCount(0, { timeout: 8_000 });
  await expect(clock(page)).toHaveText(/^0:0\d$/);
  expect(
    await page.evaluate(
      () => (window as unknown as { __sawGo?: boolean }).__sawGo
    )
  ).toBe(true);

  // Cues: one vibration per count plus the distinct begun pattern.
  const vibrations = await page.evaluate(
    () =>
      (window as unknown as { __vibrations: (number | number[])[] })
        .__vibrations
  );
  expect(
    vibrations.filter((v) => typeof v === "number").length
  ).toBeGreaterThanOrEqual(4);
  expect(vibrations.some((v) => Array.isArray(v))).toBe(true);

  // The rest timer contract is untouched: checking a set starts the rest
  // countdown.
  await page.getByLabel(/Weight in lb for set 1/).fill("100");
  await page.getByLabel(/Reps for set 1/).fill("5");
  await page.getByRole("button", { name: /Log set 1 .* as done/ }).click();
  await expect(page.getByText(/Resting ·/)).toBeVisible({ timeout: 5_000 });

  await context.close();
});

test("Skip starts immediately, Escape aborts, pause/resume never re-counts and keeps correct time, and Reset re-arms the countdown", async ({
  browser,
}) => {
  const { context, page } = await openContext(browser);

  await startEmptyWorkout(page);

  // Escape aborts the countdown back to pre-start: nothing starts.
  await page.getByRole("button", { name: "Start the workout timer" }).click();
  await expect(countdown(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(countdown(page)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Start the workout timer" })
  ).toBeVisible();
  await expect(clock(page)).toHaveText("0:00");

  // Skip starts the workout immediately.
  await page.getByRole("button", { name: "Start the workout timer" }).click();
  await page.getByRole("button", { name: "Skip countdown" }).click();
  await expect(
    page.getByRole("button", { name: "Pause the workout timer" })
  ).toBeVisible();

  // Pause after ~2s, and the paused clock reading must survive the pause.
  await page.waitForTimeout(2_200);
  await page.getByRole("button", { name: "Pause the workout timer" }).click();
  await expect(page.getByText("Paused", { exact: true })).toBeVisible();
  const pausedAt = await clock(page).textContent();
  expect(pausedAt).toMatch(/^0:0[1-4]$/);

  // Resume: NO countdown, and the clock continues from where it paused.
  await page.waitForTimeout(1_500);
  await page.getByRole("button", { name: "Resume the workout timer" }).click();
  await expect(countdown(page)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Skip countdown" })
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Pause the workout timer" })
  ).toBeVisible();
  const resumedAt = await clock(page).textContent();
  const toSeconds = (t: string | null) =>
    Number((t ?? "0:0").split(":")[0]) * 60 + Number((t ?? "0:0").split(":")[1]);
  expect(toSeconds(resumedAt)).toBeGreaterThanOrEqual(toSeconds(pausedAt));
  expect(toSeconds(resumedAt) - toSeconds(pausedAt)).toBeLessThanOrEqual(1);

  // Reset returns to the pre-start state, and the NEXT Play press runs the
  // countdown again (it is an initial-start moment, not a one-off).
  await page
    .getByRole("button", { name: "Reset the workout timer to zero" })
    .click();
  await expect(clock(page)).toHaveText("0:00");
  await expect(page.getByText("Press play to begin")).toBeVisible();
  await page.getByRole("button", { name: "Start the workout timer" }).click();
  await expect(countdown(page)).toBeVisible();
  await page.getByRole("button", { name: "Skip countdown" }).click();
  await expect(
    page.getByRole("button", { name: "Pause the workout timer" })
  ).toBeVisible();

  await context.close();
});

test("the countdown still functions under prefers-reduced-motion", async ({
  browser,
}) => {
  const { context, page } = await openContext(browser, {
    reducedMotion: "reduce",
  });

  await startEmptyWorkout(page);
  await page.getByRole("button", { name: "Start the workout timer" }).click();
  await expect(countdown(page)).toBeVisible();
  await expect(countdown(page)).toContainText(/[1-5]/);
  await expect(
    page.getByRole("button", { name: "Pause the workout timer" })
  ).toBeVisible({ timeout: 10_000 });
  await expect(countdown(page)).toHaveCount(0, { timeout: 8_000 });

  await context.close();
});
