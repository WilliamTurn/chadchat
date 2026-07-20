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
 *   SYS-16  The in-app back control on a detail page names its destination
 *           and lands there. RC-1 made it referrer-aware (plain "Back" that
 *           walked history); RC-11 (Q-D, WKT-38/39) reverted that leg because
 *           a label that cannot name where it goes cannot be honest, and on
 *           /workouts it walked members back into the workout they had just
 *           exited. The contract is now: the label IS the destination.
 *   SYS-15  Returning to a long page via the bottom nav preserves scroll
 *           position (the RC-1 NavTracker scroll memory).
 *   RPT-02  /reports has a back control at all, and it names its destination.
 *   GOL-05  The goal-detail back control names and reaches its parent
 *           listing, from a cold entry and from any in-app referrer alike.
 *   CMP-16  The workout-complete celebration has a top back control like
 *           every other workout page.
 *   RC-11   Every route the Q-D rename retired still resolves: the old URL
 *           permanently redirects to the new one, so bookmarks, Chad's
 *           deep-links, and exported PDFs keep working.
 *   XPK-15  A toast fired right before a navigation survives it (RC-5:
 *           the one root-layout Toaster is the only render surface), both
 *           inside a feature (picker add) and across route groups.
 *   RC-4    Every photo affordance offers a one-tap camera AND a gallery
 *           path (SYS-22/NUT-14/BOD-08): the shared PhotoInput renders both
 *           buttons on a phone, the camera leg asserted at attribute level
 *           (Playwright cannot drive a real camera), the gallery leg driven
 *           by a real file upload through preview and submit.
 *
 * The sibling "?" popover contract (SYS-04) is gated in s1-traps.test.ts on
 * a live surface (Escape, scroll, tap-away). The workouts-feature
 * ConfirmDialog (the second confirm primitive) is driven end to end by the
 * s1-traps discard/finish flows.
 *
 * Fixture-driven tests need no auth (dev-only pages); the member-flow tests
 * provision a Pro user the same way surface-smoke.test.ts does.
 */

import path from "node:path";
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
/** A goal owned by the provisioned user, for the GOL-05 back gate. */
let goalId: string;

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
    const [goalRow] = await sql`
      INSERT INTO "Goal" ("userId", "title", "detail")
      VALUES (
        ${updated[0].id},
        'Bench 225 for five reps',
        'Seeded by the interaction-contract gate (GOL-05).'
      )
      RETURNING id
    `;
    goalId = goalRow.id as string;
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
  await page.waitForURL("**/workouts/active**");
  await page.getByRole("button", { name: "Start the workout timer" }).click();
  await page.goto("/workouts");
  await expect(
    page.getByRole("button", { name: "Stop this workout" })
  ).toBeVisible({ timeout: 10_000 });

  // The Next.js dev-tools badge (<nextjs-portal>) floats over the bottom-left
  // corner in dev and would swallow the "Home" tap. It does not exist in
  // prod; strip it so only PRODUCT overlays can fail this gate.
  await page.addStyleTag({
    content: "nextjs-portal { display: none !important; }",
  });

  // Every routed tab must still take the tap. Playwright refuses the click
  // if another element would swallow the pointer, which is exactly the trap.
  const nav = page.locator('nav[aria-label="Primary"]');
  await nav.getByRole("link", { name: "Progress" }).click();
  await expect(page).toHaveURL(/\/progress/, { timeout: 15_000 });
  await nav.getByRole("link", { name: "Home" }).click();
  await expect(page).toHaveURL(/\/home/, { timeout: 15_000 });

  await context.close();
});

/* --------------------------------------------------------------------------
 * SYS-16 / SYS-15: back names where it goes and goes there; scroll position
 * survives. RC-1 made the control referrer-aware and NavTracker (PageShell)
 * owns scroll memory per pathname. RC-11 (Q-D, WKT-38/39) removed the
 * referrer leg: the control is now always an explicit labeled destination,
 * so it can never read "Back" and land somewhere it did not name. Scroll
 * memory is unaffected (it belongs to NavTracker, not the back control).
 * ------------------------------------------------------------------------ */

/** The RC-1 nav stack records a page from a client effect; a test that
 *  navigates away instantly can outrun it. Wait for the record. */
function waitForTracked(page: Page, path: string) {
  return page.waitForFunction((tracked) => {
    try {
      const stack = JSON.parse(
        window.sessionStorage.getItem("nav.stack") ?? "[]"
      ) as string[];
      return stack.includes(tracked);
    } catch {
      return false;
    }
  }, path);
}

