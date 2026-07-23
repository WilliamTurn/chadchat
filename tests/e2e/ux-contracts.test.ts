/**
 * UX CONTRACT GATE (S0b-2, 2026-07-22).
 *
 * The canon's cross-cutting behavioral laws, asserted mechanically. Sibling
 * to interaction-contracts.test.ts: that file gates the flaws register's
 * named TRAP CLASSES, this one gates the CANON PRINCIPLES that no single
 * defect report owns. Both run under `pnpm test:contracts`.
 *
 * House style is unchanged: one test per contract CLASS, driven on the
 * SHARED component wherever a shared component owns the behavior, asserting
 * invariants (it confirms, it keeps the data, it comes back) and never
 * styling, so the tests survive a design-system change.
 *
 *   1. Dialog conventions      canon 01 destructive actions + dialog layout
 *   2. Selection commit        canon 01 commit models
 *   3. Empty-state contract    canon 03 empty states
 *   4. Pending state           canon 03 section 2 + canon 06 perceived perf
 *   5. Focus contract          canon 01 keyboard/focus + canon 05
 *   6. Error keeps data        canon 03 error anatomy + copy.ts
 *   7. URL state               canon 02 section 5
 *   8. Draft persistence       canon 03 drafts and state persistence
 *
 * The axe accessibility sweep (canon 05) is the ninth contract of this wave
 * and lives in surface-smoke.test.ts, because it belongs on every surface at
 * every width rather than on one shared component.
 *
 * PINS. Where a contract exposed a pre-existing PRODUCT defect, the test is
 * written to the contract and pinned with `test.fail()` plus a comment naming
 * the defect. S0b-2 was authorized to gate, not to fix; the pin is the
 * ratchet, and Playwright fails the run the moment a pinned test starts
 * passing, which is when it gets promoted to a plain test (exactly how the
 * RC-1 wave promoted SYS-15/16).
 *
 * Fixture-driven tests need no auth (dev-only pages); the member-flow tests
 * provision a Pro user the same way surface-smoke.test.ts does.
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

/** The owner's phone is about 384px; 390 keeps this suite aligned with the
 *  sibling contract file. Contracts that differ by presentation (the
 *  AdaptiveDialog swaps Dialog for a Drawer under 768px) assert BOTH. */
const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 800 };

let storageState: Awaited<ReturnType<BrowserContext["storageState"]>>;
/** The provisioned credentials, replayed by the post-login deep-link leg. */
let memberEmail: string;
let memberPassword: string;

