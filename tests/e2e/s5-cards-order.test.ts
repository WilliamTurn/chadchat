/**
 * S5 REGRESSION GATE (active workout cards: order, drag reorder, honest Done
 * column, mark/unmark scopes) — owner orders 2026-07-22.
 *
 *   #1  Exercise order is visible (numbers) and re-sequences after a drag.
 *   #2  Reorder is ONE drag gesture: mouse drag on desktop, long-press drag
 *       at 390px touch. Order persists across a reload (localStorage store).
 *   #3  Done column: unchecked = EMPTY box (no glyph), checked = green check.
 *   #4  Per-exercise "Mark all sets done for this exercise" touches only its
 *       exercise; page-level "Mark all sets done" touches everything.
 *   #5  "Unmark all sets" both scopes: clears checks, never wipes numbers;
 *       the PR toast does NOT re-fire on unmark → re-check.
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
  email = `s5cards-${Date.now()}-w${workerInfo.workerIndex}@playwright.com`;
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
      throw new Error(`s5 setup: provisioning failed for ${email}`);
    }
  } finally {
    await sql.end();
  }

  storageState = await context.storageState();
  await context.close();
});

/** Five known exercises so numbering, drag distance, and scopes are all
 *  exercised. Seeded straight into the store's localStorage mirror — the
 *  same shape a real in-progress workout persists. */
const SEED_NAMES = [
  "Barbell Bench Press",
  "Overhead Press",
  "Incline Dumbbell Press",
  "Triceps Pushdown",
  "Lateral Raise",
];