test("back names its destination and lands there, referrer or not (SYS-16, WKT-39)", async ({
  browser,
}) => {
  const { context, page } = await openPage(browser, { authed: true });

  // Arrive at /hydration FROM /progress, the case that used to flip the
  // control to a bare "Back" that walked history.
  await page.goto("/progress");
  await page.locator('a[href^="/hydration"]').first().click();
  await expect(page).toHaveURL(/\/hydration/, { timeout: 15_000 });
  await waitForTracked(page, "/progress");

  // It still names Home, and it still goes to Home. An in-app referrer no
  // longer changes either the label or the destination.
  const back = page
    .locator("main")
    .getByRole("link", { name: "Back to Home", exact: true });
  await expect(back).toBeVisible({ timeout: 15_000 });
  await back.click();
  await expect(page).toHaveURL(/\/home(?:$|\?)/, { timeout: 10_000 });

  await context.close();
});

test("back never walks history into the workout just exited (WKT-38)", async ({
  browser,
}) => {
  const { context, page } = await openPage(browser, { authed: true });

  // The register's exact trap: the member leaves the active workout for the
  // /workouts index, then reaches for back. It must not return them to the
  // runner they deliberately left.
  await page.goto("/workouts/active");
  await waitForTracked(page, "/workouts/active");
  await page.goto("/workouts");

  const back = page
    .locator("main")
    .getByRole("link", { name: "Back to Home", exact: true });
  await expect(back).toBeVisible({ timeout: 30_000 });
  await back.click();
  await expect(page).toHaveURL(/\/home(?:$|\?)/, { timeout: 15_000 });

  await context.close();
});

test("returning to a long page preserves scroll position (SYS-15)", async ({
  browser,
}) => {
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
  // The scroll save is rAF-throttled; make sure the departure position is
  // recorded before navigating away.
  await page.waitForFunction((y) => {
    try {
      const map = JSON.parse(
        window.sessionStorage.getItem("nav.scroll") ?? "{}"
      ) as Record<string, number>;
      return (map["/progress"] ?? 0) >= y * 0.9;
    } catch {
      return false;
    }
  }, departedAt);

  // Leave for a detail page, then return the way the register describes:
  // via the bottom nav, the only route back from several pages.
  await page.locator('a[href^="/hydration"]').first().click();
  await expect(page).toHaveURL(/\/hydration/, { timeout: 15_000 });
  await page
    .locator('nav[aria-label="Primary"]')
    .getByRole("link", { name: "Progress" })
    .click();
  await expect(page).toHaveURL(/\/progress/, { timeout: 15_000 });

  // Restoration tops up while Suspense content streams in, so poll rather
  // than reading window.scrollY once.
  await expect
    .poll(() => page.evaluate(() => window.scrollY), { timeout: 15_000 })
    .toBeGreaterThan(departedAt * 0.5);

  await context.close();
});

/* --------------------------------------------------------------------------
 * RC-1 regression rows: one per back control the wave added.
 * ------------------------------------------------------------------------ */

test("/reports has a back control and it names Home (RPT-02)", async ({
  browser,
}) => {
  // Cold entry: the control promises its destination by name.
  const cold = await openPage(browser, { authed: true });
  await cold.page.goto("/reports");
  await expect(
    cold.page
      .locator("main")
      .getByRole("link", { name: "Back to Home", exact: true })
  ).toBeVisible({ timeout: 30_000 });
  await cold.context.close();

  // Arriving from /progress (the register's trap): same label, same landing.
  const { context, page } = await openPage(browser, { authed: true });
  await page.goto("/progress");
  await waitForTracked(page, "/progress");
  await page.goto("/reports");
  await page
    .locator("main")
    .getByRole("link", { name: "Back to Home", exact: true })
    .click();
  await expect(page).toHaveURL(/\/home(?:$|\?)/, { timeout: 15_000 });
  await context.close();
});

test("goal detail names and reaches its parent listing (GOL-05)", async ({
  browser,
}) => {
  const { context, page } = await openPage(browser, { authed: true });

  // Arrive at the goal document FROM /progress, not from /goals. The
  // referrer no longer steers the control: it named Goals, so it goes to
  // Goals.
  await page.goto("/progress");
  await waitForTracked(page, "/progress");
  await page.goto(`/goals/${goalId}`);
  await page
    .locator("main")
    .getByRole("link", { name: "Back to Goals", exact: true })
    .click();
  await expect(page).toHaveURL(/\/goals(?:$|\?)/, { timeout: 15_000 });
  await context.close();

  // Cold entry promises the same parent listing by the same name.
  const cold = await openPage(browser, { authed: true });
  await cold.page.goto(`/goals/${goalId}`);
  await expect(
    cold.page
      .locator("main")
      .getByRole("link", { name: "Back to Goals", exact: true })
  ).toBeVisible({ timeout: 30_000 });
  await cold.context.close();
});