test.beforeAll(async ({ browser }, workerInfo) => {
  memberEmail = `uxcontract-${Date.now()}-w${workerInfo.workerIndex}@playwright.com`;
  memberPassword = `Aa1-${Math.random().toString(36).slice(2, 12)}`;

  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/register");
  await page.getByLabel("Email").fill(memberEmail);
  await page.getByLabel("Password", { exact: true }).fill(memberPassword);
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill(memberPassword);
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
      WHERE email = ${memberEmail}
      RETURNING id
    `;
    if (updated.length !== 1) {
      throw new Error(`ux-contract setup: provisioning failed for ${memberEmail}`);
    }
  } finally {
    await sql.end();
  }

  storageState = await context.storageState();
  await context.close();
});

async function openPage(
  browser: Browser,
  {
    authed = false,
    viewport = PHONE,
  }: { authed?: boolean; viewport?: { width: number; height: number } } = {}
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    ...(authed ? { storageState } : {}),
    viewport,
  });
  return { context, page: await context.newPage() };
}

/* --------------------------------------------------------------------------
 * 1. DIALOG CONVENTIONS (canon 01 destructive actions; the "Keep lifting"
 *    flaw class, where a dialog's confirming action sat where Cancel belongs
 *    and carried the focus ring).
 *
 * Driven on the two shared dialog primitives via the overlay fixture, so one
 * test covers every surface that composes them:
 *   - ConfirmActionDialog (ui/confirm-undo)    the destructive confirmation
 *   - AdaptiveDialog      (ui/adaptive-dialog) the short-form overlay, which
 *     is a centered Dialog on desktop and a vaul Drawer under 768px, so both
 *     presentations are asserted.
 *
 * The geometry rule is presentation-independent on purpose: a confirming
 * action is correctly placed if it sits to the RIGHT of the dismiss control,
 * or ABOVE it when the footer stacks. Comparing bounding boxes lets the same
 * assertion hold through a layout change.
 * ------------------------------------------------------------------------ */

type Placement = "side-by-side" | "stacked";

/** Which way a footer laid itself out, from the two controls' geometry. */
async function placementOf(
  dismiss: Locator,
  confirm: Locator
): Promise<{ placement: Placement; ok: boolean; detail: string }> {
  const a = await dismiss.boundingBox();
  const b = await confirm.boundingBox();
  if (!(a && b)) {
    throw new Error("dialog footer controls have no box");
  }
  // Stacked when the two boxes share no vertical band.
  const stacked = a.y + a.height <= b.y + 1 || b.y + b.height <= a.y + 1;
  if (stacked) {
    return {
      placement: "stacked",
      ok: b.y < a.y,
      detail: `stacked: confirm.y=${Math.round(b.y)} dismiss.y=${Math.round(a.y)}`,
    };
  }
  return {
    placement: "side-by-side",
    ok: b.x > a.x,
    detail: `side-by-side: confirm.x=${Math.round(b.x)} dismiss.x=${Math.round(a.x)}`,
  };
}

/** The four-part contract, run against one open dialog. */
async function assertDialogConventions(
  page: Page,
  overlay: Locator,
  {
    label,
    confirmName,
    destructive,
  }: { label: string; confirmName: RegExp; destructive: boolean }
): Promise<void> {
  // Everything below is scoped to the ACTION ROW, not the whole overlay.
  // Every dialog presentation also ships a corner X whose accessible name is
  // "Close"; that X is a convenience, never the labeled dismiss the
  // convention asks for, and matching it would let a dialog pass this gate
  // with no worded way out at all.
  const footer = overlay.locator(
    '[data-slot="dialog-footer"], [data-slot="drawer-footer"], [data-slot="alert-dialog-footer"]'
  );
  await expect(footer, `${label}: no action row`).toHaveCount(1);

  // (a) A worded dismiss control exists, named "Cancel" (or "Close" for an
  //     info-only dialog). Never a themed line, never a bare X alone.
  const cancel = footer.getByRole("button", { name: "Cancel", exact: true });
  const close = footer.getByRole("button", { name: "Close", exact: true });
  const dismissCount = (await cancel.count()) + (await close.count());
  expect(
    dismissCount,
    `${label}: the action row has no Cancel/Close control`
  ).toBeGreaterThan(0);
  const dismiss = (await cancel.count()) > 0 ? cancel.first() : close.first();

  const confirm = footer.getByRole("button", { name: confirmName });
  await expect(confirm, `${label}: no confirming action`).toHaveCount(1);

  // (b) Placement: right of the dismiss, or above it when stacked.
  const geometry = await placementOf(dismiss, confirm);
  expect(
    geometry.ok,
    `${label}: the confirming action must sit right of Cancel (or above it when stacked) - ${geometry.detail}`
  ).toBe(true);

  // (c) A destructive action carries the destructive style, so it never reads
  //     as the ordinary way forward.
  if (destructive) {
    await expect(
      confirm,
      `${label}: the destructive action must use the destructive variant`
    ).toHaveAttribute("data-variant", "destructive");
  }

  // (d) Initial focus is never parked on the destructive action: a stray
  //     Enter must not delete anything.
  const confirmFocused = await confirm.evaluate(
    (el) => document.activeElement === el
  );
  expect(
    confirmFocused,
    `${label}: initial focus sits on the confirming action; the SAFE action is the default`
  ).toBe(false);
}

for (const viewport of [PHONE, DESKTOP]) {
  const widthLabel = `${viewport.width}px`;

  test(`shared dialogs name a dismiss control, place the confirm correctly, and never focus the destructive action @ ${widthLabel}`, async ({
    browser,
  }) => {
    const { context, page } = await openPage(browser, { viewport });
    await page.goto("/dev/fixtures/overlays");

    // The destructive confirmation.
    await page.getByTestId("open-confirm").click();
    const alert = page.getByRole("alertdialog");
    await expect(alert).toBeVisible({ timeout: 15_000 });
    await assertDialogConventions(page, alert, {
      label: `ConfirmActionDialog @ ${widthLabel}`,
      confirmName: /^Delete weigh-in$/,
      destructive: true,
    });
    await alert.getByRole("button", { name: "Cancel" }).click();
    await expect(alert).toHaveCount(0, { timeout: 10_000 });

    // The workouts feature's OWN confirmation primitive
    // (components/workouts/v2/confirm). It does not compose ui/confirm-undo,
    // so until S0c fixtured it (defect D6) it was the one confirmation class
    // in the app this contract could not see - and it is the dialog every
    // destructive workout action goes through.
    await page.getByTestId("open-workouts-confirm").click();
    const workoutsAlert = page.getByRole("alertdialog");
    await expect(workoutsAlert).toBeVisible({ timeout: 15_000 });
    await assertDialogConventions(page, workoutsAlert, {
      label: `workouts ConfirmDialog @ ${widthLabel}`,
      confirmName: /^Delete exercise$/,
      destructive: true,
    });
    await workoutsAlert.getByRole("button", { name: "Cancel" }).click();
    await expect(workoutsAlert).toHaveCount(0, { timeout: 10_000 });

    // The short-form overlay. Non-destructive, so only the dismiss control,
    // the placement, and the focus rule apply.
    await page.getByTestId("open-quicklog").click();
    const quicklog = page.getByRole("dialog").last();
    await expect(quicklog).toBeVisible({ timeout: 15_000 });
    await assertDialogConventions(page, quicklog, {
      label: `AdaptiveDialog @ ${widthLabel}`,
      confirmName: /^Add water$/,
      destructive: false,
    });
    await quicklog.getByRole("button", { name: "Cancel" }).click();

    await context.close();
  });
}

/* --------------------------------------------------------------------------
 * 2. SELECTION COMMIT (canon 01 commit models).
 *
 * A control that changes a value either applies INSTANTLY with the result
 * visible where the member is looking, or takes an explicit Save whose press
 * produces visible confirmation. The banned third option is the silent
 * auto-close: the overlay disappears and the member is left guessing whether
 * anything was written. Driven on the shared AdaptiveDialog, which owns the
 * commit model for every short-form overlay in the app.
 *
 * TODO (S6): add the live rest-picker as a second case once the S6
 * "options-menu flows" wave has merged. S6 redesigns that picker, so gating
 * it now would gate a surface that is about to change; the shared primitive
 * underneath it is what this test locks down in the meantime.
 * ------------------------------------------------------------------------ */

/** Sonner renders every toast as [data-sonner-toast]; counting them is how a
 *  test proves feedback was, or was NOT, produced. */
function toasts(page: Page): Locator {
  return page.locator("[data-sonner-toast]");
}

test("a shared overlay's save produces visible confirmation, and dismissing it commits nothing (canon 01)", async ({
  browser,
}) => {
  const { context, page } = await openPage(browser);
  await page.goto("/dev/fixtures/overlays");

  // --- Explicit Save: the press must yield a visible, concrete receipt.
  await page.getByTestId("open-quicklog").click();
  const quicklog = page.getByRole("dialog").last();
  await expect(quicklog).toBeVisible({ timeout: 15_000 });
  await quicklog.getByRole("button", { name: "24 oz" }).click();
  await quicklog.getByRole("button", { name: "Add water" }).click();

  // Closed AND receipted. A close with no receipt is the silent auto-close.
  await expect(quicklog).toBeHidden({ timeout: 10_000 });
  await expect(
    page.getByText(/Added 24 oz\./i),
    "an explicit Save must confirm what it wrote"
  ).toBeVisible({ timeout: 10_000 });

  // --- Dismiss: closes, writes nothing, says nothing. A receipt here would
  //     mean the overlay committed a value the member cancelled.
  await expect
    .poll(() => toasts(page).count(), { timeout: 20_000 })
    .toBe(0);
  await page.getByTestId("open-edit").click();
  const edit = page.getByRole("dialog").last();
  await expect(edit).toBeVisible({ timeout: 15_000 });
  await edit.getByTestId("edit-hours").fill("9.25");
  await edit.getByRole("button", { name: "Cancel" }).click();
  await expect(edit).toBeHidden({ timeout: 10_000 });
  await page.waitForTimeout(1000);
  expect(
    await toasts(page).count(),
    "Cancel must not produce a receipt: nothing was committed"
  ).toBe(0);

  // --- And the same overlay's real Save does receipt.
  await page.getByTestId("open-edit").click();
  const edit2 = page.getByRole("dialog").last();
  await expect(edit2).toBeVisible({ timeout: 15_000 });
  await edit2.getByRole("button", { name: "Save sleep entry" }).click();
  await expect(edit2).toBeHidden({ timeout: 10_000 });
  await expect(
    page.getByText(/Sleep entry updated/i),
    "an explicit Save must confirm what it wrote"
  ).toBeVisible({ timeout: 10_000 });

  await context.close();
});

/* --------------------------------------------------------------------------
 * 3. EMPTY-STATE CONTRACT (canon 03 empty states; the "Exercise not found"
 *    dead-end class).
 *
 * Every empty state says WHY it is empty and offers the action that FILLS
 * it, and never strands the member without a way back. Asserted structurally
 * rather than against exact strings, so the copy can change without breaking
 * the gate: inside <main> there must be a real sentence of explanation and at
 * least one enabled action control that is not the back link.
 *
 * The list surfaces below are the SURFACE_GROUPS entries that render a
 * collection and are genuinely empty for a freshly provisioned member.
 * ------------------------------------------------------------------------ */

const EMPTY_LIST_SURFACES = [
  "/workouts/history",
  "/workouts/cardio",
  "/goals",
  "/plans",
  "/files",
  "/progress/body",
] as const;

type EmptyStateReading = {
  explanation: string | null;
  actions: string[];
  hasWayBack: boolean;
};

/** Reads the empty region the way a member sees it: what does it TELL me,
 *  and what can I DO from here? */
async function readEmptyState(page: Page): Promise<EmptyStateReading> {
  return await page.evaluate(() => {
    const main = document.querySelector("main");
    if (!main) {
      return { explanation: null, actions: [], hasWayBack: false };
    }
    const heading = main.querySelector("h1")?.textContent?.trim() ?? "";

    // Explanation: a leaf text block of real sentence length that is not the
    // page title. A heading alone ("No workouts") says what, never why.
    let explanation: string | null = null;
    for (const el of main.querySelectorAll<HTMLElement>(
      "p, li, span, div"
    )) {
      if (el.children.length > 0) {
        continue;
      }
      const text = (el.textContent ?? "").trim();
      if (text.length < 30 || text === heading) {
        continue;
      }
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) {
        continue;
      }
      explanation = text.slice(0, 120);
      break;
    }

    // Actions: enabled, visible, member-facing controls inside main. The
    // labeled back control is excluded - it is the way BACK, never the action
    // that fills the empty state.
    const actions: string[] = [];
    for (const el of main.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], [role="button"]:not([aria-disabled="true"])'
    )) {
      const name = (
        el.getAttribute("aria-label") ||
        el.textContent ||
        ""
      ).trim();
      if (!name || /^Back to /i.test(name)) {
        continue;
      }
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) {
        continue;
      }
      if (getComputedStyle(el).visibility === "hidden") {
        continue;
      }
      actions.push(name.slice(0, 60));
    }

    // A way back: the labeled back control, or the primary nav.
    const hasWayBack =
      Boolean(main.querySelector('a[href], button')) &&
      (Array.from(main.querySelectorAll("a, button")).some((el) =>
        /^Back to /i.test((el.textContent ?? "").trim())
      ) ||
        Boolean(document.querySelector('nav[aria-label="Primary"]')));

    return { explanation, actions, hasWayBack };
  });
}

test("every empty list surface explains itself and offers the action that fills it (canon 03)", async ({
  browser,
}) => {
  const { context, page } = await openPage(browser, { authed: true });

  for (const surface of EMPTY_LIST_SURFACES) {
    await page.goto(surface, { waitUntil: "load" });
    await expect(page.locator("main").first()).toBeVisible({
      timeout: 30_000,
    });
    await page.waitForLoadState("networkidle").catch(() => {
      // Some pages never go idle; proceed.
    });

    const reading = await readEmptyState(page);

    expect
      .soft(
        reading.explanation,
        `${surface}: the empty state never says WHY it is empty (no explanatory sentence in <main>)`
      )
      .not.toBeNull();
    expect
      .soft(
        reading.actions,
        `${surface}: the empty state offers no action that would fill it`
      )
      .not.toEqual([]);
    expect
      .soft(
        reading.hasWayBack,
        `${surface}: the empty state strands the member with no way back`
      )
      .toBe(true);
  }

  await context.close();
});

/* --------------------------------------------------------------------------
 * 4. PENDING STATE (canon 03 section 22 + canon 06 perceived performance).
 *
 * Driven on the shared Button primitive (ui/button.tsx) through the forms
 * fixture's live 2-second demo, which is a deterministic slow action with no
 * network in the loop - the same shape a route-intercepted request would
 * produce, without the flakiness of intercepting one.
 *
 * Three parts, split across two tests so the passing half stays a hard gate:
 *   a) it responds within ~100ms of the press (aria-busy / disabled),
 *   b) it re-enables when the work completes,
 *   c) it KEEPS ITS LABEL while busy - see the pinned test below.
 * ------------------------------------------------------------------------ */

/** Milliseconds between the pointerdown and the button reporting itself busy,
 *  measured in-page so the Playwright round trip is not counted. */
async function pressResponseMs(page: Page, button: Locator): Promise<number> {
  const measured = button.evaluate(
    (el: HTMLElement) =>
      new Promise<number>((resolve) => {
        let pressedAt = -1;
        el.addEventListener(
          "pointerdown",
          () => {
            pressedAt = performance.now();
          },
          { once: true }
        );
        const observer = new MutationObserver(() => {
          if (
            el.getAttribute("aria-busy") === "true" ||
            (el as HTMLButtonElement).disabled
          ) {
            observer.disconnect();
            resolve(pressedAt < 0 ? -1 : performance.now() - pressedAt);
          }
        });
        observer.observe(el, { attributes: true });
        setTimeout(() => {
          observer.disconnect();
          resolve(-1);
        }, 5000);
      })
  );
  await button.click();
  return await measured;
}

test("a shared button reports itself busy within 100ms and re-enables when the work finishes (canon 03 section 2)", async ({
  browser,
}) => {
  const { context, page } = await openPage(browser);
  await page.goto("/dev/fixtures/forms");

  const button = page
    .getByTestId("buttons-live-demo")
    .getByRole("button", { name: "Save entry" });
  await expect(button).toBeVisible({ timeout: 30_000 });

  const responseMs = await pressResponseMs(page, button);
  expect(
    responseMs,
    "the button never reported a busy state at all: a press with no immediate feedback reads as a dead control"
  ).toBeGreaterThanOrEqual(0);
  expect(
    responseMs,
    `the pressed/busy state took ${Math.round(responseMs)}ms to appear; a press must acknowledge itself immediately`
  ).toBeLessThanOrEqual(100);

  // aria-busy is the part a screen reader hears (canon 05).
  await expect(button).toHaveAttribute("aria-busy", "true");

  // And it comes back. A button that stays disabled after its work is done
  // is the stranded-member failure the register keeps finding.
  await expect(button, "the button must re-enable once the work completes").toBeEnabled({
    timeout: 15_000,
  });
  await expect(button).not.toHaveAttribute("aria-busy", "true");

  await context.close();
});

/**
 * Canon 03 s22: "A button doing async work keeps its label and adds a spinner
 * - it never turns into a bare spinner. Replacing the label removes the
 * context exactly when it matters."
 *
 * Pinned by S0b-2 as a product defect (D1/D2): ui/button.tsx hid the label
 * behind `opacity-0` and overlaid a centered Spinner, so a SIGHTED member saw
 * a bare spinner and lost the one piece of context saying what was in flight,
 * while the workouts-feature WButton did it the canon way but shipped no
 * aria-busy. Each primitive had exactly the half the other was missing.
 * Unified and promoted to a plain test by S0c on the owner ruling of
 * 2026-07-23: BOTH primitives now keep the label, add an inline spinner, and
 * set aria-busy.
 */
test("a shared button keeps its label visible while busy (canon 03 section 22)", async ({
  browser,
}) => {
  const { context, page } = await openPage(browser);
  await page.goto("/dev/fixtures/forms");

  const button = page
    .getByTestId("buttons-live-demo")
    .getByRole("button", { name: "Save entry" });
  await expect(button).toBeVisible({ timeout: 30_000 });
  await button.click();
  await expect(button).toHaveAttribute("aria-busy", "true");

  // The label must still be READABLE, not merely present in the a11y tree.
  const labelOpacity = await button.evaluate((el) => {
    for (const span of el.querySelectorAll<HTMLElement>("span")) {
      if ((span.textContent ?? "").trim() === "Save entry") {
        return Number.parseFloat(getComputedStyle(span).opacity);
      }
    }
    // No wrapper span means the label is rendered directly: fully visible.
    return Number.parseFloat(getComputedStyle(el).opacity);
  });
  expect(
    labelOpacity,
    "the label must stay visible while the button is busy; a bare spinner drops the context"
  ).toBeGreaterThan(0.5);

  await context.close();
});

/* --------------------------------------------------------------------------
 * 5. FOCUS CONTRACT (canon 01 keyboard and focus; canon 05).
 *
 * Every overlay class: opening moves focus INSIDE the overlay, Escape closes
 * it, and closing RETURNS focus to the trigger that opened it. Without the
 * return leg a keyboard or screen-reader member is dumped at the top of the
 * document and has to re-walk the page.
 *
 * Extends the SYS-03 (chart tooltip) and SYS-04 (explainer popover) Escape
 * coverage in the sibling suites to the full overlay set: the dialog, the
 * alert dialog, and the side sheet, at both presentations of the adaptive
 * dialog.
 * ------------------------------------------------------------------------ */

async function assertFocusContract(
  page: Page,
  {
    label,
    triggerTestId,
    overlay,
  }: { label: string; triggerTestId: string; overlay: () => Locator }
): Promise<void> {
  const trigger = page.getByTestId(triggerTestId);
  await expect(trigger).toBeVisible({ timeout: 30_000 });
  await trigger.click();

  const content = overlay();
  await expect(content, `${label}: never opened`).toBeVisible({
    timeout: 15_000,
  });

  // Focus moved inside the overlay.
  const focusInside = await content.evaluate((el) =>
    el.contains(document.activeElement)
  );
  expect(
    focusInside,
    `${label}: focus stayed outside the overlay on open`
  ).toBe(true);

  // Escape closes it.
  await page.keyboard.press("Escape");
  await expect(content, `${label}: Escape did not close it`).toBeHidden({
    timeout: 10_000,
  });

  // And focus came home to the trigger.
  await expect
    .poll(
      () => trigger.evaluate((el) => document.activeElement === el),
      {
        timeout: 10_000,
        message: `${label}: focus was not returned to the trigger on close`,
      }
    )
    .toBe(true);
}

for (const viewport of [PHONE, DESKTOP]) {
  const widthLabel = `${viewport.width}px`;

  test(`every overlay class traps focus, closes on Escape, and returns focus to its trigger @ ${widthLabel}`, async ({
    browser,
  }) => {
    const { context, page } = await openPage(browser, { viewport });
    await page.goto("/dev/fixtures/overlays");

    // The short-form overlay: a centered Dialog at desktop, a vaul Drawer on
    // a phone. Two implementations, one contract.
    await assertFocusContract(page, {
      label: `AdaptiveDialog @ ${widthLabel}`,
      triggerTestId: "open-quicklog",
      overlay: () => page.getByRole("dialog").last(),
    });

    // The destructive confirmation.
    await assertFocusContract(page, {
      label: `ConfirmActionDialog @ ${widthLabel}`,
      triggerTestId: "open-confirm",
      overlay: () => page.getByRole("alertdialog"),
    });

    // The workouts feature's own confirmation. It is hand-rolled rather than
    // composed from a Radix primitive, so it gets none of the focus behavior
    // for free - the S0c flow audit found it took no focus at all and let Tab
    // walk straight through the scrim into the live page behind it. Gated
    // here now that the fixture exists.
    await assertFocusContract(page, {
      label: `workouts ConfirmDialog @ ${widthLabel}`,
      triggerTestId: "open-workouts-confirm",
      overlay: () => page.getByRole("alertdialog"),
    });

    // The read-mostly side sheet.
    await assertFocusContract(page, {
      label: `Sheet @ ${widthLabel}`,
      triggerTestId: "open-sheet",
      overlay: () => page.getByRole("dialog").last(),
    });

    await context.close();
  });
}

/* --------------------------------------------------------------------------
 * 6. ERROR KEEPS DATA (canon 03 error anatomy; the `errors-keep-data` law in
 *    lib/contracts/copy.ts, written but until now untested).
 *
 * A rejected submit must leave every typed value exactly where it was, show a
 * readable error that does not blame the member, and let them try again. The
 * refusal is driven for real rather than mocked: the custom-exercise action
 * refuses a duplicate name (exercise identity is the NAME everywhere
 * downstream), so submitting the same name twice produces a genuine
 * server-side rejection with the member's data in the form.
 * ------------------------------------------------------------------------ */

/** Names that must never carry the whole weight of an error message: a bare
 *  one of these tells the member nothing and offers no way forward. */
const USELESS_ERRORS =
  /^(error|something went wrong|failed|oops|invalid|try again)\.?$/i;

test("a refused submit keeps every typed value, explains itself, and allows a retry (canon 03)", async ({
  browser,
}) => {
  const { context, page } = await openPage(browser, { authed: true });

  const exerciseName = `Contract Lift ${Date.now()}`;
  const notes = "Seat height 4, elbows tucked.";

  // Create it once so the second attempt is a genuine refusal.
  await page.goto("/workouts/exercises/new");
  // `.first()` throughout this file's custom-exercise legs (S0c): a repeat
  // `goto` to this route during a cold compile can transiently resolve to two
  // copies of the field, which is a navigation artifact rather than the
  // behavior under test. See the S0c closing report.
  const nameField = page
    .getByPlaceholder("Enter the name of your exercise")
    .first();
  await expect(nameField).toBeVisible({ timeout: 30_000 });
  await nameField.fill(exerciseName);
  await page.getByRole("button", { name: "Save exercise" }).click();
  await page.waitForURL("**/workouts/exercises**", { timeout: 30_000 });

  // Now the refusal, with a full form of the member's typing in it.
  await page.goto("/workouts/exercises/new");
  await expect(nameField).toBeVisible({ timeout: 30_000 });
  await nameField.fill(exerciseName);
  await page
    .getByPlaceholder("Machine settings, cues, anything to remember")
    .fill(notes);
  const save = page.getByRole("button", { name: "Save exercise" });
  await save.click();

  // (a) An error the member can act on. Not a bare "Error".
  const errorToast = page.locator("[data-sonner-toast]").first();
  await expect(
    errorToast,
    "a refused submit must say something"
  ).toBeVisible({ timeout: 20_000 });
  const errorText = ((await errorToast.textContent()) ?? "").trim();
  expect(
    errorText.length,
    `the error message is too short to be actionable: "${errorText}"`
  ).toBeGreaterThan(20);
  expect(
    USELESS_ERRORS.test(errorText),
    `the error message says nothing the member can act on: "${errorText}"`
  ).toBe(false);

  // (b) Every typed value is still there. This is the whole law.
  await expect(
    nameField,
    "the refused submit lost the member's typed name"
  ).toHaveValue(exerciseName);
  await expect(
    page.getByPlaceholder("Machine settings, cues, anything to remember"),
    "the refused submit lost the member's typed notes"
  ).toHaveValue(notes);

  // (c) Still on the form, and the retry is available.
  expect(new URL(page.url()).pathname).toBe("/workouts/exercises/new");
  await expect(
    save,
    "the member cannot retry: the submit control never re-enabled"
  ).toBeEnabled({ timeout: 15_000 });

  await context.close();
});

/**
 * Canon 03 error anatomy; copy.ts `errors-keep-data`.
 *
 * The refusal path above was always handled: the action RETURNS {ok:false}
 * and the form toasts it. The THROWN path was not - pinned by S0b-2 as
 * defect D3. `handleSave` in components/workouts/v2/custom-exercise-form.tsx
 * awaited the server action with no try/catch, so when the request itself
 * failed (offline, dropped connection, a 500 from the action route) the
 * rejection escaped, `setSaving(false)` never ran, and the member was left
 * with a Save button spinning forever and no error at all. S0c wrapped both
 * of the form's async handlers and promoted this to a plain test.
 */
test("a submit that fails on the network still explains itself and allows a retry (canon 03)", async ({
  browser,
}) => {
  const { context, page } = await openPage(browser, { authed: true });

  await page.goto("/workouts/exercises/new");
  const nameField = page
    .getByPlaceholder("Enter the name of your exercise")
    .first();
  await expect(nameField).toBeVisible({ timeout: 30_000 });
  const typedName = `Offline Lift ${Date.now()}`;
  await nameField.fill(typedName);

  // Kill only the server-action POST, leaving navigation and assets alone.
  await page.route("**/workouts/exercises/new*", async (route) => {
    if (route.request().method() === "POST") {
      await route.abort("failed");
      return;
    }
    await route.fallback();
  });

  const save = page.getByRole("button", { name: "Save exercise" });
  await save.click();

  await expect(
    page.locator("[data-sonner-toast]").first(),
    "a failed request must tell the member it failed"
  ).toBeVisible({ timeout: 20_000 });
  await expect(
    save,
    "the member cannot retry: the submit control never re-enabled"
  ).toBeEnabled({ timeout: 20_000 });
  // And the law's other half: the typed value survived the failure.
  await expect(
    nameField,
    "the failed request lost the member's typed name"
  ).toHaveValue(typedName);

  await context.close();
});

/* --------------------------------------------------------------------------
 * 7. URL STATE (canon 02 section 5).
 *
 * Two legs. The first is the one most apps get right: a filter selection
 * lives in the URL, so a refresh, a bookmark, and a shared link all restore
 * the same view. The second is the near-universally-violated one: a member
 * who deep-links while logged out must land on the screen they ASKED for
 * after signing in, not be dumped on the home dashboard having lost their
 * destination.
 * ------------------------------------------------------------------------ */

test("a filter selection survives a refresh (canon 02 section 5)", async ({
  browser,
}) => {
  const { context, page } = await openPage(browser, { authed: true });

  await page.goto("/workouts/exercises");
  const chestTab = page.getByRole("tab", { name: "Chest" });
  await expect(chestTab).toBeVisible({ timeout: 30_000 });
  await chestTab.click();

  // The selection is in the URL, in canonical form (the default is omitted).
  await expect(page).toHaveURL(/[?&]muscle=chest/, { timeout: 10_000 });

  // And a refresh restores it, filtered view and all.
  await page.reload({ waitUntil: "load" });
  await expect(
    page.getByRole("tab", { name: "Chest" }),
    "the filter did not survive a refresh"
  ).toHaveAttribute("aria-selected", "true", { timeout: 30_000 });
  await expect(
    page.getByRole("tab", { name: "All muscles" })
  ).toHaveAttribute("aria-selected", "false");

  await context.close();
});

test("a deep link followed while logged out lands on the requested screen after login (canon 02 section 5)", async ({
  browser,
}) => {
  // Deliberately unauthenticated: this is the cold-link case.
  const { context, page } = await openPage(browser, { authed: false });

  await page.goto("/reports");
  await expect(
    page,
    "a logged-out deep link must route through login"
  ).toHaveURL(/\/login/, { timeout: 30_000 });

  await page.getByLabel("Email").fill(memberEmail);
  await page.getByLabel("Password", { exact: true }).fill(memberPassword);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(
    page,
    "login discarded the destination and dumped the member on the dashboard"
  ).toHaveURL(/\/reports(?:$|\?)/, { timeout: 60_000 });

  await context.close();
});

/* --------------------------------------------------------------------------
 * 8. DRAFT PERSISTENCE (canon 03 drafts and state persistence).
 *
 * Two pieces of shared draft machinery exist, and both are gated here:
 *   - useOverlayDraft (ui/adaptive-dialog): short-form overlay state survives
 *     an accidental dismissal, so Escape or a backdrop tap never costs the
 *     member their typing.
 *   - the live-workout store (workouts/v2/store): mirrored to localStorage,
 *     so a workout note survives leaving the runner and coming back.
 *
 * What does NOT exist is draft machinery for full-PAGE forms; the pinned test
 * at the end of this block states that contract and marks the gap.
 * ------------------------------------------------------------------------ */

test("an overlay draft survives an accidental dismissal (canon 03)", async ({
  browser,
}) => {
  const { context, page } = await openPage(browser);
  await page.goto("/dev/fixtures/overlays");

  await page.getByTestId("open-edit").click();
  const edit = page.getByRole("dialog").last();
  await expect(edit).toBeVisible({ timeout: 15_000 });
  await edit.getByTestId("edit-hours").fill("9.25");

  // Escape is the accident: a swipe-dismiss or a backdrop tap is the same
  // event to the overlay.
  await page.keyboard.press("Escape");
  await expect(edit).toBeHidden({ timeout: 10_000 });

  await page.getByTestId("open-edit").click();
  const reopened = page.getByRole("dialog").last();
  await expect(reopened).toBeVisible({ timeout: 15_000 });
  await expect(
    reopened.getByTestId("edit-hours"),
    "the dismissal lost the member's typing"
  ).toHaveValue("9.25");

  await context.close();
});

test("a workout note survives leaving the runner and coming back (canon 03)", async ({
  browser,
}) => {
  const { context, page } = await openPage(browser, { authed: true });
  const note = "Right knee twinged on set 2.";

  // A live session with one exercise: the Finish dialog owns the note field.
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

  const noteField = page.getByPlaceholder(
    "Add a note about how this workout went"
  );
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  await expect(noteField).toBeVisible({ timeout: 15_000 });
  await noteField.fill(note);

  // Back out of the dialog, leave the runner entirely, and return.
  // The Finish dialog's dismiss reads "Keep lifting", not "Cancel": the
  // workouts-feature ConfirmDialog is a SECOND confirm primitive that does
  // not compose ui/confirm-undo, and its themed dismiss label is already
  // grandfathered in the design-lint baseline (rule `dialog-dismiss-label`,
  // S0b-1). Matching both keeps this draft contract green through the wave
  // that renames it.
  await page
    .locator('[role="alertdialog"]')
    .last()
    .getByRole("button", { name: /^(Cancel|Keep lifting)$/ })
    .click();
  await page.goto("/workouts", { waitUntil: "load" });
  await page.goto("/workouts/active", { waitUntil: "load" });

  await page.getByRole("button", { name: "Finish", exact: true }).click();
  await expect(
    noteField,
    "the workout note did not survive leaving the runner"
  ).toHaveValue(note, { timeout: 15_000 });

  await context.close();
});

/**
 * PINNED GAP - no draft machinery for full-page forms (S0b-2, canon 03
 * drafts and state persistence).
 *
 * useOverlayDraft covers short-form OVERLAYS and the workout store covers the
 * live session, but a full-PAGE form holds its values in plain component
 * state: components/workouts/v2/custom-exercise-form.tsx keeps name, muscle
 * group, equipment, kind, and notes in useState with nothing behind them. A
 * member who follows a link, checks a reference, or is bounced by an incoming
 * call loses everything they typed with no warning and no recovery.
 *
 * Guardrails cannot test what has not been built, so this test states the
 * contract and pins the absence. S0b-2 was authorized to gate, not to build;
 * see the closing report. Promote it to a plain test in the change that gives
 * full-page forms a draft store.
 */
test.fail(
  "a full-page form draft survives navigating away and back (canon 03)",
  async ({ browser }) => {
    const { context, page } = await openPage(browser, { authed: true });
    const draftName = `Draft Lift ${Date.now()}`;

    await page.goto("/workouts/exercises/new");
    const nameField = page
      .getByPlaceholder("Enter the name of your exercise")
      .first();
    await expect(nameField).toBeVisible({ timeout: 30_000 });
    await nameField.fill(draftName);
    await page
      .getByPlaceholder("Machine settings, cues, anything to remember")
      .fill("Pin 7, wide grip.");

    // Leave and come back the way a member does.
    await page.goto("/workouts/exercises", { waitUntil: "load" });
    await page.goto("/workouts/exercises/new", { waitUntil: "load" });

    await expect(
      page.getByPlaceholder("Enter the name of your exercise").first(),
      "the form lost the member's typing when they navigated away"
    ).toHaveValue(draftName, { timeout: 30_000 });

    await context.close();
  }
);
