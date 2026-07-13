/**
 * P34-Z GATE-04 support (item 6): live water-goal change on the Pro test
 * account, proving the FIX-07 append-only target funnel end-to-end via the UI.
 * MUTATES the claude-testing account's water goal, then restores it. The
 * append-only version rows are intentionally left as evidence.
 *   node scripts/p34z-gate03-water-goal.mjs
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3600";
const SHOTS = "C:/Users/jon17/Desktop/chadlatest/chadchat/evidence-p34z/gate03";
mkdirSync(SHOTS, { recursive: true });
const EMAIL = "claude-testing@example.com";
const PASSWORD = "12345678";

const log = (m) => console.log(m);

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });

  // login
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  const fill = async (sel, val) => { for (let i = 0; i < 5; i++) { await page.fill(sel, val); await page.waitForTimeout(200); if ((await page.inputValue(sel)) === val) return; } };
  await fill('input[type="email"]', EMAIL);
  await fill('input[type="password"]', PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForTimeout(3500);
  await page.goto(`${BASE}/hydration`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  log(`URL after login+nav: ${page.url()}`);

  const openGoal = async () => {
    await page.getByRole("button", { name: "Edit daily hydration goal" }).click();
    await page.waitForTimeout(500);
    return page.getByRole("textbox", { name: "Daily hydration goal in ounces" });
  };
  const errorToastCount = async () =>
    page.locator('[data-sonner-toast][data-type="error"], li[role="status"]:has-text("couldn\'t"), li:has-text("Try again")').count();

  // --- read original ---
  let input = await openGoal();
  const originalOz = (await input.inputValue()).trim();
  log(`ORIGINAL goal (oz, seeded from resolved goal): ${originalOz}`);
  const newOz = String(Number(originalOz) === 100 ? 90 : 100);

  // --- change to a slightly different value ---
  await input.fill(newOz);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.waitForTimeout(2500);
  const closedAfterChange = (await page.getByRole("textbox", { name: "Daily hydration goal in ounces" }).count()) === 0;
  const errAfterChange = await errorToastCount();
  log(`CHANGE to ${newOz} oz -> popover closed=${closedAfterChange}, errorToast=${errAfterChange}`);
  await page.screenshot({ path: `${SHOTS}/item6-goal-changed.png` });

  // --- reload cold, confirm the page reflects the new value ---
  await page.goto(`${BASE}/hydration`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  input = await openGoal();
  const reflectedOz = (await input.inputValue()).trim();
  log(`AFTER RELOAD seeded goal (should reflect the saved change): ${reflectedOz} oz (expected ${newOz})`);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);

  // --- restore original ---
  input = await openGoal();
  await input.fill(originalOz);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.waitForTimeout(2500);
  const closedAfterRestore = (await page.getByRole("textbox", { name: "Daily hydration goal in ounces" }).count()) === 0;
  const errAfterRestore = await errorToastCount();
  log(`RESTORE to ${originalOz} oz -> popover closed=${closedAfterRestore}, errorToast=${errAfterRestore}`);

  // --- verify restored value ---
  await page.goto(`${BASE}/hydration`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  input = await openGoal();
  const finalOz = (await input.inputValue()).trim();
  log(`FINAL seeded goal (should equal original ${originalOz}): ${finalOz} oz`);

  await ctx.close();
  await browser.close();

  log(`\nCONSOLE ERRORS during item 6: ${[...new Set(consoleErrors)].length} unique`);
  for (const e of [...new Set(consoleErrors)]) log(`  - ${e.slice(0, 200)}`);
  log(`\nSUMMARY: original=${originalOz}oz changed=${newOz}oz reflected=${reflectedOz}oz restored=${finalOz}oz; changeSaved=${closedAfterChange && !errAfterChange}; restoreSaved=${closedAfterRestore && !errAfterRestore}`);
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