test("workout complete has a top back control (CMP-15/16)", async ({
  browser,
}) => {
  const { context, page } = await openPage(browser, { authed: true });

  // Finish a real workout to reach the celebration view (same flow the
  // s1-traps suite drives).
  await page.goto("/workouts");
  await page
    .getByRole("button", { name: /start an empty workout/i })
    .first()
    .click();
  await page.waitForURL("**/workouts/active**");
  await page.getByRole("button", { name: "Add your first exercise" }).click();
  await page.waitForURL("**/exercises/pick**");
  await page
    .getByRole("button", { name: /Barbell Bench Press/i })
    .first()
    .click();
  await page.getByRole("button", { name: /Add 1 exercise to/i }).click();
  await page.waitForURL("**/workouts/active**", { timeout: 15_000 });
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
  expect(page.url()).toContain("new=1");

  // The celebration header replaces the standard one; CMP-16 is the top
  // back control it used to lose. Explicit destination (the page behind is
  // the dead workout), same control every other workout page uses. RC-11
  // (Q-28) points it at Home; "Done, back to Workouts" at the foot of the
  // page is the other destination, so both are one tap away.
  const back = page.getByRole("button", {
    name: "Back to Home",
    exact: true,
  });
  await expect(back).toBeVisible({ timeout: 15_000 });
  await back.click();
  await expect(page).toHaveURL(/\/home(?:$|\?)/, { timeout: 15_000 });

  await context.close();
});

/* --------------------------------------------------------------------------
 * XPK-15 / RC-5: a toast fired right before a navigation survives it.
 * The Toaster mounts once in the root layout; per-page mounts died with
 * their page and took the confirmation with them.
 * ------------------------------------------------------------------------ */

test("the picker add confirmation survives the navigation it triggers (XPK-15)", async ({
  browser,
}) => {
  const { context, page } = await openPage(browser, { authed: true });

  // The original sighting: adding an exercise fires the confirmation toast
  // and navigates back to the workout in the same tap.
  await page.goto("/workouts");
  await page
    .getByRole("button", { name: /start an empty workout/i })
    .first()
    .click();
  await page.waitForURL("**/workouts/active**");
  await page.getByRole("button", { name: "Add your first exercise" }).click();
  await page.waitForURL("**/exercises/pick**");
  await page
    .getByRole("button", { name: /Barbell Bench Press/i })
    .first()
    .click();
  await page.getByRole("button", { name: /Add 1 exercise to/i }).click();

  // The toast must still be on screen on the DESTINATION page.
  await page.waitForURL("**/workouts/active**", { timeout: 15_000 });
  await expect(
    page.getByText(/Barbell Bench Press added to your workout/i)
  ).toBeVisible({ timeout: 5_000 });

  await context.close();
});

test("a toast survives a bottom-nav navigation to another route group (XPK-15)", async ({
  browser,
}) => {
  const { context, page } = await openPage(browser, { authed: true });

  // Warm the destination route first so the dev-box compile does not eat
  // the toast's lifetime (prod navigations are instant).
  await page.goto("/home");
  await page.waitForLoadState("networkidle").catch(() => {
    // Proceed if the page never goes idle.
  });

  // Log water on /hydration: the quick-add receipts with a 6s Undo toast.
  await page.goto("/hydration");
  await page
    .getByRole("button", { name: "Log water", exact: true })
    .click({ timeout: 30_000 });
  await page
    .getByRole("button", { name: /Add a glass of water/i })
    .click({ timeout: 10_000 });
  const receipt = page.getByText(/^Added 8 oz\./i);
  await expect(receipt).toBeVisible({ timeout: 15_000 });

  // Leave immediately for a different route group via the bottom nav.
  await page
    .locator('nav[aria-label="Primary"]')
    .getByRole("link", { name: "Home" })
    .click();
  await expect(page).toHaveURL(/\/home/, { timeout: 15_000 });
  await expect(
    receipt,
    "the receipt must still be visible after navigating away"
  ).toBeVisible();

  await context.close();
});

/** The gallery-path fixture: a real 640x480 JPEG under the 5MB limit. */
const PHOTO_FIXTURE = path.join(__dirname, "fixtures", "photo-fixture.jpg");

