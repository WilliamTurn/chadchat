/**
 * OVERLAY PLATFORM BEHAVIOR CHECKS (P2-D, FIX-17 evidence).
 *
 * Drives http://localhost:3600/dev/fixtures/overlays with node Playwright and
 * asserts the motion-interaction overlay laws (no input auto-focus, focus
 * trap, escape-to-close + return-focus, mobile bottom-sheet shape, destructive
 * confirm naming, undo persistence, draft preservation). Emits PASS/FAIL with
 * the measured value per check and captures frozen-animation screenshots.
 *
 * Usage: node scripts/overlay-checks.mjs   (run from inside chadchat/)
 *        node scripts/overlay-checks.mjs --toasts-only
 *          re-runs ONLY the toast checks (5d, 6) plus the undo-toast evidence
 *          screenshot; prints results without rewriting behavior-checks.md.
 * Assumes a dev server ALREADY running at :3600. Does not start/kill servers.
 */

import { mkdirSync } from "node:fs";
import { writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const BASE = "http://localhost:3600";
const URL = `${BASE}/dev/fixtures/overlays`;
const OUT =
  "C:/Users/jon17/Desktop/chadlatest/audits/dashboard-overhaul-2026-07-11/evidence-p2d";
const RUN_DATE = "2026-07-12";

mkdirSync(OUT, { recursive: true });

const results = [];
const shots = [];

function record(id, desc, pass, value) {
  results.push({ id, desc, pass, value });
  const tag = pass ? "PASS" : "FAIL";
  console.log(`[${tag}] ${id}  ${desc}  ::  ${value}`);
}

async function step(id, desc, fn) {
  try {
    const { pass, value } = await fn();
    record(id, desc, pass, value);
  } catch (e) {
    record(id, desc, false, `ERROR: ${String(e.message).split("\n")[0]}`);
  }
}

const INPUT_TAGS = ["input", "textarea", "select"];

async function activeTag(page) {
  return page.evaluate(
    () => document.activeElement?.tagName?.toLowerCase() ?? "none"
  );
}

async function focusInside(page, sel) {
  return page.evaluate((s) => {
    const c = document.querySelector(s);
    return !!(c && c.contains(document.activeElement));
  }, sel);
}

async function makeContext(browser, { width, height, theme, touch = false }) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    hasTouch: touch,
    colorScheme: theme,
  });
  await ctx.addInitScript((t) => {
    try {
      localStorage.setItem("theme", t);
    } catch {}
  }, theme);
  return ctx;
}

async function freeze(page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        caret-color: transparent !important;
      }
      nextjs-portal { display: none !important; }
    `,
  });
}

async function shot(ctx, { open, waitSel, settle = 0, name }) {
  const page = await ctx.newPage();
  try {
    await page.goto(`${URL}?open=${open}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(waitSel, { state: "visible", timeout: 10000 });
    if (settle) await page.waitForTimeout(settle);
    await freeze(page);
    await page.screenshot({ path: `${OUT}/${name}` });
    shots.push(name);
    console.log(`[shot] ${name}`);
  } catch (e) {
    console.log(`[shot FAIL] ${name} :: ${String(e.message).split("\n")[0]}`);
  } finally {
    await page.close();
  }
}

const DESC_5D = "confirm action: Delete weigh-in -> success toast";
const DESC_6 = "quick-add Undo toast appears and persists 5.2s";

/* 5d. confirm action -> success toast (shared by full run and --toasts-only) */
async function check5d(page) {
  await page.locator("[data-testid=open-confirm]").click();
  await page.waitForSelector("[data-slot=alert-dialog-content]", {
    state: "visible",
  });
  await page.locator("[data-slot=alert-dialog-action]").click();
  const appeared = await page
    .locator("[data-sonner-toast]")
    .first()
    .waitFor({ state: "visible", timeout: 4000 })
    .then(() => true)
    .catch(() => false);
  const count = await page.locator("[data-sonner-toast]").count();
  return { pass: appeared, value: `sonner toast visible=${appeared}, count=${count}` };
}

/* 6. Undo toast persists >= 5s (shared). Optionally captures an evidence
 * screenshot at the 5.2s mark, while the toast is confirmed still visible. */
