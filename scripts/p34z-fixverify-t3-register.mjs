import { chromium } from "@playwright/test";
const BASE = "http://localhost:3600";
const STATE = "scripts/.p34z-throwaway-state.json";
const evi = "evidence-p34z/fixverify";

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

await page.goto(BASE + "/register", { waitUntil: "networkidle" });
await page.waitForSelector('input[type="email"]', { timeout: 10000 });
await page.locator('input[type="email"]').fill("p34z-throwaway@example.com");
const pw = page.locator('input[type="password"]');
await pw.nth(0).fill("Zz9-throwaway-check");
await pw.nth(1).fill("Zz9-throwaway-check");
// consent checkbox
await page.locator('input[type="checkbox"]').first().check();
await page.screenshot({ path: `${evi}/t3-01-register.png`, fullPage: true });
await page.getByRole("button", { name: /^Sign up$/i }).first().click();

// Wait for auth cookie / redirect
let authed = false;
for (let i = 0; i < 20; i++) {
  await page.waitForTimeout(1000);
  const cookies = await ctx.cookies();
  if (cookies.find((c) => /session-token/i.test(c.name))) { authed = true; break; }
  if (!page.url().includes("/register")) { authed = true; break; }
}
await page.waitForTimeout(1500);
// Confirm access to /account
await page.goto(BASE + "/account", { waitUntil: "networkidle" }).catch(() => {});
await page.waitForTimeout(1500);
const onAccount = page.url().includes("/account") && !page.url().includes("/login");
const body = await page.evaluate(() => document.body.innerText.slice(0, 200)).catch(() => "");
await ctx.storageState({ path: STATE });
await page.screenshot({ path: `${evi}/t3-02-account.png`, fullPage: true });

await ctx.close();
await browser.close();
console.log(JSON.stringify({ authed, finalUrl: onAccount ? "/account" : "?", onAccount, bodyPreview: body, consoleErrors: errors }, null, 2));
