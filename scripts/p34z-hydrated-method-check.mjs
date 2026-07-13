import { chromium } from "@playwright/test";

const BASE = "http://localhost:3601";

// Read the live DOM form's method attribute (JS enabled -> form is rendered).
async function domMethod(browser, path, query = "") {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(BASE + path + query, { waitUntil: "networkidle" });
  await page.waitForSelector("form", { timeout: 8000 }).catch(() => {});
  const info = await page.evaluate(() => {
    const f = document.querySelector("form");
    if (!f) return { formPresent: false };
    return {
      formPresent: true,
      // .method normalizes to lowercase 'get'/'post'; attribute is the raw value
      methodProp: f.method,
      methodAttr: f.getAttribute("method"),
      actionAttr: f.getAttribute("action"),
    };
  });
  await ctx.close();
  return { path: path + query, ...info };
}

// Real Pro-account login regression, clicking the credentials submit button only.
async function realLogin(browser) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const reqUrls = [];
  page.on("request", (r) => reqUrls.push(r.url()));
  await page.goto(BASE + "/login", { waitUntil: "networkidle" });
  await page.waitForSelector("form", { timeout: 8000 });
  await page.locator('input[type="email"], input[name="email"]').first().fill("claude-testing@example.com");
  await page.locator('input[type="password"]').first().fill("12345678");
  // Click the submit button INSIDE the form (the "Sign in" credentials button),
  // never the Google button which sits outside the <form>.
  await page.locator('form button[type="submit"]').first().click();
  let landed = page.url();
  try {
    await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 20000 });
    landed = page.url();
  } catch {
    landed = page.url();
  }
  await page.waitForTimeout(2000);
  const finalUrl = page.url();
  // Confirm authenticated: fetch a known authed route content marker.
  const onLogin = finalUrl.includes("/login");
  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 400)).catch(() => "");
  // Leak check: no request URL should carry the password.
  const leaked = reqUrls.filter((u) => u.includes("12345678") || u.toLowerCase().includes("claude-testing"));
  await ctx.close();
  return { finalUrl, landedFirst: landed, authenticated: !onLogin, leakedRequestUrls: leaked, bodyPreview: bodyText };
}

const browser = await chromium.launch();
const out = {};
out.login = await domMethod(browser, "/login");
out.register = await domMethod(browser, "/register");
out.forgot = await domMethod(browser, "/forgot-password");
out.reset = await domMethod(browser, "/reset-password", "?token=probe-token-123");
out.realLogin = await realLogin(browser);
await browser.close();
console.log(JSON.stringify(out, null, 2));