async function check6(page, { shotName } = {}) {
  // make sure any prior overlay is closed
  await page.keyboard.press("Escape").catch(() => {});
  await page.locator("[data-testid=open-undo]").click();
  const undoSel = '[data-sonner-toast]:has-text("Undo")';
  const appeared = await page
    .locator(undoSel)
    .first()
    .waitFor({ state: "visible", timeout: 4000 })
    .then(() => true)
    .catch(() => false);
  const undoBtn = await page
    .locator('[data-sonner-toast] button:has-text("Undo")')
    .count();
  await page.waitForTimeout(5200);
  const stillVisible = await page
    .locator(undoSel)
    .first()
    .isVisible()
    .catch(() => false);
  if (shotName && stillVisible) {
    await freeze(page);
    await page.screenshot({ path: `${OUT}/${shotName}` });
    shots.push(shotName);
    console.log(`[shot] ${shotName}`);
  }
  return {
    pass: appeared && undoBtn > 0 && stillVisible,
    value: `appeared=${appeared}, undoButtons=${undoBtn}, visibleAfter5.2s=${stillVisible}`,
  };
}

/* Re-run only the toast checks (5d, 6) after the Toaster mount fix; prints
 * results and captures undo-toast-1440-dark.png, leaves the md alone. */
async function runToastsOnly() {
  const browser = await chromium.launch();
  const deskDark = await makeContext(browser, {
    width: 1440,
    height: 900,
    theme: "dark",
  });
  const page = await deskDark.newPage();
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-testid=open-quicklog]", { state: "visible" });

  await step("5d", DESC_5D, () => check5d(page));
  // let the 5d success toast expire so it cannot mask check 6's undo toast
  await page
    .waitForSelector("[data-sonner-toast]", { state: "hidden", timeout: 6000 })
    .catch(() => {});
  await step("6", DESC_6, () =>
    check6(page, { shotName: "undo-toast-1440-dark.png" })
  );

  await page.close();
  await deskDark.close();
  await browser.close();

  const passCount = results.filter((r) => r.pass).length;
  console.log(
    `\n=== TOASTS-ONLY SUMMARY: ${passCount} PASS / ${results.length - passCount} FAIL of ${results.length} ===`
  );
}

