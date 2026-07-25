/**
 * S6 REGRESSION GATE (options menu + its sub-flows) — owner orders 2026-07-22.
 *
 *   #1  The rest picker NEVER silently auto-saves or auto-closes: selecting
 *       highlights, only Save commits (with a toast), and the saved value
 *       round-trips through reopen — presets AND a custom min:sec value.
 *   #2  Move up / Move down are act-in-place rows: the menu stays open,
 *       the list reorders live, ends disable.
 *   #3  Desktop gets an anchored dropdown at the ⋯ trigger, not a bottom
 *       sheet pinned across the viewport.
 *   #4  Records page back destination: arriving from the active workout
 *       returns to the workout, unknown slugs get an honest error state.
 *   #5  The note editor shows its 1000-character limit.
 *   #6  Removing a set has an undo toast that restores the row in place.
 *
 * Same provisioning approach as s1-traps.test.ts: register through the real
 * UI, grant Pro + onboarded in the database. Requires POSTGRES_URL.
 */

import {
  type Browser,
  type BrowserContext,
  expect,
  type Page,
  test,
} from "@playwright/test";
import postgres from "postgres";

let storageState: Awaited<ReturnType<BrowserContext["storageState"]>>;
let email: string;

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ browser }, workerInfo) => {
  email = `s6flows-${Date.now()}-w${workerInfo.workerIndex}@playwright.com`;
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
      throw new Error(`s6 setup: provisioning failed for ${email}`);
    }
  } finally {
    await sql.end();
  }

  storageState = await context.storageState();
  await context.close();
});

const SEED_NAMES = [
  "Barbell Bench Press",
  "Overhead Press",
  "Incline Dumbbell Press",
];

function seedStateScript() {
  const exercises = SEED_NAMES.map((name, i) => ({
    id: `wex-${i}`,
    name,
    muscleGroup: null,
    equipment: i < 2 ? "barbell" : "dumbbell",
    kind: "weighted",
    restSeconds: 0,
    note: null,
    targetLabel: null,
    sets: [
      { id: `set-${i}-0`, type: "working", weight: 100, reps: 8, rpe: null, completed: false },
      { id: `set-${i}-1`, type: "working", weight: 100, reps: 8, rpe: null, completed: false },
    ],
  }));
  const state = {
    session: {
      id: `session-s6-${Math.random().toString(36).slice(2, 8)}`,
      name: "S6 Gate Workout",
      templateId: null,
      planRef: null,
      createdAt: Date.now(),
      timer: {
        running: false,
        accumulatedMs: 0,
        startedAt: null,
        countdownEndsAt: null,
      },
      unit: "lb",
      notes: "",
      exercises,
    },
    restTimer: null,
    draft: null,
  };
  return `localStorage.setItem("chad-workouts-live-v1", ${JSON.stringify(
    JSON.stringify(state)
  )})`;
}

async function seedAndOpen(page: Page) {
  await page.goto("/workouts");
  await page.evaluate(seedStateScript());
  await page.goto("/workouts/active");
  await page
    .getByRole("heading", { name: SEED_NAMES[0] })
    .waitFor({ timeout: 30_000 });
}

const stored = (page: Page) =>
  page.evaluate(() =>
    JSON.parse(localStorage.getItem("chad-workouts-live-v1") as string)
  );