function seedStateScript(weights: [number, number][][] = []) {
  const exercises = SEED_NAMES.map((name, i) => ({
    id: `wex-${i}`,
    name,
    muscleGroup: null,
    equipment: i < 2 ? "barbell" : "dumbbell",
    kind: "weighted",
    restSeconds: 0,
    note: null,
    targetLabel: null,
    sets: (weights[i] ?? [[100, 8]]).map((pair, j) => ({
      id: `set-${i}-${j}`,
      type: "working",
      weight: pair[0],
      reps: pair[1],
      rpe: null,
      completed: false,
    })),
  }));
  const state = {
    session: {
      id: `session-s5-${Math.random().toString(36).slice(2, 8)}`,
      name: "S5 Gate Workout",
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

async function seedAndOpen(page: Page, weights?: [number, number][][]) {
  await page.goto("/workouts");
  await page.evaluate(seedStateScript(weights));
  await page.goto("/workouts/active");
  await page
    .getByRole("heading", { name: SEED_NAMES[0] })
    .waitFor({ timeout: 30_000 });
}

const cardOrder = (page: Page) => page.locator("main h3").allTextContents();

test("desktop: one mouse drag moves an exercise from position 1 to 4, numbering re-sequences, order survives reload", async ({
  browser,
}) => {
  const context = await browser.newContext({
    storageState,
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  await seedAndOpen(page);

  const handle = page.getByRole("button", {
    name: /Reorder Barbell Bench Press/,
  });
  const target = page.getByRole("heading", { name: "Triceps Pushdown" });
  const sb = await handle.boundingBox();
  const db = await target.boundingBox();
  expect(sb).not.toBeNull();
  expect(db).not.toBeNull();
  if (!(sb && db)) {
    return;
  }
  await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2);
  await page.mouse.down();
  await page.mouse.move(sb.x + 15, sb.y + 15, { steps: 6 });
  await page.mouse.move(db.x + db.width / 2, db.y + db.height / 2 + 20, {
    steps: 25,
  });
  await page.waitForTimeout(250);
  await page.mouse.up();
  await page.waitForTimeout(400);

  const after = await cardOrder(page);
  expect(after.indexOf("Barbell Bench Press")).toBeGreaterThan(0);
  expect(after).toHaveLength(5);

  // Numbering follows the new order: position badge text 1..5 in DOM order,
  // and the sr-only positions restate it.
  const positions = await page
    .locator("main span.sr-only", { hasText: /Exercise \d of 5/ })
    .allTextContents();
  expect(positions).toEqual([1, 2, 3, 4, 5].map((n) => `Exercise ${n} of 5`));

  // Reload: the persisted store carries the dragged order.
  await page.reload();
  await page
    .getByRole("heading", { name: SEED_NAMES[0] })
    .waitFor({ timeout: 30_000 });
  expect(await cardOrder(page)).toEqual(after);
  await context.close();
});

test("390px touch: long-press on the handle lifts and drags in one gesture", async ({
  browser,
}) => {
  const context = await browser.newContext({
    storageState,
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await seedAndOpen(page);
  const before = await cardOrder(page);

  const handle = page.getByRole("button", {
    name: /Reorder Barbell Bench Press/,
  });
  const target = page.getByRole("heading", { name: "Incline Dumbbell Press" });
  const sb = await handle.boundingBox();
  const db = await target.boundingBox();
  expect(sb && db).toBeTruthy();
  if (!(sb && db)) {
    return;
  }
  const cdp = await context.newCDPSession(page);
  const from = { x: sb.x + sb.width / 2, y: sb.y + sb.height / 2 };
  const to = { x: db.x + db.width / 2, y: db.y + db.height / 2 };
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [from],
  });
  // The long-press activation delay (250ms) with the finger held still.
  await page.waitForTimeout(400);
  const steps = 14;
  for (let i = 1; i <= steps; i++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        {
          x: from.x + ((to.x - from.x) * i) / steps,
          y: from.y + ((to.y - from.y) * i) / steps,
        },
      ],
    });
    await page.waitForTimeout(30);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(500);

  const after = await cardOrder(page);
  expect(after, "long-press drag must reorder").not.toEqual(before);
  expect(after.indexOf("Barbell Bench Press")).toBeGreaterThan(0);
  await context.close();
});

test("Done column: unchecked box is EMPTY, checked shows the green glyph, un-check restores empty", async ({
  browser,
}) => {
  const context = await browser.newContext({
    storageState,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await seedAndOpen(page);

  const unchecked = page.getByRole("button", {
    name: "Log set 1 of Barbell Bench Press as done",
  });
  await expect(unchecked.locator("svg")).toHaveCount(0);
  await unchecked.click();
  const checked = page.getByRole("button", {
    name: /Set 1 of Barbell Bench Press is logged/,
  });
  await expect(checked).toHaveAttribute("aria-pressed", "true");
  await expect(checked.locator("svg")).toHaveCount(1);
  await checked.click();
  await expect(
    page.getByRole("button", {
      name: "Log set 1 of Barbell Bench Press as done",
    })
  ).toBeVisible();
  await context.close();
});

test("mark/unmark scopes: per-exercise touches only its exercise; unmark never wipes numbers", async ({
  browser,
}) => {
  const context = await browser.newContext({
    storageState,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await seedAndOpen(page, [
    [
      [222.5, 12],
      [185, 8],
    ],
  ]);

  const stored = () =>
    page.evaluate(() =>
      JSON.parse(localStorage.getItem("chad-workouts-live-v1") as string)
    );

  // Per-exercise mark-all: only Bench (2 sets) completes. (S6: the menu is a
  // role=dialog sheet at phone widths, rows are buttons, labels carry counts.)
  await page
    .getByRole("button", { name: "Options for Barbell Bench Press" })
    .click();
  await page
    .getByRole("button", { name: /Mark \d+ remaining sets? done/ })
    .click();
  await page.waitForTimeout(200);
  let s = await stored();
  expect(
    s.session.exercises.map((e: { sets: { completed: boolean }[] }) =>
      e.sets.every((x) => x.completed)
    )
  ).toEqual([true, false, false, false, false]);

  // Per-exercise unmark: checks clear, weights/reps stay.
  await page
    .getByRole("button", { name: "Options for Barbell Bench Press" })
    .click();
  await page
    .getByRole("button", { name: /Unmark (all \d+ sets|1 set)/ })
    .click();
  await page.waitForTimeout(200);
  s = await stored();
  const bench = s.session.exercises[0];
  expect(bench.sets.every((x: { completed: boolean }) => !x.completed)).toBe(
    true
  );
  expect(
    bench.sets.map((x: { weight: number; reps: number }) => [x.weight, x.reps])
  ).toEqual([
    [222.5, 12],
    [185, 8],
  ]);

  // Page-level mark-all, then page-level unmark-all.
  await page
    .getByRole("button", { name: "Mark every set in this workout as done" })
    .click();
  await page.waitForTimeout(200);
  s = await stored();
  expect(
    s.session.exercises.every((e: { sets: { completed: boolean }[] }) =>
      e.sets.every((x) => x.completed)
    )
  ).toBe(true);
  const unmarkAll = page.getByRole("button", {
    name: "Unmark every set in this workout",
  });
  await expect(unmarkAll).toBeVisible();
  await unmarkAll.click();
  await page.waitForTimeout(200);
  s = await stored();
  expect(
    s.session.exercises.every((e: { sets: { completed: boolean }[] }) =>
      e.sets.every((x) => !x.completed)
    )
  ).toBe(true);
  expect(s.session.exercises[0].sets[0].weight).toBe(222.5);
  await context.close();
});

test("PR toast fires once: unmark then re-check must not re-celebrate", async ({
  browser,
}) => {
  const context = await browser.newContext({
    storageState,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();

  // Build a PR baseline: save a workout with Overhead Press 100x5.
  await seedAndOpen(page, [
    [[100, 5]],
    [[100, 5]],
    [[100, 5]],
    [[100, 5]],
    [[100, 5]],
  ]);
  await page
    .getByRole("button", { name: "Mark every set in this workout as done" })
    .click();
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Finish and save" })
    .click();
  await page.waitForURL("**/workouts/history/**", { timeout: 60_000 });

  // New session, heavier set: checking it is a record.
  await seedAndOpen(page, [[[120, 5]]]);
  const check = page.getByRole("button", {
    name: "Log set 1 of Barbell Bench Press as done",
  });
  await check.click();
  const toast = page.getByText(/New record\./);
  await expect(toast, "first check announces the PR").toBeVisible({
    timeout: 3000,
  });

  // Unmark the exercise, wait out the toast, re-check: silence.
  await page
    .getByRole("button", { name: "Options for Barbell Bench Press" })
    .click();
  await page
    .getByRole("button", { name: /Unmark (all \d+ sets|1 set)/ })
    .click();
  await expect(toast).toBeHidden({ timeout: 6000 });
  await page
    .getByRole("button", { name: "Log set 1 of Barbell Bench Press as done" })
    .click();
  await page.waitForTimeout(1500);
  await expect(toast, "re-check must not re-fire the PR toast").toBeHidden();
  // The trophy badge (persisted prs) still marks the row as a record.
  await expect(page.getByText("PR", { exact: true })).toBeVisible();
  await context.close();
});