test("the photo input offers Take photo and Choose from gallery on a phone (RC-4)", async ({
  browser,
}) => {
  const { context, page } = await openPage(browser, { authed: true });

  // /nutrition: the Food Photo mode drives the shared input.
  await page.goto("/nutrition");
  await page.getByRole("button", { name: "Food Photo" }).click();
  const zone = page.locator("#log-meal");
  await expect(zone.getByRole("button", { name: "Take photo" })).toBeVisible();
  await expect(
    zone.getByRole("button", { name: "Choose from gallery" })
  ).toBeVisible();
  // The camera leg is asserted at attribute level (Playwright cannot drive a
  // real camera): capture="environment" is what opens the rear camera in one
  // tap, and the gallery input must NOT carry capture, because capture on a
  // single input forces camera-only on many Android browsers.
  const cameraInput = zone.locator(
    'input[type="file"][capture="environment"]'
  );
  await expect(cameraInput).toHaveCount(1);
  await expect(cameraInput).toHaveAttribute("accept", /image\//);
  await expect(zone.locator('input[type="file"]:not([capture])')).toHaveCount(
    1
  );

  // Label scan shares the same input pair.
  await page.getByRole("button", { name: "Label Photo" }).click();
  await expect(zone.getByRole("button", { name: "Take photo" })).toBeVisible();
  await expect(
    zone.getByRole("button", { name: "Choose from gallery" })
  ).toBeVisible();

  // /progress/body: the progress-photo form exposes the same two affordances.
  await page.goto("/progress/body");
  const entry = page.locator("#log-entry");
  await expect(entry.getByRole("button", { name: "Take photo" })).toBeVisible();
  await expect(
    entry.getByRole("button", { name: "Choose from gallery" })
  ).toBeVisible();
  await expect(
    entry.locator('input[type="file"][capture="environment"]')
  ).toHaveCount(1);

  await context.close();
});

test("a gallery photo flows to preview and submit (RC-4)", async ({
  browser,
}) => {
  const { context, page } = await openPage(browser, { authed: true });

  // Nutrition meal photo: a gallery pick must land in the preview and arm
  // the submit. Stops before the Analyze click on purpose: that leg spends a
  // real AI analysis per gate run; it is driven manually in wave verification.
  await page.goto("/nutrition");
  await page.getByRole("button", { name: "Food Photo" }).click();
  const zone = page.locator("#log-meal");
  await zone
    .locator('input[type="file"]:not([capture])')
    .setInputFiles(PHOTO_FIXTURE);
  await expect(zone.getByRole("img", { name: "Selected" })).toBeVisible();
  await expect(
    zone.getByRole("button", { name: "Analyze Food Photo" })
  ).toBeEnabled();

  // Progress photo: the same gallery path end to end, through the real
  // upload and save (no AI in this flow). Leaves one entry + one small blob
  // on this run's throwaway @playwright.com user.
  await page.goto("/progress/body");
  const entry = page.locator("#log-entry");
  await entry
    .locator('input[type="file"]:not([capture])')
    .setInputFiles(PHOTO_FIXTURE);
  await expect(
    entry.getByRole("img", { name: "Selected progress photo" })
  ).toBeVisible();
  await entry.getByRole("button", { name: "Log entry" }).click();
  await expect(page.getByText("Logged.", { exact: true })).toBeVisible({
    timeout: 30_000,
  });

  await context.close();
});

/* --------------------------------------------------------------------------
 * RC-11 (Q-D): the renamed routes keep their old URLs alive.
 * ------------------------------------------------------------------------ */

test("retired routes permanently redirect to their new home (RC-11)", async ({
  browser,
}) => {
  const { context, page } = await openPage(browser, { authed: true });

  for (const [oldPath, newPattern] of [
    ["/today", /\/home(?:$|\?)/],
    ["/workouts/session", /\/workouts\/active(?:$|\?)/],
    // "Dashboard" is retired as a word, but the guessed URL still lands.
    ["/dashboard", /\/home(?:$|\?)/],
  ] as const) {
    const response = await page.goto(oldPath, { waitUntil: "load" });
    await expect(
      page,
      `${oldPath} must land on its renamed destination`
    ).toHaveURL(newPattern, { timeout: 15_000 });
    // A redirect, not a client-side bounce: the old URL must never render.
    expect(response?.status(), `${oldPath} must resolve, not 404`).toBeLessThan(
      400
    );
  }

  await context.close();
});
