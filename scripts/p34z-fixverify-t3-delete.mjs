import { chromium } from "@playwright/test";
const BASE = "http://localhost:3600";
const STATE = "scripts/.p34z-throwaway-state.json";
const evi = "evidence-p34z/fixverify";

const browser = await chromium.launch();
const ctx = await browser.newContext({ storageState: STATE });
const page = await ctx.newPage();
const errors = [], toasts = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

await page.goto(BASE + "/account", { waitUntil: "networkidle" });
await page.waitForTimeout(1800);
// Scroll down to the danger zone
await page.getByRole("button", { name: /^Delete my data$/i }).first().scrollIntoViewIfNeeded();
await page.getByRole("button", { name: /^Delete my data$/i }).first().click();
await page.waitForTimeout(800);
await page.screenshot({ path: `${evi}/t3-07-delete-dialog.png`, fullPage: true });
// Type DELETE in the confirm input
const input = page.getByLabel(/Type DELETE to confirm/i).first();
await input.fill("DELETE");
await page.waitForTimeout(400);
await page.getByRole("button", { name: /Delete everything/i }).first().click();

for (let i = 0; i < 8; i++) {
  await page.waitForTimeout(500);
  const t = await page.locator('[data-sonner-toast]').allInnerTexts().catch(() => []);
  for (const x of t) if (!toasts.includes(x)) toasts.push(x);
}
await page.waitForTimeout(1000);
await page.screenshot({ path: `${evi}/t3-08-after-delete.png`, fullPage: true });
await ctx.close();
await browser.close();
console.log(JSON.stringify({ toasts, consoleErrors: errors }, null, 2));