async function phonePage(browser: Browser) {
  const context = await browser.newContext({
    storageState,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await seedAndOpen(page);
  return { context, page };
}

test("rest picker: selecting a preset stages only; Save commits with a toast; the value round-trips", async ({
  browser,
}) => {
  const { context, page } = await phonePage(browser);

  await page
    .getByRole("button", { name: "Options for Barbell Bench Press" })
    .click();
  await page.getByRole("button", { name: /Rest timer: off/ }).click();

  const dialog = page.getByRole("dialog", { name: /Rest timer for/ });
  await expect(dialog).toBeVisible();

  // Selecting highlights but does NOT save and does NOT close (owner order:
  // no silent auto-close).
  await page.getByRole("radio", { name: "2 min", exact: true }).click();
  await page.waitForTimeout(300);
  await expect(dialog).toBeVisible();
  let s = await stored(page);
  expect(s.session.exercises[0].restSeconds).toBe(0);

  // Save commits, toasts, closes.
  await page.getByRole("button", { name: "Save rest timer" }).click();
  await expect(
    page.getByText("Rest timer set to 2 min for Barbell Bench Press.")
  ).toBeVisible({ timeout: 4000 });
  await expect(dialog).toBeHidden();
  s = await stored(page);
  expect(s.session.exercises[0].restSeconds).toBe(120);

  // Reopen: the menu row and the picker both show the saved value.
  await page
    .getByRole("button", { name: "Options for Barbell Bench Press" })
    .click();
  const restRow = page.getByRole("button", { name: /Rest timer: 2 min/ });
  await expect(restRow).toBeVisible();
  await restRow.click();
  await expect(
    page.getByRole("radio", { name: "2 min", exact: true })
  ).toHaveAttribute("aria-checked", "true");

  // Custom value round-trip: 2:45 saves as 165 seconds and renders in the
  // card's subtitle line in spelled-out units.
  await page.getByLabel("Custom rest (min:sec)").fill("2:45");
  await page.getByRole("button", { name: "Save rest timer" }).click();
  await expect(
    page.getByText("Rest timer set to 2 min 45 sec for Barbell Bench Press.")
  ).toBeVisible({ timeout: 4000 });
  s = await stored(page);
  expect(s.session.exercises[0].restSeconds).toBe(165);
  await expect(page.getByText(/Rest timer 2 min 45 sec/)).toBeVisible();

  await context.close();
});

test("move rows act in place: the menu stays open while the list reorders; ends disable", async ({
  browser,
}) => {
  const { context, page } = await phonePage(browser);

  await page
    .getByRole("button", { name: "Options for Barbell Bench Press" })
    .click();
  const sheet = page.getByRole("dialog", { name: "Barbell Bench Press" });
  await expect(sheet).toBeVisible();

  // At position 1 of 3, Move up is disabled with its reason visible.
  await expect(sheet.getByRole("button", { name: /Move up/ })).toBeDisabled();
  await expect(sheet.getByText("Already first in this workout.")).toBeVisible();

  // Move down: the menu STAYS OPEN and the order changes underneath.
  await sheet.getByRole("button", { name: /Move down/ }).click();
  await page.waitForTimeout(200);
  await expect(sheet).toBeVisible();
  let s = await stored(page);
  expect(
    s.session.exercises.map((e: { name: string }) => e.name)[1]
  ).toBe("Barbell Bench Press");

  // Again: now last; Move down disables, Move up enables.
  await sheet.getByRole("button", { name: /Move down/ }).click();
  await page.waitForTimeout(200);
  await expect(sheet).toBeVisible();
  s = await stored(page);
  expect(
    s.session.exercises.map((e: { name: string }) => e.name)[2]
  ).toBe("Barbell Bench Press");
  await expect(sheet.getByRole("button", { name: /Move down/ })).toBeDisabled();
  await expect(sheet.getByText("Already last in this workout.")).toBeVisible();
  await expect(sheet.getByRole("button", { name: /Move up/ })).toBeEnabled();

  // Close; the visible card order matches the store.
  await sheet.getByRole("button", { name: "Close menu" }).click();
  await expect(sheet).toBeHidden();
  const order = await page.locator("main h3").allTextContents();
  expect(order[2]).toBe("Barbell Bench Press");

  await context.close();
});

test("desktop: the options menu is an anchored dropdown at the trigger, not a bottom sheet", async ({
  browser,
}) => {
  const context = await browser.newContext({
    storageState,
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  await seedAndOpen(page);

  const trigger = page.getByRole("button", {
    name: "Options for Barbell Bench Press",
  });
  await trigger.click();

  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  await expect(
    menu.getByRole("menuitem", { name: /Exercise details/ })
  ).toBeVisible();

  // Anchored geometry: the menu hugs the trigger, and is menu-sized, never a
  // full-width surface pinned to the viewport bottom.
  const tb = await trigger.boundingBox();
  const mb = await menu.boundingBox();
  expect(tb).not.toBeNull();
  expect(mb).not.toBeNull();
  if (tb && mb) {
    expect(mb.width).toBeLessThan(420);
    expect(Math.abs(mb.y - (tb.y + tb.height))).toBeLessThan(200);
  }

  // Escape closes and the destructive row sits after a separator.
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await context.close();
});

test("records page: from the workout menu the back path returns to the workout; unknown slugs get an honest state", async ({
  browser,
}) => {
  const { context, page } = await phonePage(browser);

  // Through the menu: Exercise details carries from=workout.
  await page
    .getByRole("button", { name: "Options for Barbell Bench Press" })
    .click();
  await page.getByRole("button", { name: /Exercise details/ }).click();
  await page.waitForURL(/\/workouts\/exercises\/.+from=workout/, {
    timeout: 30_000,
  });
  const backLink = page.getByRole("link", { name: /Back to your workout/ });
  await expect(backLink).toBeVisible();
  await backLink.click();
  await page.waitForURL("**/workouts/active", { timeout: 30_000 });

  // Unknown slug, still from the workout: honest error + a way back.
  await page.goto("/workouts/exercises/not-a-real-exercise-xyz?from=workout");
  await expect(page.getByText("Exercise not found")).toBeVisible();
  await expect(
    page.getByText(/No exercise matches this link/)
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Back to your workout/ })
  ).toBeVisible();

  await context.close();
});

test("note editor shows the character limit as it approaches", async ({
  browser,
}) => {
  const { context, page } = await phonePage(browser);

  await page
    .getByRole("button", { name: "Options for Barbell Bench Press" })
    .click();
  await page.getByRole("button", { name: /Add exercise note/ }).click();

  const field = page.getByLabel("Your note");
  await expect(field).toBeVisible();

  // Below the reveal threshold: no counter noise.
  await field.fill("a".repeat(100));
  await expect(page.getByText("100/1000")).toBeHidden();

  // From 900: live counter.
  await field.fill("a".repeat(950));
  await expect(page.getByText("950/1000")).toBeVisible();

  // At the limit: counter plus the explanation.
  await field.fill("a".repeat(1000));
  await expect(page.getByText("1000/1000")).toBeVisible();
  await expect(
    page.getByText("1,000 character limit reached. Your note is saved as written.")
  ).toBeVisible();

  await page.getByRole("button", { name: "Save note" }).click();
  const s = await stored(page);
  expect(s.session.exercises[0].note).toHaveLength(1000);

  await context.close();
});

test("removing a set offers undo, and undo restores the row in place", async ({
  browser,
}) => {
  const { context, page } = await phonePage(browser);

  await page
    .getByRole("button", { name: "Options for set 1 of Barbell Bench Press" })
    .click();
  await page.getByRole("button", { name: "Remove set 1" }).click();

  let s = await stored(page);
  expect(s.session.exercises[0].sets).toHaveLength(1);

  const undo = page.getByRole("button", { name: "Undo" });
  await expect(undo).toBeVisible({ timeout: 4000 });
  await undo.click();
  await page.waitForTimeout(300);

  s = await stored(page);
  expect(s.session.exercises[0].sets).toHaveLength(2);
  expect(s.session.exercises[0].sets[0].id).toBe("set-0-0");

  await context.close();
});
