import { chromium } from "@playwright/test";

const BASE = "http://localhost:3600";

// Fresh login to get a valid session cookie.
const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.goto(BASE + "/login", { waitUntil: "networkidle" });
await page.waitForSelector('input[type="email"]', { timeout: 10000 });
const form = page.locator("form", { has: page.locator('input[type="email"]') }).first();
await form.locator('input[type="email"]').fill("claude-testing@example.com");
await form.locator('input[type="password"]').fill("12345678");
await form.locator('input[type="password"]').press("Enter");
let ok = false;
for (let i = 0; i < 20; i++) {
  await page.waitForTimeout(1000);
  const cookies = await ctx.cookies();
  if (cookies.find((c) => /session-token/i.test(c.name))) { ok = true; break; }
}
const cookies = await ctx.cookies();
await ctx.close();
await browser.close();

const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

// 6 PARALLEL GET /workouts, no prior warm request.
const results = await Promise.all(
  Array.from({ length: 6 }, () =>
    fetch(BASE + "/workouts", { headers: { cookie: cookieHeader }, redirect: "manual" })
      .then((r) => ({ status: r.status }))
      .catch((e) => ({ error: String(e) }))
  )
);

console.log(JSON.stringify({ authed: ok, cookieCount: cookies.length, responses: results }, null, 2));