async function run() {
  const browser = await chromium.launch();

  /* =============================== DESKTOP 1440x900 (dark) =============== */
  const deskDark = await makeContext(browser, {
    width: 1440,
    height: 900,
    theme: "dark",
  });
  const page = await deskDark.newPage();
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-testid=open-quicklog]", { state: "visible" });

  /* 1. quicklog: no input auto-focused */
  await step("1", "quicklog dialog: no input auto-focused", async () => {
    await page.locator("[data-testid=open-quicklog]").click();
    await page.waitForSelector("[data-slot=dialog-content]", {
      state: "visible",
    });
    const tag = await activeTag(page);
    return { pass: !INPUT_TAGS.includes(tag), value: `activeElement=<${tag}>` };
  });

  /* 2. focus trap: 15 Tabs stay inside dialog-content */
  await step("2", "focus trap: 15 Tabs stay inside dialog", async () => {
    let inside = 0;
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press("Tab");
      if (await focusInside(page, "[data-slot=dialog-content]")) inside++;
    }
    return { pass: inside === 15, value: `${inside}/15 tabs kept focus inside` };
  });

  /* 3. Escape closes + focus returns to trigger */
  await step("3", "Escape closes dialog + focus returns to trigger", async () => {
    await page.keyboard.press("Escape");
    await page
      .waitForSelector("[data-slot=dialog-content]", {
        state: "hidden",
        timeout: 3000,
      })
      .catch(() => {});
    const closed =
      (await page.locator("[data-slot=dialog-content]").count()) === 0;
    const focusReturned = await page
      .waitForFunction(
        () =>
          document.activeElement ===
          document.querySelector("[data-testid=open-quicklog]"),
        { timeout: 2000 }
      )
      .then(() => true)
      .catch(() => false);
    return {
      pass: closed && focusReturned,
      value: `closed=${closed}, focusOnTrigger=${focusReturned}`,
    };
  });

  /* 4. side sheet: no input focus, escape closes, focus returns */
  await step("4", "side sheet: opens right, no input focus, escape+return", async () => {
    await page.locator("[data-testid=open-sheet]").click();
    await page.waitForSelector("[data-slot=sheet-content]", {
      state: "visible",
    });
    const side = await page.getAttribute(
      "[data-slot=sheet-content]",
      "data-side"
    );
    const tag = await activeTag(page);
    const noInput = !INPUT_TAGS.includes(tag);
    await page.keyboard.press("Escape");
    await page
      .waitForSelector("[data-slot=sheet-content]", {
        state: "hidden",
        timeout: 3000,
      })
      .catch(() => {});
    const closed =
      (await page.locator("[data-slot=sheet-content]").count()) === 0;
    const focusReturned = await page
      .waitForFunction(
        () =>
          document.activeElement ===
          document.querySelector("[data-testid=open-sheet]"),
        { timeout: 2000 }
      )
      .then(() => true)
      .catch(() => false);
    return {
      pass: side === "right" && noInput && closed && focusReturned,
      value: `side=${side}, activeElement=<${tag}>, closed=${closed}, focusOnTrigger=${focusReturned}`,
    };
  });

  /* 5. destructive confirm: naming, cancel, action -> success toast */
  await step("5a", "confirm dialog: title names the object", async () => {
    await page.locator("[data-testid=open-confirm]").click();
    await page.waitForSelector("[data-slot=alert-dialog-content]", {
      state: "visible",
    });
    const title =
      (await page.locator("[data-slot=alert-dialog-title]").textContent()) ?? "";
    return {
      pass: title.includes("Delete the Jul 6 weigh-in of 205.8 lb?"),
      value: `title="${title.trim()}"`,
    };
  });
  await step("5b", "confirm dialog: description states consequence", async () => {
    const desc =
      (await page
        .locator("[data-slot=alert-dialog-description]")
        .textContent()) ?? "";
    return {
      pass: desc.includes("This will update your weight trend."),
      value: `description="${desc.trim()}"`,
    };
  });
  await step("5c", "confirm dialog: Escape cancels (closes)", async () => {
    await page.keyboard.press("Escape");
    await page
      .waitForSelector("[data-slot=alert-dialog-content]", {
        state: "hidden",
        timeout: 3000,
      })
      .catch(() => {});
    const closed =
      (await page.locator("[data-slot=alert-dialog-content]").count()) === 0;
    return { pass: closed, value: `closed=${closed}` };
  });
  await step("5d", DESC_5D, () => check5d(page));

  /* 6. quick-add Undo toast persists >= 5s */
  await step("6", DESC_6, () => check6(page));

  await page.close();

  /* desktop dark screenshots */
  await shot(deskDark, {
    open: "quicklog",
    waitSel: "[data-slot=dialog-content]",
    name: "quicklog-open-1440-dark.png",
  });
  await shot(deskDark, {
    open: "confirm",
    waitSel: "[data-slot=alert-dialog-content]",
    name: "confirm-open-1440-dark.png",
  });
  await shot(deskDark, {
    open: "sheet",
    waitSel: "[data-slot=sheet-content]",
    name: "sheet-open-1440-dark.png",
  });
  await deskDark.close();

  /* =============================== MOBILE 390x844 (dark, touch) ========== */
  const mobDark = await makeContext(browser, {
    width: 390,
    height: 844,
    theme: "dark",
    touch: true,
  });
  const m = await mobDark.newPage();
  await m.goto(URL, { waitUntil: "domcontentloaded" });
  // wait until the AdaptiveDialog has switched to the Drawer (mobile) branch
  await m.waitForSelector(
    "[data-testid=open-quicklog][data-slot=drawer-trigger]",
    { state: "visible", timeout: 8000 }
  );

  /* 7. bottom sheet shape + no input focus + close btn + sticky footer + full-width primary */
  await step("7", "mobile bottom sheet: shape/focus/close/sticky/full-width primary", async () => {
    await m.locator("[data-testid=open-quicklog]").click();
    await m.waitForSelector("[data-slot=drawer-content]", { state: "visible" });
    await m.waitForTimeout(600); // vaul spring settle

    const radius = await m.evaluate(
      () =>
        getComputedStyle(
          document.querySelector("[data-slot=drawer-content]")
        ).borderTopLeftRadius
    );
    const tag = await activeTag(m);
    const noInput = !INPUT_TAGS.includes(tag);
    const closeBtns = await m
      .locator("[data-slot=drawer-content] [data-slot=drawer-close]")
      .count();
    const footerPos = await m.evaluate(() => {
      const f = document.querySelector("[data-slot=drawer-footer]");
      return f ? getComputedStyle(f).position : "none";
    });
    const btn = m
      .locator('[data-slot=drawer-content] button:has-text("Add water")')
      .first();
    const box = await btn.boundingBox();
    const h = box ? Math.round(box.height) : 0;
    const w = box ? Math.round(box.width) : 0;

    const pass =
      radius === "20px" &&
      noInput &&
      closeBtns >= 1 &&
      footerPos === "sticky" &&
      h >= 44 &&
      w >= 300;
    return {
      pass,
      value: `radius=${radius}, activeElement=<${tag}>, closeBtns=${closeBtns}, footerPos=${footerPos}, primary=${w}x${h}`,
    };
  });

  /* 8. Escape closes the sheet */
  await step("8", "mobile bottom sheet: Escape closes", async () => {
    await m.keyboard.press("Escape");
    const closed = await m
      .waitForSelector("[data-slot=drawer-content]", {
        state: "hidden",
        timeout: 3000,
      })
      .then(() => true)
      .catch(() => false);
    const count = await m.locator("[data-slot=drawer-content]").count();
    return { pass: closed || count === 0, value: `closed=${closed || count === 0}` };
  });

  /* 9. draft preservation across dismissal */
  await step("9", "mobile edit: draft survives Escape dismissal", async () => {
    await m.locator("[data-testid=open-edit]").click();
    await m.waitForSelector("[data-slot=drawer-content]", { state: "visible" });
    await m.waitForTimeout(400);
    const input = m.locator("[data-testid=edit-hours]");
    await input.click();
    await input.fill("");
    await input.fill("9.25");
    await m.keyboard.press("Escape");
    await m
      .waitForSelector("[data-slot=drawer-content]", {
        state: "hidden",
        timeout: 3000,
      })
      .catch(() => {});
    await m.locator("[data-testid=open-edit]").click();
    await m.waitForSelector("[data-slot=drawer-content]", { state: "visible" });
    await m.waitForTimeout(400);
    const val = await m.locator("[data-testid=edit-hours]").inputValue();
    return { pass: val === "9.25", value: `reopened value="${val}"` };
  });

  await m.close();

  /* mobile dark screenshots */
  await shot(mobDark, {
    open: "quicklog",
    waitSel: "[data-slot=drawer-content]",
    settle: 600,
    name: "quicklog-open-390-dark.png",
  });
  await shot(mobDark, {
    open: "edit",
    waitSel: "[data-slot=drawer-content]",
    settle: 600,
    name: "edit-open-390-dark.png",
  });
  await shot(mobDark, {
    open: "confirm",
    waitSel: "[data-slot=alert-dialog-content]",
    name: "confirm-open-390-dark.png",
  });
  await mobDark.close();

  /* =============================== LIGHT-THEME SCREENSHOTS =============== */
  const mobLight = await makeContext(browser, {
    width: 390,
    height: 844,
    theme: "light",
    touch: true,
  });
  await shot(mobLight, {
    open: "quicklog",
    waitSel: "[data-slot=drawer-content]",
    settle: 600,
    name: "quicklog-open-390-light.png",
  });
  await mobLight.close();

  const deskLight = await makeContext(browser, {
    width: 1440,
    height: 900,
    theme: "light",
  });
  await shot(deskLight, {
    open: "confirm",
    waitSel: "[data-slot=alert-dialog-content]",
    name: "confirm-open-1440-light.png",
  });
  await deskLight.close();

  await browser.close();

  /* =============================== REPORT ================================ */
  const passCount = results.filter((r) => r.pass).length;
  const failCount = results.length - passCount;

  const rows = results
    .map(
      (r) =>
        `| ${r.id} | ${r.desc} | ${r.pass ? "PASS" : "FAIL"} | ${String(
          r.value
        ).replace(/\|/g, "\\|")} |`
    )
    .join("\n");
  const shotList = shots.map((s) => `- ${s}`).join("\n");

  const md = `# Overlay platform behavior checks (P2-D, FIX-17)

- Run date: ${RUN_DATE}
- Server URL: ${URL}
- Script: chadchat/scripts/overlay-checks.mjs
- Result: ${passCount} PASS / ${failCount} FAIL (of ${results.length} checks)

## Checks

| # | Check | Result | Measured value |
| --- | --- | --- | --- |
${rows}

## Screenshots captured (evidence-p2d/, frozen animations)

${shotList}
`;

  writeFileSync(`${OUT}/behavior-checks.md`, md, "utf8");

  console.log(
    `\n=== SUMMARY: ${passCount} PASS / ${failCount} FAIL of ${results.length} ===`
  );
  console.log(`Report: ${OUT}/behavior-checks.md`);
  console.log(`Screenshots: ${shots.length} captured`);
}

const main = process.argv.includes("--toasts-only") ? runToastsOnly : run;
main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
