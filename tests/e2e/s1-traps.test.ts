/**
 * S1-TRAP REGRESSION GATE (flaws-triage 2026-07-15, S1 wave; width-swept
 * 2026-07-16).
 *
 * Each scenario pins one of the user-trapping defects fixed in the S1 wave so
 * it cannot quietly return. Every scenario runs at MULTIPLE phone widths â€”
 * the original suite ran only at 390x844, which is exactly how RUN-68 (the
 * Finish button cut off by the right screen edge) shipped in the first place.
 *
 *   RUN-06/07/08  Entering a workout page creates a PENDING session; it must
 *                 not summon the mini bar or lock every Start button behind
 *                 "Finish your current workout first".
 *   RUN-01/02     An ENGAGED session (Play pressed) shows the mini bar ABOVE
 *                 the bottom tab bar, with a working stop control.
 *   XPK-15/16     Adding exercises lands back on the workout in ONE
 *                 navigation, with visible confirmation.
 *   RUN-68/70     The Finish button sits fully inside the viewport and is
 *                 clickable; the finish dialog it opens fits the viewport on
 *                 all four edges. Asserted at 320/360/384/390.
 *   RUN-72        Finish never defaults to marking unchecked sets done, and
 *                 refuses an empty save with a corrective message.
 *   XCU-13        A duplicate custom-exercise name is refused.
 *   SYS-04        The "?" explainer popover closes on Escape, on scroll,
 *                 and on tap-away.
 *
 * Same provisioning approach as surface-smoke.test.ts: register through the
 * real UI, grant Pro + onboarded in the database. Requires POSTGRES_URL.
 */

import {
  type Browser,
  type BrowserContext,
  expect,
  type Locator,
  type Page,
  test,
} from "@playwright/test";
import postgres from "postgres";

/** The trap scenarios sweep the phone range: smallest supported, the owner's
 *  Samsung, and the old single test width. Layouts are fluid, so passing at
 *  the extremes plus the owner's device is the regression contract. */
const TRAP_VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 384, height: 832 },
  { width: 390, height: 844 },
];

/** RUN-68 shipped as a *width-specific* clip, so the Finish assertions get
 *  the full phone sweep, including 360. */
const FINISH_VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 360, height: 800 },
  { width: 384, height: 832 },
  { width: 390, height: 844 },
];

let storageState: Awaited<ReturnType<BrowserContext["storageState"]>>;
/** The registered test account's email, for tests that seed rows against it. */
let email: string;

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ browser }, workerInfo) => {
  email = `s1trap-${Date.now()}-w${workerInfo.workerIndex}@playwright.com`;
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
      throw new Error(`s1-trap setup: provisioning failed for ${email}`);
    }
  } finally {
    await sql.end();
  }

  storageState = await context.storageState();
  await context.close();
});

