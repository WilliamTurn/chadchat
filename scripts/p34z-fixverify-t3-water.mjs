import { chromium } from "@playwright/test";
const BASE = "http://localhost:3600";
const STATE = "scripts/.p34z-throwaway-state.json";
const evi = "evidence-p34z/fixverify";

const browser = await chromium.launch();
const ctx = await browser.newContext({ storageState: STATE });
const page = await ctx.newPage();
const errors = [], toasts = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

await page.goto(BASE + "/hydration", { waitUntil: "networkidle" });
await page.waitForTimeout(1800);

// 1) Log a glass of water -> WaterLog
await page.getByRole("button", { name: /Add a glass of water/i }).first().click();
await page.waitForTimeout(1500);

// 2) Edit daily hydration goal -> UserTargetVersion
await page.getByRole("button", { name: /Edit daily hydration goal/i }).first().click();
await page.waitForTimeout(800);
await page.screenshot({ path: `${evi}/t3-04-editgoal.png`, fullPage: true });
// find a number input in the dialog and set a new goal
const num = page.locator('input[type="number"], input[inputmode="numeric"], input[inputmode="decimal"]');
const cnt = await num.count();
if (cnt > 0) {
  await num.first().fill("3000");
}
// Save button (label varies) — try common labels
const saveLabels = [/^Save$/i, /Save goal/i, /Set goal/i, /Update/i, /^Done$/i];
let saved = false;
for (const lbl of saveLabels) {
  const b = page.getByRole("button", { name: lbl }).first();
  if (await b.count() && await b.isVisible().catch(() => false)) { await b.click(); saved = true; break; }
}
await page.waitForTimeout(1500);
for (let i = 0; i < 4; i++) {
  const t = await page.locator('[data-sonner-toast]').allInnerTexts().catch(() => []);
  for (const x of t) if (!toasts.includes(x)) toasts.push(x);
  await page.waitForTimeout(400);
}
await page.screenshot({ path: `${evi}/t3-05-aftergoal.png`, fullPage: true });

await ctx.close();
await browser.close();
console.log(JSON.stringify({ numInputs: cnt, saved, toasts, consoleErrors: errors }, null, 2));
