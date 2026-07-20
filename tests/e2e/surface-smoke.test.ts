/**
 * SURFACE SMOKE GATE (extended 2026-07-16 to every member screen + in-flow
 * states).
 *
 * Renders the real member surfaces (not the dev fixtures) at every supported
 * viewport width and verifies the things a member notices immediately:
 *
 *   1. The surface actually renders (no redirect loop, no error screen,
 *      the page's <main> landmark is visible).
 *   2. Nothing overflows horizontally (no sideways scroll on any phone —
 *      the owner's own device is a 384px-wide Samsung; layouts must be
 *      fluid across ALL of these widths, never tuned to one number).
 *   3. Every action control (button/link) sits FULLY inside the viewport
 *      horizontally — the RUN-68 class, where the Finish button shipped
 *      half-clipped by the right screen edge. Controls inside a deliberate
 *      horizontal scroller (filter chips) are exempt: they are reachable.
 *   4. No console errors or uncaught page errors while it renders.
 *
 * Coverage is two sweeps:
 *   - STATIC: every reachable member URL, grouped to stay inside the test
 *     timeout (first-compile on a dev server is slow).
 *   - STATEFUL: the in-flow states the flaws register's worst bugs lived on,
 *     driven for real at every width — live workout ENGAGED with a logged
 *     set, the finish dialog OPEN, the exercise picker mid-flow, workout
 *     complete, and the hydration + sleep logging overlays open.
 *
 * Runs with `pnpm test` (or `pnpm test:smoke` alone). Each worker registers
 * a fresh user through the real /register UI, then grants it an active Pro
 * plan + onboarded flag directly in the database (the same fields the
 * Stripe webhook would set) so the paywall and welcome wizard don't block
 * the dashboards. Requires POSTGRES_URL (loaded from .env.local by
 * playwright.config.ts).
 *
 * NOT covered here (needs data or state this gate can't create cheaply):
 * /goals/[id] and /plans/[id] (need a created goal/plan), /chat/[id],
 * /share/[id], /q/[id], /checkout/success, /welcome (redirects once
 * onboarded), /reports as an ELITE member (a Pro member sees the teaser,
 * which IS swept).
 */

import {
  type Browser,
  type BrowserContext,
  expect,
  type Page,
  test,
} from "@playwright/test";
import postgres from "postgres";
import knownFailures from "./smoke-known-failures.json";

/**
 * Pre-existing defects pinned when the gate was extended (2026-07-16): a
 * pinned screen+check downgrades to a logged warning instead of a failure,
 * so the gate can land while the defect is owed to a fix wave. Entries are
 * only ever REMOVED (the ratchet); the test logs loudly once a pinned entry
 * starts passing so it gets unpinned in the same change that fixed it.
 */
type KnownFailureCheck = "overflow" | "clipped" | "console";
function isKnownFailure(
  surface: string,
  check: KnownFailureCheck,
  width: number
): string | null {
  for (const entry of knownFailures.entries) {
    if (
      entry.surface === surface &&
      entry.check === check &&
      entry.widths.includes(width)
    ) {
      return entry.reason;
    }
  }
  return null;
}

/** Every reachable member screen, grouped so one test stays inside the
 *  240s budget even when the dev server first-compiles each route. */
const SURFACE_GROUPS: Record<string, string[]> = {
  "core-dashboards": [
    "/home",
    "/nutrition",
    "/hydration",
    "/sleep",
    "/workouts",
    "/progress",
  ],
  "training-screens": [
    "/progress/body",
    "/progress/training",
    "/workouts/history",
    "/workouts/exercises",
    "/workouts/exercises/pick",
    "/workouts/exercises/new",
    "/workouts/new",
    "/workouts/cardio",
  ],
  "plans-goals-reports": [
    "/goals",
    "/goals/new",
    "/reports",
    "/plans",
    "/meal-plan",
    "/future-you",
    "/quit-date",
  ],
  "account-misc": [
    "/kitchen",
    "/account",
    "/account/appearance",
    "/help",
    "/files",
    "/pricing",
    "/",
  ],
};

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
  // parallel workers start together.
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
  // Generous: registration on this dev box takes ~40s when routes are cold.
  await page.waitForURL((url) => !url.pathname.startsWith("/register"), {
    timeout: 120_000,
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

type ConsoleLog = string[];

function collectConsoleErrors(page: Page): ConsoleLog {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (
      msg.type() === "error" &&
      !CONSOLE_IGNORE.some((re) => re.test(msg.text()))
    ) {
      errors.push(`[${page.url()}] ${msg.text()}`);
    }
  });
  page.on("pageerror", (err) => {
    errors.push(`[${page.url()}] uncaught: ${err.message}`);
  });
  return errors;
}

async function openMemberContext(
  browser: Browser,
  viewport: { width: number; height: number }
) {
  const context = await browser.newContext({
    storageState,
    viewport: { width: viewport.width, height: viewport.height },
  });
  const page = await context.newPage();
  const consoleErrors = collectConsoleErrors(page);
  return { context, page, consoleErrors };
}