async function openContext(
  browser: Browser,
  viewport: { width: number; height: number }
) {
  const context = await browser.newContext({
    storageState,
    viewport,
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

/** The RUN-68 class: a control that exists and "works" but sits partly
 *  outside the viewport, so a member cannot see or tap all of it. */
async function expectFullyInsideViewport(
  target: Locator,
  viewport: { width: number; height: number },
  label: string,
  { vertical = false }: { vertical?: boolean } = {}
) {
  const box = await target.boundingBox();
  expect(box, `${label} @ ${viewport.width}px: has no bounding box`).not.toBeNull();
  if (!box) {
    return;
  }
  expect
    .soft(box.x, `${label} @ ${viewport.width}px: clipped by the LEFT edge`)
    .toBeGreaterThanOrEqual(-0.5);
  expect
    .soft(
      box.x + box.width,
      `${label} @ ${viewport.width}px: clipped by the RIGHT edge (${(box.x + box.width).toFixed(1)} > ${viewport.width})`
    )
    .toBeLessThanOrEqual(viewport.width + 0.5);
  if (vertical) {
    expect
      .soft(box.y, `${label} @ ${viewport.width}px: clipped by the TOP edge`)
      .toBeGreaterThanOrEqual(-0.5);
    expect
      .soft(
        box.y + box.height,
        `${label} @ ${viewport.width}px: clipped by the BOTTOM edge`
      )
      .toBeLessThanOrEqual(viewport.height + 0.5);
  }
}

for (const viewport of TRAP_VIEWPORTS) {
  test.describe(`S1 traps at ${viewport.width}x${viewport.height}`, () => {
    test(`pending session never traps: no mini bar, no locked Start buttons (RUN-06/07/08) @ ${viewport.width}px`, async ({
      browser,
    }) => {
      const { context, page } = await openContext(browser, viewport);

      await startEmptyWorkout(page);

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

    test(`picker returns to the workout in one step with confirmation (XPK-15/16) @ ${viewport.width}px`, async ({
      browser,
    }) => {
      const { context, page } = await openContext(browser, viewport);

      await startEmptyWorkout(page);
      await addBenchPress(page);

      // addBenchPress already asserted the ONE-navigation return; the add
      // must also be confirmed visibly.
      await expect(page.getByText(/added to your workout/i)).toBeVisible({
        timeout: 10_000,
      });

      await context.close();
    });

    test(`engaged session shows the mini bar above the tab bar with a stop control (RUN-01/02) @ ${viewport.width}px`, async ({
      browser,
    }) => {
      const { context, page } = await openContext(browser, viewport);

      // The live session lives in this context's localStorage: build it here.
      // The first Play press opens the S4 start countdown; Skip begins the
      // workout immediately.
      await startEmptyWorkout(page);
      await page
        .getByRole("button", { name: "Start the workout timer" })
        .click();
      await page.getByRole("button", { name: "Skip countdown" }).click();
      await expect(
        page.getByRole("button", { name: "Pause the workout timer" })
      ).toBeVisible();
      await page.goto("/workouts");

      const stop = page.getByRole("button", { name: "Stop this workout" });
      await expect(stop).toBeVisible();

      // The dock must clear the bottom nav entirely, and must itself fit
      // the viewport (an off-screen stop control is the RUN-01 trap again).
      const clear = await page.evaluate(() => {
        const nav = document.querySelector('nav[aria-label="Primary"]');
        const dock = document.querySelector(".bottom-above-tabbar");
        if (!nav || !dock) {
          return { ok: false as const, reason: "nav or dock missing" };
        }
        const n = nav.getBoundingClientRect();
        const d = dock.getBoundingClientRect();
        return {
          ok: d.bottom <= n.top + 1,
          navTop: n.top,
          dockBottom: d.bottom,
        };
      });
      expect(clear.ok, JSON.stringify(clear)).toBe(true);
      await expectFullyInsideViewport(
        page.locator(".bottom-above-tabbar").first(),
        viewport,
        "active-workout mini bar"
      );

      await context.close();
    });

    test(`finish never defaults unchecked sets to done and refuses an empty save (RUN-72) @ ${viewport.width}px`, async ({
      browser,
    }) => {
      const { context, page } = await openContext(browser, viewport);

      // Self-contained setup: empty workout + one exercise (its default set
      // rows enable Finish while none are checked).
      await startEmptyWorkout(page);
      await addBenchPress(page);

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
      expect(page.url()).toContain("/workouts/active");

      // Clean up: discard the session so later runs start clean.
      await dialog.getByRole("button", { name: "Cancel" }).click();
      await page
        .getByRole("button", { name: "Discard workout" })
        .first()
        .click();
      await page
        .locator('[role="alertdialog"]')
        .last()
        .getByRole("button", { name: "Discard workout" })
        .click();
      await page.waitForURL("**/workouts", { timeout: 15_000 });

      await context.close();
    });

    test(`duplicate custom-exercise names are refused (XCU-13) @ ${viewport.width}px`, async ({
      browser,
    }) => {
      const { context, page } = await openContext(browser, viewport);
      const name = `Trap Test Press ${viewport.width} ${Date.now().toString(36)}`;

      for (const attempt of [1, 2]) {
        await page.goto("/workouts/exercises/new");
        // `.first()` (S0c): under the cold 2-worker sweep this resolved to
        // TWO empty copies of the field on attempt 2's `goto`, a transient of
        // the hard navigation landing while the post-save router.replace +
        // router.refresh from attempt 1 was still in flight. It does not
        // reproduce warm (see the S0c closing report); the trap under test is
        // the duplicate-NAME refusal, not element identity, so the selector
        // stops being strict-mode-fragile about it.
        await page
          .getByPlaceholder("Enter the name of your exercise")
          .first()
          .fill(name);
        await page.getByRole("button", { name: "Save exercise" }).click();
        if (attempt === 1) {
          await expect(page.getByText(/added to your exercises/i)).toBeVisible(
            {
              timeout: 10_000,
            }
          );
        } else {
          await expect(
            page.getByText(/You already have an exercise named/i)
          ).toBeVisible({ timeout: 10_000 });
        }
      }

      await context.close();
    });

    test(`explainer popover closes on Escape, scroll, and tap-away (SYS-04) @ ${viewport.width}px`, async ({
      browser,
    }) => {
      const { context, page } = await openContext(browser, viewport);

      // The "?" explainers appear once the account has data, so earn them:
      // finish one real workout (empty session + one exercise + one logged
      // set).
      await startEmptyWorkout(page);
      await addBenchPress(page);

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
      await expect.poll(popoverOpen, { timeout: 5_000 }).toBeGreaterThan(0);
      await page.keyboard.press("Escape");
      await expect.poll(popoverOpen, { timeout: 5_000 }).toBe(0);

      await help.click();
      await expect.poll(popoverOpen, { timeout: 5_000 }).toBeGreaterThan(0);
      await page.mouse.wheel(0, 250);
      await expect.poll(popoverOpen, { timeout: 5_000 }).toBe(0);

      // Tap-away closes it too (the third leg of the dismissal contract).
      await help.scrollIntoViewIfNeeded();
      await help.click();
      await expect.poll(popoverOpen, { timeout: 5_000 }).toBeGreaterThan(0);
      await page.mouse.click(5, 5);
      await expect.poll(popoverOpen, { timeout: 5_000 }).toBe(0);

      await context.close();
    });
  });
}

/**
 * RUN-68 / RUN-70: the Finish control and the finish dialog must be fully
 * visible and clickable at every phone width. This assertion did not exist
 * when RUN-68 shipped; it is the direct regression pin for "the red Finish
 * button is completely cut off by the right edge of the screen".
 */
for (const viewport of FINISH_VIEWPORTS) {
  test(`Finish button and finish dialog fit the viewport and work (RUN-68/70) @ ${viewport.width}px`, async ({
    browser,
  }) => {
    const { context, page } = await openContext(browser, viewport);

    await startEmptyWorkout(page);
    await addBenchPress(page);

    // The Finish control: fully inside the viewport, horizontally AND (after
    // an explicit scroll-to) vertically, and actually clickable.
    const finish = page.getByRole("button", { name: "Finish", exact: true });
    await expect(finish).toBeVisible();
    await finish.scrollIntoViewIfNeeded();
    await expectFullyInsideViewport(finish, viewport, "Finish button", {
      vertical: true,
    });
    await finish.click();

    // The finish dialog: fits the viewport on all four edges (RUN-70 was the
    // dialog cut off at the top), and its own primary action is reachable.
    const dialog = page.locator('[role="alertdialog"]').last();
    await expect(dialog).toBeVisible();
    await expectFullyInsideViewport(dialog, viewport, "finish dialog", {
      vertical: true,
    });
    const save = dialog.getByRole("button", { name: "Finish and save" });
    await expect(save).toBeVisible();
    await expectFullyInsideViewport(
      save,
      viewport,
      "finish dialog primary action",
      { vertical: true }
    );

    // Prove clickability end to end: the empty save is refused with the
    // corrective message (RUN-72 contract), which also confirms the tap
    // landed on the control rather than a covering element.
    await save.click();
    await expect(page.getByText(/Nothing is checked off yet/i)).toBeVisible({
      timeout: 10_000,
    });

    await context.close();
  });
}

/**
 * FINISH-FLOW FIXES (owner flaw list 2026-07-22, S1 session):
 *
 *   Flash      Confirming Finish used to clear the session BEFORE router.push,
 *              so the player re-rendered into "No workout is running" for the
 *              seconds the complete page took to server-render. The session is
 *              now cleared on player unmount, after navigation commits.
 *   Duration   The finish dialog shows the timed duration and lets the member
 *              correct it; the corrected value is what saves, and it feeds the
 *              calorie estimate (duration is an energy input).
 *   Cancel     Both runner dialogs dismiss with the standard "Cancel", not
 *              the themed "Keep lifting".
 *   Plan note  A plan-day exercise renders its note ONCE (the note chip); the
 *              "Plan:" target line no longer embeds a second copy.
 */

/** Arm a detector for a VISIBLE empty-player screen. router.push is a soft
 *  navigation, so the observer survives into the complete page. Visibility
 *  matters: Next.js retains outgoing route segments hidden in the DOM, and
 *  the stale player re-rendering "No workout is running" inside one of those
 *  is invisible and harmless; the defect under test is the member SEEING it. */
async function armFlashDetector(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __sawEmptyPlayer?: boolean };
    w.__sawEmptyPlayer = false;
    const check = () => {
      if (w.__sawEmptyPlayer) {
        return;
      }
      const el = [...document.querySelectorAll("p")].find(
        (p) => p.textContent === "No workout is running"
      );
      if (el && el.offsetParent !== null) {
        w.__sawEmptyPlayer = true;
      }
    };
    check();
    new MutationObserver(check).observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["style", "class", "hidden", "inert"],
    });
  });
}

