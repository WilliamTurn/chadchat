import { chromium } from "@playwright/test";

const BASE = "http://localhost:3600";
const STATE = "scripts/.p34z-state.json";
const evi = "evidence-p34z/fixverify";
const workoutId = process.argv[2];

const browser = await chromium.launch();
const ctx = await browser.newContext({ storageState: STATE });
const page = await ctx.newPage();
const errors = [];
const toasts = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

await page.goto(`${BASE}/workouts/history/${workoutId}`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${evi}/t1-04-history-detail.png`, fullPage: true });

const delBtn = page.getByRole("button", { name: /Delete this workout from your history/i }).first();
await delBtn.waitFor({ state: "visible", timeout: 10000 });
await delBtn.click();
await page.waitForTimeout(600);
const confirmBtn = page.getByRole("button", { name: /^Delete workout$/i }).first();
await confirmBtn.waitFor({ state: "visible", timeout: 10000 });
await confirmBtn.click();

// capture any error toast (sonner) for ~3s
for (let i = 0; i < 6; i++) {
  await page.waitForTimeout(500);
  const t = await page.locator('[data-sonner-toast]').allInnerTexts().catch(() => []);
  for (const x of t) if (!toasts.includes(x)) toasts.push(x);
}
await page.waitForTimeout(1000);
const finalUrl = page.url();
await page.screenshot({ path: `${evi}/t1-05-after-delete.png`, fullPage: true });

await ctx.close();
await browser.close();
console.log(JSON.stringify({ finalUrl, toasts, consoleErrors: errors }, null, 2));