/** Horizontal-overflow measure: content must fit the viewport width. */
async function overflowPx(page: Page): Promise<number> {
  return await page.evaluate(() => {
    const doc = document.documentElement;
    const widest = Math.max(
      doc.scrollWidth,
      document.body ? document.body.scrollWidth : 0
    );
    return widest - doc.clientWidth;
  });
}

type ClippedControl = {
  name: string;
  left: number;
  right: number;
  viewport: number;
};

/**
 * The RUN-68 class, asserted mechanically: every visible action control must
 * sit fully inside the viewport horizontally. A control inside an ancestor
 * that intentionally scrolls horizontally (filter chips, carousels) is
 * reachable by scrolling and therefore exempt. Vertical position is not
 * asserted: pages scroll vertically by design.
 */
async function clippedControls(page: Page): Promise<ClippedControl[]> {
  return await page.evaluate(() => {
    const isScrollableX = (el: Element) => {
      const s = getComputedStyle(el);
      return (
        (s.overflowX === "auto" || s.overflowX === "scroll") &&
        el.scrollWidth > el.clientWidth + 1
      );
    };
    const out: {
      name: string;
      left: number;
      right: number;
      viewport: number;
    }[] = [];
    const vw = document.documentElement.clientWidth;
    const controls = document.querySelectorAll(
      'button, [role="button"], a[href], input[type="submit"]'
    );
    for (const el of controls) {
      // The sidebar rail is a deliberate invisible hit-strip (tabIndex -1)
      // that spans 100vw from the sidebar edge; its usable area is fully
      // in-viewport, so the overshoot hides nothing from the member.
      if (el.closest('[data-slot="sidebar-rail"]')) {
        continue;
      }
      const r = el.getBoundingClientRect();
      // Skip collapsed/hidden controls and sr-only (1px) elements.
      if (r.width <= 1.5 || r.height <= 1.5) {
        continue;
      }
      const style = getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none") {
        continue;
      }
      let parent = el.parentElement;
      let exempt = false;
      while (parent) {
        if (isScrollableX(parent)) {
          exempt = true;
          break;
        }
        parent = parent.parentElement;
      }
      if (exempt) {
        continue;
      }
      if (r.left < -0.5 || r.right > vw + 0.5) {
        out.push({
          name:
            (
              el.getAttribute("aria-label") ||
              el.textContent ||
              "(unnamed)"
            )
              .trim()
              .slice(0, 60) || "(unnamed)",
          left: Math.round(r.left),
          right: Math.round(r.right),
          viewport: vw,
        });
      }
    }
    return out;
  });
}

/** The three per-screen assertions, shared by both sweeps. `surface` is the
 *  stable key known-failure pins match against (a URL for the static sweep,
 *  a "flow:" key for in-flow states). */
async function assertScreenClean(
  page: Page,
  surface: string,
  viewport: { name: string; width: number }
): Promise<void> {
  const label = `${surface} @ ${viewport.name}`;
  // Let streamed/suspended content settle before measuring.
  await page.waitForLoadState("networkidle").catch(() => {
    // Long-polling keeps some pages from ever going idle; proceed.
  });

  // Poll until the screen settles: pre-hydration loading states park
  // transient plumbing off-viewport (e.g. the sidebar rail's 100vw drag
  // strip), which is not a member-facing defect. Only a PERSISTENT
  // overflow or clipped control fails the gate.
  const deadline = Date.now() + 15_000;
  let overflow = 0;
  let clipped: ClippedControl[] = [];
  for (;;) {
    overflow = await overflowPx(page);
    clipped = await clippedControls(page);
    if (overflow <= 1 && clipped.length === 0) {
      break;
    }
    if (Date.now() > deadline) {
      break;
    }
    await page.waitForTimeout(500);
  }

  const overflowPin = isKnownFailure(surface, "overflow", viewport.width);
  if (overflow > 1 && overflowPin) {
    console.warn(
      `KNOWN FAILURE (pinned): ${label} overflows by ${overflow}px. ${overflowPin}`
    );
  } else {
    if (overflow <= 1 && overflowPin) {
      console.warn(
        `PINNED ENTRY NOW PASSING: ${label} overflow. Remove it from smoke-known-failures.json.`
      );
    }
    expect
      .soft(
        overflow,
        `${label}: content overflows the viewport horizontally by ${overflow}px`
      )
      .toBeLessThanOrEqual(1);
  }

  const clippedPin = isKnownFailure(surface, "clipped", viewport.width);
  if (clipped.length > 0 && clippedPin) {
    console.warn(
      `KNOWN FAILURE (pinned): ${label} has clipped controls. ${clippedPin}`
    );
  } else {
    if (clipped.length === 0 && clippedPin) {
      console.warn(
        `PINNED ENTRY NOW PASSING: ${label} clipped controls. Remove it from smoke-known-failures.json.`
      );
    }
    expect
      .soft(
        clipped,
        `${label}: action controls clipped by the viewport edge (RUN-68 class)`
      )
      .toEqual([]);
  }
}