async function expectNoFlash(page: Page) {
  const saw = await page.evaluate(
    () => (window as unknown as { __sawEmptyPlayer?: boolean }).__sawEmptyPlayer
  );
  expect(
    saw,
    'the "No workout is running" screen flashed between Finish and the complete page'
  ).toBe(false);
}

/** Read a complete-page stat tile's value by its label ("Duration").
 *  `visible=true` skips copies inside Next's hidden retained segments. */
async function statTileValue(page: Page, label: string): Promise<string> {
  const value = await page
    .locator(`text="${label}" >> visible=true`)
    .locator("xpath=preceding-sibling::div[1]")
    .textContent();
  return (value ?? "").trim();
}

test.describe("finish-flow fixes (2026-07-22)", () => {
  const viewport = { width: 384, height: 832 };

  test("finish never flashes the empty player, and the edited duration reaches the saved workout and its calorie estimate", async ({
    browser,
  }) => {
    const { context, page } = await openContext(browser, viewport);

    // A weigh-in makes the calorie estimate computable on the complete page.
    const sql = postgres(process.env.POSTGRES_URL as string, { max: 1 });
    try {
      await sql`
        INSERT INTO "ProgressEntry" ("userId", "recordedAt", "weight", "unit")
        SELECT id, now(), 185, 'lb' FROM "User" WHERE email = ${email}
      `;
    } finally {
      await sql.end();
    }

    // One full finish, with the duration corrected to `minutes` in the
    // dialog. Returns the complete page's Duration and calorie tiles.
    async function finishWith(
      minutes: number
    ): Promise<{ duration: string; kcal: number }> {
      await startEmptyWorkout(page);
      await addBenchPress(page);
      await page.getByLabel(/Weight in lb for set 1/).fill("100");
      await page.getByLabel(/Reps for set 1/).fill("5");
      await page.getByRole("button", { name: /Log set 1 .* as done/ }).click();
      await page.getByRole("button", { name: "Finish", exact: true }).click();

      const dialog = page.locator('[role="alertdialog"]').last();
      await expect(dialog).toBeVisible();
      // The dismiss is the standard Cancel, never themed copy.
      await expect(
        dialog.getByRole("button", { name: "Cancel", exact: true })
      ).toBeVisible();
      await expect(
        dialog.getByRole("button", { name: "Keep lifting" })
      ).toHaveCount(0);

      // The timed duration is shown and editable.
      const minField = dialog.getByLabel("Duration, minutes");
      await expect(minField).toBeVisible();
      await minField.fill(String(minutes));
      await dialog.getByLabel("Duration, seconds").fill("0");

      await armFlashDetector(page);
      await dialog.getByRole("button", { name: "Finish and save" }).click();
      await page.waitForURL("**/workouts/history/**", { timeout: 30_000 });
      await expect(page.getByText("Workout complete")).toBeVisible({
        timeout: 60_000,
      });
      await expectNoFlash(page);

      // The session ended cleanly: no mini bar resurrecting it.
      await expect(
        page.getByRole("button", { name: "Stop this workout" })
      ).toHaveCount(0);

      const duration = await statTileValue(page, "Duration");
      const kcalText = await statTileValue(page, "cal estimated");
      return { duration, kcal: Number(kcalText.replace(/\D/g, "")) };
    }

    const short = await finishWith(10);
    expect(short.duration).toBe("10 min");
    const long = await finishWith(60);
    expect(long.duration).toBe("1 h");
    // Duration is a calorie input: a longer corrected duration must raise
    // the estimate for the same logged work.
    expect(long.kcal).toBeGreaterThan(short.kcal);

    // Back-nav must not find a zombie session.
    await page.goto("/workouts/active");
    await expect(page.getByText("No workout is running")).toBeVisible();

    await context.close();
  });

  test("a Chad plan day shows each exercise note once and finishes without the flash", async ({
    browser,
  }) => {
    const { context, page } = await openContext(browser, viewport);

    const days = JSON.stringify([
      {
        name: "Day 1: Push",
        exercises: [
          {
            name: "Barbell Bench Press",
            sets: 2,
            reps: "4-6",
            weight: 185,
            unit: "lb",
            note: "RPE 8",
          },
        ],
      },
    ]);
    const sql = postgres(process.env.POSTGRES_URL as string, { max: 1 });
    try {
      await sql`
        INSERT INTO "Plan" ("userId", "title", "detail", "kind", "status", "source", "days")
        SELECT id, 'S1 Trap Plan', 'Day 1: Push - Bench 2 x 4-6 @ 185 lb (RPE 8)',
               'training', 'active', 'chad', ${days}::json
        FROM "User" WHERE email = ${email}
      `;
    } finally {
      await sql.end();
    }

    await page.goto("/workouts");
    await page
      .getByRole("button", { name: "Start Day 1: Push", exact: true })
      .click();
    await page.waitForURL("**/workouts/active**");

    // The prescription line carries no note copy; the note chip is the ONE
    // place the note renders.
    const planLine = page.locator("p", { hasText: "Plan:" }).first();
    await expect(planLine).toContainText("2 x 4-6 @ 185 lb");
    await expect(planLine).not.toContainText("RPE 8");
    await expect(page.getByText("RPE 8", { exact: true })).toHaveCount(1);

    // Same no-flash contract when a plan day finishes.
    await page.getByRole("button", { name: /Log set 1 .* as done/ }).click();
    await page.getByRole("button", { name: "Finish", exact: true }).click();
    const dialog = page.locator('[role="alertdialog"]').last();
    await armFlashDetector(page);
    await dialog.getByRole("button", { name: "Finish and save" }).click();
    await page.waitForURL("**/workouts/history/**", { timeout: 30_000 });
    await expect(page.getByText("Workout complete")).toBeVisible({
      timeout: 15_000,
    });
    await expectNoFlash(page);

    await context.close();
  });
});
