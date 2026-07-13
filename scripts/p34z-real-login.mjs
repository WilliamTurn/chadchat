import { chromium } from "@playwright/test";

const BASE = "http://localhost:3601";

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
const posts = [];
page.on("response", async (r) => {
  const req = r.request();
  if (req.method() === "POST") {
    posts.push({ url: r.url(), status: r.status() });
  }
});
page.on("console", (m) => {
  if (m.type() === "error") posts.push({ consoleError: m.text() });
});

await page.goto(BASE + "/login", { waitUntil: "networkidle" });
await page.waitForSelector('input[type="email"]', { timeout: 8000 });

const credForm = page.locator("form", { has: page.locator('input[type="email"]') }).first();
await credForm.locator('input[type="email"]').fill("claude-testing@example.com");
await credForm.locator('input[type="password"]').fill("12345678");
await credForm.locator('input[type="password"]').press("Enter");

// Poll up to 20s for either navigation off /login OR a session cookie.
let sessionCookie = null;
let finalUrl = page.url();
for (let i = 0; i < 20; i++) {
  await page.waitForTimeout(1000);
  finalUrl = page.url();
  const cookies = await ctx.cookies();
  sessionCookie = cookies.find((c) => /authjs\.session-token|next-auth\.session-token|session-token/i.test(c.name));
  if (sessionCookie || !finalUrl.includes("/login")) break;
}

// If still on /login but we have a session, navigate to /today to confirm access.
let todayCheck = null;
if (sessionCookie) {
  await page.goto(BASE + "/today", { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(1500);
  todayCheck = { url: page.url(), redirectedToLogin: page.url().includes("/login") };
}

const bodyPreview = await page.evaluate(() => document.body.innerText.slice(0, 250)).catch(() => "");
await ctx.close();
await browser.close();

console.log(JSON.stringify({
  finalUrlAfterSubmit: finalUrl,
  sessionCookie: sessionCookie ? sessionCookie.name : null,
  authenticated: !!sessionCookie || !finalUrl.includes("/login"),
  todayCheck,
  postResponses: posts,
  bodyPreview,
}, null, 2));