/* --------------------------------------------------------------------------
 * STATIC SWEEP: every reachable member URL x every width.
 * ------------------------------------------------------------------------ */

for (const viewport of VIEWPORTS) {
  for (const [groupName, surfaces] of Object.entries(SURFACE_GROUPS)) {
    test(`${groupName} render clean at ${viewport.name} (${viewport.width}px)`, async ({
      browser,
    }) => {
      const { context, page, consoleErrors } = await openMemberContext(
        browser,
        viewport
      );

      for (const surface of surfaces) {
        await page.goto(surface, { waitUntil: "load" });

        // Reachable: still on the surface (not bounced to /login, /pricing,
        // /welcome, or /legal) and the page landmark rendered.
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

        await assertScreenClean(page, surface, viewport);
      }

      // Silent console across the whole sweep.
      expect
        .soft(consoleErrors, `console/page errors at ${viewport.name}`)
        .toEqual([]);

      await context.close();
    });
  }
}

/* --------------------------------------------------------------------------
 * STATEFUL SWEEP: the in-flow states the register's worst bugs lived on.
 * One test per width drives the real flows end to end and asserts at each
 * checkpoint. localStorage (the live session) is context-scoped, so each
 * width starts clean.
 * ------------------------------------------------------------------------ */

for (const viewport of VIEWPORTS) {
  test(`in-flow states render clean at ${viewport.name} (${viewport.width}px)`, async ({
    browser,
  }) => {
    const { context, page, consoleErrors } = await openMemberContext(
      browser,
      viewport
    );

    // --- Live workout: start empty, PENDING session screen.
    await page.goto("/workouts");
    await page
      .getByRole("button", { name: /start an empty workout/i })
      .first()
      .click();
    await page.waitForURL("**/workouts/active**");
    await assertScreenClean(page, "flow:workout-session-pending", viewport);

    // --- Exercise picker, entered MID-FLOW from the session.
    await page
      .getByRole("button", { name: "Add your first exercise" })
      .click();
    await page.waitForURL("**/exercises/pick**");
    await assertScreenClean(page, "flow:exercise-picker-mid-flow", viewport);
    await page
      .getByRole("button", { name: /Barbell Bench Press/i })
      .first()
      .click();
    await page.getByRole("button", { name: /Add 1 exercise to/i }).click();
    await page.waitForURL("**/workouts/active**", { timeout: 15_000 });

    // --- ENGAGED session: Play pressed, one set logged.
    await page
      .getByRole("button", { name: "Start the workout timer" })
      .click();
    await page.getByLabel(/Weight in lb for set 1/).fill("100");
    await page.getByLabel(/Reps for set 1/).fill("5");
    await page.getByRole("button", { name: /Log set 1 .* as done/ }).click();
    await assertScreenClean(page, "flow:workout-session-engaged", viewport);

    // --- Full page loads WITH the live session persisted (CI-8): the mini
    //     bar, resume card, and player render from localStorage state the
    //     server never saw, so these pages must hydrate without errors.
    await page.goto("/workouts", { waitUntil: "load" });
    await assertScreenClean(page, "flow:workouts-reload-mid-session", viewport);
    await page.goto("/workouts/active", { waitUntil: "load" });
    await assertScreenClean(page, "flow:player-reload-mid-session", viewport);

    // --- Finish dialog OPEN.
    await page.getByRole("button", { name: "Finish", exact: true }).click();
    const dialog = page.locator('[role="alertdialog"]').last();
    await expect(dialog).toBeVisible();
    await assertScreenClean(page, "flow:finish-dialog-open", viewport);

    // --- Workout COMPLETE (the ?new=1 celebration view of history/[id]).
    await dialog.getByRole("button", { name: "Finish and save" }).click();
    await page.waitForURL("**/workouts/history/**", { timeout: 30_000 });
    await expect(
      page.getByText(/workout complete/i).first()
    ).toBeVisible({ timeout: 15_000 });
    await assertScreenClean(page, "flow:workout-complete", viewport);

    // --- Hydration logging overlay OPEN.
    await page.goto("/hydration");
    await page.getByRole("button", { name: "Log water" }).first().click();
    await expect(page.locator('[role="dialog"]').last()).toBeVisible();
    await assertScreenClean(page, "flow:hydration-log-overlay", viewport);
    await page.keyboard.press("Escape");

    // --- Sleep logging overlay OPEN ("Log last night" on a fresh account;
    //     "Edit last night" once logged).
    await page.goto("/sleep");
    await page
      .getByRole("button", { name: /(Log|Edit) last night/ })
      .first()
      .click();
    await expect(page.locator('[role="dialog"]').last()).toBeVisible();
    await assertScreenClean(page, "flow:sleep-log-overlay", viewport);
    await page.keyboard.press("Escape");

    expect
      .soft(
        consoleErrors,
        `console/page errors during in-flow sweep at ${viewport.name}`
      )
      .toEqual([]);

    await context.close();
  });
}
