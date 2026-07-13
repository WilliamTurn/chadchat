import { chromium } from "@playwright/test";
const BASE = "http://localhost:3600";
const STATE = "scripts/.p34z-throwaway-state.json";
const evi = "evidence-p34z/fixverify";

const browser = await chromium.launch();
const ctx = await browser.newContext({ storageState: STATE });
const page = await ctx.newPage();
const toasts = [], errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

await page.goto(BASE + "/hydration", { waitUntil: "networkidle" });
await page.waitForTimeout(1800);
await page.getByRole("button", { name: /Edit daily hydration goal/i }).first().click();
await page.waitForTimeout(1200); // let dialog settle
const num = page.locator('input[type="number"], input[inputmode="numeric"], input[inputmode="decimal"], input[type="text"]');
await num.first().fill("96"); // 96 oz -> a distinct new goal
await page.waitForTimeout(500);
const save = page.getByRole("button", { name: /^Save$/i }).first();
await save.waitFor({ state: "visible" });
await page.waitForTimeout(800);
await save.click({ force: true }).catch(async () => { await save.click(); });
await page.waitForTimeout(2000);
for (let i = 0; i < 4; i++) {
  const t = await page.locator('[data-sonner-toast]').allInnerTexts().catch(() => []);
  for (const x of t) if (!toasts.includes(x)) toasts.push(x);
  await page.waitForTimeout(400);
}
await page.screenshot({ path: `${evi}/t3-06-goalsaved.png`, fullPage: true });
await ctx.close();
await browser.close();
console.log(JSON.stringify({ toasts, errors }, null, 2));
