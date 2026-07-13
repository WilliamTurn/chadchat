import { chromium } from "@playwright/test";

const BASE = "http://localhost:3600";
const STATE = "scripts/.p34z-state.json";
const evi = "evidence-p34z/fixverify";

const browser = await chromium.launch();
const ctx = await browser.newContext({ storageState: STATE });
const page = await ctx.newPage();
const errors = [];
const toasts = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

await page.goto(`${BASE}/today`, { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
await page.screenshot({ path: `${evi}/t1-06-today.png`, fullPage: true });

// Confirm the seeded plan title is present
const planVisible = await page.getByText("P34-D Verification Split (safe to delete)").first().isVisible().catch(() => false);

const trash = page.getByRole("button", { name: /^Delete plan$/i }).first();
await trash.waitFor({ state: "visible", timeout: 10000 });
await trash.scrollIntoViewIfNeeded();
await trash.click();
await page.waitForTimeout(500);
const confirm = page.getByRole("button", { name: /^Delete$/ }).first();
await confirm.waitFor({ state: "visible", timeout: 8000 });
await confirm.click();

for (let i = 0; i < 8; i++) {
  await page.waitForTimeout(500);
  const t = await page.locator('[data-sonner-toast]').allInnerTexts().catch(() => []);
  for (const x of t) if (!toasts.includes(x)) toasts.push(x);
}
await page.waitForTimeout(1000);
await page.screenshot({ path: `${evi}/t1-07-after-plan-delete.png`, fullPage: true });

await ctx.close();
await browser.close();
console.log(JSON.stringify({ planVisibleBefore: planVisible, toasts, consoleErrors: errors }, null, 2));
