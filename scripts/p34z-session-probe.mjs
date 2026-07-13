import { chromium } from "@playwright/test";
const BASE = "http://localhost:3601";

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();

await page.goto(BASE + "/login", { waitUntil: "networkidle" });
await page.waitForSelector('input[type="email"]', { timeout: 8000 });
const credForm = page.locator("form", { has: page.locator('input[type="email"]') }).first();
await credForm.locator('input[type="email"]').fill("claude-testing@example.com");
await credForm.locator('input[type="password"]').fill("12345678");
await credForm.locator('input[type="password"]').press("Enter");

// wait for session cookie
let sc = null;
for (let i = 0; i < 15; i++) {
  await page.waitForTimeout(1000);
  const cs = await ctx.cookies();
  sc = cs.find((c) => c.name === "authjs.session-token");
  if (sc) break;
}
const allCookies = (await ctx.cookies()).map((c) => ({ name: c.name, len: (c.value || "").length, secure: c.secure, path: c.path }));

// Query the session endpoint the app itself uses
const sessRes = await page.evaluate(async () => {
  try {
    const r = await fetch("/api/auth/session", { credentials: "include" });
    return { status: r.status, body: (await r.text()).slice(0, 300) };
  } catch (e) { return { error: String(e) }; }
});

// Try authed routes
async function tryRoute(path) {
  await page.goto(BASE + path, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(1000);
  return { requested: path, landedUrl: page.url() };
}
const today = await tryRoute("/today");
const chat = await tryRoute("/");

await ctx.close();
await browser.close();
console.log(JSON.stringify({ sessionCookieLen: sc ? sc.value.length : 0, allCookies, sessRes, today, chat }, null, 2));
